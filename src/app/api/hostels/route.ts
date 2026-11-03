import { NextResponse } from 'next/server';
import { query } from '@/lib/db/mysql';
import { requireAdmin } from '@/lib/auth/session';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export const dynamic = 'force-dynamic';

// GET /api/hostels - List all hostels with summary stats
export async function GET() {
  try {
    const hostels = await query<RowDataPacket[]>(`
      SELECT 
        h.hostel_id,
        h.hostel_name,
        h.address,
        h.contact_number,
        h.created_at,
        COUNT(DISTINCT r.room_id) AS total_rooms,
        COALESCE(SUM(rt.capacity), 0) AS total_capacity,
        COUNT(DISTINCT CASE WHEN a.status = 'ACTIVE' THEN a.allocation_id END) AS occupied_beds,
        (COALESCE(SUM(rt.capacity), 0) - COUNT(DISTINCT CASE WHEN a.status = 'ACTIVE' THEN a.allocation_id END)) AS available_beds
      FROM hostels h
      LEFT JOIN rooms r ON h.hostel_id = r.hostel_id
      LEFT JOIN room_types rt ON r.room_type_id = rt.room_type_id
      LEFT JOIN allocations a ON r.room_id = a.room_id AND a.status = 'ACTIVE'
      GROUP BY h.hostel_id, h.hostel_name, h.address, h.contact_number, h.created_at
      ORDER BY h.hostel_id ASC
    `);

    return NextResponse.json({
      success: true,
      data: hostels,
      message: 'Hostels retrieved successfully.',
    });
  } catch (err: unknown) {
    console.error('[API /api/hostels GET Error]:', err);
    return NextResponse.json(
      { success: false, message: 'Failed to retrieve hostels.' },
      { status: 500 }
    );
  }
}

// POST /api/hostels - Create a new hostel (Admin only)
export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { hostel_name, address, contact_number } = body;

    if (!hostel_name || typeof hostel_name !== 'string' || hostel_name.trim().length < 2) {
      return NextResponse.json(
        { success: false, message: 'Hostel name is required (min 2 characters).' },
        { status: 400 }
      );
    }

    if (!address || typeof address !== 'string' || address.trim().length < 5) {
      return NextResponse.json(
        { success: false, message: 'Address is required (min 5 characters).' },
        { status: 400 }
      );
    }

    if (!contact_number || typeof contact_number !== 'string' || contact_number.trim().length < 6) {
      return NextResponse.json(
        { success: false, message: 'Valid contact number is required.' },
        { status: 400 }
      );
    }

    const result = await query<ResultSetHeader>(
      'INSERT INTO hostels (hostel_name, address, contact_number) VALUES (?, ?, ?)',
      [hostel_name.trim(), address.trim(), contact_number.trim()]
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          hostel_id: result.insertId,
          hostel_name: hostel_name.trim(),
          address: address.trim(),
          contact_number: contact_number.trim(),
        },
        message: 'Hostel created successfully.',
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json({ success: false, message: err.message }, { status: err.status });
    }
    console.error('[API /api/hostels POST Error]:', err);
    return NextResponse.json(
      { success: false, message: 'Failed to create hostel.' },
      { status: 500 }
    );
  }
}
