import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isUnmarkedLateWindowPassed,
  resolveAttendanceStatusForSession,
  isLateCutoffPassed,
  COLLEGE_TIMEZONE
} from '../src/attendance-window.js';

test('Unmarked Lecture -> Late -> Absent Rule Suite', () => {
  const lectureDate = '2026-11-18';
  const lecture = {
    id: 'LEC-TEST-01',
    date: lectureDate,
    startTime: '10:00',
    endTime: '11:00'
  };

  // 1. Within 1 hour of lecture end (e.g. at 11:30 AM IST on lecture date)
  // End is 11:00 AM, + 1 hour deadline is 12:00 PM
  const timeWithinOneHour = new Date('2026-11-18T11:30:00+05:30');
  assert.equal(isUnmarkedLateWindowPassed(lecture, timeWithinOneHour), false, 'Within 1 hour post-lecture, unmarked window has not passed');
  assert.equal(resolveAttendanceStatusForSession(lecture, null, timeWithinOneHour), 'Scheduled', 'Unmarked attendance within 1 hour should remain Scheduled');

  // 2. >1 hour post-lecture end, but before 6:00 PM IST (e.g. at 13:00 / 1:00 PM IST)
  const timePastOneHourBefore6PM = new Date('2026-11-18T13:00:00+05:30');
  assert.equal(isUnmarkedLateWindowPassed(lecture, timePastOneHourBefore6PM), true, '>1 hour post-lecture, unmarked late window has passed');
  assert.equal(isLateCutoffPassed(lecture, timePastOneHourBefore6PM), false, 'Before 6:00 PM, cutoff has not passed');
  assert.equal(resolveAttendanceStatusForSession(lecture, null, timePastOneHourBefore6PM), 'Late', 'Unmarked lecture >1 hr post-end becomes Late');

  // 3. Marked Late student before 6:00 PM
  assert.equal(resolveAttendanceStatusForSession(lecture, 'Late', timePastOneHourBefore6PM), 'Late', 'Marked Late stays Late before 6:00 PM');

  // 4. After 6:00 PM IST (e.g. at 18:30 / 6:30 PM IST)
  const timeAfter6PM = new Date('2026-11-18T18:30:00+05:30');
  assert.equal(isLateCutoffPassed(lecture, timeAfter6PM), true, 'After 6:00 PM IST, cutoff has passed');
  assert.equal(resolveAttendanceStatusForSession(lecture, 'Late', timeAfter6PM), 'Absent', 'Late converts to Absent after 6:00 PM');
  assert.equal(resolveAttendanceStatusForSession(lecture, null, timeAfter6PM), 'Absent', 'Unmarked lecture after 6:00 PM converts to Absent');

  // 5. Existing Present / Absent records are preserved
  assert.equal(resolveAttendanceStatusForSession(lecture, 'Present', timeAfter6PM), 'Present', 'Present remains Present');
  assert.equal(resolveAttendanceStatusForSession(lecture, 'Absent', timeWithinOneHour), 'Absent', 'Absent remains Absent');
});
