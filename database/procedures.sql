-- ============================================================================
-- Smart PG/Hostel Room Allocation and Occupancy Management System
-- Academic DBMS Level 3 Project - Stored Procedures & Transactions
-- Engine: MySQL 8.0+ InnoDB
-- ============================================================================

USE smart_hostel_db;

DELIMITER $$

-- ----------------------------------------------------------------------------
-- Stored Procedure: sp_allocate_room
-- Purpose: Atomically allocates a student application to a physical room bed.
--
-- Concurrency & Transaction Guarantee:
-- 1. Uses explicit START TRANSACTION ... COMMIT / ROLLBACK.
-- 2. Uses pessimistic row-level locking (SELECT ... FOR UPDATE) on the room
--    row, application row, and existing room allocations. This forces concurrent
--    transactions on the same room to serialize in FIFO order.
-- 3. Verifies room availability, maintenance state, student uniqueness, and bed capacity.
-- 4. Automatically updates application status to 'ALLOCATED'.
-- 5. If an unhandled SQL exception or constraint violation occurs, the
--    EXIT HANDLER catches the error, records the diagnostics, and rolls back cleanly.
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_allocate_room$$

CREATE PROCEDURE sp_allocate_room(
  IN p_application_id INT,
  IN p_room_id INT,
  IN p_start_date DATE,
  OUT p_status_code VARCHAR(30),
  OUT p_status_message VARCHAR(255),
  OUT p_allocation_id INT
)
proc_block: BEGIN
  -- Local variables (Must appear before handlers and executable statements)
  DECLARE v_room_id INT;
  DECLARE v_room_status VARCHAR(20);
  DECLARE v_capacity INT;
  DECLARE v_hostel_id INT;
  
  DECLARE v_app_id INT;
  DECLARE v_student_id INT;
  DECLARE v_app_status VARCHAR(20);
  
  DECLARE v_current_active INT DEFAULT 0;
  DECLARE v_student_active INT DEFAULT 0;

  -- SQLEXCEPTION handler (Must appear immediately after variable declarations)
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    GET DIAGNOSTICS CONDITION 1
      p_status_message = MESSAGE_TEXT;
    SET p_status_code = 'SQL_EXCEPTION';
    SET p_allocation_id = NULL;
    ROLLBACK;
  END;

  -- Default OUT values
  SET p_status_code = 'UNKNOWN_ERROR';
  SET p_status_message = 'An unexpected error occurred during room allocation.';
  SET p_allocation_id = NULL;

  -- 1. Begin atomic transaction
  START TRANSACTION;

  -- 2. Pessimistic lock on target room and fetch capacity
  SELECT r.room_id, r.status, rt.capacity, r.hostel_id
  INTO v_room_id, v_room_status, v_capacity, v_hostel_id
  FROM rooms r
  JOIN room_types rt ON r.room_type_id = rt.room_type_id
  WHERE r.room_id = p_room_id
  FOR UPDATE;

  -- 3. Verify room existence
  IF v_room_id IS NULL THEN
    SET p_status_code = 'ROOM_NOT_FOUND';
    SET p_status_message = CONCAT('Target room ID ', p_room_id, ' does not exist.');
    ROLLBACK;
    LEAVE proc_block;
  END IF;

  -- Verify room is not blocked for maintenance
  IF v_room_status = 'UNDER_MAINTENANCE' THEN
    SET p_status_code = 'ROOM_UNDER_MAINTENANCE';
    SET p_status_message = CONCAT('Room ID ', p_room_id, ' is currently UNDER_MAINTENANCE.');
    ROLLBACK;
    LEAVE proc_block;
  END IF;

  -- 4. Pessimistic lock on the student application
  SELECT a.application_id, a.student_id, a.status
  INTO v_app_id, v_student_id, v_app_status
  FROM applications a
  WHERE a.application_id = p_application_id
  FOR UPDATE;

  -- Verify application existence
  IF v_app_id IS NULL THEN
    SET p_status_code = 'APPLICATION_NOT_FOUND';
    SET p_status_message = CONCAT('Application ID ', p_application_id, ' does not exist.');
    ROLLBACK;
    LEAVE proc_block;
  END IF;

  -- Verify application eligibility (must be PENDING or APPROVED)
  IF v_app_status NOT IN ('PENDING', 'APPROVED') THEN
    SET p_status_code = 'APPLICATION_INELIGIBLE';
    SET p_status_message = CONCAT('Application status is ', v_app_status, '; only PENDING or APPROVED can be allocated.');
    ROLLBACK;
    LEAVE proc_block;
  END IF;

  -- 5. Verify student does not already hold another active room allocation
  SELECT COUNT(*)
  INTO v_student_active
  FROM allocations
  WHERE student_id = v_student_id AND status = 'ACTIVE'
  FOR UPDATE;

  IF v_student_active > 0 THEN
    SET p_status_code = 'STUDENT_ALREADY_ALLOCATED';
    SET p_status_message = CONCAT('Student ID ', v_student_id, ' already holds an active room allocation.');
    ROLLBACK;
    LEAVE proc_block;
  END IF;

  -- 6. Lock and count current active allocations for the room
  SELECT COUNT(*)
  INTO v_current_active
  FROM allocations
  WHERE room_id = p_room_id AND status = 'ACTIVE'
  FOR UPDATE;

  -- 7. Verify capacity headroom
  IF v_current_active >= v_capacity THEN
    SET p_status_code = 'ROOM_CAPACITY_EXCEEDED';
    SET p_status_message = CONCAT('Room capacity reached (', v_current_active, '/', v_capacity, ' occupied).');
    ROLLBACK;
    LEAVE proc_block;
  END IF;

  -- 8. Insert allocation record
  INSERT INTO allocations (
    application_id,
    student_id,
    room_id,
    allocation_date,
    start_date,
    status
  ) VALUES (
    p_application_id,
    v_student_id,
    p_room_id,
    CURRENT_TIMESTAMP,
    p_start_date,
    'ACTIVE'
  );

  SET p_allocation_id = LAST_INSERT_ID();

  -- 9. Transition application status to ALLOCATED
  UPDATE applications
  SET status = 'ALLOCATED'
  WHERE application_id = p_application_id;

  -- 10. Commit the transaction
  COMMIT;

  SET p_status_code = 'SUCCESS';
  SET p_status_message = 'Room allocated successfully.';
