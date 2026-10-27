import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/index.js';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  revokeToken,
  ROLES
} from '../src/auth.js';

describe('Phase C: Authentication & Four-Role Access Control Verification', () => {
  let server;
  let baseUrl = 'http://localhost:4000/api';

  before(async () => {
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}/api`;
  });

  after(() => {
    if (server) server.close();
  });

  // --------------------------------------------------------------------------
  // 1. Password Hashing and Cryptographic Verification
  // --------------------------------------------------------------------------
  test('Auth Unit 1: Password hashing uses secure salt and verifies correctly', () => {
    const rawPass = 'SecretPassword123!';
    const hash1 = hashPassword(rawPass);
    const hash2 = hashPassword(rawPass);

    assert.notEqual(hash1, hash2, 'Salts must ensure unique hashes for identical passwords');
    assert.ok(verifyPassword(rawPass, hash1), 'Password must verify against hash1');
    assert.ok(verifyPassword(rawPass, hash2), 'Password must verify against hash2');
    assert.equal(verifyPassword('WrongPassword', hash1), false, 'Wrong password must be rejected');
    assert.equal(verifyPassword('', hash1), false, 'Empty password must be rejected');
  });

  // --------------------------------------------------------------------------
  // 2. Token Signing, Verification & Tamper Resistance
  // --------------------------------------------------------------------------
  test('Auth Unit 2: Bearer token signing, verification, and tamper detection', () => {
    const payload = { id: 'USR-01', username: 'tester', role: ROLES.TEACHER };
    const token = generateToken(payload, 3600);
    assert.ok(token && typeof token === 'string');

    const decoded = verifyToken(token);
    assert.equal(decoded.id, 'USR-01');
    assert.equal(decoded.role, ROLES.TEACHER);

    // Tamper with payload
    const parts = token.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ ...decoded, role: ROLES.ADMIN }))
      .toString('base64')
      .replace(/=/g, '');
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    assert.throws(() => verifyToken(tamperedToken), /Invalid token signature/, 'Tampered token signature must throw');
  });

  test('Auth Unit 3: Expired token is strictly rejected', () => {
    const payload = { id: 'USR-02', username: 'expiring', role: ROLES.STUDENT };
    // Issue token with -10 seconds TTL (already expired)
    const expiredToken = generateToken(payload, -10);

    assert.throws(() => verifyToken(expiredToken), /Token has expired/, 'Expired token must throw');
  });

  test('Auth Unit 4: Token revocation (logout) invalidates subsequent usage', () => {
    const payload = { id: 'USR-03', username: 'revokeme', role: ROLES.TEACHER };
    const token = generateToken(payload, 3600);

    assert.ok(verifyToken(token));
    revokeToken(token);

    assert.throws(() => verifyToken(token), /Token has been revoked/, 'Revoked token must throw');
  });

  // --------------------------------------------------------------------------
  // 3. API Login Endpoints across all 4 roles
  // --------------------------------------------------------------------------
  test('API Login 1: ADMIN login returns token with ADMIN role', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@AttendTrack2026!'
      })
    });

    const data = await res.json();
    assert.equal(res.status, 200, `Expected 200 OK: ${JSON.stringify(data)}`);
    assert.equal(data.ok, true);
    assert.ok(data.token);
    assert.equal(data.user.role, ROLES.ADMIN);
  });

  test('API Login 2: TEACHER login returns token with TEACHER role', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'teacher.extc',
        password: process.env.TEACHER_DEFAULT_PASSWORD || 'Teacher@AttendTrack2026!'
      })
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.user.role, ROLES.TEACHER);
  });

  test('API Login 3: COORDINATOR login returns token with COORDINATOR role', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'coordinator.extc',
        password: process.env.COORD_DEFAULT_PASSWORD || 'Coordinator@AttendTrack2026!'
      })
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.user.role, ROLES.COORDINATOR);
  });

  test('API Login 4: STUDENT login with SAP ID returns token with STUDENT role', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: '60001240001',
        password: 'Student@60001240001'
      })
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.user.role, ROLES.STUDENT);
    assert.equal(data.user.sapId, '60001240001');
  });

  test('API Login 5: Invalid credentials return 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'IncorrectPassword999!'
      })
    });

    const data = await res.json();
    assert.equal(res.status, 401);
    assert.equal(data.code, 'AUTH_FAILED');
  });

  // --------------------------------------------------------------------------
  // 4. Session & Logout Endpoints
  // --------------------------------------------------------------------------
  test('API Session: /api/auth/me returns current user and rejects after logout', async () => {
    // 1. Login as teacher
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'teacher.extc',
        password: process.env.TEACHER_DEFAULT_PASSWORD || 'Teacher@AttendTrack2026!'
      })
    });
    const { token } = await loginRes.json();

    // 2. Fetch /api/auth/me with Bearer token
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.user.role, ROLES.TEACHER);

    // 3. Logout
    const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(logoutRes.status, 200);

    // 4. Subsequent call with revoked token must fail with 401
    const revokedRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(revokedRes.status, 401);
  });

  // --------------------------------------------------------------------------
  // 5. Role-Based Access Control Restrictions
  // --------------------------------------------------------------------------
  test('RBAC 1: Admin endpoints allow ADMIN token but reject TEACHER and STUDENT with 403', async () => {
    const adminToken = generateToken({ id: 'ADM-01', role: ROLES.ADMIN, username: 'admin' });
    const teacherToken = generateToken({ id: 'TEA-01', role: ROLES.TEACHER, username: 'teacher' });
    const studentToken = generateToken({ id: 'STU-01', role: ROLES.STUDENT, username: 'student' });

    // 1. Admin accesses /api/admin/students -> 200 OK
    const resAdmin = await fetch(`${baseUrl}/admin/students`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(resAdmin.status, 200);

    // 2. Teacher accesses /api/admin/students -> 403 Forbidden
    const resTeacher = await fetch(`${baseUrl}/admin/students`, {
      headers: { Authorization: `Bearer ${teacherToken}` }
    });
    assert.equal(resTeacher.status, 403);

    // 3. Student accesses /api/admin/students -> 403 Forbidden
    const resStudent = await fetch(`${baseUrl}/admin/students`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert.equal(resStudent.status, 403);
  });

  test('RBAC 2: Student is strictly prohibited from submitting attendance (403)', async () => {
    const studentToken = generateToken({ id: 'STU-01', role: ROLES.STUDENT, username: 'student' });

    const res = await fetch(`${baseUrl}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        lectureId: 'LEC-101',
        entries: [{ studentId: 'STU-001', status: 'Present' }]
      })
    });

    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.code, 'FORBIDDEN');
    assert.ok(data.error.includes('Students are not permitted'));
  });

  test('RBAC 3: Student is strictly prohibited from approving attendance letters (403)', async () => {
    const studentToken = generateToken({ id: 'STU-01', role: ROLES.STUDENT, username: 'student' });

    const res = await fetch(`${baseUrl}/letters/batch-decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        letterIds: ['LTR-001'],
        decision: 'approve'
      })
    });

    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.code, 'FORBIDDEN');
  });

  // --------------------------------------------------------------------------
  // 6. Student Privacy & Self-Access Protection
  // --------------------------------------------------------------------------
  test('Privacy 1: Student can view their own profile and attendance records', async () => {
    const studentToken = generateToken({
      id: 'STU-001',
      sapId: '60001240001',
      role: ROLES.STUDENT,
      username: '60001240001'
    });

    // 1. Own profile
    const resMe = await fetch(`${baseUrl}/student/me`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert.equal(resMe.status, 200);
    const dataMe = await resMe.json();
    assert.equal(dataMe.student.sapId, '60001240001');

    // 2. Own attendance
    const resAtt = await fetch(`${baseUrl}/student/attendance`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert.equal(resAtt.status, 200);
    const dataAtt = await resAtt.json();
    assert.equal(dataAtt.sapId, '60001240001');
  });

  test('Privacy 2: Student attempting to access another students SAP ID is strictly rejected (403)', async () => {
    const student1Token = generateToken({
      id: 'STU-001',
      sapId: '60001240001',
      role: ROLES.STUDENT,
      username: '60001240001'
    });

    // Student 1 attempts to query Student 2 (60001240002)
    const res = await fetch(`${baseUrl}/student/60001240002/attendance`, {
      headers: { Authorization: `Bearer ${student1Token}` }
    });

    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.code, 'STUDENT_PRIVACY_VIOLATION');
    assert.ok(data.error.includes('prohibited from viewing or accessing other students records'));
  });

  // --------------------------------------------------------------------------
  // 7. Security: Developer Header Bypass Prevention in Production Mode
  // --------------------------------------------------------------------------
  test('Security: Developer headers (x-user-role) and body spoofing are strictly blocked in production mode', async () => {
    const priorEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';

      // 1. Attempting /api/auth/me using x-user-role in production -> strictly 401 Unauthorized
      const resMe = await fetch(`${baseUrl}/auth/me`, {
        headers: { 'x-user-role': 'Admin' }
      });
      assert.equal(resMe.status, 401, 'Production mode must reject x-user-role header without Bearer token');

      // 2. Attempting /api/admin/students using x-user-role in production -> strictly 403 Forbidden
      const resAdmin = await fetch(`${baseUrl}/admin/students`, {
        headers: { 'x-user-role': 'Admin' }
      });
      assert.equal(resAdmin.status, 403, 'Production mode must reject x-user-role header on admin routes');

      // 3. Attempting /api/attendance/admin-correction using actor: Admin spoofing -> strictly 403 Forbidden
      const resSpoof = await fetch(`${baseUrl}/attendance/admin-correction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lectureId: 'LEC-101',
          entries: [{ studentId: 'STU-001', status: 'Present' }],
          actor: 'Admin',
          role: 'Admin',
          reason: 'Attempted bypass'
        })
      });
      assert.equal(resSpoof.status, 403, 'Spoofed body actor/role must be rejected');
    } finally {
      process.env.NODE_ENV = priorEnv;
    }
  });
});

