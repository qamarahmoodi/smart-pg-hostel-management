# Academic Project Report — DBMS Level 3

---

## 1. Project Title

**Smart PG/Hostel Room Allocation and Occupancy Management System**  
*A Polyglot DBMS Implementation with ACID Concurrency Control and MongoDB Activity Auditing*

---

## 2. Student Details

| Student Name | Student Registration Number (SRN) | Role / Contributions |
| :--- | :--- | :--- |
| `Qamar Ahmed` | `PES2UG24CS904` | Architecture, MySQL Relational Database, Next.js Portals, APIs, Auth |
| `Ibrahim Khaleel` | `PES2UG25809` | MongoDB Activity Logging Aggregations & Activity Log Admin Viewer |

---

## 3. Abstract

Managing student accommodation in PG (Paying Guest) and hostel facilities typically suffers from manual bookkeeping, lack of transparency regarding bed vacancies, and high risk of accidental double-allocation when multiple wardens operate simultaneously. 

This project implements a full-stack, enterprise-grade accommodation management system using a **polyglot database architecture**:
1. **Primary Relational Store (MySQL 8+ InnoDB):** Enforces strict ACID transactional integrity across six core relational entities (`users`, `hostels`, `room_types`, `rooms`, `applications`, and `allocations`). Concurrency is managed via pessimistic row locking (`SELECT ... FOR UPDATE`) in stored procedure `sp_allocate_room`, preventing race conditions and over-allocation. Database views dynamically compute live vacancies, while engine-level triggers provide defense-in-depth enforcement.
2. **Secondary Document Store (MongoDB Atlas):** Captures high-throughput, unstructured audit logs (`activity_logs` collection) for all critical operations (registration, application status updates, allocations, and terminations) without placing analytical burden or schema constraints on the relational engine.
3. **Application Layer (Next.js 14 App Router, TypeScript, Tailwind CSS):** Delivers responsive student and administrator portals protected by secure, stateless HTTP-only signed JWT session cookies (`jose`) and role-based access control (RBAC).

---

## 4. Technology Stack

- **Frontend & Server Framework:** Next.js 14 (App Router, Server Components & Route Handlers)
- **Programming Language:** TypeScript 5.4+ (Strict typing enabled)
- **User Interface:** Tailwind CSS 3.4+, Lucide React icons
- **Primary Relational Database:** MySQL Server 8.0+ (InnoDB Engine) via `mysql2/promise` connection pool
- **Secondary Document Database:** MongoDB Atlas Cloud (v7.0+) via official `mongodb` Node.js driver
- **Authentication & Security:** Stateless signed JWT session cookies (`jose`), password hashing (`bcryptjs` with 10 salt rounds), parameterized queries
- **Testing & Diagnostics:** Automated End-to-End integration test suite, ESLint, TypeScript compiler (`tsc`)

---

## 5. SQL Database Commands (MySQL 8.0+ InnoDB)

### 5.1 Core Relational Schema (DDL)

