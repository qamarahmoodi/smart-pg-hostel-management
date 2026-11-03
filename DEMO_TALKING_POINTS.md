# Viva Demonstration & Presentation Talking Points

Use this guide for oral examinations, project reviews, and live system demonstrations.

---

## 1. Quick Project Elevator Pitch
> *"Our project is a Smart PG and Hostel Management System built with a polyglot database architecture. MySQL 8 handles strict relational data, concurrency locking, and atomic bed allocations to prevent over-allocation. MongoDB Atlas captures high-throughput, flexible audit logs for every system action. The frontend is built on Next.js 14 App Router with TypeScript and Tailwind CSS."*

---

## 2. Likely Viva Questions & Ready Answers

### Q1: Why use both MySQL and MongoDB? Why not just one database?
**Answer:**
- **MySQL** is ideal for structured, relational, and ACID-critical business operations. Room allocation involves financial records, strict capacity limits, and relational integrity across users, hostels, and rooms. We need foreign keys, row-level locks (`SELECT FOR UPDATE`), and triggers to guarantee a room is never over-allocated.
- **MongoDB** is ideal for activity logging. Audit events have varying structures (e.g., student registration vs room status changes vs allocation details). Storing logs in MongoDB decouples high-volume audit logging from the primary transactional database and allows rich aggregation queries without bloating relational tables.

### Q2: How do you prevent two admins from allocating the last bed to different students at the exact same moment?
**Answer:**
- We solve this using **Pessimistic Concurrency Control** inside the MySQL stored procedure `sp_allocate_room`.
- The procedure runs within an explicit transaction (`START TRANSACTION`).
- It executes `SELECT ... FROM rooms WHERE room_id = ? FOR UPDATE`. This row lock blocks any concurrent transaction trying to allocate the same room until the first transaction commits.
- If the first allocation fills the remaining bed, the second transaction unblocks, reads the updated occupancy count, sees `active_count >= capacity`, and immediately executes `ROLLBACK`, returning error code `ROOM_CAPACITY_EXCEEDED`.

### Q3: What is the purpose of the `room_occupancy_summary` view?
**Answer:**
- The view eliminates the need to maintain a redundant, fragile `occupied_beds` counter column in the `rooms` table.
- It dynamically calculates `occupied_beds` and `available_beds` on the fly by executing a `LEFT JOIN` on active allocation records.
- By using a `LEFT JOIN`, rooms with 0 occupants are preserved in the results with 0 occupied beds and full available capacity.
- It synthesizes physical maintenance blocks with mathematical vacancies to output a single `occupancy_status` ('AVAILABLE', 'FULL', or 'UNDER_MAINTENANCE').

### Q4: If the stored procedure checks capacity, why do you also have a BEFORE INSERT trigger?
**Answer:**
- This is a **Defense-in-Depth** DBMS architecture.
- The stored procedure governs the standard application workflow (checking application state, student authorization, updating status).
- However, if a developer or administrator connects via MySQL Workbench or executes a direct SQL `INSERT INTO allocations`, the `trg_before_allocation_insert` trigger intercepts the query at the database engine level and rejects it via `SIGNAL SQLSTATE '45000'` if the room is at capacity or the student already has an active allocation.

### Q5: How are passwords stored and secured?
**Answer:**
- We never store plaintext passwords.
- Passwords are encrypted using salted `bcrypt` hashes (`bcryptjs` with 10 salt rounds).
- In our seed data, all demo accounts use the standard development password `Password@123`, stored as `$2a$10$DZ/goLnw8qgbRNw15bT8puVxwO48PY2.B9gqI84GB4O.esTqA3m0q`.

### Q6: What indexes did you create and why?
**Answer:**
- `rooms(hostel_id, status)`: Speeds up student searches filtering available rooms in a specific hostel.
- `allocations(room_id, status)`: Speeds up active occupant counting during procedure execution and view calculations.
- `applications(student_id, status)`: Speeds up student dashboard status checks.
- `users(email)`: Enforces unique email constraints and ensures instant credential lookups during login.

---

## 3. Live Demo Script (Step-by-Step Viva Run)

1. **Show Seed Data & Users:**
   - Open MySQL client or run query from `database/demo_queries.sql` section 1.
   - Show `admin@smartpg.com` and student accounts (`aarav.sharma@example.com`, `rohan.gupta@example.com`).

2. **Show the Occupancy View:**
   - Execute: `SELECT * FROM room_occupancy_summary WHERE hostel_id = 1;`
   - Point out Room `G-101` (1/1 bed occupied, status: `FULL`) and Room `G-201` (0/2 beds occupied, status: `AVAILABLE`).

3. **Demonstrate Successful Room Allocation via Stored Procedure:**
   - Show student Rohan Gupta (Application 4) is currently in `APPROVED` status.
   - Execute: `CALL sp_allocate_room(4, 3, '2026-02-01', @code, @msg, @id);`
   - Query `@code` and `@msg` -> returns `SUCCESS` and the new allocation ID.
   - Show that Application 4 automatically transitioned to `ALLOCATED`.

4. **Demonstrate Concurrency & Capacity Rejection (Rollback):**
   - Attempt to call `sp_allocate_room` again with the same application -> rejected with `APPLICATION_INELIGIBLE`.
   - Attempt to manually insert an allocation into Room `G-101` (capacity 1, already full) -> rejected with trigger error: `Capacity Error: Room capacity has been reached. Allocation rejected.`
