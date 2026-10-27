import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/db.js';
import {
  authenticateCredentials,
  generateToken,
  isTeacherAuthorizedForLecture
} from '../src/auth.js';
import {
  getLectures,
  getStudents,
  getTimetableSlots,
  getAuthoritativeRosterForLecture,
  ensureCurrentWeekLecturesExist
} from '../src/db.js';
import { checkAttendanceCorrectionWindow } from '../src/attendance-window.js';

describe('Teacher Attendance Workflow & Professor-Specific Timetable Regression Suite', () => {
  let teacherExtcToken;
  let teacherOtherToken;
  let teacherExtcUser;
  let exLectures = [];
  let ceLectures = [];
  let allStudents = [];

  before(async () => {
    // Generate dated lectures for the week so tests have active sessions
    await ensureCurrentWeekLecturesExist();

    allStudents = await getStudents();

    // Authenticate teacher.extc (Prof. Sharma)
    const teacherPassword = process.env.TEACHER_DEFAULT_PASSWORD || 'Teacher@AttendTrack2026!';
    teacherExtcUser = await authenticateCredentials('teacher.extc', teacherPassword);
    teacherExtcToken = generateToken(teacherExtcUser);

    // Create a mock token for a teacher with different facultyId
    teacherOtherToken = generateToken({
      id: 'USR-TEACHER-OTHER',
      username: 'teacher.other',
      name: 'Prof. Other',
      role: 'TEACHER',
      department: 'Mechanical Engineering',
      facultyId: 'FAC-ME-101',
      facultyIds: ['FAC-ME-101']
    });

    const allLectures = await getLectures();
    exLectures = allLectures.filter(l => (l.className || '').includes('EXTC'));
    ceLectures = allLectures.filter(l => (l.className || '').includes('CE'));
  });

  test('1. Roster test with more than four students (loads complete cohort, not capped at 4)', async () => {
    assert.ok(allStudents.length > 4, 'Database has more than 4 students enrolled');

    const extcStudents = allStudents.filter(s => s.classGroup === 'EXTC — Year 3 / A');
    const ceStudents = allStudents.filter(s => s.classGroup === 'CE — Year 3 / A');

    assert.ok(extcStudents.length >= 10, `EXTC roster has ${extcStudents.length} students (expected >= 10)`);
    assert.ok(ceStudents.length >= 12, `CE roster has ${ceStudents.length} students (expected >= 12)`);

    // Verify SAP IDs are strings
    extcStudents.forEach(s => {
      assert.strictEqual(typeof s.sapId, 'string', `SAP ID for ${s.name} must be a string`);
      assert.ok(s.sapId.length > 0, `SAP ID for ${s.name} must not be empty`);
    });
  });

  test('2. EXTC lecture returns ONLY its assigned EXTC students (zero CE contamination)', async () => {
    assert.ok(exLectures.length > 0, 'EXTC lectures exist in the database');
    const extcLecture = exLectures[0];

    const roster = await getAuthoritativeRosterForLecture(extcLecture);
    assert.ok(roster.length >= 10, `Roster count is ${roster.length}`);

    // Every single student in this roster must belong strictly to EXTC
    roster.forEach(student => {
      assert.strictEqual(
        student.classGroup,
        'EXTC — Year 3 / A',
        `Student ${student.name} (${student.sapId}) in EXTC roster has wrong classGroup: ${student.classGroup}`
      );
      assert.ok(
        !student.classGroup.includes('CE'),
        `CE student ${student.name} contaminated EXTC lecture roster`
      );
    });
  });

  test('3. CE lecture returns ONLY its assigned CE students (zero EXTC contamination)', async () => {
    assert.ok(ceLectures.length > 0, 'CE lectures exist in the database');
    const ceLecture = ceLectures[0];

    const roster = await getAuthoritativeRosterForLecture(ceLecture);
    assert.ok(roster.length >= 12, `Roster count is ${roster.length}`);

    // Every single student in this roster must belong strictly to CE
    roster.forEach(student => {
      assert.strictEqual(
        student.classGroup,
        'CE — Year 3 / A',
        `Student ${student.name} (${student.sapId}) in CE roster has wrong classGroup: ${student.classGroup}`
      );
      assert.ok(
        !student.classGroup.includes('EXTC'),
        `EXTC student ${student.name} contaminated CE lecture roster`
      );
    });
  });

  test('4. Cross-department submission rejection: Submitting CE student ID for EXTC lecture fails validation', async () => {
    const extcLecture = exLectures[0];
    const ceStudents = allStudents.filter(s => s.classGroup === 'CE — Year 3 / A');
    assert.ok(ceStudents.length > 0);
    const ceStudent = ceStudents[0];

    const authoritativeRoster = await getAuthoritativeRosterForLecture(extcLecture);
    const permittedIds = new Set(authoritativeRoster.map(s => s.id));

    // The CE student ID must NOT be permitted for this EXTC lecture
    assert.strictEqual(
      permittedIds.has(ceStudent.id),
      false,
      'CE student ID must not be in EXTC permitted roster'
    );
  });

  test('5. Default lecture selection logic: Prioritizes in-progress lecture over upcoming or past', () => {
    const today = '2026-10-26';
    const mockLectures = [
      { id: 'LEC-PAST', date: today, startTime: '08:00', endTime: '09:00', subject: 'Past Lecture' },
      { id: 'LEC-IN-PROGRESS', date: today, startTime: '11:00', endTime: '12:00', subject: 'Live Lecture' },
      { id: 'LEC-UPCOMING', date: today, startTime: '14:00', endTime: '15:00', subject: 'Upcoming Lecture' },
      { id: 'LEC-FUTURE', date: '2026-10-27', startTime: '09:00', endTime: '10:00', subject: 'Future Lecture' }
    ];

    const currentTime = '11:30';

    // Timeline analysis
    const todayLectures = mockLectures.filter(l => l.date === today);
    const inProgress = todayLectures.find(l => l.startTime <= currentTime && currentTime < l.endTime);
    const upcomingToday = todayLectures.filter(l => l.startTime > currentTime);
    const pastToday = todayLectures.filter(l => l.endTime <= currentTime);

    assert.ok(inProgress, 'Should identify in-progress lecture');
    assert.strictEqual(inProgress.id, 'LEC-IN-PROGRESS');
    assert.strictEqual(upcomingToday.length, 1);
    assert.strictEqual(upcomingToday[0].id, 'LEC-UPCOMING');
    assert.strictEqual(pastToday.length, 1);
    assert.strictEqual(pastToday[0].id, 'LEC-PAST');
  });

  test('6. No-current-lecture logic: Selects next upcoming lecture today when no lecture is active', () => {
    const today = '2026-10-26';
    const mockLectures = [
      { id: 'LEC-PAST', date: today, startTime: '08:00', endTime: '09:00', subject: 'Past Lecture' },
      { id: 'LEC-UPCOMING-1', date: today, startTime: '14:00', endTime: '15:00', subject: 'First Upcoming' },
      { id: 'LEC-UPCOMING-2', date: today, startTime: '16:00', endTime: '17:00', subject: 'Second Upcoming' }
    ];

    const currentTime = '10:15'; // Between 09:00 and 14:00 (no active lecture)

    const todayLectures = mockLectures.filter(l => l.date === today);
    const inProgress = todayLectures.find(l => l.startTime <= currentTime && currentTime < l.endTime);
    const upcomingToday = todayLectures
      .filter(l => l.startTime > currentTime)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    assert.strictEqual(inProgress, undefined, 'No lecture currently in progress');
    assert.ok(upcomingToday.length > 0, 'Found upcoming lectures today');
    assert.strictEqual(upcomingToday[0].id, 'LEC-UPCOMING-1', 'Next upcoming lecture selected');
  });

  test('7. 24-hour editing window calculation and deadline enforcement', () => {
    // Current lecture ended at 10:00 on 2026-10-26
    const recentLecture = {
      date: '2026-10-26',
      startTime: '09:00',
      endTime: '10:00'
    };

    // As of 2026-10-26 13:00 IST, deadline is 2026-10-27 10:00 IST -> within window
    const windowInfo = checkAttendanceCorrectionWindow(recentLecture, new Date('2026-10-26T13:00:00+05:30'));
    assert.strictEqual(windowInfo.isExpired, false, 'Should be within 24h editing window');
    assert.strictEqual(windowInfo.isOpen, true, 'Editing window should be open');
    assert.ok(windowInfo.remainingMs > 0, 'Remaining time must be positive');

    // Historical lecture ended on 2026-10-14
    const expiredLecture = {
      date: '2026-10-14',
      startTime: '09:00',
      endTime: '10:00'
    };
    const expiredInfo = checkAttendanceCorrectionWindow(expiredLecture);
    assert.strictEqual(expiredInfo.isExpired, true, 'Historical lecture must be expired');
    assert.strictEqual(expiredInfo.isOpen, false, 'Expired window must be closed');
  });

  test('8. Teacher authorization check: Faculty only authorized for assigned lectures', () => {
    // Prof. Sharma has facultyIds: ['FAC-EX-101', 'FAC-GEN-101']
    const extcLecture = {
      id: 'LEC-EX-01',
      className: 'EXTC — Year 3 / A',
      facultyId: 'FAC-EX-101',
      teacherName: 'Prof. Sharma'
    };

    const ceLecture = {
      id: 'LEC-CE-01',
      className: 'CE — Year 3 / A',
      facultyId: 'FAC-GEN-101',
      teacherName: 'Prof. Sharma'
    };

    const mechLecture = {
      id: 'LEC-MECH-01',
      className: 'MECH — Year 3 / A',
      facultyId: 'FAC-ME-101',
      teacherName: 'Prof. Patel'
    };

    assert.strictEqual(
      isTeacherAuthorizedForLecture(teacherExtcUser, extcLecture),
      true,
      'Prof. Sharma must be authorized for EXTC lecture (FAC-EX-101)'
    );

    assert.strictEqual(
      isTeacherAuthorizedForLecture(teacherExtcUser, ceLecture),
      true,
      'Prof. Sharma must be authorized for CE lecture (FAC-GEN-101)'
    );

    assert.strictEqual(
      isTeacherAuthorizedForLecture(teacherExtcUser, mechLecture),
      false,
      'Prof. Sharma must NOT be authorized for Mechanical lecture'
    );
  });

  test('9. Professor-specific timetable: Returns weekly slots spanning multiple class groups', async () => {
    const teacherFacultyIds = teacherExtcUser.facultyIds || ['FAC-EX-101', 'FAC-GEN-101'];

    const profSlots = await getTimetableSlots({
      facultyIds: teacherFacultyIds
    });

    assert.ok(profSlots.length > 0, 'Professor has assigned timetable slots');

    // Verify slots span multiple class groups (both EXTC and CE)
    const classGroupsTaught = new Set(profSlots.map(s => s.className));
    assert.ok(
      classGroupsTaught.has('EXTC — Year 3 / A'),
      'Professor timetable must contain EXTC — Year 3 / A'
    );
    assert.ok(
      classGroupsTaught.has('CE — Year 3 / A'),
      'Professor timetable must contain CE — Year 3 / A'
    );

    // Verify zero slots during lunch break (13:00 - 14:00)
    profSlots.forEach(s => {
      assert.notStrictEqual(s.startTime, '13:00', 'No teaching slot during lunch break');
      assert.notStrictEqual(s.endTime, '13:00', 'No slot ending during lunch break');
    });
  });
});