```sql
-- 1. Users table (students and administrators)
CREATE TABLE users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('student', 'admin') NOT NULL DEFAULT 'student',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_users_email UNIQUE (email)
) ENGINE=InnoDB;

-- 2. Hostels table
CREATE TABLE hostels (
  hostel_id INT AUTO_INCREMENT PRIMARY KEY,
  hostel_name VARCHAR(100) NOT NULL,
  address TEXT NOT NULL,
  contact_number VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3. Room types lookup table
CREATE TABLE room_types (
  room_type_id INT AUTO_INCREMENT PRIMARY KEY,
  type_name VARCHAR(50) NOT NULL,
  capacity INT NOT NULL,
  monthly_rent DECIMAL(10, 2) NOT NULL,
  CONSTRAINT uq_room_types_name UNIQUE (type_name),
  CONSTRAINT chk_room_types_capacity CHECK (capacity > 0),
  CONSTRAINT chk_room_types_rent CHECK (monthly_rent >= 0.00)
) ENGINE=InnoDB;

-- 4. Rooms physical inventory
CREATE TABLE rooms (
  room_id INT AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT NOT NULL,
  room_type_id INT NOT NULL,
  room_number VARCHAR(20) NOT NULL,
  floor INT NOT NULL DEFAULT 0,
  status ENUM('AVAILABLE', 'OCCUPIED', 'UNDER_MAINTENANCE') NOT NULL DEFAULT 'AVAILABLE',
  CONSTRAINT fk_rooms_hostel FOREIGN KEY (hostel_id) 
    REFERENCES hostels(hostel_id) ON DELETE CASCADE,
  CONSTRAINT fk_rooms_room_type FOREIGN KEY (room_type_id) 
    REFERENCES room_types(room_type_id) ON DELETE RESTRICT,
  CONSTRAINT uq_hostel_room_number UNIQUE (hostel_id, room_number),
  CONSTRAINT chk_rooms_floor CHECK (floor >= 0),
  INDEX idx_rooms_hostel_status (hostel_id, status)
) ENGINE=InnoDB;

-- 5. Applications table
CREATE TABLE applications (
  application_id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  preferred_hostel_id INT NOT NULL,
  preferred_room_type_id INT NOT NULL,
  application_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('PENDING', 'APPROVED', 'REJECTED', 'ALLOCATED') NOT NULL DEFAULT 'PENDING',
  notes TEXT NULL,
  CONSTRAINT fk_applications_student FOREIGN KEY (student_id) 
    REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_applications_hostel FOREIGN KEY (preferred_hostel_id) 
    REFERENCES hostels(hostel_id) ON DELETE RESTRICT,
  CONSTRAINT fk_applications_room_type FOREIGN KEY (preferred_room_type_id) 
    REFERENCES room_types(room_type_id) ON DELETE RESTRICT,
  INDEX idx_applications_student_status (student_id, status)
) ENGINE=InnoDB;

-- 6. Allocations table
CREATE TABLE allocations (
  allocation_id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  student_id INT NOT NULL,
  room_id INT NOT NULL,
  allocation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  status ENUM('ACTIVE', 'TERMINATED') NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT uq_allocations_application UNIQUE (application_id),
  CONSTRAINT fk_allocations_application FOREIGN KEY (application_id) 
    REFERENCES applications(application_id) ON DELETE RESTRICT,
  CONSTRAINT fk_allocations_student FOREIGN KEY (student_id) 
    REFERENCES users(user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_allocations_room FOREIGN KEY (room_id) 
    REFERENCES rooms(room_id) ON DELETE RESTRICT,
  INDEX idx_allocations_room_status (room_id, status)
) ENGINE=InnoDB;
```

### 5.2 Real-Time Occupancy View

```sql
CREATE OR REPLACE VIEW room_occupancy_summary AS
SELECT 
  r.room_id,
  r.hostel_id,
  h.hostel_name,
  r.room_number,
  r.floor,
  rt.room_type_id,
  rt.type_name,
  rt.capacity,
  rt.monthly_rent,
  COUNT(CASE WHEN a.status = 'ACTIVE' THEN a.allocation_id END) AS occupied_beds,
  (rt.capacity - COUNT(CASE WHEN a.status = 'ACTIVE' THEN a.allocation_id END)) AS available_beds,
  r.status AS physical_status,
  CASE 
    WHEN r.status = 'UNDER_MAINTENANCE' THEN 'UNDER_MAINTENANCE'
    WHEN (rt.capacity - COUNT(CASE WHEN a.status = 'ACTIVE' THEN a.allocation_id END)) <= 0 THEN 'FULL'
    ELSE 'AVAILABLE'
  END AS occupancy_status
FROM rooms r
JOIN hostels h ON r.hostel_id = h.hostel_id
JOIN room_types rt ON r.room_type_id = rt.room_type_id
LEFT JOIN allocations a ON r.room_id = a.room_id AND a.status = 'ACTIVE'
GROUP BY 
  r.room_id, r.hostel_id, h.hostel_name, r.room_number, r.floor,
  rt.room_type_id, rt.type_name, rt.capacity, rt.monthly_rent, r.status;
```

