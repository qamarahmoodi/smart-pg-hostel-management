if (typeof window !== 'undefined') {
  throw new Error('Security Error: Logger cannot be executed in the browser');
}

import { ObjectId } from 'mongodb';
import { getActivityLogsCollection } from '../db/mongodb';

export type ActivityAction =
  | 'STUDENT_REGISTERED'
  | 'APPLICATION_SUBMITTED'
  | 'APPLICATION_APPROVED'
  | 'APPLICATION_REJECTED'
  | 'ROOM_ALLOCATED'
  | 'ALLOCATION_TERMINATED'
  | 'ROOM_STATUS_CHANGED';

export type TargetType = 'user' | 'application' | 'allocation' | 'room' | 'hostel';

export interface ActivityLogInput {
  action: ActivityAction;
  performedBy: number | { userId: number; email?: string; role?: string };
  targetType: TargetType;
  targetId: number;
  studentId?: number;
  roomId?: number;
  timestamp?: Date;
  details?: Record<string, any>;
}

export interface ActivityLogDocument {
  _id: ObjectId;
  action: ActivityAction;
  performedBy: number | { userId: number; email?: string; role?: string };
  targetType: TargetType;
  targetId: number;
  studentId?: number;
  roomId?: number;
  timestamp: Date;
  details: Record<string, any>;
}

/**
 * Sanitizes details object to prevent passwords or sensitive tokens
 * from ever being written to MongoDB logs.
 */
function sanitizeDetails(details: Record<string, any> = {}): Record<string, any> {
  const sensitiveKeys = ['password', 'password_hash', 'passwordHash', 'token', 'secret', 'authSecret'];
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(details)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      sanitized[key] = sanitizeDetails(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Logs a business activity event into MongoDB Atlas asynchronously.
 * 
 * Reliability Guarantee:
 * - Designed to be called POST-COMMIT following MySQL operations.
 * - Non-fatal: if MongoDB is temporarily unreachable, logs the failure
 *   to server console without crashing or reversing committed MySQL data.
 */
export async function logActivity(input: ActivityLogInput): Promise<{
  success: boolean;
  logId?: ObjectId;
  error?: string;
}> {
  try {
    const collection = await getActivityLogsCollection<ActivityLogDocument>();
    const doc: ActivityLogDocument = {
      _id: new ObjectId(),
      action: input.action,
      performedBy: input.performedBy,
      targetType: input.targetType,
      targetId: input.targetId,
      studentId: input.studentId,
      roomId: input.roomId,
      timestamp: input.timestamp || new Date(),
      details: sanitizeDetails(input.details || {}),
    };

    const result = await collection.insertOne(doc);
    return {
      success: result.acknowledged,
      logId: doc._id,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[ActivityLogger Error] Failed to record event "${input.action}":`, errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Ensures optimal indexes exist on the activity_logs collection.
 * 
 * Indexes Created:
 * 1. { timestamp: -1 } -> Essential for ordering recent logs and timeframe filtering.
 * 2. { action: 1 } -> Speeds up aggregation pipelines and action-type summaries.
 * 3. { performedBy: 1 } -> Supports audit trail queries by administrative user or student.
 * 4. { targetType: 1 } -> Allows efficient querying by target entity (e.g. all room events).
 * 5. { studentId: 1 } -> Optimizes student-specific accommodation history searches.
 */
export async function ensureLogIndexes(): Promise<{
  created: string[];
  existing: string[];
}> {
  const collection = await getActivityLogsCollection();
  const existingIndexes = await collection.indexes();
  const existingNames = existingIndexes.map((idx) => idx.name || '');

  const requiredIndexes = [
    { key: { timestamp: -1 }, name: 'idx_activity_timestamp_desc' },
    { key: { action: 1 }, name: 'idx_activity_action' },
    { key: { performedBy: 1 }, name: 'idx_activity_performedBy' },
    { key: { targetType: 1 }, name: 'idx_activity_targetType' },
    { key: { studentId: 1 }, name: 'idx_activity_studentId' },
  ];

  const created: string[] = [];
  for (const indexDef of requiredIndexes) {
    if (!existingNames.includes(indexDef.name)) {
      const createdName = await collection.createIndex(indexDef.key as any, { name: indexDef.name });
      created.push(createdName);
    }
  }

  return {
    created,
    existing: existingNames,
  };
}
