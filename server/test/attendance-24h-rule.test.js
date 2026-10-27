import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, testDatabaseConnection, getFallbackStore } from '../src/db.js';
import {
  checkAttendanceCorrectionWindow,
  getAttendanceCorrectionDeadline,
  getLectureScheduledEndTime,
  parseLectureDateTime,
  COLLEGE_TIMEZONE
} from '../src/attendance-window.js';
import app from '../src/index.js';

describe('Strict 24-Hour Attendance Correction Rule - Comprehensive Verification', () => {
  let server;
  let baseUrl = 'http://localhost:4000/api';
  let isDbOnline = false;

  // Test fixtures
  const TEST_LEC_OPEN = {
    id: 'LEC-TEST-24H-OPEN',
    subject: 'Cloud Computing Architecture',
    className: 'EXTC — Year 3 / A',
    date: '2026-10-20',
    startTime: '10:00',
    endTime: '11:00',
    studentIds: ['STU-001', 'STU-002', 'STU-003', 'STU-004']
  };

  const TEST_LEC_EXPIRED = {
    id: 'LEC-TEST-24H-EXPIRED',
    subject: 'Advanced Microprocessors',
    className: 'EXTC — Year 3 / A',
    date: '2026-10-18',
    startTime: '10:00',
    endTime: '11:00',
    studentIds: ['STU-001', 'STU-002', 'STU-003', 'STU-004']
  };

  const TEST_LEC_NEXTDAY = {
    id: 'LEC-TEST-24H-NEXTDAY',
    subject: 'Cyber Security Operations',
    className: 'EXTC — Year 3 / A',
    date: '2026-10-21',
    startTime: '16:00',
    endTime: '17:00', // Ends at 17:00, deadline is 17:00 next day
    studentIds: ['STU-001', 'STU-002', 'STU-003', 'STU-004']
  };

  async function getDbAttendance(lectureId) {
    if (isDbOnline) {
      return prisma.attendanceRecord.findMany({ where: { lectureId } });
    }
    const fb = getFallbackStore();
    return fb.attendance.filter(a => a.lectureId === lectureId);
  }

  before(async () => {
    // 1. Resolve base URL (use existing dev server or ephemeral listener)
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (!res.ok) throw new Error('Dev server not ready');
    } catch (_) {
      server = app.listen(0);
      const port = server.address().port;
      baseUrl = `http://localhost:${port}/api`;
    }

    // 2. Ensure test lectures exist in persistent PostgreSQL or fallback store
    isDbOnline = await testDatabaseConnection();
    if (isDbOnline) {
      for (const lec of [TEST_LEC_OPEN, TEST_LEC_EXPIRED, TEST_LEC_NEXTDAY]) {
        await prisma.lecture.upsert({
          where: { id: lec.id },
          update: {
            subject: lec.subject,
            className: lec.className,
            date: lec.date,
            startTime: lec.startTime,
            endTime: lec.endTime,
            studentIds: lec.studentIds
          },
          create: lec
        });
      }
    } else {
      const fb = getFallbackStore();
      for (const lec of [TEST_LEC_OPEN, TEST_LEC_EXPIRED, TEST_LEC_NEXTDAY]) {
        const idx = fb.lectures.findIndex(l => l.id === lec.id);
        if (idx >= 0) {
          fb.lectures[idx] = lec;
        } else {
          fb.lectures.push(lec);
        }
      }
    }
  });

  after(async () => {
    // Clean up test attendance records and test lectures without touching institutional data
    if (isDbOnline) {
      await prisma.attendanceRecord.deleteMany({
        where: {
          lectureId: {
            in: [TEST_LEC_OPEN.id, TEST_LEC_EXPIRED.id, TEST_LEC_NEXTDAY.id]
          }
        }
      });
      await prisma.lecture.deleteMany({
        where: {
          id: {
            in: [TEST_LEC_OPEN.id, TEST_LEC_EXPIRED.id, TEST_LEC_NEXTDAY.id]
          }
        }
      });
    } else {
      const fb = getFallbackStore();
      fb.lectures = fb.lectures.filter(l => ![TEST_LEC_OPEN.id, TEST_LEC_EXPIRED.id, TEST_LEC_NEXTDAY.id].includes(l.id));
      fb.attendance = fb.attendance.filter(a => ![TEST_LEC_OPEN.id, TEST_LEC_EXPIRED.id, TEST_LEC_NEXTDAY.id].includes(a.lectureId));
    }
    if (server) server.close();
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Before deadline (now = deadline - 2h)
  // --------------------------------------------------------------------------
  test('Scenario 1: Teacher marks attendance before 24h deadline (now = deadline - 2h) -> 201 Created or safe 503 if DB disconnected', async () => {
    const testNow = '2026-10-21T03:30:00.000Z';

    const entries = [
      { studentId: 'STU-001', status: 'Present' },
      { studentId: 'STU-002', status: 'Present' },
      { studentId: 'STU-003', status: 'Absent' },
      { studentId: 'STU-004', status: 'Present' }
    ];

    const res = await fetch(`${baseUrl}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-server-time': testNow
      },
      body: JSON.stringify({
        lectureId: TEST_LEC_OPEN.id,
        entries,
        actor: 'Prof. Test'
      })
    });

    const data = await res.json();
    if (!isDbOnline) {
      assert.equal(res.status, 503, `Disconnected DB safely returns 503 to prevent data loss: ${JSON.stringify(data)}`);
      assert.ok(data.error.includes('PostgreSQL is disconnected'));
    } else {
      assert.equal(res.status, 201, `Expected 201 Created but got ${res.status}: ${JSON.stringify(data)}`);
      assert.ok(data.message.includes('Attendance'));
      const recs = await prisma.attendanceRecord.findMany({ where: { lectureId: TEST_LEC_OPEN.id } });
      assert.equal(recs.length, 4);
      const stu1 = recs.find(r => r.studentId === 'STU-001');
      assert.equal(stu1.status, 'Present');
      const stu3 = recs.find(r => r.studentId === 'STU-003');
      assert.equal(stu3.status, 'Absent');
    }
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Just before deadline (now = deadline - 1ms)
  // --------------------------------------------------------------------------
  test('Scenario 2: Teacher corrects attendance just before deadline (now = deadline - 1ms)', async () => {
    const testNow = '2026-10-21T05:29:59.999Z';

    const entries = [
      { studentId: 'STU-001', status: 'Present' },
      { studentId: 'STU-002', status: 'Present' },
      { studentId: 'STU-003', status: 'Present' },
      { studentId: 'STU-004', status: 'Present' }
    ];

    const res = await fetch(`${baseUrl}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-server-time': testNow
      },
      body: JSON.stringify({
        lectureId: TEST_LEC_OPEN.id,
        entries,
        actor: 'Prof. Test'
      })
    });

    const data = await res.json();
    if (!isDbOnline) {
      assert.equal(res.status, 503, 'Disconnected DB safely returns 503 to prevent data loss');
    } else {
      assert.equal(res.status, 201, `Expected 201 Created but got ${res.status}: ${JSON.stringify(data)}`);
      const recs = await prisma.attendanceRecord.findMany({ where: { lectureId: TEST_LEC_OPEN.id } });
      const stu3 = recs.find(r => r.studentId === 'STU-003');
      assert.equal(stu3.status, 'Present', 'Correction should update STU-003 status to Present');
    }
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Exactly at deadline (now = deadline) -> 403 Forbidden
  // --------------------------------------------------------------------------
  test('Scenario 3: Attendance change exactly at deadline (now = deadline) -> strictly 403 Forbidden', async () => {
    const testNow = '2026-10-21T05:30:00.000Z';

    // Snapshot records before call to verify no modifications occur
    const beforeRecords = await getDbAttendance(TEST_LEC_OPEN.id);

    const entries = [
      { studentId: 'STU-001', status: 'Absent' },
      { studentId: 'STU-002', status: 'Absent' },
      { studentId: 'STU-003', status: 'Absent' },
      { studentId: 'STU-004', status: 'Absent' }
    ];

    const res = await fetch(`${baseUrl}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-server-time': testNow
      },
      body: JSON.stringify({
        lectureId: TEST_LEC_OPEN.id,
        entries,
        actor: 'Prof. Test'
      })
    });

    const data = await res.json();
    assert.equal(res.status, 403, `Expected 403 Forbidden but got ${res.status}`);
    assert.equal(data.code, 'CORRECTION_WINDOW_EXPIRED');
    assert.ok(data.error.includes('expired'), 'Error message should clearly state window is expired');

    // Verify database was NOT touched
    const afterRecords = await getDbAttendance(TEST_LEC_OPEN.id);
    assert.equal(afterRecords.length, beforeRecords.length);
    if (isDbOnline && afterRecords.length > 0) {
      const stu1 = afterRecords.find(r => r.studentId === 'STU-001');
      assert.equal(stu1.status, 'Present', 'Status must NOT have changed to Absent');
    }
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Just after deadline (now = deadline + 1ms) -> 403 Forbidden
  // --------------------------------------------------------------------------
  test('Scenario 4: Attendance change just after deadline (now = deadline + 1ms) -> strictly 403 Forbidden', async () => {
    const testNow = '2026-10-21T05:30:00.001Z';

    const entries = [
      { studentId: 'STU-001', status: 'Absent' },
      { studentId: 'STU-002', status: 'Absent' },
      { studentId: 'STU-003', status: 'Absent' },
      { studentId: 'STU-004', status: 'Absent' }
    ];

    const res = await fetch(`${baseUrl}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-server-time': testNow
      },
      body: JSON.stringify({
        lectureId: TEST_LEC_OPEN.id,
        entries,
        actor: 'Prof. Test'
      })
    });

    const data = await res.json();
    assert.equal(res.status, 403);
    assert.equal(data.code, 'CORRECTION_WINDOW_EXPIRED');
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Lecture deadline falling on next calendar day (endTime = 17:00)
  // --------------------------------------------------------------------------
  test('Scenario 5: Next-calendar-day deadline calculation (17:00 Day 1 -> 17:00 Day 2 IST)', async () => {
    const windowRes = await fetch(`${baseUrl}/attendance/window/${TEST_LEC_NEXTDAY.id}`);
    const win = await windowRes.json();
    assert.equal(win.timeZone, 'Asia/Kolkata');
    assert.equal(new Date(win.scheduledEnd).toISOString(), '2026-10-21T11:30:00.000Z');
    assert.equal(new Date(win.deadline).toISOString(), '2026-10-22T11:30:00.000Z');

    // 1 second before deadline on next calendar day: allowed
    const justBefore = '2026-10-22T11:29:59.000Z';
    const resAllowed = await fetch(`${baseUrl}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-server-time': justBefore
      },
      body: JSON.stringify({
        lectureId: TEST_LEC_NEXTDAY.id,
        entries: [
          { studentId: 'STU-001', status: 'Present' },
          { studentId: 'STU-002', status: 'Present' },
          { studentId: 'STU-003', status: 'Present' },
          { studentId: 'STU-004', status: 'Present' }
        ],
        actor: 'Prof. Evening'
      })
    });

    if (!isDbOnline) {
      assert.equal(resAllowed.status, 503);
    } else {
      assert.equal(resAllowed.status, 201);
    }

    // Exactly at 17:00:00 next day: rejected
    const exactDeadline = '2026-10-22T11:30:00.000Z';
    const resRejected = await fetch(`${baseUrl}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-server-time': exactDeadline
      },
      body: JSON.stringify({
        lectureId: TEST_LEC_NEXTDAY.id,
        entries: [
          { studentId: 'STU-001', status: 'Absent' },
          { studentId: 'STU-002', status: 'Absent' },
          { studentId: 'STU-003', status: 'Absent' },
          { studentId: 'STU-004', status: 'Absent' }
        ],
        actor: 'Prof. Evening'
      })
    });
    assert.equal(resRejected.status, 403);
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Bulk attendance containing both open and expired sessions
  // --------------------------------------------------------------------------
  test('Scenario 6: Bulk attendance with mixed open & expired sessions -> rejected with zero partial updates', async () => {
    const testNow = '2026-10-20T18:30:00.000Z';

    if (isDbOnline) {
      await prisma.attendanceRecord.deleteMany({
        where: { lectureId: TEST_LEC_EXPIRED.id }
      });
    } else {
      const fb = getFallbackStore();
      fb.attendance = fb.attendance.filter(a => a.lectureId !== TEST_LEC_EXPIRED.id);
    }

    const bulkPayload = {
      submissions: [
        {
          lectureId: TEST_LEC_OPEN.id, // Open session
          entries: [
            { studentId: 'STU-001', status: 'Absent' },
            { studentId: 'STU-002', status: 'Absent' },
            { studentId: 'STU-003', status: 'Absent' },
            { studentId: 'STU-004', status: 'Absent' }
          ]
        },
        {
          lectureId: TEST_LEC_EXPIRED.id, // Expired session
          entries: [
            { studentId: 'STU-001', status: 'Present' },
            { studentId: 'STU-002', status: 'Present' },
            { studentId: 'STU-003', status: 'Present' },
            { studentId: 'STU-004', status: 'Present' }
          ]
        }
      ],
      actor: 'Prof. Bulk'
    };

    const res = await fetch(`${baseUrl}/attendance/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-server-time': testNow
      },
      body: JSON.stringify(bulkPayload)
    });

    const data = await res.json();
    assert.equal(res.status, 403, `Expected 403 Forbidden for mixed bulk submission`);
    assert.equal(data.code, 'CORRECTION_WINDOW_EXPIRED');
    assert.equal(data.expiredLectureId, TEST_LEC_EXPIRED.id);

    // CRITICAL: Verify ATOMIC ROLLBACK - zero records created for TEST_LEC_EXPIRED
    const expiredRecords = await getDbAttendance(TEST_LEC_EXPIRED.id);
    assert.equal(expiredRecords.length, 0, 'No records should have been saved for expired lecture');

    // And verify OPEN lecture records were not modified
    const openRecords = await getDbAttendance(TEST_LEC_OPEN.id);
    if (isDbOnline && openRecords.length > 0) {
      const stu1 = openRecords.find(r => r.studentId === 'STU-001');
      assert.equal(stu1.status, 'Present', 'Open lecture must NOT have been updated due to atomic transaction rollback');
    }
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Direct API request sending actor: 'Admin' to /api/attendance
  // --------------------------------------------------------------------------
  test('Scenario 7: Direct API request after expiry sending actor: "Admin" to /api/attendance -> strictly rejected (403)', async () => {
    const testNow = '2026-10-25T10:00:00.000Z'; // Far past deadline

    const res = await fetch(`${baseUrl}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-server-time': testNow
      },
      body: JSON.stringify({
        lectureId: TEST_LEC_EXPIRED.id,
        entries: [
          { studentId: 'STU-001', status: 'Present' },
          { studentId: 'STU-002', status: 'Present' },
          { studentId: 'STU-003', status: 'Present' },
          { studentId: 'STU-004', status: 'Present' }
        ],
        actor: 'Admin' // Spoofed admin actor on regular endpoint
      })
    });

    const data = await res.json();
    assert.equal(res.status, 403, 'Regular /api/attendance must never allow bypass via spoofed actor field');
    assert.equal(data.code, 'CORRECTION_WINDOW_EXPIRED');
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Attendance-letter approval after expiry -> allowed via coordinator
  // --------------------------------------------------------------------------
  test('Scenario 8: Attendance-letter approval for expired lecture succeeds with official coordinator audit trail (when DB available)', async () => {
    if (!isDbOnline) {
      // Live letter persistence requires online database
      return;
    }

    const doc = await prisma.document.create({
      data: {
        id: `DOC-TEST-${Date.now()}`,
        storageKey: 'documents/2026/test_letter.pdf',
        originalFilename: 'test_letter.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        extractionStatus: 'success'
      }
    });

    const letter = await prisma.attendanceLetter.create({
      data: {
        id: `LTR-TEST-${Date.now()}`,
        studentId: 'STU-001',
        studentName: 'Riya Shah',
        rawStudentName: 'Riya Shah',
        rawStudentId: 'STU-001',
        sapId: '60001240001',
        date: TEST_LEC_EXPIRED.date,
        startTime: TEST_LEC_EXPIRED.startTime,
        endTime: TEST_LEC_EXPIRED.endTime,
        subject: TEST_LEC_EXPIRED.subject,
        matchedSubject: TEST_LEC_EXPIRED.subject,
        lectureId: TEST_LEC_EXPIRED.id,
        validation: 'Exact lecture/time candidate',
        reference: 'PERM-2026-HACKATHON-01',
        uploadId: doc.id,
        status: 'Pending',
        createdBy: 'Attendance Coordinator'
      }
    });

    const res = await fetch(`${baseUrl}/letters/batch-decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        letterIds: [letter.id],
        decision: 'approve',
        actor: 'Attendance Coordinator'
      })
    });

    const result = await res.json();
    assert.equal(res.status, 200);
    assert.equal(result.approved.length, 1);
    assert.equal(result.approved[0].studentId, 'STU-001');

    // Verify attendance was updated with correction reference
    const att = await prisma.attendanceRecord.findUnique({
      where: {
        lectureId_studentId: {
          lectureId: TEST_LEC_EXPIRED.id,
          studentId: 'STU-001'
        }
      }
    });
    assert.ok(att);
    assert.equal(att.status, 'Present');
    assert.equal(att.correctedBy, 'Attendance Coordinator');
    assert.equal(att.correctionReference, 'PERM-2026-HACKATHON-01');

    // Clean up test letter & doc
    await prisma.attendanceLetter.delete({ where: { id: letter.id } });
    await prisma.document.delete({ where: { id: doc.id } });
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Authorized admin correction after expiry
  // --------------------------------------------------------------------------
  test('Scenario 9: Authorized admin post-deadline correction requires reason & logs audit event', async () => {
    // 1. Without reason -> 400 Bad Request
    const resNoReason = await fetch(`${baseUrl}/attendance/admin-correction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'Admin'
      },
      body: JSON.stringify({
        lectureId: TEST_LEC_EXPIRED.id,
        entries: [
          { studentId: 'STU-001', status: 'Present' },
          { studentId: 'STU-002', status: 'Present' },
          { studentId: 'STU-003', status: 'Present' },
          { studentId: 'STU-004', status: 'Present' }
        ],
        reason: '' // Empty reason
      })
    });
    assert.equal(resNoReason.status, 400);

    // 2. Without Admin role -> 403 Forbidden
    const resNoAuth = await fetch(`${baseUrl}/attendance/admin-correction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'Teacher'
      },
      body: JSON.stringify({
        lectureId: TEST_LEC_EXPIRED.id,
        entries: [
          { studentId: 'STU-001', status: 'Present' },
          { studentId: 'STU-002', status: 'Present' },
          { studentId: 'STU-003', status: 'Present' },
          { studentId: 'STU-004', status: 'Present' }
        ],
        reason: 'Authorized correction'
      })
    });
    assert.equal(resNoAuth.status, 403);

    // 3. With Admin role and valid reason
    const validReason = 'Medical leave sanctioned by Principal following hospital discharge';
    const resSuccess = await fetch(`${baseUrl}/attendance/admin-correction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'Admin'
      },
      body: JSON.stringify({
        lectureId: TEST_LEC_EXPIRED.id,
        entries: [
          { studentId: 'STU-001', status: 'Present' },
          { studentId: 'STU-002', status: 'Absent' },
          { studentId: 'STU-003', status: 'Present' },
          { studentId: 'STU-004', status: 'Present' }
        ],
        reason: validReason,
        actor: 'College Admin'
      })
    });

    const successData = await resSuccess.json();
    if (!isDbOnline) {
      assert.equal(resSuccess.status, 503, 'PostgreSQL offline returns 503 to prevent uncommitted changes');
    } else {
      assert.equal(resSuccess.status, 200, `Expected 200 OK: ${JSON.stringify(successData)}`);
      assert.equal(successData.count, 4);

      // Verify records updated
      const records = await prisma.attendanceRecord.findMany({
        where: { lectureId: TEST_LEC_EXPIRED.id }
      });
      assert.equal(records.length, 4);
      const stu2 = records.find(r => r.studentId === 'STU-002');
      assert.equal(stu2.status, 'Absent');
      assert.equal(stu2.correctedBy, 'College Admin');
      assert.ok(stu2.correctionReference.includes(validReason));

      // Verify audit event
      const audit = await prisma.auditEvent.findFirst({
        where: { action: 'Admin post-deadline attendance correction' },
        orderBy: { timestamp: 'desc' }
      });
      assert.ok(audit);
      assert.ok(audit.details.includes(validReason));
    }
  });

  // --------------------------------------------------------------------------
  // Scenario 10: Zero partial updates verification on rejected submissions
  // --------------------------------------------------------------------------
  test('Scenario 10: Zero partial updates across database when requests are rejected', async () => {
    let priorAuditCount = 0;
    if (isDbOnline) {
      priorAuditCount = await prisma.auditEvent.count();
    } else {
      priorAuditCount = getFallbackStore().logs.length;
    }

    // Rejection at deadline
    const testNow = '2026-10-30T00:00:00.000Z';
    const res = await fetch(`${baseUrl}/attendance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-server-time': testNow
      },
      body: JSON.stringify({
        lectureId: TEST_LEC_OPEN.id,
        entries: [
          { studentId: 'STU-001', status: 'Absent' },
          { studentId: 'STU-002', status: 'Absent' },
          { studentId: 'STU-003', status: 'Absent' },
          { studentId: 'STU-004', status: 'Absent' }
        ],
        actor: 'Prof. Late'
      })
    });
    assert.equal(res.status, 403);

    // Verify NO new audit event or record modifications occurred
    const currentAuditCount = isDbOnline ? await prisma.auditEvent.count() : getFallbackStore().logs.length;
    assert.equal(currentAuditCount, priorAuditCount, 'Rejected requests must not create audit logs');
  });
});
