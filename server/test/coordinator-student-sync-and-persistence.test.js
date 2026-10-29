import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/index.js';
import {
  saveFallbackState,
  loadFallbackState,
  resetFallbackStore,
  getFallbackStore,
  findLetterById,
  findDocumentById,
  createDocumentRecord,
  queueAttendanceLetter
} from '../src/db.js';
import { generateToken, ROLES } from '../src/auth.js';

describe('Coordinator-to-Student Synchronization, Persistence, and Session Integrity Suite', () => {
  let server;
  let baseUrl;

  // QA Tokens
  const coordinatorToken = generateToken({
    id: 'QA-COORD-01',
    username: 'coordinator',
    name: 'Prof. Kulkarni (Attendance Coordinator)',
    role: ROLES.COORDINATOR,
    department: 'EXTC'
  });

  const studentRiyaToken = generateToken({
    id: 'STU-001',
    username: '60001240001',
    sapId: '60001240001',
    name: 'Riya Shah',
    role: ROLES.STUDENT,
    department: 'Computer Engineering'
  });

  const studentArjunToken = generateToken({
    id: 'STU-002',
    username: '60001240002',
    sapId: '60001240002',
    name: 'Arjun Mehta',
    role: ROLES.STUDENT,
    department: 'Computer Engineering'
  });

  before(async () => {
    await new Promise(resolve => {
      server = app.listen(0, () => {
        baseUrl = `http://localhost:${server.address().port}/api`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  // Test 1: Coordinator uploads a letter and the student sees it promptly
  test('1. Coordinator uploads a letter and the student sees it promptly via /api/student/letters', async () => {
    const letterPayload = {
      studentId: 'STU-001',
      studentName: 'Riya Shah',
      sapId: '60001240001',
      date: '2026-10-14',
      startTime: '10:00',
      endTime: '11:00',
      subject: 'Database Systems',
      lectureId: 'LEC-101',
      validation: 'Exact lecture/time candidate',
      reason: 'ACM Student Chapter Technical Presentation'
    };

    const uploadRes = await fetch(`${baseUrl}/letters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`
      },
      body: JSON.stringify(letterPayload)
    });
    assert.equal(uploadRes.status, 201, 'Coordinator letter upload should return 201');
    const uploadedData = await uploadRes.json();
    const createdLetterId = uploadedData.item?.id || uploadedData.letter?.id;
    assert.ok(createdLetterId, 'Uploaded letter should have an ID');

    // Student immediately queries letters
    const studentRes = await fetch(`${baseUrl}/student/letters`, {
      headers: { Authorization: `Bearer ${studentRiyaToken}` }
    });
    assert.equal(studentRes.status, 200, 'Student letters endpoint should return 200');
    const studentData = await studentRes.json();
    assert.ok(Array.isArray(studentData.letters), 'Student letters should be an array');
    const found = studentData.letters.find(l => l.id === createdLetterId);
    assert.ok(found, `Student Riya should see uploaded letter ${createdLetterId} promptly`);
    assert.equal(found.status, 'Pending', 'Letter status should initially be Pending');
  });

  // Test 2: Coordinator approves or rejects a letter and student sees the updated status
  test('2. Coordinator approves or rejects a letter and the student sees updated status', async () => {
    // Create another letter for Arjun
    const letterPayload = {
      studentId: 'STU-002',
      studentName: 'Arjun Mehta',
      sapId: '60001240002',
      date: '2026-10-14',
      startTime: '10:00',
      endTime: '11:00',
      subject: 'Database Systems',
      lectureId: 'LEC-101',
      validation: 'Exact lecture/time candidate'
    };

    const upRes = await fetch(`${baseUrl}/letters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`
      },
      body: JSON.stringify(letterPayload)
    });
    assert.equal(upRes.status, 201);
    const upData = await upRes.json();
    const letterId = upData.item?.id || upData.letter?.id;
    assert.ok(letterId, 'Created letter must have an ID');

    // Coordinator approves letter
    const approveRes = await fetch(`${baseUrl}/letters/${letterId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`
      },
      body: JSON.stringify({ decision: 'approve' })
    });
    assert.equal(approveRes.status, 200, 'Letter approval should return 200');
    const approveData = await approveRes.json();
    const approvedItem = approveData.item || approveData.letter;
    assert.equal(approvedItem?.status, 'Approved');

    // Student Arjun queries his letters
    const arjunRes = await fetch(`${baseUrl}/student/letters`, {
      headers: { Authorization: `Bearer ${studentArjunToken}` }
    });
    assert.equal(arjunRes.status, 200);
    const arjunData = await arjunRes.json();
    const updatedLetter = arjunData.letters.find(l => l.id === letterId);
    assert.ok(updatedLetter, 'Student should see the letter');
    assert.equal(updatedLetter.status, 'Approved', 'Student should see status updated to Approved');

    // Student Arjun queries his attendance records (should now be Present)
    const attRes = await fetch(`${baseUrl}/student/attendance`, {
      headers: { Authorization: `Bearer ${studentArjunToken}` }
    });
    assert.equal(attRes.status, 200);
    const attData = await attRes.json();
    const matchedRecord = attData.attendance.find(a => a.lectureId === 'LEC-101');
    assert.ok(matchedRecord, 'Attendance record should be created/updated for approved lecture');
    assert.equal(matchedRecord.status, 'Present', 'Attendance record status should be Present');
  });

  // Test 3: Refreshing the student portal does not make the letter disappear
  test('3. Refreshing the student portal repeatedly does not lose or drop letters', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${baseUrl}/student/letters`, {
        headers: { Authorization: `Bearer ${studentRiyaToken}` }
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.letters.length > 0, `Query iteration ${i + 1} must return student letters`);
    }
  });

  // Test 4: Logging out and back in does not lose persisted letters
  test('4. Logging out and re-authenticating maintains full letter history', async () => {
    // Generate a fresh session token representing a re-login
    const newSessionToken = generateToken({
      id: 'STU-001',
      username: '60001240001',
      sapId: '60001240001',
      name: 'Riya Shah',
      role: ROLES.STUDENT,
      department: 'Computer Engineering'
    });

    const res = await fetch(`${baseUrl}/student/letters`, {
      headers: { Authorization: `Bearer ${newSessionToken}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.letters.length > 0, 'Re-authenticated student should retain letters');
  });

  // Test 5: A backend restart does not lose letters, statuses, or document references
  test('5. Backend process restart restores persistent state from disk without data loss', async () => {
    // Record a unique letter with attached document
    const doc = await createDocumentRecord({
      id: `DOC-TEST-RESTART-${Date.now()}`,
      storageKey: 'documents/2026/test_doc.docx',
      storageProvider: 'local',
      originalFilename: 'test_doc.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: 1024
    });

    const uniqueLetter = await queueAttendanceLetter({
      studentId: 'STU-001',
      studentName: 'Riya Shah',
      sapId: '60001240001',
      date: '2026-10-15',
      startTime: '09:00',
      endTime: '10:00',
      subject: 'Signals & Systems',
      lectureId: 'LEC-103',
      uploadId: doc.id,
      documentName: doc.originalFilename,
      validation: 'Exact lecture/time candidate'
    }, 'Attendance Coordinator');

    assert.ok(uniqueLetter.id);

    // Simulate backend process restart:
    // Reset in-memory store, then call loadFallbackState() to simulate re-hydration from disk
    const fb = getFallbackStore();
    fb.letters = [];
    fb.documents = [];

    // Prior to reload, memory is empty
    assert.equal(fb.letters.length, 0);

    // Rehydrate from disk
    loadFallbackState();

    // Verify uniqueLetter and doc were restored from disk
    const restoredLetter = await findLetterById(uniqueLetter.id);
    const restoredDoc = await findDocumentById(doc.id);

    assert.ok(restoredLetter, 'Letter must be restored from persistent disk storage after restart');
    assert.equal(restoredLetter.id, uniqueLetter.id);
    assert.ok(restoredDoc, 'Document reference must be restored from persistent storage after restart');
    assert.equal(restoredDoc.id, doc.id);
  });

  // Test 6: Failed writes produce visible errors and are not reported as successful
  test('6. Failed operations produce visible HTTP errors and are not reported as successful', async () => {
    // Attempt to approve a nonexistent letter
    const badRes = await fetch(`${baseUrl}/letters/LTR-NONEXISTENT-9999/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`
      },
      body: JSON.stringify({ decision: 'approve' })
    });
    assert.equal(badRes.status, 404, 'Non-existent letter approval should return 404 error');
    const badData = await badRes.json();
    assert.ok(badData.error, 'Error message must be present in response');

    // Attempt to upload without student ID
    const badUploadRes = await fetch(`${baseUrl}/letters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`
      },
      body: JSON.stringify({ date: '2026-10-14' })
    });
    assert.equal(badUploadRes.status, 400, 'Invalid letter payload must return 400');
  });

  // Test 7: Students cannot access another student's letters
  test('7. Students cannot access another student letters or records (authorization isolation)', async () => {
    // Student Riya attempting to access Arjun's private attendance
    const forbiddenRes = await fetch(`${baseUrl}/student/60001240002/attendance`, {
      headers: { Authorization: `Bearer ${studentRiyaToken}` }
    });
    assert.equal(forbiddenRes.status, 403, 'Cross-student access attempt should be rejected with 403 Forbidden');
    const forbidData = await forbiddenRes.json();
    assert.equal(forbidData.code, 'STUDENT_PRIVACY_VIOLATION');
  });

  // Test 8: Single and multi-student workflows continue working
  test('8. Multi-student letter queueing persists all extracted students reliably', async () => {
    const multiPayload = [
      {
        studentId: 'STU-001',
        studentName: 'Riya Shah',
        sapId: '60001240001',
        date: '2026-10-14',
        startTime: '10:00',
        endTime: '11:00',
        subject: 'Database Systems',
        lectureId: 'LEC-101',
        validation: 'Exact lecture/time candidate'
      },
      {
        studentId: 'STU-002',
        studentName: 'Arjun Mehta',
        sapId: '60001240002',
        date: '2026-10-14',
        startTime: '10:00',
        endTime: '11:00',
        subject: 'Database Systems',
        lectureId: 'LEC-101',
        validation: 'Exact lecture/time candidate'
      }
    ];

    const batchRes = await fetch(`${baseUrl}/letters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`
      },
      body: JSON.stringify({
        students: multiPayload,
        date: '2026-10-14',
        subject: 'Database Systems'
      })
    });
    assert.equal(batchRes.status, 201, 'Batch letter queueing must return 201');
    const batchData = await batchRes.json();
    assert.equal(batchData.items?.length, 2, 'Batch must record 2 letters');
  });

  // Test 9: Authentication survives refresh according to existing session design
  test('9. Authentication endpoint /api/auth/me verifies valid bearer tokens across page refreshes', async () => {
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${studentRiyaToken}` }
    });
    assert.equal(meRes.status, 200, '/api/auth/me should succeed with valid token');
    const meData = await meRes.json();
    assert.ok(meData.ok);
    assert.equal(meData.user.sapId, '60001240001');
    assert.equal(meData.user.role, 'STUDENT');

    // Invalid token must be rejected
    const invalidRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: 'Bearer invalid.token.value' }
    });
    assert.equal(invalidRes.status, 401, 'Tampered or expired token must return 401');
  });
});
