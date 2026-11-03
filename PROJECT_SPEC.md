# Smart PG/Hostel Room Allocation and Occupancy Management System
## Project Specification & Technical Architecture

---

## 1. Problem Statement & Motivation
Finding suitable PG (Paying Guest) and hostel accommodation is often a chaotic, opaque, and stressful experience for university students and working professionals. Traditional accommodation management suffers from critical issues:
- **Unclear Room Availability:** Students cannot easily determine real-time bed or room vacancies.
- **Manual, Error-Prone Application Process:** Applications submitted on paper or basic forms get lost, delayed, or mishandled.
- **Over-Allocation & Capacity Violations:** Without atomic controls, hostel wardens risk allocating more students to a room than its physical capacity permits.
- **Lack of Accountability & Audit Trails:** Modifications to room statuses, application approvals, and allocations lack historical activity tracking.

This project delivers a **Smart PG/Hostel Room Allocation and Occupancy Management System** designed as an **Academic DBMS Level 3 Full-Stack Application**. It enforces strict relational data integrity, concurrency control, database-level business logic, and flexible audit logging.

---

## 2. Core Project Objectives
1. **Pessimistic Concurrency & Atomic Allocations:** Ensure that room allocation operations are executed within ACID transactions using `SELECT ... FOR UPDATE` and a dedicated stored procedure to eliminate race conditions and over-allocation.
2. **Database-Enforced Integrity:** Implement MySQL triggers, foreign key constraints, CHECK constraints, and uniqueness checks directly inside the database engine.
3. **Optimized Querying with Views & Indexes:** Create specialized database views (e.g., `room_occupancy_summary`) and composite indexes for fast search, filter, and reporting queries.
4. **Polyglot Persistence Architecture:**
   - **MySQL 8+:** Serves as the primary transactional database for users, hostels, rooms, room types, applications, and allocations.
   - **MongoDB Atlas:** Serves as the secondary document database for flexible, append-only activity and audit logs (`activity_logs`), powered by aggregation pipelines.
5. **Modern, Responsive Web Application:** Provide an intuitive, modern UI built with Next.js App Router, TypeScript, and Tailwind CSS, featuring distinct role-based portals for Students and Administrators.

---

## 3. Scope & User Modules

### 3.1 Public Module
- **Landing Page:** Project overview, hostel highlights, features, and quick navigation.
- **Student Registration:** Account creation with password hashing (`bcryptjs`) and email validation.
- **Authentication:** Unified, secure login with role-based routing (Admin vs. Student) and HTTP-only signed cookie sessions.

### 3.2 Student Portal
- **Student Dashboard:** Real-time summary of current application status, allocated room details, and hostel announcements.
- **Browse Hostels & Rooms:** Filter and search rooms by hostel, room type (Single, Double, Triple sharing), rent range, and live vacancy status.
- **Submit Application:** Choose preferred hostel and room type with custom notes.
- **Track Applications:** Monitor status changes (`PENDING`, `APPROVED`, `REJECTED`, `ALLOCATED`).
- **Allocated Room Details:** View allocated hostel name, room number, floor, room capacity, rent, and occupancy breakdown.

### 3.3 Administrator Portal
- **Admin Dashboard:** Key metrics: total hostels, total capacity, occupied beds, vacancy rate, pending applications, and recent activities.
- **Hostel Management:** Add, edit, and view hostels with contact numbers and addresses.
- **Room & Room Type Management:** Configure room types (capacity, monthly rent) and manage rooms (room number, floor, status: `AVAILABLE`, `OCCUPIED`, `MAINTENANCE`).
- **Application Processing:** Review pending student applications with options to approve or reject with remarks.
- **Atomic Room Allocation:** Allocate an approved application to a verified room with capacity validation via stored procedure and transaction.
- **Occupancy Insights:** View live occupancy breakdown utilizing the `room_occupancy_summary` MySQL view.
- **Activity Log Viewer (Reserved Teammate Task):** Dedicated admin interface powered by MongoDB aggregation to summarize system events.

---

## 4. Database Architecture & Schema

### 4.1 Relational Schema (MySQL 8+ InnoDB)

1. **`users`**
   - `user_id` (INT AUTO_INCREMENT, PK)
   - `name` (VARCHAR(100), NOT NULL)
   - `email` (VARCHAR(150), NOT NULL, UNIQUE)
   - `password_hash` (VARCHAR(255), NOT NULL)
   - `role` (ENUM('student', 'admin'), NOT NULL DEFAULT 'student')
   - `created_at` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)

2. **`hostels`**
   - `hostel_id` (INT AUTO_INCREMENT, PK)
   - `hostel_name` (VARCHAR(150), NOT NULL)
   - `address` (TEXT, NOT NULL)
   - `contact_number` (VARCHAR(20), NOT NULL)
   - `created_at` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)

3. **`room_types`**
   - `room_type_id` (INT AUTO_INCREMENT, PK)
   - `type_name` (VARCHAR(50), NOT NULL) -- e.g., 'Single Deluxe', 'Double Sharing'
   - `capacity` (INT NOT NULL, CHECK (capacity > 0))
   - `monthly_rent` (DECIMAL(10,2) NOT NULL, CHECK (monthly_rent >= 0))

4. **`rooms`**
   - `room_id` (INT AUTO_INCREMENT, PK)
   - `hostel_id` (INT NOT NULL, FK -> hostels.hostel_id ON DELETE CASCADE)
   - `room_type_id` (INT NOT NULL, FK -> room_types.room_type_id)
   - `room_number` (VARCHAR(20), NOT NULL)
   - `floor` (INT NOT NULL DEFAULT 1)
   - `status` (ENUM('AVAILABLE', 'OCCUPIED', 'UNDER_MAINTENANCE') DEFAULT 'AVAILABLE')
   - UNIQUE KEY `unique_hostel_room` (`hostel_id`, `room_number`)

