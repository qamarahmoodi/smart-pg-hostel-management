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
- The MySQL relational schema, views, triggers, and stored procedures
- The authentication and role-based access control system
- The student application and admin room allocation workflows
- The MongoDB client connection and background activity logging helper (`lib/logger/index.ts`)

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
   `src/lib/db/mongodb.ts` -> exports `getMongoDatabase()` or `clientPromise`.
2. **Authentication & Session Verifier:**  
   `src/lib/auth/session.ts` -> exports `getCurrentUser()` or `requireAdminSession()`.
3. **Admin Layout & Navigation:**  
   Already available under `src/app/(dashboard)/admin/layout.tsx`.
4. **Target MongoDB Collection:**  
   `activity_logs` in the database configured by `MONGODB_DB`.

---

## 3. MongoDB Document Schema (`activity_logs`)

The logging helper automatically saves documents with this structure:

```typescript
interface ActivityLogDocument {
  _id: ObjectId;
  action: 'STUDENT_REGISTERED' | 'APPLICATION_SUBMITTED' | 'APPLICATION_STATUS_CHANGED' | 'ROOM_ALLOCATED' | 'ROOM_STATUS_CHANGED';
  performedBy: {
    userId: number;
    email: string;
    role: 'admin' | 'student';
  };
  targetType: 'USER' | 'APPLICATION' | 'ALLOCATION' | 'ROOM' | 'HOSTEL';
  targetId: number;
  studentId?: number;
  roomId?: number;
  timestamp: Date;
  details?: Record<string, any>;
}
```

---

## 4. Specific Task Breakdown

### Step 1: Design the MongoDB Aggregation Pipeline
In your API route, implement a MongoDB aggregation query on the `activity_logs` collection. For example:
- **Aggregation A (Event breakdown by action):**
  Group logs by `action`, compute `count`, and retrieve the most recent timestamp (`lastOccurred: { $max: "$timestamp" }`).
- **Aggregation B (Daily activity volume):**
  Group logs by day (`$dateToString: { format: "%Y-%m-%d", date: "$timestamp" }`), count daily events, and sort descending.
- **Recent Logs Listing:**
  Fetch the last 20 raw activity logs sorted by `timestamp: -1`.

### Step 2: Implement the Route Handler
- **File location to create:** `src/app/api/admin/logs/route.ts`
- **Method:** `GET`
- **Requirements:**
  1. Authenticate the request: call `requireAdminSession()` or verify that `user.role === 'admin'`. If unauthorized, return `401` or `403`.
  2. Connect to MongoDB using `getMongoDatabase()`.
  3. Execute the aggregation pipeline using `.aggregate([...]).toArray()`.
  4. Return JSON response:
     ```json
     {
       "success": true,
       "summary": [
         { "action": "ROOM_ALLOCATED", "count": 14, "lastOccurred": "..." },
         { "action": "APPLICATION_SUBMITTED", "count": 28, "lastOccurred": "..." }
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
     - Performed By (user email + role)
     - Target & Details summary
  4. Include standard loading spinner and empty states.
  5. Add a navigation link to this page inside `src/components/layout/AdminSidebar.tsx` (or admin header).

---

## 5. Files to Create or Modify

| Action | File Path | Purpose |
| :--- | :--- | :--- |
| **CREATE** | `src/app/api/admin/logs/route.ts` | Next.js API Route Handler running MongoDB aggregation |
| **CREATE** | `src/app/(dashboard)/admin/activity-logs/page.tsx` | Admin UI page for activity log analytics |
| **EDIT** | `src/components/layout/AdminSidebar.tsx` | Add link to `/admin/activity-logs` with an icon |

> [!WARNING]
> Do NOT modify existing SQL schemas, triggers, or stored procedures. Do not modify the student allocation engine. Keep your changes isolated to the activity logs feature.

---

## 6. Definition of Done (Completion Criteria)

Your task is considered complete when:
1. `GET /api/admin/logs` responds with `401 Unauthorized` for non-admins or logged-out users.
2. `GET /api/admin/logs` returns aggregated metrics and recent logs when called with an admin session.
3. The page at `/admin/activity-logs` renders without TypeScript or runtime console errors.
4. The aggregation demonstrates core DBMS Level 3 MongoDB concepts (`$group`, `$sort`, `$project`, `$limit`).
5. You can present this screen and the underlying MongoDB aggregation code during viva evaluations!
