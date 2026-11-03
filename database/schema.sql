-- ============================================================================
-- Smart PG/Hostel Room Allocation and Occupancy Management System
-- Academic DBMS Level 3 Project - Relational Schema DDL
-- Engine: MySQL 8.0+ InnoDB
-- ============================================================================

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS smart_hostel_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE smart_hostel_db;

-- ----------------------------------------------------------------------------
-- Table 1: users
-- Stores both students and hostel administrators with secure role-based access.
-- Passwords must ALWAYS be stored as cryptographic hashes (bcrypt).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('student', 'admin') NOT NULL DEFAULT 'student',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_users_email UNIQUE (email),
  INDEX idx_users_role (role),
  INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table 2: hostels
-- Stores physical hostel / PG properties and their contact details.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hostels (
  hostel_id INT AUTO_INCREMENT PRIMARY KEY,
  hostel_name VARCHAR(150) NOT NULL,
  address TEXT NOT NULL,
  contact_number VARCHAR(20) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_hostels_name (hostel_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table 3: room_types
-- Normalizes room tiers, standard capacity (beds per room), and monthly rent.
-- Enforces CHECK constraints to ensure valid positive capacities and rents.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS room_types (
  room_type_id INT AUTO_INCREMENT PRIMARY KEY,
  type_name VARCHAR(50) NOT NULL,
  capacity INT NOT NULL,
  monthly_rent DECIMAL(10, 2) NOT NULL,
  CONSTRAINT uq_room_types_name UNIQUE (type_name),
  CONSTRAINT chk_room_types_capacity CHECK (capacity > 0),
  CONSTRAINT chk_room_types_rent CHECK (monthly_rent >= 0.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table 4: rooms
-- Physical rooms located within a specific hostel, tied to a room type.
-- Enforces composite uniqueness: no duplicate room_number within the same hostel.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rooms (
  room_id INT AUTO_INCREMENT PRIMARY KEY,
  hostel_id INT NOT NULL,
  room_type_id INT NOT NULL,
  room_number VARCHAR(20) NOT NULL,
  floor INT NOT NULL DEFAULT 1,
  status ENUM('AVAILABLE', 'OCCUPIED', 'UNDER_MAINTENANCE') NOT NULL DEFAULT 'AVAILABLE',
  CONSTRAINT uq_hostel_room_number UNIQUE (hostel_id, room_number),
  CONSTRAINT chk_rooms_floor CHECK (floor >= 0),
  CONSTRAINT fk_rooms_hostel FOREIGN KEY (hostel_id)
    REFERENCES hostels (hostel_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_rooms_room_type FOREIGN KEY (room_type_id)
    REFERENCES room_types (room_type_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  INDEX idx_rooms_hostel_status (hostel_id, status),
  INDEX idx_rooms_type (room_type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table 5: applications
-- Applications submitted by students specifying their accommodation preferences.
-- Tracks progression: PENDING -> APPROVED / REJECTED -> ALLOCATED.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS applications (
  application_id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  preferred_hostel_id INT NOT NULL,
  preferred_room_type_id INT NOT NULL,
  application_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('PENDING', 'APPROVED', 'REJECTED', 'ALLOCATED') NOT NULL DEFAULT 'PENDING',
  notes TEXT NULL,
  CONSTRAINT fk_applications_student FOREIGN KEY (student_id)
    REFERENCES users (user_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_applications_hostel FOREIGN KEY (preferred_hostel_id)
    REFERENCES hostels (hostel_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT fk_applications_room_type FOREIGN KEY (preferred_room_type_id)
    REFERENCES room_types (room_type_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  INDEX idx_applications_student_status (student_id, status),
  INDEX idx_applications_status (status),
  INDEX idx_applications_hostel (preferred_hostel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table 6: allocations
-- Transactional assignment of a specific student to a physical room bed.
-- application_id is UNIQUE: prevents duplicate allocations for one application.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS allocations (
  allocation_id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  student_id INT NOT NULL,
  room_id INT NOT NULL,
  allocation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  status ENUM('ACTIVE', 'TERMINATED') NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT uq_allocations_application UNIQUE (application_id),
  CONSTRAINT fk_allocations_application FOREIGN KEY (application_id)
    REFERENCES applications (application_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT fk_allocations_student FOREIGN KEY (student_id)
    REFERENCES users (user_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT fk_allocations_room FOREIGN KEY (room_id)
    REFERENCES rooms (room_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  INDEX idx_allocations_room_status (room_id, status),
  INDEX idx_allocations_student_status (student_id, status),
  INDEX idx_allocations_dates (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
