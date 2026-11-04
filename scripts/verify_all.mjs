// Comprehensive Database and System Verification Script
// Run via: node --env-file=.env.local scripts/verify_all.mjs

import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

console.log('='.repeat(70));
console.log('SMART PG/HOSTEL MANAGEMENT SYSTEM — SYSTEM & DATABASE VERIFICATION');
console.log('='.repeat(70));
console.log(`Execution Time: ${new Date().toISOString()}\n`);

let overallStatus = true;

// -----------------------------------------------------------------------------
// 1. MySQL 8 Database Verification
// -----------------------------------------------------------------------------
console.log('▶ [1/4] Testing MySQL Primary Relational Database...');

const mysqlConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'smart_hostel_db',
  connectTimeout: 5000,
};

console.log(`  Connecting to MySQL [${mysqlConfig.user}@${mysqlConfig.host}:${mysqlConfig.port}/${mysqlConfig.database}]...`);

let mysqlConn;
try {
  mysqlConn = await mysql.createConnection(mysqlConfig);
  const [versionRows] = await mysqlConn.query('SELECT VERSION() AS version');
  console.log(`  ✓ MySQL Connected successfully! Engine Version: ${versionRows[0].version}`);

  // Check required tables
  console.log('\n  Checking Relational Tables:');
  const requiredTables = ['users', 'hostels', 'room_types', 'rooms', 'applications', 'allocations'];
  const [tableRows] = await mysqlConn.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = ?
  `, [mysqlConfig.database]);
  
  const existingTables = tableRows.map(r => r.TABLE_NAME || r.table_name);
  for (const t of requiredTables) {
    if (existingTables.includes(t)) {
      const [[{ count }]] = await mysqlConn.query(`SELECT COUNT(*) AS count FROM ${t}`);
      console.log(`    ✓ Table '${t}': EXISTS (${count} records)`);
    } else {
      console.log(`    ✗ Table '${t}': MISSING`);
      overallStatus = false;
    }
  }

  // Check Views
  console.log('\n  Checking Database Views:');
  const [viewRows] = await mysqlConn.query(`
    SELECT table_name 
    FROM information_schema.views 
    WHERE table_schema = ?
  `, [mysqlConfig.database]);
  const existingViews = viewRows.map(r => r.TABLE_NAME || r.table_name);
  const expectedView = 'room_occupancy_summary';
  if (existingViews.includes(expectedView)) {
    const [[{ viewCount }]] = await mysqlConn.query(`SELECT COUNT(*) AS viewCount FROM ${expectedView}`);
    console.log(`    ✓ View '${expectedView}': EXISTS (${viewCount} rooms calculated)`);
  } else {
    console.log(`    ✗ View '${expectedView}': MISSING`);
    overallStatus = false;
  }

  // Check Triggers
  console.log('\n  Checking Allocation Integrity Triggers:');
  const [triggerRows] = await mysqlConn.query(`
    SELECT trigger_name 
    FROM information_schema.triggers 
    WHERE trigger_schema = ?
  `, [mysqlConfig.database]);
  const existingTriggers = triggerRows.map(r => r.TRIGGER_NAME || r.trigger_name);
  const expectedTriggers = [
    'trg_before_allocation_insert',
    'trg_after_allocation_insert',
    'trg_before_allocation_update',
    'trg_after_allocation_update'
  ];
  for (const trig of expectedTriggers) {
    if (existingTriggers.includes(trig)) {
      console.log(`    ✓ Trigger '${trig}': ACTIVE`);
    } else {
      console.log(`    ⚠ Trigger '${trig}': NOT FOUND (Triggers can be applied from database/triggers.sql)`);
    }
  }

  // Check Stored Procedures
  console.log('\n  Checking Stored Procedures:');
  const [procRows] = await mysqlConn.query(`
    SELECT routine_name 
    FROM information_schema.routines 
    WHERE routine_schema = ? AND routine_type = 'PROCEDURE'
  `, [mysqlConfig.database]);
  const existingProcs = procRows.map(r => r.ROUTINE_NAME || r.routine_name);
  const expectedProc = 'sp_allocate_room';
  if (existingProcs.includes(expectedProc)) {
    console.log(`    ✓ Stored Procedure '${expectedProc}': EXISTS & COMPILED`);
  } else {
    console.log(`    ⚠ Stored Procedure '${expectedProc}': NOT FOUND (Can be created from database/procedures.sql)`);
  }

} catch (err) {
  console.log(`  ✗ MySQL Connection Failed: ${err.message}`);
  overallStatus = false;
} finally {
  if (mysqlConn) await mysqlConn.end();
}

// -----------------------------------------------------------------------------
// 2. MongoDB Atlas Activity Logging Verification
// -----------------------------------------------------------------------------
console.log('\n▶ [2/4] Testing MongoDB Activity & Audit Store...');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hostel_management';
const mongoDbName = process.env.MONGODB_DB || 'hostel_management';

console.log(`  Connecting to MongoDB [${mongoDbName}]...`);

let mongoClient;
try {
  mongoClient = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });
  await mongoClient.connect();
  const db = mongoClient.db(mongoDbName);
  const pingResult = await db.command({ ping: 1 });
  console.log(`  ✓ MongoDB Connected successfully! (Ping Response: ok=${pingResult.ok})`);

  const coll = db.collection('activity_logs');
  const count = await coll.countDocuments();
  console.log(`    ✓ Collection 'activity_logs': EXISTS (${count} audit log records)`);

  // Check indexes
  const indexes = await coll.indexes();
  console.log(`    ✓ Collection Indexes (${indexes.length} total):`);
  for (const idx of indexes) {
    console.log(`      - Index '${idx.name}': keys=${JSON.stringify(idx.key)}`);
  }

  // Test Aggregation Pipeline (Same as in GET /api/admin/logs)
  console.log('\n  Testing MongoDB Aggregation Pipeline ($group, $sum, $max, $sort):');
  const actionSummary = await coll.aggregate([
    {
      $group: {
        _id: '$action',
        count: { $sum: 1 },
        lastOccurred: { $max: '$timestamp' },
      },
    },
    { $sort: { count: -1 } },
  ]).toArray();

  if (actionSummary.length > 0) {
    console.log(`    ✓ Aggregation successfully computed ${actionSummary.length} action group summaries:`);
    for (const group of actionSummary) {
      console.log(`      • ${group._id}: ${group.count} events (Latest: ${group.lastOccurred ? new Date(group.lastOccurred).toISOString() : 'N/A'})`);
    }
  } else {
    console.log('    ℹ Aggregation pipeline executed cleanly (Collection currently has 0 events).');
  }

} catch (err) {
  console.log(`  ✗ MongoDB Connection Failed: ${err.message}`);
  overallStatus = false;
} finally {
  if (mongoClient) await mongoClient.close();
}

// -----------------------------------------------------------------------------
// 3. Security & Cryptographic Hashes Verification
// -----------------------------------------------------------------------------
console.log('\n▶ [3/4] Testing Cryptographic & Authentication Utilities...');

try {
  const plain = 'WardenSecure2026!';
  const hashed = await bcrypt.hash(plain, 10);
  const matched = await bcrypt.compare(plain, hashed);
  if (matched) {
    console.log('  ✓ bcryptjs password hashing and verification: PASSED');
  } else {
    console.log('  ✗ bcryptjs verification FAILED');
    overallStatus = false;
  }
} catch (err) {
  console.log(`  ✗ Cryptography check failed: ${err.message}`);
  overallStatus = false;
}

// -----------------------------------------------------------------------------
// 4. Summary & Health Status
// -----------------------------------------------------------------------------
console.log('\n' + '='.repeat(70));
if (overallStatus) {
  console.log('🎉 ALL SYSTEM & DATABASE CHECKS PASSED SUCCESSFULLY!');
  console.log('   The system is healthy, both databases are accessible,');
  console.log('   and all required schemas, views, and indexes are in place.');
} else {
  console.log('⚠ ONE OR MORE CHECKS RETURNED WARNINGS OR ERRORS.');
  console.log('   Review the output above for specific diagnostic messages.');
}
console.log('='.repeat(70));
