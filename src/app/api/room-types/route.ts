import { NextResponse } from 'next/server';
import { query } from '@/lib/db/mysql';
import { RowDataPacket } from 'mysql2/promise';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const types = await query<RowDataPacket[]>(
      'SELECT room_type_id, type_name, capacity, monthly_rent FROM room_types ORDER BY room_type_id ASC'
    );

    return NextResponse.json({
      success: true,
      data: types,
    });
  } catch (err: unknown) {
    console.error('[API /api/room-types GET Error]:', err);
    return NextResponse.json(
      { success: false, message: 'Failed to retrieve room types.' },
      { status: 500 }
    );
  }
}