### 5.3 Concurrency Control Stored Procedure (`sp_allocate_room`)

```sql
DELIMITER //

CREATE PROCEDURE sp_allocate_room(
  IN p_application_id INT,
  IN p_room_id INT,
  IN p_start_date DATE,
  OUT p_status_code VARCHAR(50),
  OUT p_status_message VARCHAR(255),
  OUT p_allocation_id INT
)
proc_label: BEGIN
  DECLARE v_student_id INT;
  DECLARE v_app_status VARCHAR(20);
  DECLARE v_room_status VARCHAR(30);
  DECLARE v_capacity INT;
  DECLARE v_active_count INT DEFAULT 0;
  DECLARE v_existing_active INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SET p_status_code = 'TRANSACTION_FAILED';
    SET p_status_message = 'Internal error during allocation. Transaction rolled back.';
    SET p_allocation_id = NULL;
  END;

  START TRANSACTION;

  -- 1. Lock Application
  SELECT student_id, status INTO v_student_id, v_app_status
  FROM applications WHERE application_id = p_application_id FOR UPDATE;

  IF v_app_status IS NULL OR v_app_status != 'APPROVED' THEN
    ROLLBACK;
    SET p_status_code = 'APPLICATION_INELIGIBLE';
    SET p_status_message = 'Application must be in APPROVED status to allocate.';
    SET p_allocation_id = NULL;
    LEAVE proc_label;
  END IF;

  -- 2. Lock Room & Room Type (Pessimistic Locking)
  SELECT r.status, rt.capacity INTO v_room_status, v_capacity
  FROM rooms r
  JOIN room_types rt ON r.room_type_id = rt.room_type_id
  WHERE r.room_id = p_room_id FOR UPDATE;

  IF v_room_status = 'UNDER_MAINTENANCE' THEN
    ROLLBACK;
    SET p_status_code = 'ROOM_UNDER_MAINTENANCE';
    SET p_status_message = 'Cannot allocate bed: Room is under maintenance.';
    SET p_allocation_id = NULL;
    LEAVE proc_label;
  END IF;

  -- 3. Check Capacity
  SELECT COUNT(*) INTO v_active_count
  FROM allocations WHERE room_id = p_room_id AND status = 'ACTIVE';

  IF v_active_count >= v_capacity THEN
    ROLLBACK;
    SET p_status_code = 'ROOM_CAPACITY_EXCEEDED';
    SET p_status_message = CONCAT('Room capacity reached (', v_active_count, '/', v_capacity, ' occupied).');
    SET p_allocation_id = NULL;
    LEAVE proc_label;
  END IF;

  -- 4. Check Single Active Occupancy Rule
  SELECT COUNT(*) INTO v_existing_active
  FROM allocations WHERE student_id = v_student_id AND status = 'ACTIVE';

  IF v_existing_active > 0 THEN
    ROLLBACK;
    SET p_status_code = 'STUDENT_ALREADY_ALLOCATED';
    SET p_status_message = 'Student already has an active room allocation.';
    SET p_allocation_id = NULL;
    LEAVE proc_label;
  END IF;

  -- 5. Insert Allocation & Update Application
  INSERT INTO allocations (application_id, student_id, room_id, allocation_date, start_date, status)
  VALUES (p_application_id, v_student_id, p_room_id, NOW(), p_start_date, 'ACTIVE');

  SET p_allocation_id = LAST_INSERT_ID();

  UPDATE applications
  SET status = 'ALLOCATED', notes = CONCAT(COALESCE(notes, ''), ' | Allocated to room #', p_room_id)
  WHERE application_id = p_application_id;

  COMMIT;

  SET p_status_code = 'SUCCESS';
  SET p_status_message = 'Room allocated successfully.';
END //

DELIMITER ;
```

