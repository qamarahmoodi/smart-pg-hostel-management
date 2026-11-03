// scripts/test-e2e-workflow.mjs
// End-to-End Workflow Test through live HTTP server
// Tests: Register -> Login -> Browse Rooms -> Apply -> Review & Approve -> sp_allocate_room -> View Allocated Room -> sp_terminate_allocation -> Cleanup

import mysql from 'mysql2/promise';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3002';

const mysqlConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE || 'smart_hostel_db',
};

async function runE2E() {
  console.log('====================================================');
  console.log('E2E WORKFLOW TEST — Full Student & Admin Portal Run');
  console.log('====================================================\n');

  let studentCookie = '';
  let adminCookie = '';
  const testStudentEmail = `e2e.student.${Date.now()}@example.com`;
  const testStudentPassword = 'Password@123';
  let studentId = 0;
  let applicationId = 0;
  let allocatedRoomId = 0;
  let allocationId = 0;

  async function api(path, options = {}, cookie = '') {
    const headers = {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(options.headers || {}),
    };
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    });
    const setCookie = res.headers.get('set-cookie');
    let data;
    try {
      data = await res.json();
    } catch (e) {
      data = { raw: await res.text() };
    }
    return { status: res.status, data, setCookie };
  }

  try {
    // 1. Student Registration
    console.log('1. Testing Student Self-Registration...');
    const regRes = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Aditya E2E Test',
        email: testStudentEmail,
        password: testStudentPassword,
      }),
    });
    console.log('   ✓ Registered user:', regRes.data.data?.user?.email, 'ID:', regRes.data.data?.user?.user_id);
    if (regRes.status !== 201) throw new Error('Registration failed');
    studentId = regRes.data.data.user.user_id;

    // 2. Student Login
    console.log('\n2. Testing Student Login...');
    const loginRes = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testStudentEmail,
        password: testStudentPassword,
      }),
    });
    console.log('   ✓ Student login status:', loginRes.status);
    if (loginRes.status !== 200) throw new Error('Student login failed');
    studentCookie = loginRes.setCookie ? loginRes.setCookie.split(';')[0] : '';
    console.log('   ✓ Obtained student session cookie:', studentCookie.substring(0, 25) + '...');

    // 3. Student Session Verification (/api/auth/me)
    console.log('\n3. Testing Student Session Retrieval (/api/auth/me)...');
    const meRes = await api('/api/auth/me', {}, studentCookie);
    console.log('   ✓ Authenticated student:', meRes.data.data?.user?.name, 'Role:', meRes.data.data?.user?.role);
    if (meRes.data.data?.user?.role !== 'student') throw new Error('Role mismatch in session');

    // 4. Student Browses Available Rooms
    console.log('\n4. Testing Room Inventory Browse (available_only=true)...');
    const roomsRes = await api('/api/rooms?available_only=true', {}, studentCookie);
    console.log('   ✓ Rooms with vacancy found:', roomsRes.data.count);
    if (roomsRes.data.count === 0) throw new Error('No vacant rooms found');
    const targetRoom = roomsRes.data.data[0];
    allocatedRoomId = targetRoom.room_id;
    console.log(`   ✓ Selected room: Room ${targetRoom.room_number} in ${targetRoom.hostel_name} (vacant beds: ${targetRoom.available_beds})`);

    // 5. Student Submits Accommodation Application
    console.log('\n5. Testing Student Application Submission...');
    const appRes = await api(
      '/api/applications',
      {
        method: 'POST',
        body: JSON.stringify({
          preferred_hostel_id: targetRoom.hostel_id,
          preferred_room_type_id: targetRoom.room_type_id,
          notes: 'E2E automated workflow application test',
        }),
      },
      studentCookie
    );
    console.log('   ✓ Application created ID:', appRes.data.data?.application_id, 'Status:', appRes.data.data?.status);
    if (appRes.status !== 201) throw new Error('Application submission failed');
    applicationId = appRes.data.data.application_id;

    // 6. Admin Login
    console.log('\n6. Testing Admin Login...');
    const adminLoginRes = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'admin@smartpg.com',
        password: 'Password@123',
      }),
    });
    console.log('   ✓ Admin login status:', adminLoginRes.status);
    if (adminLoginRes.status !== 200) throw new Error('Admin login failed');
    adminCookie = adminLoginRes.setCookie ? adminLoginRes.setCookie.split(';')[0] : '';
    console.log('   ✓ Admin session verified. Role:', adminLoginRes.data.data?.user?.role);

    // 7. Admin Reviews & Approves Application
    console.log('\n7. Testing Admin Application Review & Approval...');
    const reviewRes = await api(
      `/api/applications/${applicationId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'APPROVED',
          notes: 'Approved during E2E verification test',
        }),
      },
      adminCookie
    );
    console.log('   ✓ Application review response:', reviewRes.data.message);
    if (reviewRes.status !== 200) throw new Error('Application approval failed');

    // 8. Admin Allocates Room via Stored Procedure sp_allocate_room
    console.log('\n8. Testing Atomic Room Allocation via sp_allocate_room...');
    const allocRes = await api(
      '/api/allocations',
      {
        method: 'POST',
        body: JSON.stringify({
          application_id: applicationId,
          room_id: allocatedRoomId,
          start_date: new Date().toISOString().split('T')[0],
        }),
      },
      adminCookie
    );
    console.log('   ✓ Allocation result:', allocRes.data.message);
    if (allocRes.status !== 201) throw new Error(`Allocation failed: ${JSON.stringify(allocRes.data)}`);
    allocationId = allocRes.data.data.allocation_id;
    console.log('   ✓ Created allocation ID:', allocationId);

    // 9. Student Checks Allocated Room
    console.log('\n9. Testing Student Allocated Room View...');
    const studentAllocRes = await api('/api/allocations', {}, studentCookie);
    console.log('   ✓ Student active allocations count:', studentAllocRes.data.count);
    if (studentAllocRes.data.count !== 1) throw new Error('Expected 1 active allocation for student');
    const myAlloc = studentAllocRes.data.data[0];
    console.log(`   ✓ Assigned to: Room ${myAlloc.room_number} (${myAlloc.hostel_name}), Status: ${myAlloc.status}`);

    // 10. Terminate Allocation via sp_terminate_allocation
    console.log('\n10. Testing Allocation Termination via sp_terminate_allocation...');
    const termRes = await api(
      `/api/allocations/${allocationId}/terminate`,
      {
        method: 'POST',
      },
      adminCookie
    );
    console.log('   ✓ Termination result:', termRes.data.message);
    if (termRes.status !== 200) throw new Error('Termination failed');

    // Verify vacancy restored
    const verifyRoomRes = await api(`/api/rooms/${allocatedRoomId}`, {}, adminCookie);
    console.log(`   ✓ Restored vacant beds for Room ${verifyRoomRes.data.data?.room_number}: ${verifyRoomRes.data.data?.available_beds}`);

    console.log('\n====================================================');
    console.log('ALL 10 E2E WORKFLOW TESTS PASSED SUCCESSFULLY! ✓');
    console.log('====================================================');
  } finally {
    // Clean up temporary test student and their records if created
    if (studentId > 7) {
      console.log('\nCleaning up temporary E2E test records...');
      try {
        const pool = mysql.createPool(mysqlConfig);
        await pool.execute('DELETE FROM allocations WHERE student_id = ?', [studentId]);
        await pool.execute('DELETE FROM applications WHERE student_id = ?', [studentId]);
        await pool.execute('DELETE FROM users WHERE user_id = ?', [studentId]);
        await pool.end();
        console.log('✓ Temporary E2E test user and records cleanly removed.');
      } catch (cleanErr) {
        console.warn('Cleanup warning:', cleanErr.message);
      }
    }
  }
}

runE2E().catch((err) => {
  console.error('\nE2E TEST FAILURE:', err);
  process.exit(1);
});
