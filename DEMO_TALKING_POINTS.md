# Viva Demonstration & Presentation Talking Points

This guide prepares students for oral examinations (viva voce), project evaluations, and live technical demonstrations for the **Smart PG/Hostel Room Allocation and Occupancy Management System**.

---

## 1. Quick Project Elevator Pitch

> *"Our project is a Smart PG and Hostel Management System designed with a polyglot database architecture. MySQL 8 (InnoDB) acts as the primary relational store to manage room inventory, applicant workflows, and atomic bed allocations using ACID transactions, pessimistic locking (`SELECT ... FOR UPDATE`), triggers, and views to guarantee that no room is ever over-allocated. MongoDB Atlas acts as our secondary document store for high-throughput, flexible audit logging without cluttering the relational tables. The full-stack application is built with Next.js 14 App Router, TypeScript, and Tailwind CSS."*

---

## 2. Core Viva Questions & Ready Answers

### Q1: Why MySQL?
**Answer:**  
MySQL 8+ with the InnoDB storage engine is built for structured, relational, and ACID-critical business data. Our core domain involves financial rates (rent), physical room capacities, applicant relationships, and strict referential integrity. MySQL gives us foreign keys (`ON DELETE CASCADE / RESTRICT`), composite unique constraints (`hostel_id + room_number`), engine-level triggers, dynamic views, and row-level pessimistic locking (`SELECT ... FOR UPDATE`).

### Q2: Why MongoDB?
**Answer:**  
MongoDB Atlas provides a high-throughput, flexible JSON document store ideal for audit trails and activity logging (`activity_logs` collection). Different system events have varying metadata structures (e.g. student signup vs room status toggle vs bed allocation with lease dates). In MongoDB, we can store structured metadata in a flexible `details` sub-document without altering table schemas or adding empty nullable columns.

### Q3: Why two databases (Polyglot Architecture)?
**Answer:**  
Using both databases follows the principle of **using the right tool for the job**:
- **Separation of Concerns:** High-frequency, append-heavy audit logs are kept out of MySQL so they don't consume relational IOPS, bloat transactional indexes, or lock tables.
- **Transactional Integrity vs Analytical Flexibility:** MySQL guarantees strict ACID consistency for the room allocations that matter financially and physically, while MongoDB handles time-series activity tracking and fast analytics aggregation (`$group`, `$sort`).

### Q4: What is a transaction?
**Answer:**  
A transaction is a logical unit of work that guarantees **ACID properties**:
- **Atomicity:** All statements inside the transaction succeed together, or all are rolled back (`COMMIT` vs `ROLLBACK`).
- **Consistency:** Moves the database from one valid state to another without violating schema constraints.
- **Isolation:** Concurrent transactions cannot see each other's intermediate, uncommitted changes.
- **Durability:** Once committed, changes survive system crashes and restarts.

In our system, assigning a student to a bed involves checking remaining vacancies, inserting an allocation row, and changing the application status to `ALLOCATED`. Wrapping this in `START TRANSACTION ... COMMIT` ensures that an application is never left marked as allocated without a real allocation record.

### Q5: What does `SELECT ... FOR UPDATE` do?
**Answer:**  
`SELECT ... FOR UPDATE` is **pessimistic locking** in MySQL InnoDB. When executed inside a transaction, it places an **exclusive write lock (X-lock)** on the selected rows:
1. It prevents any concurrent transaction from updating, deleting, or acquiring a lock on those specific rows.
2. Other transactions attempting to select the same room `FOR UPDATE` are blocked until the holding transaction issues `COMMIT` or `ROLLBACK`.
3. This guarantees that between the time we read the vacant bed count and the time we insert the new allocation, no other transaction can sneak in and claim the same bed.

