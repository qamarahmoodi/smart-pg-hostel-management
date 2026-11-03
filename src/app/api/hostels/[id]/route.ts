import { NextResponse } from 'next/server';
import { query } from '@/lib/db/mysql';
import { requireAdmin } from '@/lib/auth/session';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

interface Params {
  params: { id: string };
}

// GET /api/hostels/[id] - Get details for a specific hostel
export async function GET(_request: Request, { params }: Params) {
  try {
    const hostelId = parseInt(params.id, 10);
    if (isNaN(hostelId)) {
      return NextResponse.json({ success: false, message: 'Invalid hostel ID.' }, { status: 400 });
    }

    const rows = await query<RowDataPacket[]>(
      'SELECT * FROM hostels WHERE hostel_id = ?',
      [hostelId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Hostel not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: rows[0],
    });
  } catch (err: unknown) {
    console.error('[API /api/hostels/[id] GET Error]:', err);
    return NextResponse.json(
      { success: false, message: 'Failed to retrieve hostel details.' },
      { status: 500 }
    );
  }
}

// PUT /api/hostels/[id] - Update a hostel (Admin only)
export async function PUT(request: Request, { params }: Params) {
  try {
    await requireAdmin();

    const hostelId = parseInt(params.id, 10);
    if (isNaN(hostelId)) {
      return NextResponse.json({ success: false, message: 'Invalid hostel ID.' }, { status: 400 });
    }

    const body = await request.json();
    const { hostel_name, address, contact_number } = body;

    if (!hostel_name || !address || !contact_number) {
      return NextResponse.json(
        { success: false, message: 'Hostel name, address, and contact number are required.' },
        { status: 400 }
      );
    }

    const result = await query<ResultSetHeader>(
      'UPDATE hostels SET hostel_name = ?, address = ?, contact_number = ? WHERE hostel_id = ?',
      [hostel_name.trim(), address.trim(), contact_number.trim(), hostelId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ success: false, message: 'Hostel not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: { hostel_id: hostelId, hostel_name, address, contact_number },
      message: 'Hostel updated successfully.',
    });
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json({ success: false, message: err.message }, { status: err.status });
    }
    console.error('[API /api/hostels/[id] PUT Error]:', err);
    return NextResponse.json({ success: false, message: 'Failed to update hostel.' }, { status: 500 });
  }
}

// DELETE /api/hostels/[id] - Delete a hostel (Admin only)
export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireAdmin();

    const hostelId = parseInt(params.id, 10);
    if (isNaN(hostelId)) {
      return NextResponse.json({ success: false, message: 'Invalid hostel ID.' }, { status: 400 });
    }

    const result = await query<ResultSetHeader>(
      'DELETE FROM hostels WHERE hostel_id = ?',
      [hostelId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ success: false, message: 'Hostel not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Hostel deleted successfully.',
    });
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json({ success: false, message: err.message }, { status: err.status });
    }
    console.error('[API /api/hostels/[id] DELETE Error]:', err);
    return NextResponse.json({ success: false, message: 'Failed to delete hostel.' }, { status: 500 });
  }
}
