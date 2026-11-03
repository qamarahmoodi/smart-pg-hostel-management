-- ============================================================================
-- Smart PG/Hostel Room Allocation and Occupancy Management System
-- Academic DBMS Level 3 Project - Database Views
-- Engine: MySQL 8.0+ InnoDB
-- ============================================================================

USE smart_hostel_db;

-- ----------------------------------------------------------------------------
-- View: room_occupancy_summary
-- Materializes a unified real-time overview of room capacity and availability.
-- 
-- Key Characteristics:
-- 1. Uses LEFT JOIN on active allocations so rooms with ZERO occupants appear.
-- 2. Filters strictly on `a.status = 'ACTIVE'` to exclude historic/terminated stays.
-- 3. Accurately derives `occupied_beds` and remaining `available_beds`.
-- 4. Exposes an authoritative `occupancy_status`:
--    - 'UNDER_MAINTENANCE' if physically blocked
--    - 'FULL' if available beds <= 0
--    - 'AVAILABLE' if ready for new student allocations
-- ----------------------------------------------------------------------------
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
JOIN hostels h 
  ON r.hostel_id = h.hostel_id
JOIN room_types rt 
  ON r.room_type_id = rt.room_type_id
LEFT JOIN allocations a 
  ON r.room_id = a.room_id 
  AND a.status = 'ACTIVE'
GROUP BY 
  r.room_id,
  r.hostel_id,
  h.hostel_name,
  r.room_number,
  r.floor,
  rt.room_type_id,
  rt.type_name,
  rt.capacity,
  rt.monthly_rent,
  r.status;