### 5.4 Database Triggers (Defense-in-Depth)

```sql
DELIMITER //

-- Prevent over-allocation on direct SQL insert
CREATE TRIGGER trg_before_allocation_insert
BEFORE INSERT ON allocations
FOR EACH ROW
BEGIN
  DECLARE v_cap INT;
  DECLARE v_active_count INT;
  DECLARE v_existing_active INT;
  DECLARE v_room_status VARCHAR(30);

  SELECT r.status, rt.capacity INTO v_room_status, v_cap
  FROM rooms r JOIN room_types rt ON r.room_type_id = rt.room_type_id
  WHERE r.room_id = NEW.room_id;

  IF v_room_status = 'UNDER_MAINTENANCE' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Maintenance Error: Room is currently under maintenance.';
  END IF;

  IF NEW.status = 'ACTIVE' THEN
    SELECT COUNT(*) INTO v_existing_active
    FROM allocations WHERE student_id = NEW.student_id AND status = 'ACTIVE';

    IF v_existing_active > 0 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Integrity Error: Student already holds an active allocation.';
    END IF;

    SELECT COUNT(*) INTO v_active_count
    FROM allocations WHERE room_id = NEW.room_id AND status = 'ACTIVE';

    IF v_active_count >= v_cap THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Capacity Error: Room capacity has been reached. Allocation rejected.';
    END IF;
  END IF;
END //

-- Mark room OCCUPIED when last bed is taken
CREATE TRIGGER trg_after_allocation_insert
AFTER INSERT ON allocations
FOR EACH ROW
BEGIN
  DECLARE v_cap INT;
  DECLARE v_active_count INT;

  IF NEW.status = 'ACTIVE' THEN
    SELECT rt.capacity INTO v_cap
    FROM rooms r JOIN room_types rt ON r.room_type_id = rt.room_type_id
    WHERE r.room_id = NEW.room_id;

    SELECT COUNT(*) INTO v_active_count
    FROM allocations WHERE room_id = NEW.room_id AND status = 'ACTIVE';

    IF v_active_count >= v_cap THEN
      UPDATE rooms SET status = 'OCCUPIED' WHERE room_id = NEW.room_id AND status = 'AVAILABLE';
    END IF;
  END IF;
END //

-- Mark room AVAILABLE when allocation is terminated
CREATE TRIGGER trg_after_allocation_update
AFTER UPDATE ON allocations
FOR EACH ROW
BEGIN
  DECLARE v_cap INT;
  DECLARE v_active_count INT;

  IF OLD.status = 'ACTIVE' AND NEW.status != 'ACTIVE' THEN
    SELECT rt.capacity INTO v_cap
    FROM rooms r JOIN room_types rt ON r.room_type_id = rt.room_type_id
    WHERE r.room_id = NEW.room_id;

    SELECT COUNT(*) INTO v_active_count
    FROM allocations WHERE room_id = NEW.room_id AND status = 'ACTIVE';

    IF v_active_count < v_cap THEN
      UPDATE rooms SET status = 'AVAILABLE' WHERE room_id = NEW.room_id AND status = 'OCCUPIED';
    END IF;
  END IF;
END //

DELIMITER ;
```

---

## 6. NoSQL Database Commands (MongoDB Atlas)

### 6.1 Collection & Document Structure

Collection: `hostel_management.activity_logs`

```javascript
// Sample JSON document inserted for ROOM_ALLOCATED event
{
  "_id": ObjectId("6727daef1b2c4e0012345678"),
  "action": "ROOM_ALLOCATED",
  "performedBy": 1,
  "targetType": "allocation",
  "targetId": 6,
  "studentId": 11,
  "roomId": 2,
  "timestamp": ISODate("2026-11-03T22:57:19.000Z"),
  "details": {
    "applicationId": 10,
    "hostelName": "Greenfield Boys PG & Hostel",
    "roomNumber": "G-102",
    "roomType": "Double Sharing",
    "startDate": "2026-11-03"
  }
}
```

