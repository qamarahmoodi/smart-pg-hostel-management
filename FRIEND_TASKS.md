# FRIEND_TASKS.md — Reserved Teammate Contribution Task

> **Status:** 🟢 **IMPLEMENTED & VERIFIED**  
> **Assigned To:** Secondary Teammate / Peer Developer  
> **Role:** Full-Stack Contributor (MongoDB Aggregation + Admin Analytics UI)  
> **Estimated Time:** 1–2 hours (Completed)

---

## 1. Overview & Objective

To ensure fair academic collaboration and clear division of labor, this specific module was assigned to and implemented by the secondary teammate:
- **Module:** MongoDB Activity Log Aggregation & Admin Analytics Viewer
- **Purpose:** Provide administrative audit trail visualization, action event distributions, daily activity volume trends, and raw document inspection without placing write locks on the primary MySQL 8 relational tables.

---

## 2. Technical Prerequisites & Ready-Made Assets Reused

1. **MongoDB Client:**  
   `import { getMongoDatabase, getActivityLogsCollection } from '@/lib/db/mongodb';`
2. **TypeScript Interfaces:**  
   `import { ActivityLogDocument, ActivityAction } from '@/lib/logger';`
   `import { ActivityLogsApiResponse, SerializedActivityLog, ActivityLogSummaryItem } from '@/types';`
3. **Target MongoDB Database & Collection:**  
   Database: `hostel_management`  
   Collection: `activity_logs`
4. **Indexes Leveraged:**
   - `{ timestamp: -1 }` (`idx_activity_timestamp_desc`) for rapid chronological sorting
   - `{ action: 1 }` (`idx_activity_action`) for aggregation group scans
   - `{ performedBy: 1 }` (`idx_activity_performedBy`)
   - `{ targetType: 1 }` (`idx_activity_targetType`)
   - `{ studentId: 1 }` (`idx_activity_studentId`)

---

## 3. Implemented Files & Deliverables

| Action | File Path | Purpose |
| :--- | :--- | :--- |
| **CREATED** | `src/app/api/admin/logs/route.ts` | Next.js API Route Handler running MongoDB aggregation pipelines and enforcing admin RBAC |
| **CREATED** | `src/app/(dashboard)/admin/activity-logs/page.tsx` | Admin UI page for activity log analytics with KPI cards, filters, and JSON inspector |
| **EDITED** | `src/components/layout/Sidebar.tsx` | Added navigation link to `/admin/activity-logs` with `Activity` icon |
| **EDITED** | `src/types/index.ts` | Added shared TypeScript interfaces for API response and serialized log models |

---

## 4. MongoDB Aggregation Pipeline Details

In `src/app/api/admin/logs/route.ts`, three distinct aggregation pipelines and queries are executed:

### Aggregation A: Event Breakdown by Action
Groups logs by business action (`ROOM_ALLOCATED`, `APPLICATION_SUBMITTED`, etc.), calculates the total frequency using `$sum: 1`, and retrieves the latest event timestamp using `$max: "$timestamp"`:
```javascript
const actionSummary = await collection.aggregate([
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
]).toArray();
```

### Aggregation B: Daily Activity Volume
Extracts calendar days using `$dateToString` and computes daily audit event counts for trend analysis:
```javascript
const dailyTrends = await collection.aggregate([
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
]).toArray();
```

### Aggregation C: Target Entity Distribution
Groups logs by `targetType` (`room`, `allocation`, `application`, `user`) to summarize entity modification distribution.

---

## 5. Security & RBAC Enforcement

- **Route Guard:** `await requireAdmin()` verifies that a valid JWT session exists and the authenticated user holds the `admin` role.
- Returns `401 Unauthorized` if no session cookie is present.
- Returns `403 Forbidden` if a logged-in student attempts to access `/api/admin/logs`.
- Sensitive details (passwords, hashes, authentication tokens) are scrubbed via `sanitizeDetails` in `src/lib/logger/index.ts` prior to persistence.

---

## 6. Viva Presentation & Evaluation Talking Points

When presenting this module during academic evaluations, highlight:

1. **Why Polyglot Architecture?**
   - MySQL handles ACID transactions, unique constraints, and pessimistic concurrency control (`SELECT ... FOR UPDATE` via stored procedures).
   - MongoDB Atlas acts as an asynchronous, append-only document store for event logs. It handles variable JSON detail payloads without requiring schema migrations or placing locks on relational tables.
2. **Aggregation Pipeline Explanation:**
   - Explain how `$group` accumulates values in memory while streaming over indexed collections.
   - Explain `$project` for transforming document shapes and suppressing internal `_id` fields.
   - Explain the importance of index `{ timestamp: -1 }` for ordering recent activities without in-memory sort overflows.
3. **Demo Seed Helper:**
   - If the database is empty, the UI includes a one-click **"Seed Sample Audit Records"** button (via `POST /api/admin/logs`) to populate realistic demonstration events for instant evaluation.
