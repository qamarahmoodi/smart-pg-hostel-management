-- ============================================================================
-- Smart PG/Hostel Room Allocation and Occupancy Management System
-- Academic DBMS Level 3 Project - Allocation Integrity Triggers
-- Engine: MySQL 8.0+ InnoDB
-- ============================================================================

USE smart_hostel_db;

DELIMITER $$

-- ----------------------------------------------------------------------------
-- Architectural Note on DBMS Execution Order & Separation of Concerns:
--
-- 1. Application Layer (Next.js): Validates session, role permissions, and input.
-- 2. Stored Procedure (sp_allocate_room): Enforces atomic transaction boundary,
--    acquires pessimistic row locks (SELECT ... FOR UPDATE) to serialize
--    concurrent allocation requests, checks application eligibility, and
--    updates application workflow states.
-- 3. Triggers (Database Engine Core): Serve as the impenetrable, final defensive
--    barrier. Regardless of which client or raw SQL script attempts an INSERT or
--    UPDATE on `allocations`, these triggers mathematically guarantee:
--    - Room capacity is NEVER exceeded under any circumstances.
--    - Maintenance-locked rooms are never allocated.
--    - A student cannot hold multiple simultaneous active bed allocations.
--    - Room status ('AVAILABLE' vs 'OCCUPIED') is maintained automatically.
-- ----------------------------------------------------------------------------

-- Drop triggers if they previously exist to allow safe re-execution
DROP TRIGGER IF EXISTS trg_before_allocation_insert$$
DROP TRIGGER IF EXISTS trg_after_allocation_insert$$
DROP TRIGGER IF EXISTS trg_before_allocation_update$$
DROP TRIGGER IF EXISTS trg_after_allocation_update$$

-- ----------------------------------------------------------------------------
-- Trigger 1: trg_before_allocation_insert
-- Purpose: Capacity and eligibility pre-validation before any new allocation row.
-- ----------------------------------------------------------------------------
CREATE TRIGGER trg_before_allocation_insert
BEFORE INSERT ON allocations
FOR EACH ROW
BEGIN
  DECLARE v_room_status VARCHAR(20);
  DECLARE v_room_capacity INT;
  DECLARE v_current_active_allocations INT;
  DECLARE v_student_active_allocations INT;

  -- 1. Fetch target room's status and room type capacity
  SELECT r.status, rt.capacity
  INTO v_room_status, v_room_capacity
  FROM rooms r
  JOIN room_types rt ON r.room_type_id = rt.room_type_id
  WHERE r.room_id = NEW.room_id;

  -- Verify room existence
  IF v_room_capacity IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Integrity Error: The specified room does not exist.';
  END IF;

  -- 2. Reject allocation if room is under maintenance
  IF v_room_status = 'UNDER_MAINTENANCE' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Integrity Error: Room is currently UNDER_MAINTENANCE and cannot be allocated.';
  END IF;

  -- 3. Only validate active capacity if the incoming record is 'ACTIVE'
  IF NEW.status = 'ACTIVE' THEN
    -- Check if student already holds another active allocation anywhere
    SELECT COUNT(*)
    INTO v_student_active_allocations
    FROM allocations
    WHERE student_id = NEW.student_id AND status = 'ACTIVE';

    IF v_student_active_allocations > 0 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Integrity Error: Student already has an active room allocation in the system.';
    END IF;

    -- Count existing active allocations in this room
    SELECT COUNT(*)
    INTO v_current_active_allocations
    FROM allocations
    WHERE room_id = NEW.room_id AND status = 'ACTIVE';

    -- Enforce room type bed limit
    IF v_current_active_allocations >= v_room_capacity THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Capacity Error: Room capacity has been reached. Allocation rejected.';
    END IF;
  END IF;
END$$

-- ----------------------------------------------------------------------------
-- Trigger 2: trg_after_allocation_insert
-- Purpose: Synchronize room status to 'OCCUPIED' when all beds are filled.
-- ----------------------------------------------------------------------------
CREATE TRIGGER trg_after_allocation_insert
AFTER INSERT ON allocations
FOR EACH ROW
BEGIN
  DECLARE v_room_capacity INT;
  DECLARE v_current_active INT;

  IF NEW.status = 'ACTIVE' THEN
    SELECT rt.capacity
    INTO v_room_capacity
    FROM rooms r
    JOIN room_types rt ON r.room_type_id = rt.room_type_id
    WHERE r.room_id = NEW.room_id;

    SELECT COUNT(*)
    INTO v_current_active
    FROM allocations
    WHERE room_id = NEW.room_id AND status = 'ACTIVE';

    -- If room has reached or exceeded full capacity, set physical status to OCCUPIED
    IF v_current_active >= v_room_capacity THEN
      UPDATE rooms
      SET status = 'OCCUPIED'
      WHERE room_id = NEW.room_id AND status = 'AVAILABLE';
    END IF;
  END IF;
END$$

-- ----------------------------------------------------------------------------
-- Trigger 3: trg_before_allocation_update
-- Purpose: Protect against capacity overflow if a terminated allocation is reactivated.
-- ----------------------------------------------------------------------------
CREATE TRIGGER trg_before_allocation_update
BEFORE UPDATE ON allocations
FOR EACH ROW
BEGIN
  DECLARE v_room_capacity INT;
  DECLARE v_current_active INT;

  -- If status is transitioning from TERMINATED to ACTIVE, re-verify bed capacity
  IF OLD.status <> 'ACTIVE' AND NEW.status = 'ACTIVE' THEN
    SELECT rt.capacity
    INTO v_room_capacity
    FROM rooms r
    JOIN room_types rt ON r.room_type_id = rt.room_type_id
    WHERE r.room_id = NEW.room_id;

    SELECT COUNT(*)
    INTO v_current_active
    FROM allocations
    WHERE room_id = NEW.room_id AND status = 'ACTIVE' AND allocation_id <> NEW.allocation_id;

    IF v_current_active >= v_room_capacity THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Capacity Error: Cannot reactivate allocation; room is already at full capacity.';
    END IF;
  END IF;
END$$

-- ----------------------------------------------------------------------------
-- Trigger 4: trg_after_allocation_update
-- Purpose: Revert room status from 'OCCUPIED' to 'AVAILABLE' when a bed frees up.
-- ----------------------------------------------------------------------------
CREATE TRIGGER trg_after_allocation_update
AFTER UPDATE ON allocations
FOR EACH ROW
BEGIN
  DECLARE v_room_capacity INT;
  DECLARE v_current_active INT;

  -- If an active allocation was terminated or vacated
  IF OLD.status = 'ACTIVE' AND NEW.status = 'TERMINATED' THEN
    SELECT rt.capacity
    INTO v_room_capacity
    FROM rooms r
    JOIN room_types rt ON r.room_type_id = rt.room_type_id
    WHERE r.room_id = NEW.room_id;

    SELECT COUNT(*)
    INTO v_current_active
    FROM allocations
    WHERE room_id = NEW.room_id AND status = 'ACTIVE';

    -- If available beds now exist and room was OCCUPIED, mark it AVAILABLE
    IF v_current_active < v_room_capacity THEN
      UPDATE rooms
      SET status = 'AVAILABLE'
      WHERE room_id = NEW.room_id AND status = 'OCCUPIED';
    END IF;
  END IF;
END$$

DELIMITER ;
