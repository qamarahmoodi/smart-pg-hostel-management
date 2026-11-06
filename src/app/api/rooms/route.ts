import { NextResponse } from 'next/server';
import { query } from '@/lib/db/mysql';
import { requireAdmin } from '@/lib/auth/session';
import { logActivity } from '@/lib/logger';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export const dynamic = 'force-dynamic';

// GET /api/rooms - Query the room_occupancy_summary view with dynamic filters
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const hostelId = searchParams.get('hostel_id');
    const roomTypeId = searchParams.get('room_type_id');
    const occupancyStatus = searchParams.get('occupancy_status'); // 'AVAILABLE', 'FULL', 'UNDER_MAINTENANCE'
    const availableOnly = searchParams.get('available_only');
    const floor = searchParams.get('floor');
    const maxRent = searchParams.get('max_rent');

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (hostelId) {
      conditions.push('hostel_id = ?');
      params.push(parseInt(hostelId, 10));
    }

    if (roomTypeId) {
      conditions.push('room_type_id = ?');
      params.push(parseInt(roomTypeId, 10));
    }

    if (availableOnly === 'true' || availableOnly === '1') {
      conditions.push("occupancy_status = 'AVAILABLE'");
    } else if (occupancyStatus) {
      conditions.push('occupancy_status = ?');
      params.push(occupancyStatus.toUpperCase());
    }

    if (floor !== null && floor !== '') {
      conditions.push('floor = ?');
      params.push(parseInt(floor, 10));
    }

    if (maxRent) {
      conditions.push('monthly_rent <= ?');
      params.push(parseFloat(maxRent));
    }

    let sql = 'SELECT * FROM room_occupancy_summary';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY hostel_name ASC, floor ASC, room_number ASC';

    const rooms = await query<RowDataPacket[]>(sql, params);
    const formattedRooms = (rooms as any[]).map((r) => ({
      ...r,
      status: r.physical_status || r.occupancy_status || 'AVAILABLE',
    }));

    return NextResponse.json({
      success: true,
      data: formattedRooms,
      count: formattedRooms.length,
      message: 'Rooms retrieved successfully.',
    });
  } catch (err: unknown) {
    console.error('[API /api/rooms GET Error]:', err);
    return NextResponse.json(
      { success: false, message: 'Failed to retrieve rooms.' },
      { status: 500 }
    );
  }
}

// POST /api/rooms - Create a new room (Admin only)
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();

    const body = await request.json();
    const { hostel_id, room_type_id, room_number, floor = 1, status = 'AVAILABLE' } = body;

    if (!hostel_id || !room_type_id || !room_number) {
      return NextResponse.json(
        { success: false, message: 'Hostel ID, room type ID, and room number are required.' },
        { status: 400 }
      );
    }

    // Check for duplicate room number in this hostel
    const existing = await query<RowDataPacket[]>(
      'SELECT room_id FROM rooms WHERE hostel_id = ? AND room_number = ?',
      [hostel_id, room_number.trim()]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, message: `Room ${room_number} already exists in this hostel.` },
        { status: 409 }
      );
    }

    const result = await query<ResultSetHeader>(
      'INSERT INTO rooms (hostel_id, room_type_id, room_number, floor, status) VALUES (?, ?, ?, ?, ?)',
      [hostel_id, room_type_id, room_number.trim(), parseInt(floor, 10) || 1, status]
    );

    const newRoomId = result.insertId;

    // Log event in MongoDB
    await logActivity({
      action: 'ROOM_STATUS_CHANGED',
      performedBy: admin.user_id,
      targetType: 'room',
      targetId: newRoomId,
      roomId: newRoomId,
      details: {
        hostelId: hostel_id,
        roomNumber: room_number.trim(),
        initialStatus: status,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          room_id: newRoomId,
          hostel_id,
          room_type_id,
          room_number: room_number.trim(),
          floor,
          status,
        },
        message: 'Room created successfully.',
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json({ success: false, message: err.message }, { status: err.status });
    }
    console.error('[API /api/rooms POST Error]:', err);
    return NextResponse.json({ success: false, message: 'Failed to create room.' }, { status: 500 });
  }
}
