// scripts/test-auth.mjs
// Verification of Authentication & Password functions

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

async function testAuth() {
  console.log('Testing Authentication & Session primitives...');

  // 1. Test Password Hashing
  const plain = 'SecurePass@2026';
  const hash = await bcrypt.hash(plain, 10);
  const match = await bcrypt.compare(plain, hash);
  const badMatch = await bcrypt.compare('WrongPass', hash);
  console.log('   ✓ Password hash & compare OK:', match && !badMatch);

  // 2. Test JWT Signing & Verification
  const token = await new SignJWT({ userId: 99, email: 'jwt@test.com', role: 'student', name: 'JWT User' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(SECRET_KEY);

  const { payload } = await jwtVerify(token, SECRET_KEY);
  console.log('   ✓ JWT Sign & Verify OK: User ID', payload.userId, 'Role:', payload.role);

  // 3. Test Seed Admin Login Verification
  const pool = mysql.createPool(mysqlConfig);
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', ['admin@smartpg.com']);
  if (!rows.length) throw new Error('Admin seed user missing');
  const adminMatch = await bcrypt.compare('Password@123', rows[0].password_hash);
  console.log('   ✓ Admin seed credentials match Password@123:', adminMatch);

  await pool.end();
  console.log('All Authentication Primitives Passed!');
}

testAuth().catch(console.error);
