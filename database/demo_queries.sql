-- ============================================================================
-- Smart PG/Hostel Room Allocation and Occupancy Management System
-- Academic DBMS Level 3 Project - Demonstration & Viva SQL Queries
-- ============================================================================

USE smart_hostel_db;

-- ----------------------------------------------------------------------------
-- 1. BASIC CRUD OPERATIONS
-- ----------------------------------------------------------------------------

-- 1.1 SELECT: List all student users sorted by registration date
SELECT user_id, name, email, role, created_at 
FROM users 
WHERE role = 'student'
ORDER BY created_at DESC;

-- 1.2 INSERT: Register a new student application
INSERT INTO applications (student_id, preferred_hostel_id, preferred_room_type_id, status, notes)
VALUES (7, 1, 2, 'PENDING', 'Viva Demo: Re-applying with valid college credentials.');

-- 1.3 UPDATE: Admin reviews and approves the application
UPDATE applications 
SET status = 'APPROVED', notes = CONCAT(COALESCE(notes, ''), ' [Approved by Warden]')
WHERE application_id = LAST_INSERT_ID();

-- 1.4 DELETE: Clean up test notes or records (demonstrating safe DELETE)
DELETE FROM applications 
WHERE application_id = LAST_INSERT_ID();


-- ----------------------------------------------------------------------------
-- 2. JOINS: RELATIONAL QUERIES ACROSS MULTIPLE TABLES
-- ----------------------------------------------------------------------------

-- 2.1 INNER JOIN: Get active allocations with student name, hostel, room, and rent
SELECT 
  al.allocation_id,
  u.name AS student_name,
  u.email AS student_email,
  h.hostel_name,
  r.room_number,
  r.floor,
  rt.type_name AS room_type,
  rt.monthly_rent,
  al.start_date,
  al.status AS allocation_status
FROM allocations al
INNER JOIN users u ON al.student_id = u.user_id
INNER JOIN rooms r ON al.room_id = r.room_id
INNER JOIN hostels h ON r.hostel_id = h.hostel_id
INNER JOIN room_types rt ON r.room_type_id = rt.room_type_id
WHERE al.status = 'ACTIVE'
ORDER BY h.hostel_name, r.room_number;

-- 2.2 LEFT JOIN: List all rooms regardless of whether they have active allocations
SELECT 
  r.room_id,
  h.hostel_name,
  r.room_number,
  rt.type_name,
  rt.capacity,
  al.allocation_id,
  u.name AS occupant_name
FROM rooms r
INNER JOIN hostels h ON r.hostel_id = h.hostel_id
INNER JOIN room_types rt ON r.room_type_id = rt.room_type_id
LEFT JOIN allocations al ON r.room_id = al.room_id AND al.status = 'ACTIVE'
LEFT JOIN users u ON al.student_id = u.user_id
ORDER BY r.room_id;


-- ----------------------------------------------------------------------------
-- 3. AGGREGATIONS, GROUP BY & HAVING
-- ----------------------------------------------------------------------------

-- 3.1 Hostel Occupancy & Financial Summary (COUNT, SUM, AVG)
SELECT 
  h.hostel_name,
  COUNT(DISTINCT r.room_id) AS total_rooms,
  SUM(rt.capacity) AS total_bed_capacity,
  COUNT(DISTINCT CASE WHEN al.status = 'ACTIVE' THEN al.allocation_id END) AS occupied_beds,
  (SUM(rt.capacity) - COUNT(DISTINCT CASE WHEN al.status = 'ACTIVE' THEN al.allocation_id END)) AS vacant_beds,
  AVG(rt.monthly_rent) AS average_room_rent,
  SUM(CASE WHEN al.status = 'ACTIVE' THEN rt.monthly_rent ELSE 0 END) AS projected_monthly_revenue
FROM hostels h
JOIN rooms r ON h.hostel_id = r.hostel_id
JOIN room_types rt ON r.room_type_id = rt.room_type_id
LEFT JOIN allocations al ON r.room_id = al.room_id AND al.status = 'ACTIVE'
GROUP BY h.hostel_id, h.hostel_name;

-- 3.2 GROUP BY with HAVING: Find room types with average rent greater than 6000
SELECT 
  rt.type_name,
  rt.capacity,
  COUNT(r.room_id) AS room_count,
  AVG(rt.monthly_rent) AS avg_rent
FROM room_types rt
JOIN rooms r ON rt.room_type_id = r.room_type_id
GROUP BY rt.room_type_id, rt.type_name, rt.capacity
HAVING avg_rent > 6000.00;


