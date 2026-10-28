import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/index.js';
import {
  resetFallbackStore,
  getFallbackStore,
  findLetterById,
  getAttendanceByLecture,
  findStudentBySapId
} from '../src/db.js';
import { generateToken, ROLES } from '../src/auth.js';

describe('Coordinator Letter Decisions -> Student & Teacher Portal Sync Regression Suite', () => {
  let server;
  let baseUrl;

  // Isolated QA tokens for Coordinator, Teacher, and Students
  const coordinatorToken = generateToken({
    id: 'QA-USR-COORD-01',
    username: 'coordinator',
    name: 'Prof. Kulkarni (Attendance Coordinator)',
    role: ROLES.COORDINATOR,
    department: 'Academic Administration'
  });

  const teacherExtcToken = generateToken({
    id: 'QA-USR-TEACHER-EXTC',
    username: 'teacher.extc',
    name: 'Prof. Sharma',
    role: ROLES.TEACHER,
    department: 'Electronics & Telecommunication',
    facultyId: 'FAC-106',
    facultyIds: ['FAC-106', 'FAC-105']
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

  const studentSaraToken = generateToken({
    id: 'STU-003',
    username: '60001240003',
    sapId: '60001240003',
    name: 'Sara Khan',
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
    delete process.env.STRICT_POSTGRES_MODE;
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  beforeEach(() => {
    delete process.env.STRICT_POSTGRES_MODE;
    resetFallbackStore();
  });

  test('1. Approval updates the database, student portal, and relevant teacher portal', async () => {
    // Step 1: Teacher initially marks STU-001 (Riya Shah) Absent for LEC-101 (Database Systems, 2026-10-14 10:00-11:00)
    const fb = getFallbackStore();
    fb.attendance.push({
      id: 'ATT-LEC-101-STU-001',
      lectureId: 'LEC-101',
      studentId: 'STU-001',
      status: 'Absent',
      submitted: true,
      submittedBy: 'Prof. Sharma',
      submittedAt: '2026-10-14T10:30:00.000Z'
    });

    // Step 2: Queue official attendance letter for Riya Shah (SAP: 60001240001)
    const queueRes = await fetch(`${baseUrl}/letters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`
      },
      body: JSON.stringify({
        date: '2026-10-14',
        subject: 'Database Systems',
        startTime: '10:00',
        endTime: '11:00',
        reference: 'QA-REF-APPROVE-001',
        documentName: 'QA_Medical_Certificate.pdf',
        actor: 'Attendance Coordinator',
        students: [
          {
            sapId: '60001240001',
            studentName: 'Riya Shah',
            rawStudentName: 'Riya Shah',
            rawStudentId: '24CE01'
          }
        ]
      })
    });

    assert.equal(queueRes.status, 201);
    const queueBody = await queueRes.json();
    assert.equal(queueBody.items.length, 1);
    const letterId = queueBody.items[0].id;
    assert.equal(queueBody.items[0].status, 'Pending');
    assert.equal(queueBody.items[0].lectureId, 'LEC-101');

    // Step 3: Coordinator approves the letter
    const approveRes = await fetch(`${baseUrl}/letters/${letterId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`
      },
      body: JSON.stringify({
        decision: 'approve',
        actor: 'Prof. Kulkarni (Coordinator)'
      })
    });

    assert.equal(approveRes.status, 200);
    const approveBody = await approveRes.json();
    assert.equal(approveBody.item.status, 'Approved');
    assert.equal(approveBody.item.reviewedBy, 'Prof. Kulkarni (Coordinator)');
    assert.ok(approveBody.item.reviewedAt);

    // Step 4: Verify persisted database/store state
    const persistedLetter = await findLetterById(letterId);
    assert.equal(persistedLetter.status, 'Approved');
    const lectureAttendance = await getAttendanceByLecture('LEC-101');
    const riyaRecord = lectureAttendance.find(a => a.studentId === 'STU-001');
    assert.ok(riyaRecord, 'Attendance record for STU-001 must exist');
    assert.equal(riyaRecord.status, 'Present', 'Attendance status must be updated from Absent to Present');
    assert.equal(riyaRecord.correctionReference, 'QA-REF-APPROVE-001');

    // Step 5: Verify Student Portal API endpoints (/api/student/attendance and /api/student/letters)
    const studentAttRes = await fetch(`${baseUrl}/student/attendance`, {
      headers: { Authorization: `Bearer ${studentRiyaToken}` }
    });
    assert.equal(studentAttRes.status, 200);
    const studentAttBody = await studentAttRes.json();
    assert.equal(studentAttBody.sapId, '60001240001');
    const portalAttRecord = studentAttBody.attendance.find(a => a.lectureId === 'LEC-101');
    assert.ok(portalAttRecord, 'Student portal must return LEC-101 attendance record');
    assert.equal(portalAttRecord.status, 'Present');
    assert.ok(portalAttRecord.lecture, 'Student portal attendance record must include lecture metadata');
    assert.equal(portalAttRecord.lecture.subject, 'Database Systems');
    assert.equal(studentAttBody.summary.present, 1);
    assert.equal(studentAttBody.summary.approvedLetters, 1);

    const studentLettersRes = await fetch(`${baseUrl}/student/letters`, {
      headers: { Authorization: `Bearer ${studentRiyaToken}` }
    });
    assert.equal(studentLettersRes.status, 200);
    const studentLettersBody = await studentLettersRes.json();
    const portalLetter = studentLettersBody.letters.find(l => l.id === letterId);
    assert.ok(portalLetter);
    assert.equal(portalLetter.status, 'Approved');

    // Step 6: Verify Teacher Portal API endpoints (/api/lectures/LEC-101/roster and /api/dashboard)
    const rosterRes = await fetch(`${baseUrl}/lectures/LEC-101/roster`, {
      headers: { Authorization: `Bearer ${teacherExtcToken}` }
    });
    assert.equal(rosterRes.status, 200);
    const rosterBody = await rosterRes.json();
    const riyaInRoster = rosterBody.rosterWithStatus.find(s => s.sapId === '60001240001');
    assert.ok(riyaInRoster, 'Teacher lecture rosterWithStatus must include exempted student');
    assert.equal(riyaInRoster.attendanceStatus, 'Present');
    assert.equal(riyaInRoster.approvedLetter.id, letterId);
    assert.equal(rosterBody.summary.presentCount, 1);
    assert.equal(rosterBody.summary.approvedLetterCount, 1);
  });

  test('2. Rejection updates both relevant portal views and does not grant attendance', async () => {
    // Queue letter for Arjun Mehta (STU-002, SAP: 60001240002)
    const queueRes = await fetch(`${baseUrl}/letters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`
      },
      body: JSON.stringify({
        date: '2026-10-14',
        subject: 'Database Systems',
        startTime: '10:00',
        endTime: '11:00',
        reference: 'QA-REF-REJECT-002',
        documentName: 'QA_Unverified_Note.pdf',
        students: [
          {
            sapId: '60001240002',
            studentName: 'Arjun Mehta',
            rawStudentName: 'Arjun Mehta',
            rawStudentId: '24CE02'
          }
        ]
      })
    });
    assert.equal(queueRes.status, 201);
    const { items } = await queueRes.json();
    const letterId = items[0].id;

    // Coordinator rejects the letter with a reason
    const rejectRes = await fetch(`${baseUrl}/letters/${letterId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`
      },
      body: JSON.stringify({
        decision: 'reject',
        actor: 'Prof. Kulkarni (Coordinator)',
        reason: 'Missing stamped signature from faculty advisor'
      })
    });
    assert.equal(rejectRes.status, 200);
    const rejectBody = await rejectRes.json();
    assert.equal(rejectBody.item.status, 'Rejected');
    assert.equal(rejectBody.item.reviewedBy, 'Prof. Kulkarni (Coordinator)');
    assert.equal(rejectBody.item.rejectionReason, 'Missing stamped signature from faculty advisor');

    // Verify no attendance record was created for STU-002
    const lectureAttendance = await getAttendanceByLecture('LEC-101');
    const arjunRecord = lectureAttendance.find(a => a.studentId === 'STU-002');
    assert.equal(arjunRecord, undefined, 'Rejection must NEVER grant attendance or create a Present record');

    // Verify Student Portal reflects Rejected letter and 0 attendance credits
    const studentAttRes = await fetch(`${baseUrl}/student/attendance`, {
      headers: { Authorization: `Bearer ${studentArjunToken}` }
    });
    assert.equal(studentAttRes.status, 200);
    const studentAttBody = await studentAttRes.json();
    assert.equal(studentAttBody.attendance.length, 0);
    assert.equal(studentAttBody.summary.present, 0);
    assert.equal(studentAttBody.summary.rejectedLetters, 1);

    const studentLettersRes = await fetch(`${baseUrl}/student/letters`, {
      headers: { Authorization: `Bearer ${studentArjunToken}` }
    });
    const studentLettersBody = await studentLettersRes.json();
    assert.equal(studentLettersBody.letters[0].status, 'Rejected');
    assert.equal(studentLettersBody.letters[0].rejectionReason, 'Missing stamped signature from faculty advisor');

    // Verify Teacher Portal view reflects Rejected status and 0 present count
    const rosterRes = await fetch(`${baseUrl}/lectures/LEC-101/roster`, {
      headers: { Authorization: `Bearer ${teacherExtcToken}` }
    });
    const rosterBody = await rosterRes.json();
    assert.equal(rosterBody.summary.presentCount, 0);
    assert.equal(rosterBody.summary.rejectedLetterCount, 1);
    const arjunInRoster = rosterBody.rosterWithStatus.find(s => s.sapId === '60001240002');
    assert.ok(arjunInRoster);
    assert.equal(arjunInRoster.rejectedLetter.status, 'Rejected');
  });

  test('3. Unknown SAP ID does not receive attendance credit, while valid matched students can still be processed', async () => {
    // Submit multi-student letter containing 1 valid student (Riya Shah, 60001240001) and 1 unknown SAP ID (60009999999)
    const batchRes = await fetch(`${baseUrl}/letters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`
      },
      body: JSON.stringify({
        date: '2026-10-14',
        subject: 'Database Systems',
        startTime: '10:00',
        endTime: '11:00',
        reference: 'QA-REF-MIXED-003',
        students: [
          {
            sapId: '60001240001',
            studentName: 'Riya Shah',
            rawStudentName: 'Riya Shah',
            rawStudentId: '24CE01'
          },
          {
            sapId: '60009999999',
            studentName: 'Unknown Ghost Student',
            rawStudentName: 'Unknown Ghost Student',
            rawStudentId: '24CE99'
          }
        ]
      })
    });

    assert.equal(batchRes.status, 201);
    const batchBody = await batchRes.json();
    assert.equal(batchBody.items.length, 1, 'Valid matched student must be queued');
    assert.equal(batchBody.items[0].sapId, '60001240001');
    assert.equal(batchBody.skipped.length, 1, 'Unknown SAP ID must be skipped');
    assert.equal(batchBody.skipped[0].sapId, '60009999999');

    // Approve the queued valid letter via batch-decision
    const decisionRes = await fetch(`${baseUrl}/letters/batch-decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`
      },
      body: JSON.stringify({
        letterIds: [batchBody.items[0].id],
        decision: 'approve',
        actor: 'Attendance Coordinator'
      })
    });
    assert.equal(decisionRes.status, 200);
    const decisionBody = await decisionRes.json();
    assert.equal(decisionBody.approved.length, 1);

    // Verify only STU-001 received attendance credit, and unknown SAP ID received nothing
    const attendance = await getAttendanceByLecture('LEC-101');
    assert.equal(attendance.length, 1);
    assert.equal(attendance[0].studentId, 'STU-001');
    assert.equal(attendance[0].status, 'Present');
  });

  test('4. Retrying an approval does not create duplicate attendance', async () => {
    const queueRes = await fetch(`${baseUrl}/letters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`
      },
      body: JSON.stringify({
        date: '2026-10-14',
        subject: 'Database Systems',
        startTime: '10:00',
        endTime: '11:00',
        reference: 'QA-REF-IDEMPOTENT-004',
        students: [{ sapId: '60001240001', studentName: 'Riya Shah' }]
      })
    });
    const { items } = await queueRes.json();
    const letterId = items[0].id;

    // First approval succeeds
    const firstApprove = await fetch(`${baseUrl}/letters/${letterId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`
      },
      body: JSON.stringify({ decision: 'approve', actor: 'Coordinator' })
    });
    assert.equal(firstApprove.status, 200);

    // Second (retried) single approval returns 409 Conflict
    const secondApprove = await fetch(`${baseUrl}/letters/${letterId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`
      },
      body: JSON.stringify({ decision: 'approve', actor: 'Coordinator' })
    });
    assert.equal(secondApprove.status, 409);

    // Retried batch approval safely skips the already-approved letter
    const batchRetry = await fetch(`${baseUrl}/letters/batch-decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`
      },
      body: JSON.stringify({ letterIds: [letterId], decision: 'approve', actor: 'Coordinator' })
    });
    assert.equal(batchRetry.status, 200);
    const batchRetryBody = await batchRetry.json();
    assert.equal(batchRetryBody.approved.length, 0);
    assert.equal(batchRetryBody.skipped.length, 1);

    // Verify exactly ONE attendance record exists for STU-001 on LEC-101
    const attendance = await getAttendanceByLecture('LEC-101');
    const riyaRecords = attendance.filter(a => a.studentId === 'STU-001');
    assert.equal(riyaRecords.length, 1, 'Must never create duplicate attendance records on retry');
  });

  test('5. Database failure does not produce a false success or partial inconsistent state', async () => {
    const queueRes = await fetch(`${baseUrl}/letters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`
      },
      body: JSON.stringify({
        date: '2026-10-14',
        subject: 'Database Systems',
        startTime: '10:00',
        endTime: '11:00',
        reference: 'QA-REF-DB-FAIL-005',
        students: [{ sapId: '60001240001', studentName: 'Riya Shah' }]
      })
    });
    const { items } = await queueRes.json();
    const letterId = items[0].id;

    // Simulate strict database unavailability during decision persistence
    process.env.STRICT_POSTGRES_MODE = 'true';
    try {
      const failRes = await fetch(`${baseUrl}/letters/${letterId}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${coordinatorToken}`
        },
        body: JSON.stringify({ decision: 'approve', actor: 'Coordinator' })
      });
      assert.equal(failRes.status, 503, 'API must return 503 when persistence fails');
    } finally {
      delete process.env.STRICT_POSTGRES_MODE;
    }

    // Verify letter remained Pending and no partial attendance record was written
    const letterAfterFail = await findLetterById(letterId);
    assert.equal(letterAfterFail.status, 'Pending');
    const attendanceAfterFail = await getAttendanceByLecture('LEC-101');
    assert.equal(attendanceAfterFail.length, 0);
  });

  test('6. Unauthorized roles (STUDENT and TEACHER) cannot approve or reject letters', async () => {
    const queueRes = await fetch(`${baseUrl}/letters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`
      },
      body: JSON.stringify({
        date: '2026-10-14',
        subject: 'Database Systems',
        startTime: '10:00',
        endTime: '11:00',
        reference: 'QA-REF-AUTH-006',
        students: [{ sapId: '60001240001', studentName: 'Riya Shah' }]
      })
    });
    const { items } = await queueRes.json();
    const letterId = items[0].id;

    // Student attempts single approve -> 403
    const studentSingleRes = await fetch(`${baseUrl}/letters/${letterId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentRiyaToken}`
      },
      body: JSON.stringify({ decision: 'approve' })
    });
    assert.equal(studentSingleRes.status, 403);

    // Teacher attempts single approve -> 403
    const teacherSingleRes = await fetch(`${baseUrl}/letters/${letterId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherExtcToken}`
      },
      body: JSON.stringify({ decision: 'approve' })
    });
    assert.equal(teacherSingleRes.status, 403);

    // Teacher attempts batch reject -> 403
    const teacherBatchRes = await fetch(`${baseUrl}/letters/batch-decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherExtcToken}`
      },
      body: JSON.stringify({ letterIds: [letterId], decision: 'reject' })
    });
    assert.equal(teacherBatchRes.status, 403);

    // Verify letter is still Pending
    const unchanged = await findLetterById(letterId);
    assert.equal(unchanged.status, 'Pending');
  });

  test('7. Existing attendance is not accidentally overwritten by unrelated or rejected letters', async () => {
    const fb = getFallbackStore();
    // Seed existing Present attendance for STU-001 on LEC-101 and LEC-102
    fb.attendance.push(
      {
        id: 'ATT-LEC-101-STU-001',
        lectureId: 'LEC-101',
        studentId: 'STU-001',
        status: 'Present',
        submitted: true,
        submittedBy: 'Prof. Sharma',
        submittedAt: '2026-10-14T10:15:00.000Z'
      },
      {
        id: 'ATT-LEC-102-STU-001',
        lectureId: 'LEC-102',
        studentId: 'STU-001',
        status: 'Absent',
        submitted: true,
        submittedBy: 'Prof. Mehta',
        submittedAt: '2026-10-14T11:15:00.000Z'
      }
    );

    // Queue a letter for STU-001 on LEC-101 and reject it -> must NOT erase STU-001's existing Present record on LEC-101
    const queueRes = await fetch(`${baseUrl}/letters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`
      },
      body: JSON.stringify({
        date: '2026-10-14',
        subject: 'Database Systems',
        startTime: '10:00',
        endTime: '11:00',
        reference: 'QA-REF-PRESERVE-007',
        students: [{ sapId: '60001240001', studentName: 'Riya Shah' }]
      })
    });
    const { items } = await queueRes.json();
    const letterId = items[0].id;

    const rejectRes = await fetch(`${baseUrl}/letters/${letterId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`
      },
      body: JSON.stringify({ decision: 'reject', actor: 'Coordinator' })
    });
    assert.equal(rejectRes.status, 200);

    const lec101Att = await getAttendanceByLecture('LEC-101');
    assert.equal(lec101Att.find(a => a.studentId === 'STU-001')?.status, 'Present', 'Rejected letter must not erase existing valid Present record');

    const lec102Att = await getAttendanceByLecture('LEC-102');
    assert.equal(lec102Att.find(a => a.studentId === 'STU-001')?.status, 'Absent', 'Unrelated lecture attendance must remain untouched');
  });

  test('8. The teacher 24-hour deadline remains enforced while coordinator letter approval still works', async () => {
    // LEC-101 is on 2026-10-14 10:00-11:00. At 2026-10-16T12:00:00Z (>24h later), teacher edit must be rejected with 403
    const fb = getFallbackStore();
    const lec101 = fb.lectures.find(l => l.id === 'LEC-101');
    const entries = lec101.studentIds.map(sid => ({ studentId: sid, status: 'Present' }));

    const teacherLateRes = await fetch(`${baseUrl}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherExtcToken}`
      },
      body: JSON.stringify({
        lectureId: 'LEC-101',
        entries,
        actor: 'Prof. Sharma',
        serverTime: '2026-10-16T12:00:00.000Z'
      })
    });
    assert.equal(teacherLateRes.status, 403);
    const teacherLateBody = await teacherLateRes.json();
    assert.equal(teacherLateBody.code, 'CORRECTION_WINDOW_EXPIRED');

    // Coordinator can still approve an official attendance letter for LEC-101
    const queueRes = await fetch(`${baseUrl}/letters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`
      },
      body: JSON.stringify({
        date: '2026-10-14',
        subject: 'Database Systems',
        startTime: '10:00',
        endTime: '11:00',
        reference: 'QA-REF-24H-COORD-008',
        students: [{ sapId: '60001240001', studentName: 'Riya Shah' }]
      })
    });
    const { items } = await queueRes.json();
    const approveRes = await fetch(`${baseUrl}/letters/${items[0].id}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`
      },
      body: JSON.stringify({ decision: 'approve', actor: 'Coordinator' })
    });
    assert.equal(approveRes.status, 200);
    const lec101Att = await getAttendanceByLecture('LEC-101');
    assert.equal(lec101Att.find(a => a.studentId === 'STU-001')?.status, 'Present');
  });

  test('9. Portal data refreshes after a decision without requiring logout or a full browser restart (plus privacy isolation)', async () => {
    // 1. Student Riya and Teacher fetch initial state using their active session tokens
    const initStudentRes = await fetch(`${baseUrl}/student/attendance`, {
      headers: { Authorization: `Bearer ${studentRiyaToken}` }
    });
    const initStudentBody = await initStudentRes.json();
    assert.equal(initStudentBody.attendance.length, 0);

    // 2. Coordinator queues and approves a letter with afternoon time 10:00 - 01:00
    const queueRes = await fetch(`${baseUrl}/letters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`
      },
      body: JSON.stringify({
        date: '2026-10-14',
        subject: 'Database Systems',
        startTime: '10:00',
        endTime: '01:00',
        reference: 'QA-REF-LIVE-REFRESH-009',
        students: [{ sapId: '60001240001', studentName: 'Riya Shah' }]
      })
    });
    assert.equal(queueRes.status, 201);
    const { items } = await queueRes.json();
    assert.equal(items[0].validation, 'Exact lecture/time candidate');

    const approveRes = await fetch(`${baseUrl}/letters/${items[0].id}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`
      },
      body: JSON.stringify({ decision: 'approve', actor: 'Coordinator' })
    });
    assert.equal(approveRes.status, 200);

    // 3. Re-query Student & Teacher portal endpoints using the SAME tokens (no re-login required)
    const refreshedStudentRes = await fetch(`${baseUrl}/student/attendance`, {
      headers: { Authorization: `Bearer ${studentRiyaToken}` }
    });
    const refreshedStudentBody = await refreshedStudentRes.json();
    assert.equal(refreshedStudentBody.attendance.length, 1);
    assert.equal(refreshedStudentBody.attendance[0].status, 'Present');
    assert.equal(refreshedStudentBody.summary.approvedLetters, 1);

    const refreshedDashRes = await fetch(`${baseUrl}/dashboard`, {
      headers: { Authorization: `Bearer ${teacherExtcToken}` }
    });
    const refreshedDashBody = await refreshedDashRes.json();
    assert.ok(refreshedDashBody.attendance.some(a => a.lectureId === 'LEC-101' && a.studentId === 'STU-001' && a.status === 'Present'));
    assert.ok(refreshedDashBody.letters.some(l => l.id === items[0].id && l.status === 'Approved'));

    // 4. Verify student privacy isolation: Sara Khan (STU-003) cannot see Riya's letter or attendance
    const saraAttRes = await fetch(`${baseUrl}/student/attendance`, {
      headers: { Authorization: `Bearer ${studentSaraToken}` }
    });
    const saraAttBody = await saraAttRes.json();
    assert.equal(saraAttBody.attendance.length, 0);
    assert.equal(saraAttBody.letters.length, 0);

    const crossAccessRes = await fetch(`${baseUrl}/student/60001240001/attendance`, {
      headers: { Authorization: `Bearer ${studentSaraToken}` }
    });
    assert.equal(crossAccessRes.status, 403, 'One student must never access another student attendance endpoint');
  });
});

