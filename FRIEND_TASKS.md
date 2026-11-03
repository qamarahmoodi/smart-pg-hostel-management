# FRIEND_TASKS.md — Reserved Teammate Contribution Task

> **Status:** 🔴 **NOT IMPLEMENTED (Reserved for Teammate)**  
> **Assigned To:** Secondary Teammate / Peer Developer  
> **Role:** Full-Stack Contributor (MongoDB Aggregation + Admin Analytics UI)  
> **Estimated Time:** 1–2 hours

---

## 1. Overview & Objective

To ensure fair academic collaboration and clear division of labor, this specific module is **strictly reserved for the secondary teammate**.

The primary developer has built:
- The entire Next.js application foundation and layout
- The MySQL relational schema, views, triggers, and stored procedures (`smart_hostel_db`)
- The MySQL connection pool singleton (`src/lib/db/mysql.ts`)
- The MongoDB client singleton (`src/lib/db/mongodb.ts`)
- The background activity logging helper (`src/lib/logger/index.ts`) with automatic index creation

**Your task** is to build the **Activity Log Summary & Analytics Viewer** for administrators by:
1. Writing a meaningful MongoDB aggregation pipeline query.
2. Creating an admin-only Next.js API route handler to execute and serve this aggregation.
3. Creating a responsive, clean admin UI page (or tab) to display the aggregated logs.

> [!NOTE]
> The rest of the application is 100% functional without this page. You do not need to do any project setup, database migrations, or authentication logic. All database connections and auth helpers are ready for you to import!

---

## 2. Technical Prerequisites & Ready-Made Assets

You can directly import and reuse these existing helpers:

1. **MongoDB Database Client:**  
   `import { getMongoDatabase, getActivityLogsCollection } from '@/lib/db/mongodb';`
2. **TypeScript Interfaces:**  
   `import { ActivityLogDocument, ActivityAction } from '@/lib/logger';`
3. **Target MongoDB Database & Collection:**  
   Database: `hostel_management`  
   Collection: `activity_logs`
4. **Existing Indexes Already Created:**
   - `{ timestamp: -1 }` (`idx_activity_timestamp_desc`)
   - `{ action: 1 }` (`idx_activity_action`)
   - `{ performedBy: 1 }` (`idx_activity_performedBy`)
   - `{ targetType: 1 }` (`idx_activity_targetType`)
   - `{ studentId: 1 }` (`idx_activity_studentId`)

---

## 3. MongoDB Document Schema (`activity_logs`)

The logging helper automatically saves documents with this structure:

```typescript
export interface ActivityLogDocument {
  _id: ObjectId;
  action:
    | 'STUDENT_REGISTERED'
    | 'APPLICATION_SUBMITTED'
    | 'APPLICATION_APPROVED'
    | 'APPLICATION_REJECTED'
    | 'ROOM_ALLOCATED'
    | 'ALLOCATION_TERMINATED'
    | 'ROOM_STATUS_CHANGED';
  performedBy: number | { userId: number; email?: string; role?: string };
  targetType: 'user' | 'application' | 'allocation' | 'room' | 'hostel';
  targetId: number;
  studentId?: number;
  roomId?: number;
  timestamp: Date;
  details: Record<string, any>;
}
```

### Example Real Activity Document in MongoDB:
```json
{
  "_id": "67277b084918e95079a4c10a",
  "action": "ROOM_ALLOCATED",
  "performedBy": 1,
  "targetType": "allocation",
  "targetId": 4,
  "studentId": 5,
  "roomId": 3,
  "timestamp": "2026-11-03T16:00:00.000Z",
  "details": {
    "hostelName": "Greenfield Boys PG & Hostel",
    "roomNumber": "G-201",
    "startDate": "2026-02-01"
  }
}
```

---

## 4. Specific Task Breakdown

### Step 1: Design the MongoDB Aggregation Pipeline
In your API route, implement a MongoDB aggregation query on the `activity_logs` collection. For example:
- **Aggregation A (Event breakdown by action):**
  Group logs by `action`, compute `count`, and retrieve the most recent timestamp (`lastOccurred: { $max: "$timestamp" }`).
  ```javascript
  const summary = await collection.aggregate([
    {
      $group: {
        _id: "$action",
        count: { $sum: 1 },
        lastOccurred: { $max: "$timestamp" }
      }
    },
    { $sort: { count: -1 } }
  ]).toArray();
  ```
- **Aggregation B (Daily activity volume):**
  Group logs by day (`$dateToString: { format: "%Y-%m-%d", date: "$timestamp" }`), count daily events, and sort descending.
- **Recent Logs Listing:**
  Fetch the last 20 raw activity logs sorted by `timestamp: -1`.
  ```javascript
  const recentLogs = await collection.find({}).sort({ timestamp: -1 }).limit(20).toArray();
  ```

### Step 2: Implement the Route Handler
- **File location to create:** `src/app/api/admin/logs/route.ts`
- **Method:** `GET`
- **Requirements:**
  1. Authenticate request: verify that the user session has `role === 'admin'`. Return `401 Unauthorized` or `403 Forbidden` if not an admin.
  2. Connect to MongoDB using `getActivityLogsCollection()`.
  3. Execute the aggregation pipeline and recent logs fetch.
  4. Return JSON response matching this contract:
     ```json
     {
       "success": true,
       "summary": [
         { "action": "ROOM_ALLOCATED", "count": 14, "lastOccurred": "2026-11-03T16:00:00.000Z" },
         { "action": "APPLICATION_SUBMITTED", "count": 28, "lastOccurred": "2026-11-03T15:30:00.000Z" }
       ],
       "recentLogs": [ ... ]
     }
     ```

### Step 3: Implement the Admin UI Page
- **File location to create:** `src/app/(dashboard)/admin/activity-logs/page.tsx`
- **UI Requirements:**
  1. Add a page title: "System Activity & Audit Logs".
  2. Summary cards or grid showing event counts by action type (e.g., Rooms Allocated, Applications Processed).
  3. An interactive table showing the recent 20 activity logs with columns:
     - Timestamp (formatted readable date/time)
     - Action Badge (e.g. green for `ROOM_ALLOCATED`, blue for `APPLICATION_SUBMITTED`)
     - Performed By (user ID or email)
     - Target & Details summary
  4. Include standard loading spinner and empty states.
  5. Add a navigation link to this page inside the Admin navigation sidebar.

---

## 5. Files to Create or Modify

| Action | File Path | Purpose |
| :--- | :--- | :--- |
| **CREATE** | `src/app/api/admin/logs/route.ts` | Next.js API Route Handler running MongoDB aggregation |
| **CREATE** | `src/app/(dashboard)/admin/activity-logs/page.tsx` | Admin UI page for activity log analytics |
| **EDIT** | `src/components/layout/AdminSidebar.tsx` | Add navigation link to `/admin/activity-logs` with an icon |

> [!WARNING]
> Do NOT modify existing SQL schemas, triggers, or stored procedures. Do not modify the student allocation engine. Keep your changes isolated to the activity logs viewer feature.

---

## 6. Definition of Done (Completion Criteria)

Your task is considered complete when:
1. `GET /api/admin/logs` responds with `401 Unauthorized` for non-admins or logged-out users.
2. `GET /api/admin/logs` returns aggregated metrics and recent logs when called with an admin session.
3. The page at `/admin/activity-logs` renders cleanly without TypeScript or runtime console errors.
4. The aggregation demonstrates core DBMS Level 3 MongoDB concepts (`$group`, `$sort`, `$max`, `$limit`).
5. You can present this screen and explain the underlying MongoDB aggregation pipeline during viva evaluations!
