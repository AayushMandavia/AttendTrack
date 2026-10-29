import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLectureDateTime,
  getLateAttendanceCutoff,
  isLateCutoffPassed,
  resolveLateAttendanceEntries,
  LATE_CUTOFF_TIME
} from '../src/attendance-window.js';
import {
  saveAttendanceSubmission,
  getDashboardData
} from '../src/db.js';

test('Real-Time Lecture & 6:00 PM Late Cutoff Rule Suite', async (t) => {
  const lectureDate = '2026-10-29';
  const testLecture = {
    id: 'LEC-TEST-REALTIME-1700',
    subject: 'Applied Mathematics',
    className: 'CE — Year 3 / A',
    date: lectureDate,
    startTime: '17:00',
    endTime: '18:00',
    studentIds: ['STU-001', 'STU-002', 'STU-003']
  };

  await t.test('1. Late cutoff calculation: Exact 18:00:00 IST on lecture date', () => {
    const cutoff = getLateAttendanceCutoff(testLecture);
    assert.ok(cutoff instanceof Date, 'Cutoff must be a valid Date object');
    assert.equal(LATE_CUTOFF_TIME, '18:00', 'Late cutoff time must be 18:00');

    // 17:59:59 IST (12:29:59 UTC) is before cutoff
    const before6PM = new Date(`${lectureDate}T12:29:59Z`);
    assert.equal(isLateCutoffPassed(testLecture, before6PM), false, 'Before 18:00 IST must return false');

    // 18:00:00 IST (12:30:00 UTC) is at cutoff
    const at6PM = new Date(`${lectureDate}T12:30:00Z`);
    assert.equal(isLateCutoffPassed(testLecture, at6PM), true, 'Exactly at 18:00 IST must return true');

    // 18:01:00 IST is after cutoff
    const after6PM = new Date(`${lectureDate}T12:31:00Z`);
    assert.equal(isLateCutoffPassed(testLecture, after6PM), true, 'After 18:00 IST must return true');
  });

  await t.test('2. resolveLateAttendanceEntries: Late status is preserved before 6:00 PM, converted to Absent after 6:00 PM', () => {
    const entries = [
      { studentId: 'STU-001', status: 'Present' },
      { studentId: 'STU-002', status: 'Late' },
      { studentId: 'STU-003', status: 'Absent' }
    ];

    // Case A: Before 6:00 PM
    const beforeTime = new Date(`${lectureDate}T12:25:00Z`); // 17:55 IST
    const resolvedBefore = resolveLateAttendanceEntries(testLecture, entries, beforeTime);
    assert.equal(resolvedBefore[1].status, 'Late', 'Status remains Late before 6:00 PM');

    // Case B: Exactly at / after 6:00 PM
    const afterTime = new Date(`${lectureDate}T12:30:01Z`); // 18:00:01 IST
    const resolvedAfter = resolveLateAttendanceEntries(testLecture, entries, afterTime);
    assert.equal(resolvedAfter[1].status, 'Absent', 'Status automatically converts to Absent after 6:00 PM');
    assert.equal(resolvedAfter[1].autoConvertedFromLate, true, 'Flag indicates auto-conversion');
    assert.equal(resolvedAfter[0].status, 'Present', 'Present status remains unaffected');
    assert.equal(resolvedAfter[2].status, 'Absent', 'Absent status remains unaffected');
  });

  await t.test('3. Attendance submission after 6:00 PM converts Late students to Absent in DB storage', async () => {
    const entries = [
      { studentId: 'STU-001', status: 'Present' },
      { studentId: 'STU-002', status: 'Late' },
      { studentId: 'STU-003', status: 'Absent' }
    ];

    const submissionTime = new Date(`${lectureDate}T13:00:00Z`); // 18:30 IST (after 6:00 PM)
    const result = await saveAttendanceSubmission({
      lecture: testLecture,
      entries,
      actor: 'Prof. Sharma',
      serverTime: submissionTime,
      enforceWindow: false
    });

    assert.equal(result.count, 3);
    assert.equal(result.autoConvertedLateCount, 1, 'Reported 1 auto-converted late record');

    // Verify stored state in getDashboardData
    const dashboard = await getDashboardData();
    const stu2Record = dashboard.attendance.find(a => a.lectureId === testLecture.id && a.studentId === 'STU-002');
    assert.ok(stu2Record, 'Record must exist');
    assert.equal(stu2Record.status, 'Absent', 'Student marked Late after 6:00 PM must be stored as Absent');
  });
});
