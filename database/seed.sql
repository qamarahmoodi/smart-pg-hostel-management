-- ============================================================================
-- Smart PG/Hostel Room Allocation and Occupancy Management System
-- Academic DBMS Level 3 Project - Demonstration Seed Data
-- Engine: MySQL 8.0+ InnoDB
-- ============================================================================

USE smart_hostel_db;

-- Safely clear existing data in reverse dependency order
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE allocations;
TRUNCATE TABLE applications;
TRUNCATE TABLE rooms;
TRUNCATE TABLE room_types;
TRUNCATE TABLE hostels;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
-- 1. Users (Admin + Students)
-- All demo passwords are: Password@123
-- Verified bcrypt hash: $2a$10$DZ/goLnw8qgbRNw15bT8puVxwO48PY2.B9gqI84GB4O.esTqA3m0q
-- ----------------------------------------------------------------------------
INSERT INTO users (user_id, name, email, password_hash, role, created_at) VALUES
  (1, 'System Administrator', 'admin@smartpg.com', '$2a$10$DZ/goLnw8qgbRNw15bT8puVxwO48PY2.B9gqI84GB4O.esTqA3m0q', 'admin', '2026-01-01 09:00:00'),
  (2, 'Aarav Sharma', 'aarav.sharma@example.com', '$2a$10$DZ/goLnw8qgbRNw15bT8puVxwO48PY2.B9gqI84GB4O.esTqA3m0q', 'student', '2026-01-10 10:15:00'),
  (3, 'Priya Patel', 'priya.patel@example.com', '$2a$10$DZ/goLnw8qgbRNw15bT8puVxwO48PY2.B9gqI84GB4O.esTqA3m0q', 'student', '2026-01-11 11:30:00'),
  (4, 'Ananya Verma', 'ananya.verma@example.com', '$2a$10$DZ/goLnw8qgbRNw15bT8puVxwO48PY2.B9gqI84GB4O.esTqA3m0q', 'student', '2026-01-12 14:00:00'),
  (5, 'Rohan Gupta', 'rohan.gupta@example.com', '$2a$10$DZ/goLnw8qgbRNw15bT8puVxwO48PY2.B9gqI84GB4O.esTqA3m0q', 'student', '2026-01-15 16:45:00'),
  (6, 'Sneha Reddy', 'sneha.reddy@example.com', '$2a$10$DZ/goLnw8qgbRNw15bT8puVxwO48PY2.B9gqI84GB4O.esTqA3m0q', 'student', '2026-01-18 09:30:00'),
  (7, 'Vikram Singh', 'vikram.singh@example.com', '$2a$10$DZ/goLnw8qgbRNw15bT8puVxwO48PY2.B9gqI84GB4O.esTqA3m0q', 'student', '2026-01-20 12:00:00');

-- ----------------------------------------------------------------------------
-- 2. Hostels
-- ----------------------------------------------------------------------------
INSERT INTO hostels (hostel_id, hostel_name, address, contact_number, created_at) VALUES
  (1, 'Greenfield Boys PG & Hostel', '124 Tech Park Road, Whitefield, Bangalore - 560066', '+91 98765 43210', '2026-01-01 08:00:00'),
  (2, 'Sunshine Girls PG & Hostel', '45 Residency Enclave, Koramangala, Bangalore - 560034', '+91 98765 43211', '2026-01-01 08:00:00');

-- ----------------------------------------------------------------------------
-- 3. Room Types
-- ----------------------------------------------------------------------------
INSERT INTO room_types (room_type_id, type_name, capacity, monthly_rent) VALUES
  (1, 'Single Deluxe', 1, 12000.00),
  (2, 'Double Sharing', 2, 7500.00),
  (3, 'Triple Sharing', 3, 5500.00);

-- ----------------------------------------------------------------------------
-- 4. Rooms
-- ----------------------------------------------------------------------------
INSERT INTO rooms (room_id, hostel_id, room_type_id, room_number, floor, status) VALUES
  -- Greenfield Boys PG (Hostel 1)
  (1, 1, 1, 'G-101', 1, 'OCCUPIED'),           -- 1 bed, fully allocated to Aarav
  (2, 1, 2, 'G-102', 1, 'AVAILABLE'),          -- 2 beds, currently empty
  (3, 1, 2, 'G-201', 2, 'AVAILABLE'),          -- 2 beds, available for viva allocation demo
  (4, 1, 3, 'G-202', 2, 'UNDER_MAINTENANCE'),  -- Blocked for plumbing repairs
  -- Sunshine Girls PG (Hostel 2)
  (5, 2, 1, 'S-101', 1, 'AVAILABLE'),          -- 1 bed, available
  (6, 2, 2, 'S-102', 1, 'OCCUPIED'),           -- 2 beds, fully allocated to Priya & Ananya
  (7, 2, 2, 'S-201', 2, 'AVAILABLE'),          -- 2 beds, available
  (8, 2, 3, 'S-202', 2, 'AVAILABLE');          -- 3 beds, available

-- ----------------------------------------------------------------------------
-- 5. Applications
-- ----------------------------------------------------------------------------
INSERT INTO applications (application_id, student_id, preferred_hostel_id, preferred_room_type_id, application_date, status, notes) VALUES
  -- Aarav: Allocated to G-101
  (1, 2, 1, 1, '2026-01-10 11:00:00', 'ALLOCATED', 'Prefers quiet ground-floor room.'),
  -- Priya: Allocated to S-102
  (2, 3, 2, 2, '2026-01-11 12:00:00', 'ALLOCATED', 'Close to tech park.'),
  -- Ananya: Allocated to S-102 (Roommate with Priya)
  (3, 4, 2, 2, '2026-01-12 15:00:00', 'ALLOCATED', 'Requested double sharing on 1st floor.'),
  -- Rohan: Approved and ready to be allocated during viva demonstration
  (4, 5, 1, 2, '2026-01-16 10:00:00', 'APPROVED', 'Urgent joining required next week.'),
  -- Sneha: Pending review
  (5, 6, 2, 1, '2026-01-18 11:30:00', 'PENDING', 'Applying for Single Deluxe.'),
  -- Vikram: Rejected
  (6, 7, 1, 1, '2026-01-20 14:00:00', 'REJECTED', 'Documents incomplete; college ID missing.');

-- ----------------------------------------------------------------------------
-- 6. Allocations
-- Note: Respects room capacities:
-- - Room 1 (G-101, cap 1): Aarav Sharma (1/1 -> Full)
-- - Room 6 (S-102, cap 2): Priya Patel & Ananya Verma (2/2 -> Full)
-- ----------------------------------------------------------------------------
INSERT INTO allocations (allocation_id, application_id, student_id, room_id, allocation_date, start_date, end_date, status) VALUES
  (1, 1, 2, 1, '2026-01-10 14:00:00', '2026-01-15', NULL, 'ACTIVE'),
  (2, 2, 3, 6, '2026-01-11 15:00:00', '2026-01-15', NULL, 'ACTIVE'),
  (3, 3, 4, 6, '2026-01-12 16:30:00', '2026-01-15', NULL, 'ACTIVE');
