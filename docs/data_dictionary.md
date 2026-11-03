# Database Data Dictionary

Comprehensive technical specification of all data structures implemented in the **Smart PG/Hostel Room Allocation and Occupancy Management System**.

---

## 1. Relational Database (MySQL 8.0+ InnoDB — `smart_hostel_db`)

### 1.1 Table: `users`
Stores user accounts for both students and system administrators (wardens).

| Column Name | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `user_id` | `INT` | No | PK | Auto-increment | Unique identifier for each user |
| `name` | `VARCHAR(100)` | No | | None | Full legal name of user |
| `email` | `VARCHAR(150)` | No | UK | None | Unique email address used for authentication |
| `password_hash` | `VARCHAR(255)` | No | | None | Salted bcrypt password hash (`$2a$10$...`) |
| `role` | `ENUM('student', 'admin')` | No | | `'student'` | Access role for authorization |
| `created_at` | `TIMESTAMP` | Yes | | `CURRENT_TIMESTAMP` | Account creation timestamp |

- **Constraints:**
  - PK: `user_id`
  - Unique: `uq_users_email (email)`

---

### 1.2 Table: `hostels`
Stores hostel and PG properties managed by the institution.

| Column Name | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `hostel_id` | `INT` | No | PK | Auto-increment | Unique identifier for the hostel property |
| `hostel_name` | `VARCHAR(100)` | No | | None | Display name of the hostel building |
| `address` | `TEXT` | No | | None | Full physical street address |
| `contact_number`| `VARCHAR(20)` | No | | None | Primary phone number for warden/office |
| `created_at` | `TIMESTAMP` | Yes | | `CURRENT_TIMESTAMP` | Record registration timestamp |

- **Constraints:**
  - PK: `hostel_id`

---

### 1.3 Table: `room_types`
Lookup table defining room categories, bed capacities, and standard monthly rent.

| Column Name | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `room_type_id` | `INT` | No | PK | Auto-increment | Unique identifier for the room category |
| `type_name` | `VARCHAR(50)` | No | UK | None | Category name (`Single Deluxe`, `Double Sharing`, etc.) |
| `capacity` | `INT` | No | | None | Total bed capacity of rooms in this category |
| `monthly_rent` | `DECIMAL(10,2)` | No | | None | Standard monthly rent in INR |

- **Constraints:**
  - PK: `room_type_id`
  - Unique: `uq_room_types_name (type_name)`
  - Check: `chk_room_types_capacity (capacity > 0)`
  - Check: `chk_room_types_rent (monthly_rent >= 0.00)`

---

### 1.4 Table: `rooms`
Physical inventory of rooms across all hostels.

| Column Name | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `room_id` | `INT` | No | PK | Auto-increment | Unique identifier for the physical room |
| `hostel_id` | `INT` | No | FK | None | References `hostels(hostel_id)` |
| `room_type_id` | `INT` | No | FK | None | References `room_types(room_type_id)` |
| `room_number` | `VARCHAR(20)` | No | | None | Room designation string (e.g., `G-101`, `202`) |
| `floor` | `INT` | No | | `0` | Floor index (0 = Ground, 1 = 1st Floor, etc.) |
| `status` | `ENUM('AVAILABLE', 'OCCUPIED', 'UNDER_MAINTENANCE')` | No | | `'AVAILABLE'` | Physical availability status |

- **Constraints & Foreign Keys:**
  - PK: `room_id`
  - FK: `fk_rooms_hostel` (`hostel_id`) -> `hostels(hostel_id)` `ON DELETE CASCADE`
  - FK: `fk_rooms_room_type` (`room_type_id`) -> `room_types(room_type_id)` `ON DELETE RESTRICT`
  - Unique: `uq_hostel_room_number (hostel_id, room_number)`
  - Check: `chk_rooms_floor (floor >= 0)`
- **Indexes:**
  - `idx_rooms_hostel_status (hostel_id, status)`

---

### 1.5 Table: `applications`
Student accommodation requests detailing preferred hostel and category.

| Column Name | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `application_id` | `INT` | No | PK | Auto-increment | Unique identifier for the application |
| `student_id` | `INT` | No | FK | None | References `users(user_id)` |
| `preferred_hostel_id` | `INT` | No | FK | None | References `hostels(hostel_id)` |
| `preferred_room_type_id`| `INT` | No | FK | None | References `room_types(room_type_id)` |
| `application_date` | `TIMESTAMP` | Yes | | `CURRENT_TIMESTAMP` | Timestamp of submission |
| `status` | `ENUM('PENDING', 'APPROVED', 'REJECTED', 'ALLOCATED')` | No | | `'PENDING'` | Application workflow state |
| `notes` | `TEXT` | Yes | | `NULL` | Student notes or warden review remarks |

- **Constraints & Foreign Keys:**
  - PK: `application_id`
  - FK: `fk_applications_student` (`student_id`) -> `users(user_id)` `ON DELETE CASCADE`
  - FK: `fk_applications_hostel` (`preferred_hostel_id`) -> `hostels(hostel_id)` `ON DELETE RESTRICT`
  - FK: `fk_applications_room_type` (`preferred_room_type_id`) -> `room_types(room_type_id)` `ON DELETE RESTRICT`
