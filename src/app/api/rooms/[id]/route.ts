import { NextResponse } from 'next/server';
import { query } from '@/lib/db/mysql';
import { requireAdmin } from '@/lib/auth/session';
import { logActivity } from '@/lib/logger';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

interface Params {
  params: { id: string };
}

// GET /api/rooms/[id] - Get single room occupancy details
export async function GET(_request: Request, { params }: Params) {
  try {
    const roomId = parseInt(params.id, 10);
    if (isNaN(roomId)) {
      return NextResponse.json({ success: false, message: 'Invalid room ID.' }, { status: 400 });
    }

    const rows = await query<RowDataPacket[]>(
      'SELECT * FROM room_occupancy_summary WHERE room_id = ?',
      [roomId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Room not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: rows[0],
    });
  } catch (err: unknown) {
    console.error('[API /api/rooms/[id] GET Error]:', err);
    return NextResponse.json({ success: false, message: 'Failed to retrieve room.' }, { status: 500 });
  }
}

// PUT /api/rooms/[id] - Update room status or metadata (Admin only)
export async function PUT(request: Request, { params }: Params) {
  try {
    const admin = await requireAdmin();
    const roomId = parseInt(params.id, 10);
    if (isNaN(roomId)) {
      return NextResponse.json({ success: false, message: 'Invalid room ID.' }, { status: 400 });
    }

    const body = await request.json();
    const { room_number, floor, status, room_type_id } = body;

    // Get current state for audit comparison
    const current = await query<RowDataPacket[]>(
      'SELECT status, room_number FROM rooms WHERE room_id = ?',
      [roomId]
    );

    if (current.length === 0) {
      return NextResponse.json({ success: false, message: 'Room not found.' }, { status: 404 });
    }

    const prevStatus = current[0].status;

    await query<ResultSetHeader>(
      `UPDATE rooms 
       SET room_number = COALESCE(?, room_number),
           floor = COALESCE(?, floor),
           status = COALESCE(?, status),
           room_type_id = COALESCE(?, room_type_id)
       WHERE room_id = ?`,
      [room_number || null, floor || null, status || null, room_type_id || null, roomId]
    );

    // If status changed, log into MongoDB
    if (status && status !== prevStatus) {
      await logActivity({
        action: 'ROOM_STATUS_CHANGED',
        performedBy: admin.user_id,
        targetType: 'room',
        targetId: roomId,
        roomId: roomId,
        details: {
          previousStatus: prevStatus,
          newStatus: status,
          roomNumber: room_number || current[0].room_number,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Room updated successfully.',
    });
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json({ success: false, message: err.message }, { status: err.status });
    }
    console.error('[API /api/rooms/[id] PUT Error]:', err);
    return NextResponse.json({ success: false, message: 'Failed to update room.' }, { status: 500 });
  }
}

// DELETE /api/rooms/[id] - Delete a room (Admin only)
export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireAdmin();
    const roomId = parseInt(params.id, 10);
    if (isNaN(roomId)) {
      return NextResponse.json({ success: false, message: 'Invalid room ID.' }, { status: 400 });
    }

    // Check if active allocations exist
    const activeAllocs = await query<RowDataPacket[]>(
      'SELECT allocation_id FROM allocations WHERE room_id = ? AND status = "ACTIVE"',
      [roomId]
    );

    if (activeAllocs.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Cannot delete room with active occupants. Please terminate active allocations first.',
        },
        { status: 400 }
      );
    }

    const result = await query<ResultSetHeader>('DELETE FROM rooms WHERE room_id = ?', [roomId]);
    if (result.affectedRows === 0) {
      return NextResponse.json({ success: false, message: 'Room not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Room deleted successfully.',
    });
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json({ success: false, message: err.message }, { status: err.status });
    }
    console.error('[API /api/rooms/[id] DELETE Error]:', err);
    return NextResponse.json({ success: false, message: 'Failed to delete room.' }, { status: 500 });
  }
}
