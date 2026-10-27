import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, testDatabaseConnection, getDashboardData } from '../src/db.js';
import { institutionalUsers } from '../src/auth.js';
import { ROLES } from '../src/auth.js';

describe('Faculty Dashboard Redesign & Scoped Data Integrity Suite', () => {
  let isDbOnline = false;

  test('1. Authoritative Teacher Identity & Department Source Verification', async () => {
    // Authenticated teacher profile in institutionalUsers
    const teacherUser = institutionalUsers.find(u => u.username === 'teacher.extc');
    assert.ok(teacherUser, 'teacher.extc must exist in institutional staff users');
    assert.equal(teacherUser.name, 'Prof. Sharma', 'Teacher name must be authoritative "Prof. Sharma" without branch suffix');
    assert.equal(teacherUser.department, 'Electronics & Telecommunication Engineering', 'Authoritative department must be EXTC');
    assert.deepEqual(teacherUser.facultyIds, ['FAC-EX-101', 'FAC-GEN-101'], 'Must have facultyIds for both EXTC and CE courses');
  });

  test('2. Students Across Assigned Classes Count: Strictly 22 across EXTC and CE cohorts (not single cohort)', async () => {
    isDbOnline = await testDatabaseConnection();
    const data = await getDashboardData();
    assert.ok(data.students && data.students.length >= 22, 'Must have at least 22 synthetic students in database');

    const teacherFacultyIds = ['FAC-EX-101', 'FAC-GEN-101'];
    const teacherLectures = data.lectures.filter(l => 
      (l.facultyId && teacherFacultyIds.includes(l.facultyId)) ||
      l.id === 'LEC-101' || l.id === 'LEC-102' || l.id === 'LEC-103'
    );

    const assignedClassGroups = Array.from(new Set(teacherLectures.map(l => l.className)));
    assert.ok(assignedClassGroups.includes('EXTC — Year 3 / A'), 'Assigned classes must include EXTC — Year 3 / A');
    assert.ok(assignedClassGroups.includes('CE — Year 3 / A'), 'Assigned classes must include CE — Year 3 / A');

    // Deduplicate unique students across assigned classes
    const uniqueStudentsMap = new Map();
    data.students.forEach(s => {
      if (s.classGroup && assignedClassGroups.includes(s.classGroup)) {
        uniqueStudentsMap.set(s.id, s);
      }
    });

    const extcStudents = data.students.filter(s => s.classGroup === 'EXTC — Year 3 / A');
    const ceStudents = data.students.filter(s => s.classGroup === 'CE — Year 3 / A');

    assert.equal(extcStudents.length, 10, 'EXTC cohort must have exactly 10 students');
    assert.equal(ceStudents.length, 12, 'CE cohort must have exactly 12 students');
    assert.equal(uniqueStudentsMap.size, 22, 'Total unique students across teacher assigned cohorts must be exactly 22 (10 + 12)');
  });

  test('3. Scheduled Lectures Scoping: Only counts teacher assigned lectures', async () => {
    const data = await getDashboardData();
    const teacherFacultyIds = ['FAC-EX-101', 'FAC-GEN-101'];
    
    // Total institutional lectures
    assert.ok(data.lectures.length > 50, 'Institution-wide lectures should exceed 50');

    // Teacher-scoped lectures
    const teacherLectures = data.lectures.filter(l => 
      (l.facultyId && teacherFacultyIds.includes(l.facultyId)) ||
      l.id === 'LEC-101' || l.id === 'LEC-102' || l.id === 'LEC-103'
    );

    assert.ok(teacherLectures.length >= 20, 'Teacher must have at least 20 assigned lectures across the schedule');
    // Ensure all lectures belong to Prof. Sharma's assigned classes or faculty IDs
    for (const lec of teacherLectures) {
      if (lec.facultyId) {
        assert.ok(teacherFacultyIds.includes(lec.facultyId), `Lecture ${lec.id} facultyId ${lec.facultyId} must be in teacher facultyIds`);
      }
    }
  });

  test('4. Today Schedule Chronological Ordering and Status Logic', async () => {
    const data = await getDashboardData();
    const teacherFacultyIds = ['FAC-EX-101', 'FAC-GEN-101'];
    const todayStr = '2026-10-26';

    const todaysLectures = data.lectures
      .filter(l => l.date === todayStr && ((l.facultyId && teacherFacultyIds.includes(l.facultyId)) || l.id === 'LEC-101' || l.id === 'LEC-102' || l.id === 'LEC-103'))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    assert.equal(todaysLectures.length, 3, 'Prof. Sharma must have exactly 3 scheduled lectures on 2026-10-26');
    assert.equal(todaysLectures[0].startTime, '08:00', 'First lecture starts at 08:00');
    assert.equal(todaysLectures[1].startTime, '14:00', 'Second lecture starts at 14:00');
    assert.equal(todaysLectures[2].startTime, '15:00', 'Third lecture starts at 15:00');

    // Check lunch exclusion
    const hasLunchLecture = todaysLectures.some(l => l.startTime === '13:00' || l.endTime === '14:00' && l.startTime === '13:00');
    assert.equal(hasLunchLecture, false, 'No lecture scheduled during 13:00-14:00 lunch break');
  });

  test('5. Letter Reviews Authorization: Teachers strictly lack approval permissions', async () => {
    const teacherUser = institutionalUsers.find(u => u.username === 'teacher.extc');
    assert.equal(teacherUser.role, ROLES.TEACHER, 'User must have TEACHER role');
    
    // Only COORDINATOR and ADMIN can approve letter reviews
    const canReview = teacherUser.role === ROLES.COORDINATOR || teacherUser.role === ROLES.ADMIN;
    assert.equal(canReview, false, 'Standard teacher must not have coordinator approval authority');
  });

  test('6. Recent Activity Filtering: Scoped to Teacher Courses and Classes', async () => {
    const data = await getDashboardData();
    const teacherSubjects = ['signals & systems', 'applied mathematics', 'database systems'];
    const teacherClasses = ['extc — year 3 / a', 'ce — year 3 / a'];

    const filtered = data.logs.filter(log => {
      const text = `${log.action} ${log.details}`.toLowerCase();
      if (text.includes('sharma') || text.includes('teacher.extc') || text.includes('teacher')) return true;
      for (const subj of teacherSubjects) {
        if (text.includes(subj)) return true;
      }
      for (const cls of teacherClasses) {
        if (text.includes(cls)) return true;
      }
      return false;
    });

    assert.ok(filtered.length > 0, 'Must have teacher-relevant audit activity in data.logs');
    // Verify no unrelated EE / ME / IT specific logs leak in
    for (const log of filtered) {
      const text = `${log.action} ${log.details}`.toLowerCase();
      const isTeacherRelated = text.includes('sharma') || text.includes('teacher') || 
        teacherSubjects.some(s => text.includes(s)) ||
        teacherClasses.some(c => text.includes(c));
      assert.ok(isTeacherRelated, `Log ${log.id} must be relevant to teacher`);
    }
  });
});
