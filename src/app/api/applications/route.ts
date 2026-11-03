import { NextResponse } from 'next/server';
import { query } from '@/lib/db/mysql';
import { requireAuth } from '@/lib/auth/session';
import { logActivity } from '@/lib/logger';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export const dynamic = 'force-dynamic';

// GET /api/applications - List applications (Student sees own; Admin sees all)
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    let sql = `
      SELECT 
        a.application_id,
        a.student_id,
        u.name AS student_name,
        u.email AS student_email,
        a.preferred_hostel_id,
        h.hostel_name,
        a.preferred_room_type_id,
        rt.type_name,
        rt.monthly_rent,
        rt.capacity,
        a.application_date,
        a.status,
        a.notes,
        alloc.allocation_id,
        r.room_number
      FROM applications a
      JOIN users u ON a.student_id = u.user_id
      JOIN hostels h ON a.preferred_hostel_id = h.hostel_id
      JOIN room_types rt ON a.preferred_room_type_id = rt.room_type_id
      LEFT JOIN allocations alloc ON a.application_id = alloc.application_id AND alloc.status = 'ACTIVE'
      LEFT JOIN rooms r ON alloc.room_id = r.room_id
    `;

    const conditions: string[] = [];
    const params: any[] = [];

    // Role-based scoping: Students only see their own applications
    if (user.role === 'student') {
      conditions.push('a.student_id = ?');
      params.push(user.user_id);
    }

    if (statusFilter) {
      conditions.push('a.status = ?');
      params.push(statusFilter.toUpperCase());
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY a.application_date DESC';

    const applications = await query<RowDataPacket[]>(sql, params);

    return NextResponse.json({
      success: true,
      data: applications,
      count: applications.length,
      message: 'Applications retrieved successfully.',
    });
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json({ success: false, message: err.message }, { status: err.status });
    }
    console.error('[API /api/applications GET Error]:', err);
    return NextResponse.json(
      { success: false, message: 'Failed to retrieve applications.' },
      { status: 500 }
    );
  }
}

// POST /api/applications - Submit room application (Students only)
export async function POST(request: Request) {
  try {
    const user = await requireAuth(['student']);

    const body = await request.json();
    const { preferred_hostel_id, preferred_room_type_id, notes } = body;

    if (!preferred_hostel_id || !preferred_room_type_id) {
      return NextResponse.json(
        { success: false, message: 'Preferred hostel and room type are required.' },
        { status: 400 }
      );
    }

    // Check if student already has an active allocation
    const activeAllocs = await query<RowDataPacket[]>(
      'SELECT allocation_id FROM allocations WHERE student_id = ? AND status = "ACTIVE"',
      [user.user_id]
    );

    if (activeAllocs.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'You already possess an active room allocation and cannot submit another application.',
        },
        { status: 400 }
      );
    }

    // Check if student already has a pending or approved application
    const existingApps = await query<RowDataPacket[]>(
      'SELECT application_id, status FROM applications WHERE student_id = ? AND status IN ("PENDING", "APPROVED")',
      [user.user_id]
    );

    if (existingApps.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `You already have an active application (${existingApps[0].status}) under review.`,
        },
        { status: 400 }
      );
    }

    const result = await query<ResultSetHeader>(
      `INSERT INTO applications (student_id, preferred_hostel_id, preferred_room_type_id, notes, status)
       VALUES (?, ?, ?, ?, 'PENDING')`,
      [user.user_id, preferred_hostel_id, preferred_room_type_id, notes || null]
    );

    const newAppId = result.insertId;

    // Log event in MongoDB
    await logActivity({
      action: 'APPLICATION_SUBMITTED',
      performedBy: user.user_id,
      targetType: 'application',
      targetId: newAppId,
      studentId: user.user_id,
      details: {
        preferredHostelId: preferred_hostel_id,
        preferredRoomTypeId: preferred_room_type_id,
        notes: notes || '',
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          application_id: newAppId,
          student_id: user.user_id,
          status: 'PENDING',
        },
        message: 'Application submitted successfully.',
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json({ success: false, message: err.message }, { status: err.status });
    }
    console.error('[API /api/applications POST Error]:', err);
    return NextResponse.json(
      { success: false, message: 'Failed to submit application.' },
      { status: 500 }
    );
  }
}