### 6.2 Index Creation Commands

```javascript
db.activity_logs.createIndex({ timestamp: -1 }, { name: "idx_activity_timestamp_desc" });
db.activity_logs.createIndex({ action: 1 }, { name: "idx_activity_action" });
db.activity_logs.createIndex({ performedBy: 1 }, { name: "idx_activity_performedBy" });
db.activity_logs.createIndex({ targetType: 1 }, { name: "idx_activity_targetType" });
db.activity_logs.createIndex({ studentId: 1 }, { name: "idx_activity_studentId" });
```

### 6.3 Aggregation Pipeline Command

```javascript
db.activity_logs.aggregate([
  {
    $group: {
      _id: "$action",
      totalEvents: { $sum: 1 },
      lastOccurred: { $max: "$timestamp" }
    }
  },
  {
    $sort: { totalEvents: -1 }
  }
]);
```

---

## 7. Next.js Project Tree

```
smart-pg-hostel-management/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx               # Login with demo credentials
│   │   │   └── register/page.tsx            # Student self-registration
│   │   ├── (dashboard)/
│   │   │   ├── student/
│   │   │   │   ├── layout.tsx               # Student RBAC guard
│   │   │   │   ├── page.tsx                 # Student dashboard overview
│   │   │   │   ├── rooms/page.tsx           # Room inventory browser & filters
│   │   │   │   ├── apply/page.tsx           # Accommodation application form
│   │   │   │   ├── applications/page.tsx    # Application status tracker
│   │   │   │   └── allocated-room/page.tsx  # My allocated room & vacate action
│   │   │   └── admin/
│   │   │       ├── layout.tsx               # Admin RBAC guard
│   │   │       ├── page.tsx                 # Warden occupancy KPI dashboard
│   │   │       ├── hostels/page.tsx         # Hostel property manager
│   │   │       ├── rooms/page.tsx           # Room inventory manager
│   │   │       ├── applications/page.tsx    # Applicant review & approval queue
│   │   │       └── allocations/page.tsx     # Atomic room allocation manager
│   │   ├── api/
│   │   │   ├── auth/                        # /login, /register, /logout, /me
│   │   │   ├── hostels/                     # GET, POST, PUT, DELETE
│   │   │   ├── rooms/                       # GET (view query), POST, PUT, DELETE
│   │   │   ├── room-types/                  # GET room categories
│   │   │   ├── applications/                # GET, POST, PATCH (review)
│   │   │   └── allocations/                 # GET, POST (sp_allocate_room), /terminate
│   │   ├── layout.tsx                       # Global root layout
│   │   ├── page.tsx                         # Public landing page
│   │   └── globals.css                      # Tailwind base styles
│   ├── components/
│   │   ├── layout/                          # Navbar, Sidebar, DashboardLayout
│   │   └── ui/                              # Badge, Modal, ConfirmDialog, EmptyState
│   ├── lib/
│   │   ├── auth/                            # session.ts (jose JWT), password.ts (bcrypt)
│   │   ├── db/                              # mysql.ts (connection pool), mongodb.ts (Atlas)
│   │   └── logger/                          # logActivity() helper
│   └── types/                               # TypeScript domain interfaces
├── database/                                # SQL DDL, views, triggers, procedures, seeds
├── docs/                                    # ERD, architecture, relational schema, dictionary
├── README.md                                # Setup & execution guide
├── DATABASE_CONCEPTS.md                     # Deep-dive DBMS technical documentation
├── DEMO_TALKING_POINTS.md                   # Viva questions & answers guide
└── FRIEND_TASKS.md                          # Reserved teammate task description
```

---

## 8. Application Code / Demonstration Screenshots

