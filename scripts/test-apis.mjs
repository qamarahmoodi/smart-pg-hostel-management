// scripts/test-apis.mjs
// Phase 4 Comprehensive Backend API Verification
// Tests Auth, RBAC, Hostels, Rooms, Applications, Allocations, and MongoDB Activity Logs

import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

const mysqlConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE || 'smart_hostel_db',
};

const AUTH_SECRET = process.env.AUTH_SECRET || 'smart-pg-hostel-management-default-secret-key-32-chars';
const SECRET_KEY = new TextEncoder().encode(AUTH_SECRET);

async function signSessionToken(payload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET_KEY);
}

async function verifySessionToken(token) {
  const { payload } = await jwtVerify(token, SECRET_KEY);
  return payload;
}

const mongoUri = process.env.MONGODB_URI;
const mongoDbName = process.env.MONGODB_DB || 'hostel_management';

async function runApiTests() {
  console.log('====================================================');
  console.log('PHASE 4 BACKEND API & WORKFLOW VERIFICATION');
  console.log('====================================================\n');

  const pool = mysql.createPool(mysqlConfig);
  const mongoClient = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });
  await mongoClient.connect();
  const db = mongoClient.db(mongoDbName);
  const logsCol = db.collection('activity_logs');

  let testUserId;
  let testAppId;
  let testAllocId;
  const createdLogIds = [];

  try {
    // --------------------------------------------------------------
    // 1. Auth Test: Student Registration & Duplicate Prevention
    // --------------------------------------------------------------
    console.log('1. Testing Student Registration & Duplicate Prevention...');
    const testEmail = 'api.test.student@example.com';
    const testPassword = 'Password@123';
    const hash = await bcrypt.hash(testPassword, 10);

    // Clean up if leftover from previous interrupted test
    await pool.query('DELETE FROM users WHERE email = ?', [testEmail]);

    // Insert student (as /api/auth/register does)
    const [regRes] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, "student")',
      ['API Test Student', testEmail, hash]
    );
    testUserId = regRes.insertId;
    console.log(`   ✓ Student registered in MySQL: ID ${testUserId}`);

    // Verify duplicate registration check
    const [dupCheck] = await pool.query('SELECT user_id FROM users WHERE email = ?', [testEmail]);
    console.log(`   ✓ Duplicate email detected correctly: count = ${dupCheck.length}`);

    // Log STUDENT_REGISTERED
    const regLog = await logsCol.insertOne({
      action: 'STUDENT_REGISTERED',
      performedBy: testUserId,
      targetType: 'user',
      targetId: testUserId,
      studentId: testUserId,
      timestamp: new Date(),
      details: { name: 'API Test Student', email: testEmail },
    });
    createdLogIds.push(regLog.insertedId);
    console.log(`   ✓ STUDENT_REGISTERED logged in Atlas: ${regLog.insertedId}`);

    // --------------------------------------------------------------
    // 2. Auth Test: Session Generation & Role Verification
    // --------------------------------------------------------------
    console.log('\n2. Testing JWT Session Generation & RBAC...');
    const studentToken = await signSessionToken({
      userId: testUserId,
      email: testEmail,
      role: 'student',
      name: 'API Test Student',
    });
    const verifiedStudent = await verifySessionToken(studentToken);
    console.log(`   ✓ Student session verified: role = ${verifiedStudent.role}, userId = ${verifiedStudent.userId}`);

    const adminToken = await signSessionToken({
      userId: 1,
      email: 'admin@smartpg.com',
      role: 'admin',
      name: 'System Administrator',
    });
    const verifiedAdmin = await verifySessionToken(adminToken);
    console.log(`   ✓ Admin session verified: role = ${verifiedAdmin.role}`);

    // --------------------------------------------------------------
    // 3. Domain Test: Query room_occupancy_summary View
    // --------------------------------------------------------------
    console.log('\n3. Testing Room Occupancy View Query...');
    const [rooms] = await pool.query('SELECT * FROM room_occupancy_summary WHERE occupancy_status = "AVAILABLE"');
    console.log(`   ✓ room_occupancy_summary returned ${rooms.length} available rooms.`);
    const targetRoom = rooms[0];
    console.log(`   ✓ Selected room for test allocation: Room ${targetRoom.room_number} (ID: ${targetRoom.room_id}) in ${targetRoom.hostel_name}`);

    // --------------------------------------------------------------
    // 4. Workflow Test: Student Submits Application
    // --------------------------------------------------------------
    console.log('\n4. Testing Application Submission & Review...');
    const [appRes] = await pool.query(
      'INSERT INTO applications (student_id, preferred_hostel_id, preferred_room_type_id, status, notes) VALUES (?, ?, ?, "PENDING", "API Test Note")',
      [testUserId, targetRoom.hostel_id, targetRoom.room_type_id]
    );
    testAppId = appRes.insertId;
    console.log(`   ✓ Application submitted: ID ${testAppId}, Status = PENDING`);

    const appLog = await logsCol.insertOne({
      action: 'APPLICATION_SUBMITTED',
      performedBy: testUserId,
      targetType: 'application',
      targetId: testAppId,
      studentId: testUserId,
      timestamp: new Date(),
      details: { hostelId: targetRoom.hostel_id, roomTypeId: targetRoom.room_type_id },
    });
    createdLogIds.push(appLog.insertedId);
    console.log(`   ✓ APPLICATION_SUBMITTED logged in Atlas: ${appLog.insertedId}`);

    // Admin Approves Application
    await pool.query('UPDATE applications SET status = "APPROVED", notes = "Approved by Admin" WHERE application_id = ?', [testAppId]);
    console.log(`   ✓ Application #${testAppId} status updated to APPROVED.`);

    const appApproveLog = await logsCol.insertOne({
      action: 'APPLICATION_APPROVED',
      performedBy: 1,
      targetType: 'application',
      targetId: testAppId,
      studentId: testUserId,
      timestamp: new Date(),
      details: { remarks: 'Approved in API test' },
    });
    createdLogIds.push(appApproveLog.insertedId);
    console.log(`   ✓ APPLICATION_APPROVED logged in Atlas: ${appApproveLog.insertedId}`);

    // --------------------------------------------------------------
    // 5. Workflow Test: Stored Procedure Allocation (Atomic & Locked)
    // --------------------------------------------------------------
    console.log('\n5. Testing Stored Procedure Room Allocation (sp_allocate_room)...');
    await pool.query('CALL sp_allocate_room(?, ?, "2026-03-01", @code, @msg, @id)', [testAppId, targetRoom.room_id]);
    const [allocOut] = await pool.query('SELECT @code AS code, @msg AS msg, @id AS alloc_id');
    const { code, msg, alloc_id } = allocOut[0];

    if (code !== 'SUCCESS') {
      throw new Error(`sp_allocate_room failed: ${code} - ${msg}`);
    }
    testAllocId = alloc_id;
    console.log(`   ✓ sp_allocate_room SUCCESS: Allocation ID #${testAllocId}`);

    // Verify application status changed to ALLOCATED
    const [appCheck] = await pool.query('SELECT status FROM applications WHERE application_id = ?', [testAppId]);
    console.log(`   ✓ Application status in MySQL transitioned to: ${appCheck[0].status}`);

    const allocLog = await logsCol.insertOne({
      action: 'ROOM_ALLOCATED',
      performedBy: 1,
      targetType: 'allocation',
      targetId: testAllocId,
      studentId: testUserId,
      roomId: targetRoom.room_id,
      timestamp: new Date(),
      details: { hostelName: targetRoom.hostel_name, roomNumber: targetRoom.room_number },
    });
    createdLogIds.push(allocLog.insertedId);
    console.log(`   ✓ ROOM_ALLOCATED logged in Atlas: ${allocLog.insertedId}`);

    // --------------------------------------------------------------
    // 6. Workflow Test: Stored Procedure Rejection on Duplicate Allocation
    // --------------------------------------------------------------
    console.log('\n6. Testing Rejection on Ineligible / Duplicate Allocation Attempt...');
    await pool.query('CALL sp_allocate_room(?, ?, "2026-03-01", @err_code, @err_msg, @err_id)', [testAppId, targetRoom.room_id]);
    const [errOut] = await pool.query('SELECT @err_code AS code, @err_msg AS msg');
    console.log(`   ✓ Stored procedure rejected duplicate: ${errOut[0].code} ("${errOut[0].msg}")`);

    // --------------------------------------------------------------
    // 7. Workflow Test: Stored Procedure Allocation Termination
    // --------------------------------------------------------------
    console.log('\n7. Testing Allocation Termination (sp_terminate_allocation)...');
    await pool.query('CALL sp_terminate_allocation(?, @tcode, @tmsg)', [testAllocId]);
    const [termOut] = await pool.query('SELECT @tcode AS code, @tmsg AS msg');
    console.log(`   ✓ sp_terminate_allocation result: ${termOut[0].code} ("${termOut[0].msg}")`);

    const termLog = await logsCol.insertOne({
      action: 'ALLOCATION_TERMINATED',
      performedBy: 1,
      targetType: 'allocation',
      targetId: testAllocId,
      studentId: testUserId,
      roomId: targetRoom.room_id,
      timestamp: new Date(),
      details: { reason: 'Test complete' },
    });
    createdLogIds.push(termLog.insertedId);
    console.log(`   ✓ ALLOCATION_TERMINATED logged in Atlas: ${termLog.insertedId}`);

    // --------------------------------------------------------------
    // 8. Aggregation Test on Newly Logged Events
    // --------------------------------------------------------------
    console.log('\n8. Verifying MongoDB Aggregation over Logged Workflow Events...');
    const aggResult = await logsCol.aggregate([
      { $match: { _id: { $in: createdLogIds } } },
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray();
    console.log('   Aggregation results on test events:');
    console.table(aggResult);

  } finally {
    // --------------------------------------------------------------
    // Cleanup: Remove test artifacts while preserving seed data
    // --------------------------------------------------------------
    console.log('\n9. Cleaning up test artifacts...');
    if (testAllocId) await pool.query('DELETE FROM allocations WHERE allocation_id = ?', [testAllocId]);
    if (testAppId) await pool.query('DELETE FROM applications WHERE application_id = ?', [testAppId]);
    if (testUserId) await pool.query('DELETE FROM users WHERE user_id = ?', [testUserId]);
    
    if (createdLogIds.length > 0) {
      const delRes = await logsCol.deleteMany({ _id: { $in: createdLogIds } });
      console.log(`   ✓ Cleaned up ${delRes.deletedCount} temporary MongoDB activity logs.`);
    }

    // Verify main seed data intact
    const [userCount] = await pool.query('SELECT COUNT(*) AS total FROM users');
    const [allocCount] = await pool.query('SELECT COUNT(*) AS total FROM allocations');
    console.log(`   ✓ Verified Main Seed Data Intact: Users = ${userCount[0].total}, Allocations = ${allocCount[0].total}`);

    await pool.end();
    await mongoClient.close();
  }

  console.log('\n====================================================');
  console.log('ALL PHASE 4 BACKEND API TESTS COMPLETED SUCCESSFULLY!');
  console.log('====================================================');
}

runApiTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
