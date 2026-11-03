import { NextResponse } from 'next/server';
import { query } from '@/lib/db/mysql';
import { requireAuth, requireAdmin } from '@/lib/auth/session';
import { logActivity } from '@/lib/logger';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export const dynamic = 'force-dynamic';

interface Params {
  params: { id: string };
}

// GET /api/applications/[id] - Get details of an application (Student owner or Admin)
export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const appId = parseInt(params.id, 10);
    if (isNaN(appId)) {
      return NextResponse.json({ success: false, message: 'Invalid application ID.' }, { status: 400 });
    }

    const rows = await query<RowDataPacket[]>(
      `SELECT 
        a.*,
        u.name AS student_name,
        u.email AS student_email,
        h.hostel_name,
        rt.type_name,
        rt.monthly_rent,
        rt.capacity
       FROM applications a
       JOIN users u ON a.student_id = u.user_id
       JOIN hostels h ON a.preferred_hostel_id = h.hostel_id
       JOIN room_types rt ON a.preferred_room_type_id = rt.room_type_id
       WHERE a.application_id = ?`,
      [appId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Application not found.' }, { status: 404 });
    }

    const application = rows[0];

    // Ownership check: Students can only view their own applications
    if (user.role === 'student' && application.student_id !== user.user_id) {
      return NextResponse.json({ success: false, message: 'Access denied.' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      data: application,
    });
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json({ success: false, message: err.message }, { status: err.status });
    }
    console.error('[API /api/applications/[id] GET Error]:', err);
    return NextResponse.json({ success: false, message: 'Failed to retrieve application.' }, { status: 500 });
  }
}

// PATCH /api/applications/[id] - Review application (Approve/Reject) (Admin only)
export async function PATCH(request: Request, { params }: Params) {
  try {
    const admin = await requireAdmin();
    const appId = parseInt(params.id, 10);
    if (isNaN(appId)) {
      return NextResponse.json({ success: false, message: 'Invalid application ID.' }, { status: 400 });
    }

    const body = await request.json();
    const { status, notes } = body;

    if (!status || !['APPROVED', 'REJECTED'].includes(status.toUpperCase())) {
      return NextResponse.json(
        { success: false, message: 'Status must be updated to either APPROVED or REJECTED.' },
        { status: 400 }
      );
    }

    const targetStatus = status.toUpperCase();

    // Verify application exists and is currently PENDING
    const existing = await query<RowDataPacket[]>(
      'SELECT student_id, status FROM applications WHERE application_id = ?',
      [appId]
    );

    if (existing.length === 0) {
      return NextResponse.json({ success: false, message: 'Application not found.' }, { status: 404 });
    }

    if (existing[0].status === 'ALLOCATED') {
      return NextResponse.json(
        { success: false, message: 'Cannot modify an already ALLOCATED application.' },
        { status: 400 }
      );
    }

    const studentId = existing[0].student_id;

    // Update in MySQL
    await query<ResultSetHeader>(
      'UPDATE applications SET status = ?, notes = COALESCE(?, notes) WHERE application_id = ?',
      [targetStatus, notes || null, appId]
    );

    // Record activity log in MongoDB post-commit
    const action = targetStatus === 'APPROVED' ? 'APPLICATION_APPROVED' : 'APPLICATION_REJECTED';
    await logActivity({
      action,
      performedBy: admin.user_id,
      targetType: 'application',
      targetId: appId,
      studentId,
      details: {
        newStatus: targetStatus,
        remarks: notes || '',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        application_id: appId,
        status: targetStatus,
      },
      message: `Application ${targetStatus.toLowerCase()} successfully.`,
    });
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json({ success: false, message: err.message }, { status: err.status });
    }
    console.error('[API /api/applications/[id] PATCH Error]:', err);
    return NextResponse.json({ success: false, message: 'Failed to update application.' }, { status: 500 });
  }
}