5. **`applications`**
   - `application_id` (INT AUTO_INCREMENT, PK)
   - `student_id` (INT NOT NULL, FK -> users.user_id ON DELETE CASCADE)
   - `preferred_hostel_id` (INT NOT NULL, FK -> hostels.hostel_id)
   - `preferred_room_type_id` (INT NOT NULL, FK -> room_types.room_type_id)
   - `application_date` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
   - `status` (ENUM('PENDING', 'APPROVED', 'REJECTED', 'ALLOCATED') DEFAULT 'PENDING')
   - `notes` (TEXT)

6. **`allocations`**
   - `allocation_id` (INT AUTO_INCREMENT, PK)
   - `application_id` (INT NOT NULL, UNIQUE, FK -> applications.application_id)
   - `student_id` (INT NOT NULL, FK -> users.user_id)
   - `room_id` (INT NOT NULL, FK -> rooms.room_id)
   - `allocation_date` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
   - `start_date` (DATE NOT NULL)
   - `end_date` (DATE NULL)
   - `status` (ENUM('ACTIVE', 'TERMINATED') DEFAULT 'ACTIVE')

---

### 4.2 Advanced DBMS Features

1. **ACID Transactions & Row-Level Locking:**
   - Stored procedure `AllocateRoomToStudent(p_application_id, p_room_id, p_start_date)` uses `START TRANSACTION;` and `SELECT ... FOR UPDATE` on `rooms` and `allocations`.
2. **Database View (`room_occupancy_summary`):**
   - Joins `rooms`, `room_types`, `hostels`, and active `allocations` to expose `capacity`, `occupied_beds`, `available_beds`, and calculated `occupancy_status`.
3. **Database Triggers:**
   - `before_allocation_insert`: Re-validates that active allocations for the room do not exceed capacity before an insert is committed.
   - `after_allocation_insert`: Updates room status to `OCCUPIED` if remaining beds reach 0.
   - `after_allocation_terminate`: Reverts room status to `AVAILABLE` when an allocation ends.
4. **Stored Procedures:**
   - `sp_allocate_room`: Atomic allocation procedure with error handling, rollback, and parameter validation.
5. **Indexes:**
   - `idx_rooms_hostel_status` on `rooms(hostel_id, status)`
   - `idx_allocations_active` on `allocations(room_id, status)`
   - `idx_applications_student` on `applications(student_id, status)`

---

### 4.3 Activity Logging Store (MongoDB Atlas)

- Collection: `activity_logs`
- Schema structure:
  ```json
  {
    "_id": "ObjectId(...)",
    "action": "STUDENT_REGISTERED | APPLICATION_SUBMITTED | APPLICATION_STATUS_CHANGED | ROOM_ALLOCATED | ROOM_STATUS_CHANGED",
    "performedBy": {
      "userId": 1,
      "email": "admin@hostel.edu",
      "role": "admin"
    },
    "targetType": "USER | APPLICATION | ALLOCATION | ROOM | HOSTEL",
    "targetId": 105,
    "studentId": 42,
    "roomId": 12,
    "timestamp": "2026-11-03T12:00:00.000Z",
    "details": {
      "hostelName": "Blue Sky Hostel",
      "roomNumber": "B-204",
      "previousStatus": "PENDING",
      "newStatus": "ALLOCATED"
    }
  }
  ```
- Indexes: `timestamp` (desc), `action`, `performedBy.userId`, `targetType`.
- Aggregation Pipeline: Grouping events by action type and daily timeline summaries.

---

## 5. Security & Technical Standards
- **Zero Plain-Text Secrets:** Passwords hashed with salt rounds via `bcryptjs`.
- **Stateless HTTP-only Sessions:** Secure cookies with signed JWT payload, preventing XSS and CSRF token tampering.
- **SQL Injection Prevention:** Strictly parameterized queries using `mysql2/promise`.
- **Role-Based Access Control (RBAC):** Middleware and API route protection preventing students from invoking admin routes.

---

## 6. Implementation Roadmap

- [x] **Phase 1: Project Setup & Baseline Architecture**
  - Scaffold Next.js App Router, TypeScript, Tailwind CSS.
  - Setup `.gitignore`, `.env.example`, `AGENTS.md`, `PROJECT_SPEC.md`, `FRIEND_TASKS.md`.
  - Validate local installation and dev server.
- [ ] **Phase 2: Database Schema, Views, Triggers, Procedures & Seed Data**
  - Write SQL scripts for DDL, views, triggers, and stored procedures.
  - Generate comprehensive realistic seed data for viva demonstrations.
- [ ] **Phase 3: Database Clients & MongoDB Activity Logging**
  - Implement MySQL connection pool singleton.
  - Implement MongoDB client and activity logging helper.
- [ ] **Phase 4: Authentication, Authorization & Route Handlers**
  - Implement JWT authentication with HTTP-only cookies.
  - Build endpoints for auth, hostels, rooms, applications, and atomic allocations.
- [ ] **Phase 5: Student & Admin Portals (UI & Integration)**
  - Student browse, apply, and status tracking UI.
  - Admin dashboard, hostel/room management, application review, and atomic allocation dialog.
- [ ] **Phase 6: End-to-End Testing & Verification**
  - Concurrency test on allocation procedure.
  - Trigger and view verification.
- [ ] **Phase 7: Documentation, Viva Preparation & Teammate Handoff**
  - Complete `DATABASE_CONCEPTS.md`, `DEMO_TALKING_POINTS.md`, and `README.md`.