-- ----------------------------------------------------------------------------
-- 4. SUBQUERIES
-- ----------------------------------------------------------------------------

-- 4.1 Subquery with IN: Students who currently do NOT have any room allocation
SELECT user_id, name, email 
FROM users 
WHERE role = 'student'
  AND user_id NOT IN (
    SELECT student_id 
    FROM allocations 
    WHERE status = 'ACTIVE'
  );

-- 4.2 Correlated Subquery: Find rooms where occupied count is less than room capacity
SELECT 
  r.room_id,
  r.room_number,
  (SELECT capacity FROM room_types WHERE room_type_id = r.room_type_id) AS total_capacity,
  (SELECT COUNT(*) FROM allocations WHERE room_id = r.room_id AND status = 'ACTIVE') AS active_occupants
FROM rooms r
WHERE r.status <> 'UNDER_MAINTENANCE'
  AND (
    SELECT COUNT(*) FROM allocations WHERE room_id = r.room_id AND status = 'ACTIVE'
  ) < (
    SELECT capacity FROM room_types WHERE room_type_id = r.room_type_id
  );


-- ----------------------------------------------------------------------------
-- 5. DATABASE VIEW DEMONSTRATION
-- ----------------------------------------------------------------------------

-- 5.1 Query the room_occupancy_summary view for all available rooms
SELECT 
  room_id,
  hostel_name,
  room_number,
  floor,
  type_name,
  capacity,
  occupied_beds,
  available_beds,
  occupancy_status
FROM room_occupancy_summary
WHERE occupancy_status = 'AVAILABLE'
ORDER BY hostel_name, room_number;

-- 5.2 Filter the view by a specific hostel
SELECT * 
FROM room_occupancy_summary 
WHERE hostel_id = 1;


-- ----------------------------------------------------------------------------
-- 6. INDEX USAGE DEMONSTRATION (EXPLAIN)
-- ----------------------------------------------------------------------------

-- 6.1 Verify index utilization on composite index (hostel_id, status)
EXPLAIN SELECT * 
FROM rooms 
WHERE hostel_id = 1 AND status = 'AVAILABLE';

-- 6.2 Verify index utilization on allocations (room_id, status)
EXPLAIN SELECT * 
FROM allocations 
WHERE room_id = 1 AND status = 'ACTIVE';


-- ----------------------------------------------------------------------------
-- 7. TRIGGER VERIFICATION: CAPACITY ENFORCEMENT
-- ----------------------------------------------------------------------------

-- 7.1 Try to insert an allocation for Room 1 (G-101, Single Deluxe, cap 1, ALREADY OCCUPIED)
-- Expected Outcome: FAILS with "Capacity Error: Room capacity has been reached. Allocation rejected."
-- (Uncomment to execute test):
-- INSERT INTO allocations (application_id, student_id, room_id, allocation_date, start_date, status)
-- VALUES (4, 5, 1, NOW(), '2026-02-01', 'ACTIVE');


-- ----------------------------------------------------------------------------
-- 8. STORED PROCEDURE DEMONSTRATION (ATOMIC CONCURRENCY & TRANSACTION)
-- ----------------------------------------------------------------------------

-- 8.1 Scenario A: Successful Allocation of Rohan Gupta (Application 4) to Room 3 (G-201)
CALL sp_allocate_room(
  4,                  -- p_application_id (Rohan Gupta, Status: APPROVED)
  3,                  -- p_room_id (G-201, Double Sharing, currently 0/2)
  '2026-02-01',       -- p_start_date
  @out_status_code,
  @out_status_message,
  @out_alloc_id
);

-- Check procedure output variables
SELECT 
  @out_status_code AS status_code, 
  @out_status_message AS status_message, 
  @out_alloc_id AS new_allocation_id;

-- Verify application status changed to ALLOCATED
SELECT application_id, student_id, status 
FROM applications 
WHERE application_id = 4;

-- 8.2 Scenario B: Failed Allocation (Attempting duplicate allocation for same application)
-- Expected: Rejection with APPLICATION_INELIGIBLE
CALL sp_allocate_room(
  4,                  -- Application 4 is now ALLOCATED, ineligible for second allocation
  3,
  '2026-02-01',
  @err_code,
  @err_msg,
  @err_id
);

SELECT @err_code AS failed_code, @err_msg AS failed_message;

-- 8.3 Scenario C: Rollback Verification
-- Verify that the failed attempt did NOT insert any partial allocation record
SELECT COUNT(*) AS total_allocations_for_app_4 
FROM allocations 
WHERE application_id = 4;