- **Indexes:**
  - `idx_applications_student_status (student_id, status)`

---

### 1.6 Table: `allocations`
Authoritative occupancy assignments connecting students to specific rooms.

| Column Name | Data Type | Nullable | Key | Default | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `allocation_id` | `INT` | No | PK | Auto-increment | Unique identifier for the allocation |
| `application_id` | `INT` | No | FK, UK | None | References originating `applications(application_id)` |
| `student_id` | `INT` | No | FK | None | References `users(user_id)` |
| `room_id` | `INT` | No | FK | None | References assigned `rooms(room_id)` |
| `allocation_date` | `TIMESTAMP` | Yes | | `CURRENT_TIMESTAMP` | When assignment was confirmed |
| `start_date` | `DATE` | No | | None | Lease / tenancy commencement date |
| `end_date` | `DATE` | Yes | | `NULL` | Vacation / tenancy termination date |
| `status` | `ENUM('ACTIVE', 'TERMINATED')` | No | | `'ACTIVE'` | Occupancy status |

- **Constraints & Foreign Keys:**
  - PK: `allocation_id`
  - Unique: `uq_allocations_application (application_id)`
  - FK: `fk_allocations_application` (`application_id`) -> `applications(application_id)` `ON DELETE RESTRICT`
  - FK: `fk_allocations_student` (`student_id`) -> `users(user_id)` `ON DELETE RESTRICT`
  - FK: `fk_allocations_room` (`room_id`) -> `rooms(room_id)` `ON DELETE RESTRICT`
- **Indexes:**
  - `idx_allocations_room_status (room_id, status)`

---

## 2. Relational View (`room_occupancy_summary`)

| Column Name | Source | Data Type | Description |
| :--- | :--- | :--- | :--- |
| `room_id` | `r.room_id` | `INT` | Primary room identifier |
| `hostel_id` | `r.hostel_id` | `INT` | Hostel identifier |
| `hostel_name` | `h.hostel_name` | `VARCHAR(100)` | Name of the hostel property |
| `room_number` | `r.room_number` | `VARCHAR(20)` | Room number string |
| `floor` | `r.floor` | `INT` | Floor index |
| `room_type_id` | `rt.room_type_id` | `INT` | Category identifier |
| `type_name` | `rt.type_name` | `VARCHAR(50)` | Room category name |
| `capacity` | `rt.capacity` | `INT` | Maximum bed capacity |
| `monthly_rent` | `rt.monthly_rent` | `DECIMAL(10,2)` | Monthly rent in INR |
| `occupied_beds` | `COUNT(CASE...)` | `BIGINT` | Active occupants currently allocated |
| `available_beds`| `(capacity - occupied)`| `BIGINT` | Remaining beds free for new allocation |
| `physical_status`| `r.status` | `ENUM` | Physical maintenance flag |
| `occupancy_status`| `CASE WHEN...` | `VARCHAR(20)` | Authoritative status: `'AVAILABLE'`, `'FULL'`, or `'UNDER_MAINTENANCE'` |

---

## 3. MongoDB Audit Store (`hostel_management.activity_logs`)

Stores audit documents for critical business events.

### 3.1 Document Schema

| Field Name | BSON Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Yes | MongoDB primary document identifier |
| `action` | `String` | Yes | Event action type (e.g. `STUDENT_REGISTERED`, `APPLICATION_SUBMITTED`, `ROOM_ALLOCATED`) |
| `performedBy` | `Int32 / Int64` | Yes | MySQL `user_id` of student or admin initiating the action |
| `targetType` | `String` | Yes | Entity type affected (`'user'`, `'application'`, `'allocation'`, `'room'`, `'hostel'`) |
| `targetId` | `Int32 / Int64` | Yes | Primary key of target entity in MySQL |
| `studentId` | `Int32 / Int64` | No | Associated student ID when applicable |
| `roomId` | `Int32 / Int64` | No | Associated room ID when applicable |
| `timestamp` | `Date` | Yes | ISO UTC timestamp of event recording |
| `details` | `Object` | Yes | Arbitrary structured event metadata (rent, room numbers, notes, etc.) |

### 3.2 Collection Indexes

| Index Name | Key Specification | Purpose |
| :--- | :--- | :--- |
| `_id_` | `{ _id: 1 }` | Default primary key index |
| `idx_activity_timestamp_desc` | `{ timestamp: -1 }` | Reverse-chronological timeline feeds and range queries |
| `idx_activity_action` | `{ action: 1 }` | Action filtering and `$group` aggregation pipeline |
| `idx_activity_performedBy` | `{ performedBy: 1 }` | Auditor history for specific admin or student |
| `idx_activity_targetType` | `{ targetType: 1 }` | Entity domain queries |
| `idx_activity_studentId` | `{ studentId: 1 }` | Student activity timeline retrieval |
