import { NextResponse } from 'next/server';
import { query } from '@/lib/db/mysql';
import { requireAuth, requireAdmin } from '@/lib/auth/session';
import { logActivity } from '@/lib/logger';
import { RowDataPacket } from 'mysql2/promise';

export const dynamic = 'force-dynamic';

// GET /api/allocations - List allocations (Role-aware: student sees own; admin sees all)
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const roomIdFilter = searchParams.get('room_id');
    const hostelIdFilter = searchParams.get('hostel_id');

    let sql = `
      SELECT 
        al.allocation_id,
        al.application_id,
        al.student_id,
        u.name AS student_name,
        u.email AS student_email,
        al.room_id,
        r.room_number,
        r.floor,
        h.hostel_id,
        h.hostel_name,
        rt.room_type_id,
        rt.type_name,
        rt.capacity,
        rt.monthly_rent,
        al.allocation_date,
        al.start_date,
        al.end_date,
        al.status
      FROM allocations al
      JOIN users u ON al.student_id = u.user_id
      JOIN rooms r ON al.room_id = r.room_id
      JOIN hostels h ON r.hostel_id = h.hostel_id
      JOIN room_types rt ON r.room_type_id = rt.room_type_id
    `;

    const conditions: string[] = [];
    const params: any[] = [];

    // Role-based scoping
    if (user.role === 'student') {
      conditions.push('al.student_id = ?');
      params.push(user.user_id);
    }

    if (statusFilter) {
      conditions.push('al.status = ?');
      params.push(statusFilter.toUpperCase());
    }

    if (roomIdFilter) {
      conditions.push('al.room_id = ?');
      params.push(parseInt(roomIdFilter, 10));
    }

    if (hostelIdFilter) {
      conditions.push('r.hostel_id = ?');
      params.push(parseInt(hostelIdFilter, 10));
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY al.allocation_date DESC';

    const allocations = await query<RowDataPacket[]>(sql, params);

    return NextResponse.json({
      success: true,
      data: allocations,
      count: allocations.length,
      message: 'Allocations retrieved successfully.',
    });
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json({ success: false, message: err.message }, { status: err.status });
    }
    console.error('[API /api/allocations GET Error]:', err);
    return NextResponse.json(
      { success: false, message: 'Failed to retrieve allocations.' },
      { status: 500 }
    );
  }
}

// POST /api/allocations - Allocate room to student application via sp_allocate_room (Admin only)
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();

    const body = await request.json();
    const { application_id, room_id, start_date } = body;

    if (!application_id || !room_id || !start_date) {
      return NextResponse.json(
        { success: false, message: 'Application ID, room ID, and start date are required.' },
        { status: 400 }
      );
    }

    const appId = parseInt(application_id, 10);
    const rId = parseInt(room_id, 10);

    // Call stored procedure sp_allocate_room with pessimistic locking
    await query(
      'CALL sp_allocate_room(?, ?, ?, @status_code, @status_message, @allocation_id)',
      [appId, rId, start_date]
    );

    const outRows = await query<RowDataPacket[]>(
      'SELECT @status_code AS code, @status_message AS msg, @allocation_id AS alloc_id'
    );

    const { code, msg, alloc_id } = outRows[0];

    // If procedure returned error code, return structured 400 response
    if (code !== 'SUCCESS') {
      return NextResponse.json(
        {
          success: false,
          code,
          message: msg || 'Room allocation failed.',
        },
        { status: 400 }
      );
    }

    // Fetch allocation details for activity log
    const detailsRows = await query<RowDataPacket[]>(
      `SELECT al.student_id, r.room_number, h.hostel_name, rt.type_name
       FROM allocations al
       JOIN rooms r ON al.room_id = r.room_id
       JOIN hostels h ON r.hostel_id = h.hostel_id
       JOIN room_types rt ON r.room_type_id = rt.room_type_id
       WHERE al.allocation_id = ?`,
      [alloc_id]
    );

    const allocDetails = detailsRows[0] || {};

    // Record activity log in MongoDB post-commit
    await logActivity({
      action: 'ROOM_ALLOCATED',
      performedBy: admin.user_id,
      targetType: 'allocation',
      targetId: alloc_id,
      studentId: allocDetails.student_id,
      roomId: rId,
      details: {
        applicationId: appId,
        hostelName: allocDetails.hostel_name,
        roomNumber: allocDetails.room_number,
        roomType: allocDetails.type_name,
        startDate: start_date,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          allocation_id: alloc_id,
          application_id: appId,
          room_id: rId,
          start_date,
        },
        message: 'Room allocated successfully.',
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json({ success: false, message: err.message }, { status: err.status });
    }
    console.error('[API /api/allocations POST Error]:', err);
    return NextResponse.json(
      { success: false, message: 'An internal server error occurred during room allocation.' },
      { status: 500 }
    );
  }
}