END proc_block$$

-- ----------------------------------------------------------------------------
-- Stored Procedure: sp_terminate_allocation
-- Purpose: Safely vacates a student allocation and triggers room status updates.
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_terminate_allocation$$

CREATE PROCEDURE sp_terminate_allocation(
  IN p_allocation_id INT,
  OUT p_status_code VARCHAR(30),
  OUT p_status_message VARCHAR(255)
)
term_block: BEGIN
  DECLARE v_alloc_id INT;
  DECLARE v_alloc_status VARCHAR(20);
  DECLARE v_room_id INT;

  -- SQLEXCEPTION handler (Must appear immediately after variable declarations)
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    GET DIAGNOSTICS CONDITION 1
      p_status_message = MESSAGE_TEXT;
    SET p_status_code = 'SQL_EXCEPTION';
    ROLLBACK;
  END;

  SET p_status_code = 'UNKNOWN_ERROR';
  SET p_status_message = 'An unexpected error occurred during termination.';

  START TRANSACTION;

  SELECT allocation_id, status, room_id
  INTO v_alloc_id, v_alloc_status, v_room_id
  FROM allocations
  WHERE allocation_id = p_allocation_id
  FOR UPDATE;

  IF v_alloc_id IS NULL THEN
    SET p_status_code = 'ALLOCATION_NOT_FOUND';
    SET p_status_message = CONCAT('Allocation ID ', p_allocation_id, ' was not found.');
    ROLLBACK;
    LEAVE term_block;
  END IF;

  IF v_alloc_status <> 'ACTIVE' THEN
    SET p_status_code = 'ALREADY_TERMINATED';
    SET p_status_message = 'Allocation is already terminated or inactive.';
    ROLLBACK;
    LEAVE term_block;
  END IF;

  UPDATE allocations
  SET status = 'TERMINATED', end_date = CURDATE()
  WHERE allocation_id = p_allocation_id;

  COMMIT;

  SET p_status_code = 'SUCCESS';
  SET p_status_message = 'Allocation terminated successfully.';
END term_block$$

DELIMITER ;