*Instructions for Student Report Submission: Capture screenshots from the running local web application at `http://localhost:3000` and embed them into the spaces below.*

### 8.1 Public Landing Page & Demo Accounts
`[INSERT SCREENSHOT: Public Landing Page showing project banner, features, and Pre-Seeded Demo Credentials box]`

### 8.2 Student Room Browsing & Filtering
`[INSERT SCREENSHOT: Student portal /student/rooms showing hostel and room type filters with remaining vacancy badges]`

### 8.3 Student Accommodation Application Form
`[INSERT SCREENSHOT: Student portal /student/apply showing preferred hostel selection and notes]`

### 8.4 Warden Occupancy & KPI Dashboard
`[INSERT SCREENSHOT: Admin dashboard /admin showing total capacity, occupied beds, vacancy rate, and hostel-level summary cards]`

### 8.5 Admin Review & Approval Workflow
`[INSERT SCREENSHOT: Admin portal /admin/applications showing review modal with remarks]`

### 8.6 Atomic Room Allocation via Modal
`[INSERT SCREENSHOT: Admin portal /admin/allocations showing the Atomic Room Allocation modal pre-matching the approved applicant to vacant rooms]`

### 8.7 Student "My Allocated Room" View
`[INSERT SCREENSHOT: Student portal /student/allocated-room showing confirmed room number, hostel name, monthly rent, and self-vacate option]`

### 8.8 Concurrency & Capacity Error Handling
`[INSERT SCREENSHOT: Browser alert or modal error showing ROOM_CAPACITY_EXCEEDED when attempting to assign a student to a full room]`

---

## 9. Evaluation Rubric Completion Status

| Evaluation Criteria | Requirement | Status | Implementation Details |
| :--- | :--- | :---: | :--- |
| **Relational Database Design** | Minimum 6 normalized tables with PKs, FKs, and constraints | **COMPLETED** | 6 InnoDB tables (`users`, `hostels`, `room_types`, `rooms`, `applications`, `allocations`) with cascading updates and deletion restrictions. |
| **Integrity & Business Rules** | Enforce room capacity, prevent double bookings | **COMPLETED** | Unique constraints (`hostel_id + room_number`), trigger `trg_before_allocation_insert`, and procedure `sp_allocate_room`. |
| **Concurrency Control** | Prevent race conditions during simultaneous bookings | **COMPLETED** | Pessimistic row locking (`SELECT ... FOR UPDATE`) in `sp_allocate_room` with transactional `COMMIT` / `ROLLBACK`. |
| **Database Views** | Dynamic computation of calculated metrics | **COMPLETED** | `room_occupancy_summary` view with `LEFT JOIN` dynamic bed counting and synthesized availability status. |
| **Triggers** | Engine-level business rule enforcement | **COMPLETED** | 4 triggers covering before/after insert and update to synchronize physical room availability. |
| **Stored Procedures** | Encapsulated business workflow | **COMPLETED** | `sp_allocate_room` and `sp_terminate_allocation` handling multi-table updates within explicit transactions. |
| **NoSQL Integration** | Non-relational document database usage | **COMPLETED** | MongoDB Atlas cloud cluster with indexed `activity_logs` collection storing detailed audit documents. |
| **NoSQL Analytics** | Aggregation pipeline | **COMPLETED** | Aggregation pipeline grouping event volumes (`$group`, `$sum`, `$sort`), reserved for teammate viewer. |
| **Full-Stack Application** | Functional web application with RBAC | **COMPLETED** | Next.js 14 App Router, TypeScript, Tailwind CSS, HTTP-only signed JWT session cookies, student and admin portals. |
| **Documentation & Demo Readiness** | Clear documentation, ERD, and viva prep | **COMPLETED** | Comprehensive `README.md`, `DATABASE_CONCEPTS.md`, `DEMO_TALKING_POINTS.md`, Draw.io diagrams, and sample queries. |
