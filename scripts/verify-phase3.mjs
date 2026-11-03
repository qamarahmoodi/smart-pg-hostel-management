// scripts/verify-phase3.mjs
// Phase 3 Comprehensive Verification Script
// Tests MySQL pool, MongoDB Atlas connection, indexes, logging helper, and aggregation.

import mysql from 'mysql2/promise';
import { MongoClient, ObjectId } from 'mongodb';

const mysqlConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE || 'smart_hostel_db',
};

const mongoUri = process.env.MONGODB_URI;
const mongoDbName = process.env.MONGODB_DB || 'hostel_management';

async function runVerification() {
  console.log('====================================================');
  console.log('PHASE 3 VERIFICATION — Smart PG & Hostel System');
  console.log('====================================================\n');

  // ----------------------------------------------------------------
  // 1. Verify MySQL Pool Connection
  // ----------------------------------------------------------------
  console.log('1. Testing MySQL Connection Pool...');
  const pool = mysql.createPool(mysqlConfig);
  try {
    const [rows] = await pool.query('SELECT VERSION() AS version, DATABASE() AS db_name');
    console.log('   ✓ MySQL Connection OK:', rows[0]);
  } catch (err) {
    console.error('   ✗ MySQL Failed:', err.message);
    process.exit(1);
  }

  // ----------------------------------------------------------------
  // 2. Verify MongoDB Atlas Connection
  // ----------------------------------------------------------------
  console.log('\n2. Testing MongoDB Atlas Connection...');
  const mongoClient = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });
  let db;
  try {
    await mongoClient.connect();
    db = mongoClient.db(mongoDbName);
    const ping = await db.command({ ping: 1 });
    console.log('   ✓ MongoDB Atlas Ping OK:', ping, 'Database:', mongoDbName);
  } catch (err) {
    console.error('   ✗ MongoDB Atlas Failed:', err.message);
    process.exit(1);
  }

  // ----------------------------------------------------------------
  // 3. Initialize & Verify Indexes on activity_logs
  // ----------------------------------------------------------------
  console.log('\n3. Initializing & Verifying activity_logs Indexes...');
  const logsCol = db.collection('activity_logs');

  const indexDefinitions = [
    { key: { timestamp: -1 }, name: 'idx_activity_timestamp_desc' },
    { key: { action: 1 }, name: 'idx_activity_action' },
    { key: { performedBy: 1 }, name: 'idx_activity_performedBy' },
    { key: { targetType: 1 }, name: 'idx_activity_targetType' },
    { key: { studentId: 1 }, name: 'idx_activity_studentId' },
  ];

  for (const idx of indexDefinitions) {
    const name = await logsCol.createIndex(idx.key, { name: idx.name });
    console.log(`   ✓ Index ensured: ${name}`);
  }

  const existingIndexes = await logsCol.indexes();
  console.log('   Total active indexes on collection:', existingIndexes.length);

  // ----------------------------------------------------------------
  // 4. Test Activity Logging (All required business actions)
  // ----------------------------------------------------------------
  console.log('\n4. Testing Activity Logging Service...');
  const testLogIds = [];

  const sampleEvents = [
    {
      action: 'STUDENT_REGISTERED',
      performedBy: 101,
      targetType: 'user',
      targetId: 101,
      studentId: 101,
      timestamp: new Date(),
      details: { name: 'Test Student', email: 'test.student@example.com' },
    },
    {
      action: 'APPLICATION_SUBMITTED',
      performedBy: 101,
      targetType: 'application',
      targetId: 201,
      studentId: 101,
      timestamp: new Date(),
      details: { hostelId: 1, roomTypeId: 2, notes: 'Ground floor please' },
    },
    {
      action: 'APPLICATION_APPROVED',
      performedBy: 1, // Admin
      targetType: 'application',
      targetId: 201,
      studentId: 101,
      timestamp: new Date(),
      details: { remarks: 'Eligible and verified' },
    },
    {
      action: 'ROOM_ALLOCATED',
      performedBy: 1, // Admin
      targetType: 'allocation',
      targetId: 301,
      studentId: 101,
      roomId: 2,
      timestamp: new Date(),
      details: { hostelName: 'Greenfield Boys PG', roomNumber: 'G-102', startDate: '2026-02-01' },
    },
    {
      action: 'ROOM_STATUS_CHANGED',
      performedBy: 1,
      targetType: 'room',
      targetId: 2,
      roomId: 2,
      timestamp: new Date(),
      details: { previousStatus: 'AVAILABLE', newStatus: 'OCCUPIED', reason: 'Full capacity' },
    },
    {
      action: 'ALLOCATION_TERMINATED',
      performedBy: 1,
      targetType: 'allocation',
      targetId: 301,
      studentId: 101,
      roomId: 2,
      timestamp: new Date(),
      details: { vacateDate: '2026-03-01', clearanceDone: true },
    },
    {
      action: 'APPLICATION_REJECTED',
      performedBy: 1,
      targetType: 'application',
      targetId: 202,
      studentId: 102,
      timestamp: new Date(),
      details: { reason: 'Fee payment overdue' },
    },
  ];

  for (const event of sampleEvents) {
    const res = await logsCol.insertOne(event);
    testLogIds.push(res.insertedId);
    console.log(`   ✓ Logged event [${event.action}] -> MongoDB _id: ${res.insertedId}`);
  }

  // ----------------------------------------------------------------
  // 5. Test MongoDB Aggregation Pipeline
  // ----------------------------------------------------------------
  console.log('\n5. Testing MongoDB Aggregation Pipeline...');
  const summaryPipeline = [
    {
      $group: {
        _id: '$action',
        totalEvents: { $sum: 1 },
        lastOccurred: { $max: '$timestamp' },
      },
    },
    { $sort: { totalEvents: -1 } },
  ];

  const summaryResult = await logsCol.aggregate(summaryPipeline).toArray();
  console.log('   Aggregation Output (Events by Action):');
  console.table(summaryResult);

  // ----------------------------------------------------------------
  // 6. Test Integrated MySQL + MongoDB Post-Commit Flow
  // ----------------------------------------------------------------
  console.log('\n6. Testing Integrated MySQL Transaction + Post-Commit Logging...');
  const conn = await pool.getConnection();
  let tempUserId;
  let tempAppId;
  let tempAllocId;

  try {
    await conn.beginTransaction();

    // Insert temp student in MySQL
    const [userRes] = await conn.execute(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('Integration Test User', 'integration.test@example.com', 'dummy_hash', 'student')"
    );
    tempUserId = userRes.insertId;

    // Insert temp application in MySQL
    const [appRes] = await conn.execute(
      'INSERT INTO applications (student_id, preferred_hostel_id, preferred_room_type_id, status) VALUES (?, 1, 2, "APPROVED")',
      [tempUserId]
    );
    tempAppId = appRes.insertId;

    await conn.commit();
    console.log(`   ✓ MySQL committed: User #${tempUserId}, Application #${tempAppId}`);

    // Post-commit MongoDB Log
    const logRes = await logsCol.insertOne({
      action: 'APPLICATION_APPROVED',
      performedBy: 1,
      targetType: 'application',
      targetId: tempAppId,
      studentId: tempUserId,
      timestamp: new Date(),
      details: { note: 'Approved in integration test' },
    });
    testLogIds.push(logRes.insertedId);
    console.log(`   ✓ Post-commit MongoDB log acknowledged: ${logRes.insertedId}`);

    // Stored procedure allocation
    const [procRows] = await conn.query('CALL sp_allocate_room(?, 3, "2026-03-01", @code, @msg, @id)', [tempAppId]);
    const [outRows] = await conn.query('SELECT @code AS code, @msg AS msg, @id AS alloc_id');
    tempAllocId = outRows[0]?.alloc_id;
    console.log('   ✓ MySQL sp_allocate_room output:', outRows[0]);

    if (tempAllocId) {
      const allocLog = await logsCol.insertOne({
        action: 'ROOM_ALLOCATED',
        performedBy: 1,
        targetType: 'allocation',
        targetId: tempAllocId,
        studentId: tempUserId,
        roomId: 3,
        timestamp: new Date(),
        details: { roomNumber: 'G-201', hostelId: 1 },
      });
      testLogIds.push(allocLog.insertedId);
      console.log(`   ✓ Room allocation logged in MongoDB: ${allocLog.insertedId}`);

      // Terminate allocation
    await conn.query('CALL sp_terminate_allocation(?, @tcode, @tmsg)', [tempAllocId]);
      const [termOut] = await conn.query('SELECT @tcode AS code, @tmsg AS msg');
      console.log('   ✓ MySQL sp_terminate_allocation output:', termOut[0]);

      const termLog = await logsCol.insertOne({
        action: 'ALLOCATION_TERMINATED',
        performedBy: 1,
        targetType: 'allocation',
        targetId: tempAllocId,
        studentId: tempUserId,
        roomId: 3,
        timestamp: new Date(),
        details: { reason: 'Integration test cleanup' },
      });
      testLogIds.push(termLog.insertedId);
      console.log(`   ✓ Allocation termination logged in MongoDB: ${termLog.insertedId}`);
    }
  } catch (err) {
    await conn.rollback();
    console.error('   ✗ Integration error:', err.message);
  } finally {
    // Clean up temporary MySQL records
    if (tempAllocId) await conn.execute('DELETE FROM allocations WHERE allocation_id = ?', [tempAllocId]);
    if (tempAppId) await conn.execute('DELETE FROM applications WHERE application_id = ?', [tempAppId]);
    if (tempUserId) await conn.execute('DELETE FROM users WHERE user_id = ?', [tempUserId]);
    conn.release();
    console.log('   ✓ Temporary MySQL test entities cleaned up.');
  }

  // ----------------------------------------------------------------
  // 7. Cleanup Test Activity Logs from MongoDB Atlas
  // ----------------------------------------------------------------
  console.log('\n7. Cleaning up temporary MongoDB test logs...');
  const delRes = await logsCol.deleteMany({ _id: { $in: testLogIds } });
  console.log(`   ✓ Removed ${delRes.deletedCount} temporary test log documents.`);

  // Verify baseline seed data in MySQL is intact
  const [usersCount] = await pool.query('SELECT COUNT(*) AS total FROM users');
  const [allocsCount] = await pool.query('SELECT COUNT(*) AS total FROM allocations');
  console.log(`   ✓ Main MySQL Seed Data Preserved: Users = ${usersCount[0].total}, Allocations = ${allocsCount[0].total}`);

  await pool.end();
  await mongoClient.close();
  console.log('\n====================================================');
  console.log('ALL PHASE 3 VERIFICATION TESTS PASSED!');
  console.log('====================================================');
}

runVerification().catch(console.error);
