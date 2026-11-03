import { NextResponse } from 'next/server';
import { query } from '@/lib/db/mysql';
import { requireAuth } from '@/lib/auth/session';
import { logActivity } from '@/lib/logger';
import { RowDataPacket } from 'mysql2/promise';

interface Params {
  params: { id: string };
}

export const dynamic = 'force-dynamic';

// POST /api/allocations/[id]/terminate - Terminate allocation via sp_terminate_allocation
export async function POST(_request: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const allocId = parseInt(params.id, 10);

    if (isNaN(allocId)) {
      return NextResponse.json({ success: false, message: 'Invalid allocation ID.' }, { status: 400 });
    }

    // Verify allocation exists and check authorization
    const allocRows = await query<RowDataPacket[]>(
      `SELECT al.allocation_id, al.student_id, al.room_id, al.status, r.room_number, h.hostel_name
       FROM allocations al
       JOIN rooms r ON al.room_id = r.room_id
       JOIN hostels h ON r.hostel_id = h.hostel_id
       WHERE al.allocation_id = ?`,
      [allocId]
    );

    if (allocRows.length === 0) {
      return NextResponse.json({ success: false, message: 'Allocation not found.' }, { status: 404 });
    }

    const alloc = allocRows[0];

    // Authorization check: Must be an admin or the occupant student
    if (user.role !== 'admin' && alloc.student_id !== user.user_id) {
      return NextResponse.json(
        { success: false, message: 'Access denied. You can only vacate your own room allocation.' },
        { status: 403 }
      );
    }

    // Execute stored procedure
    await query('CALL sp_terminate_allocation(?, @tcode, @tmsg)', [allocId]);

    const outRows = await query<RowDataPacket[]>('SELECT @tcode AS code, @tmsg AS msg');
    const { code, msg } = outRows[0];

    if (code !== 'SUCCESS') {
      return NextResponse.json(
        { success: false, code, message: msg || 'Failed to terminate allocation.' },
        { status: 400 }
      );
    }

    // Log event in MongoDB post-commit
    await logActivity({
      action: 'ALLOCATION_TERMINATED',
      performedBy: user.user_id,
      targetType: 'allocation',
      targetId: allocId,
      studentId: alloc.student_id,
      roomId: alloc.room_id,
      details: {
        hostelName: alloc.hostel_name,
        roomNumber: alloc.room_number,
        terminatedByRole: user.role,
        vacateDate: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      data: { allocation_id: allocId, status: 'TERMINATED' },
      message: 'Allocation terminated successfully. Bed marked as available.',
    });
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json({ success: false, message: err.message }, { status: err.status });
    }
    console.error('[API /api/allocations/[id]/terminate POST Error]:', err);
    return NextResponse.json(
      { success: false, message: 'An internal server error occurred during allocation termination.' },
      { status: 500 }
    );
  }
}