### Q6: What does each trigger in your project do?
**Answer:**  
We implemented four triggers in `database/triggers.sql` as a **defense-in-depth** safeguard:
1. **`trg_before_allocation_insert`:** Runs before any row is inserted into `allocations`. It verifies that the target room is not under maintenance, checks that the student doesn't already hold an active allocation elsewhere, and computes `COUNT(active occupants)`. If active occupants equal or exceed room capacity, it fires `SIGNAL SQLSTATE '45000'` and rejects the insert.
2. **`trg_after_allocation_insert`:** Automatically synchronizes `rooms.status` to `'OCCUPIED'` when the last available bed in a room is allocated.
3. **`trg_before_allocation_update`:** Re-checks room capacity if someone attempts to change an old terminated allocation back to `'ACTIVE'`.
4. **`trg_after_allocation_update`:** Automatically resets `rooms.status` back to `'AVAILABLE'` as soon as an allocation is marked `'TERMINATED'` (vacated).

### Q7: What is the difference between a Trigger and a Stored Procedure?
**Answer:**  
| Feature | Trigger | Stored Procedure |
| :--- | :--- | :--- |
| **Invocation** | Automatically executed by the DBMS engine in response to an event (`INSERT`, `UPDATE`, `DELETE`). | Explicitly called by an application or user via `CALL procedure_name(...)`. |
| **Parameters** | Cannot accept input arguments; operates on `NEW` and `OLD` row pseudo-records. | Accepts `IN`, `OUT`, and `INOUT` parameters. |
| **Transaction Control** | Runs within the transaction of the triggering statement; cannot issue explicit `COMMIT` or `ROLLBACK`. | Can initiate transactions (`START TRANSACTION`), handle errors, and execute `COMMIT` or `ROLLBACK`. |
| **Role in Project** | Defense-in-depth safety net preventing invalid direct SQL inserts. | Encapsulates the complete business workflow (locking, verification, application status updates, returning status codes). |

### Q8: What is a View, and why did you use `room_occupancy_summary`?
**Answer:**  
A View is a virtual table defined by a saved SQL query. It does not store redundant duplicate data on disk; instead, the DBMS executes the underlying query dynamically when the view is accessed.  
Our `room_occupancy_summary` view:
1. Performs a `LEFT JOIN` on active allocations so rooms with zero occupants still appear with `occupied_beds = 0` and `available_beds = capacity`.
2. Computes live remaining beds on the fly, eliminating the need to maintain a fragile counter column in the `rooms` table.
3. Computes a synthesized status: `'UNDER_MAINTENANCE'`, `'FULL'`, or `'AVAILABLE'`.

### Q9: Why are indexes needed, and which ones did you create?
**Answer:**  
Without indexes, the DBMS must perform a **full table scan** ($O(N)$), inspecting every row on disk. An index creates a **B+Tree** data structure ($O(\log N)$) enabling instant lookups.  
We created:
- **MySQL:**
  - `rooms(hostel_id, status)`: Optimizes room browsing and vacancy filters.
  - `allocations(room_id, status)`: Optimizes active bed counting in procedures and views.
  - `applications(student_id, status)`: Optimizes student dashboard timeline queries.
  - `users(email)`: Unique index ensuring instant login credential verification.
- **MongoDB:**
  - `{ timestamp: -1 }`: Optimizes chronological audit log feeds and time ranges.
  - `{ action: 1 }`: Optimizes action filters and aggregation pipelines.
  - `{ performedBy: 1 }`, `{ targetType: 1 }`, `{ studentId: 1 }`: Accelerates targeted audit queries.

### Q10: How does MongoDB aggregation work?
**Answer:**  
MongoDB aggregation processes documents through a multi-stage pipeline where each stage transforms the stream:
1. **`$match`:** Filters documents matching specific criteria (like SQL `WHERE`).
2. **`$group`:** Groups documents by a specified field (like SQL `GROUP BY`), computing accumulator metrics like `totalEvents: { $sum: 1 }` and `lastOccurred: { $max: "$timestamp" }`.
3. **`$sort`:** Sorts the resulting aggregated groups in descending order of event volume (like SQL `ORDER BY`).

### Q11: How is room capacity protected against over-allocation?
**Answer:**  
Through **layered protection**:
1. **Application Layer:** Front-end dropdowns only list rooms with remaining vacancies from `room_occupancy_summary`.
2. **Procedure / Transaction Layer:** Stored procedure `sp_allocate_room` executes `SELECT ... FOR UPDATE` on the room, locks the row, counts active allocations, and executes `ROLLBACK` if capacity is reached.
3. **Engine / Trigger Layer:** If someone bypasses the procedure and runs a raw SQL `INSERT INTO allocations`, trigger `trg_before_allocation_insert` fires, detects that active allocations equal capacity, and aborts the insert with an error.

