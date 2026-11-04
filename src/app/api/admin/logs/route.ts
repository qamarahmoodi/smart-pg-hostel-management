import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { getActivityLogsCollection } from '@/lib/db/mongodb';
import { ensureLogIndexes, logActivity } from '@/lib/logger';
import type { Filter, Document } from 'mongodb';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/logs
 * 
 * Executes MongoDB aggregation pipelines on the `activity_logs` collection:
 * 1. Action Breakdown: $group by action, $sum count, $max lastOccurred, $sort descending.
 * 2. Daily Trends: $group by formatted date (%Y-%m-%d), count daily activity.
 * 3. Target Distribution: $group by targetType, count entities affected.
 * 4. Recent Logs: $find with optional filtering, sorted by timestamp DESC.
 * 
 * Strict Admin-only access enforced via requireAdmin().
 */
export async function GET(request: Request) {
  try {
    // 1. Enforce RBAC: Admin session required (returns 401 if unauthorized, 403 if forbidden)
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const actionFilter = searchParams.get('action');
    const targetTypeFilter = searchParams.get('targetType');
    const limitParam = parseInt(searchParams.get('limit') || '20', 10);
    const limit = Math.min(Math.max(1, isNaN(limitParam) ? 20 : limitParam), 100);

    // 2. Connect to MongoDB activity_logs collection
    const collection = await getActivityLogsCollection();

    // Ensure background indexes exist (timestamp, action, performedBy, targetType, studentId)
    try {
      await ensureLogIndexes();
    } catch {
      // Non-fatal if index check is delayed
    }

    // 3. MongoDB Aggregation Pipeline A: Event breakdown by action
    const actionSummary = await collection
      .aggregate<{ action: string; count: number; lastOccurred: Date }>([
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 },
            lastOccurred: { $max: '$timestamp' },
          },
        },
        { $sort: { count: -1 } },
        {
          $project: {
            _id: 0,
            action: '$_id',
            count: 1,
            lastOccurred: 1,
          },
        },
      ])
      .toArray();

    // 4. MongoDB Aggregation Pipeline B: Daily activity volume / trends
    const dailyTrends = await collection
      .aggregate<{ date: string; count: number }>([
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: -1 } },
        { $limit: 14 },
        {
          $project: {
            _id: 0,
            date: '$_id',
            count: 1,
          },
        },
      ])
      .toArray();

    // 5. MongoDB Aggregation Pipeline C: Target entity breakdown
    const targetSummary = await collection
      .aggregate<{ targetType: string; count: number }>([
        {
          $group: {
            _id: '$targetType',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        {
          $project: {
            _id: 0,
            targetType: '$_id',
            count: 1,
          },
        },
      ])
      .toArray();

    // 6. Total count of logged audit events
    const totalLogs = await collection.countDocuments();

    // 7. Recent logs query with optional filters
    const filter: Filter<Document> = {};
    if (actionFilter && actionFilter !== 'ALL') {
      filter.action = actionFilter;
    }
    if (targetTypeFilter && targetTypeFilter !== 'ALL') {
      filter.targetType = targetTypeFilter;
    }

    const rawRecentLogs = await collection
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    // 8. Serialize ObjectIds and Dates for clean JSON client consumption
    const recentLogs = rawRecentLogs.map((doc) => ({
      _id: doc._id.toString(),
      action: doc.action,
      performedBy: doc.performedBy,
      targetType: doc.targetType,
      targetId: doc.targetId,
      studentId: doc.studentId,
      roomId: doc.roomId,
      timestamp: doc.timestamp instanceof Date ? doc.timestamp.toISOString() : doc.timestamp,
      details: doc.details || {},
    }));

    return NextResponse.json({
      success: true,
      totalLogs,
      summary: actionSummary.map((item) => ({
        action: item.action,
        count: item.count,
        lastOccurred: item.lastOccurred instanceof Date ? item.lastOccurred.toISOString() : item.lastOccurred,
      })),
      dailyTrends,
      targetSummary,
      recentLogs,
    });
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json(
        { success: false, message: err.message },
        { status: err.status }
      );
    }
    console.error('[API /api/admin/logs GET Error]:', err);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to retrieve MongoDB activity logs.',
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/logs
 * 
 * Helper endpoint to seed realistic sample activity logs if MongoDB is empty.
 * Useful for viva demonstrations, smoke tests, and developer evaluations.
 */
export async function POST() {
  try {
    const admin = await requireAdmin();
    const collection = await getActivityLogsCollection();
    const existingCount = await collection.countDocuments();

    if (existingCount > 0) {
      return NextResponse.json({
        success: true,
        message: `Database already contains ${existingCount} activity log records.`,
        totalLogs: existingCount,
      });
    }

    // Seed realistic audit events
    const sampleEvents = [
      {
        action: 'STUDENT_REGISTERED' as const,
        performedBy: { userId: 2, email: 'rahul.sharma@example.com', role: 'student' },
        targetType: 'user' as const,
        targetId: 2,
        studentId: 2,
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        details: { name: 'Rahul Sharma', email: 'rahul.sharma@example.com' },
      },
      {
        action: 'STUDENT_REGISTERED' as const,
        performedBy: { userId: 3, email: 'priya.patel@example.com', role: 'student' },
        targetType: 'user' as const,
        targetId: 3,
        studentId: 3,
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        details: { name: 'Priya Patel', email: 'priya.patel@example.com' },
      },
      {
        action: 'APPLICATION_SUBMITTED' as const,
        performedBy: { userId: 2, email: 'rahul.sharma@example.com', role: 'student' },
        targetType: 'application' as const,
        targetId: 1,
        studentId: 2,
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 3600000),
        details: { preferredHostel: 'Greenfield Boys PG & Hostel', preferredRoomType: 'Double Sharing AC' },
      },
      {
        action: 'APPLICATION_APPROVED' as const,
        performedBy: { userId: admin.user_id, email: admin.email, role: 'admin' },
        targetType: 'application' as const,
        targetId: 1,
        studentId: 2,
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        details: { previousStatus: 'PENDING', newStatus: 'APPROVED' },
      },
      {
        action: 'ROOM_ALLOCATED' as const,
        performedBy: { userId: admin.user_id, email: admin.email, role: 'admin' },
        targetType: 'allocation' as const,
        targetId: 1,
        studentId: 2,
        roomId: 1,
        timestamp: new Date(Date.now() - 20 * 60 * 60 * 1000),
        details: {
          hostelName: 'Greenfield Boys PG & Hostel',
          roomNumber: 'G-101',
          startDate: '2026-11-01',
          allocationId: 1,
        },
      },
      {
        action: 'ROOM_STATUS_CHANGED' as const,
        performedBy: { userId: admin.user_id, email: admin.email, role: 'admin' },
        targetType: 'room' as const,
        targetId: 4,
        roomId: 4,
        timestamp: new Date(Date.now() - 10 * 60 * 60 * 1000),
        details: {
          roomNumber: 'G-202',
          previousStatus: 'AVAILABLE',
          newStatus: 'UNDER_MAINTENANCE',
          reason: 'Air conditioning servicing scheduled',
        },
      },
    ];

    for (const evt of sampleEvents) {
      await logActivity(evt);
    }

    const newCount = await collection.countDocuments();
    return NextResponse.json({
      success: true,
      message: `Successfully seeded ${sampleEvents.length} demonstration audit records into MongoDB.`,
      totalLogs: newCount,
    });
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json(
        { success: false, message: err.message },
        { status: err.status }
      );
    }
    console.error('[API /api/admin/logs POST Seed Error]:', err);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to seed demonstration logs into MongoDB.',
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