### Q12: What happens when two admins allocate the same last available bed at the same instant?
**Answer:**  
1. Both admins call `sp_allocate_room`.
2. Admin A's transaction reaches `SELECT * FROM rooms WHERE room_id = ? FOR UPDATE` first and acquires an exclusive row lock.
3. Admin B's transaction reaches the same statement and is **placed in a wait queue** by the MySQL InnoDB engine.
4. Admin A checks remaining capacity (1 bed left), inserts the allocation, sets the application to `ALLOCATED`, and calls `COMMIT`.
5. Upon commit, Admin A's lock is released.
6. Admin B's transaction unblocks and executes its read. It now reads the updated count (0 beds left), detects `active_occupants >= capacity`, executes `ROLLBACK`, and returns status code `ROOM_CAPACITY_EXCEEDED`.
7. Physical capacity is preserved; zero overbooking occurs.

### Q13: How does authentication and authorization work?
**Answer:**  
- **Authentication:** Passwords are encrypted with salted `bcrypt` hashes (`10 rounds`). Upon successful login, the server creates a signed JWT session cookie (`smart_pg_session`) using `jose` with `HS256`. The cookie is marked `HttpOnly` (inaccessible to JavaScript, preventing XSS theft), `SameSite=Lax` (mitigating CSRF), and expires in 7 days.
- **Authorization (RBAC):** We never trust the client. Server-side middleware and utilities (`requireAuth()` and `requireAdmin()`) inspect the signed JWT cookie on every protected page and API route handler. Non-admins requesting `/api/hostels` (POST/PUT/DELETE) or `/api/allocations` receive an immediate `403 Forbidden` response.

---

## 3. Step-by-Step Viva Live Demo Script

Follow these 5 steps during the viva presentation:

```
Step 1: System Overview & Clean Seed Data
-----------------------------------------
1. Open the home page at http://localhost:3000.
2. Point out the Polyglot architecture badge and the demo credentials callout box.
3. Show that clean demo accounts exist for both System Administrator and students.

Step 2: MySQL Real-Time Occupancy View
---------------------------------------
1. Open MySQL terminal or show database/demo_queries.sql query 1:
   SELECT * FROM room_occupancy_summary WHERE hostel_id = 1;
2. Explain that Room G-101 has capacity 1 and 1 active allocation -> occupancy_status = 'FULL'.
3. Explain that Room G-102 has capacity 2 and 0 active allocations -> occupancy_status = 'AVAILABLE'.

Step 3: Student Flow (Browsing & Applying)
------------------------------------------
1. Sign in as student Rohan Gupta (rohan.gupta@example.com / Password@123) or register a new student.
2. Go to "Browse Rooms" -> observe real-time vacancy badges calculated from MySQL view.
3. Submit an application for Greenfield Boys PG (Double Sharing).
4. Go to "My Applications" -> observe status = PENDING.

Step 4: Warden Flow (Review & Stored Procedure Allocation)
----------------------------------------------------------
1. Sign in as Administrator (admin@smartpg.com / Password@123).
2. Go to "Applications" -> locate the student's pending application.
3. Click "Review" -> approve with warden remarks.
4. Click "Allocate Bed" -> modal opens pre-selected for that application.
5. Select vacant Room G-102 and click "Confirm Allocation".
6. Explain to the examiner that sp_allocate_room just executed with SELECT ... FOR UPDATE.
7. Show that the student application transitioned to ALLOCATED and bed vacancy decreased.

Step 5: Defense-in-Depth & MongoDB Audit Log Proof
---------------------------------------------------
1. Show that attempting to allocate a full room is blocked by sp_allocate_room.
2. Show that a direct invalid SQL insert is blocked by trg_before_allocation_insert.
3. Show MongoDB Atlas activity_logs collection containing all recorded audit events:
   STUDENT_REGISTERED, APPLICATION_SUBMITTED, APPLICATION_STATUS_UPDATED, ROOM_ALLOCATED.
```
