import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { matchStudentToRoster } from '../src/docx-parser.js';
import {
  testDatabaseConnection,
  getStudents,
  findStudentById,
  findStudentBySapId,
  queueAttendanceLetter,
  queueBatchAttendanceLetters,
  recordLetterDecision,
  recordBatchLetterDecision,
  findLetterById,
  getAttendanceByLecture,
  prisma
} from '../src/db.js';

describe('Strict SAP ID & Name Verification: Matching Rules & Edge Cases', () => {
  const sampleRoster = [
    { id: 'STU-001', name: 'Riya Shah', branch: 'Computer Engineering', rollNo: '24CE01', sapId: '60001240001' },
    { id: 'STU-002', name: 'Arjun Mehta', branch: 'Computer Engineering', rollNo: '24CE02', sapId: '60001240002' },
    { id: 'STU-003', name: 'Sara Khan', branch: 'Computer Engineering', rollNo: '24CE03', sapId: '60001240003' },
    { id: 'STU-004', name: 'Dev Patel', branch: 'Computer Engineering', rollNo: '24CE04', sapId: '60001240004' },
    { id: 'STU-005', name: 'Ananya Deshmukh', branch: 'Computer Engineering', rollNo: '24CE05', sapId: '60001240005' },
    { id: 'STU-006', name: 'Rohan Kulkarni', branch: 'Computer Engineering', rollNo: '24CE06', sapId: '60001240006' }
  ];

  test('1. Exact SAP ID and exact name match -> Matched', () => {
    const res = matchStudentToRoster('Riya Shah', '24CE01', '60001240001', sampleRoster);
    assert.equal(res.matchStatus, 'matched');
    assert.ok(res.matched);
    assert.equal(res.matched.id, 'STU-001');
    assert.equal(res.matched.name, 'Riya Shah');
    assert.equal(res.matched.sapId, '60001240001');
    assert.equal(res.registeredStudent.name, 'Riya Shah');
  });

  test('2. Correct SAP ID with wrong name (name belongs to another student) -> SAP ID / Name Mismatch (blocked)', () => {
    // SAP belongs to Riya Shah, but name is Dev Patel
    const res = matchStudentToRoster('Dev Patel', '24CE01', '60001240001', sampleRoster);
    assert.equal(res.matchStatus, 'ambiguous');
    assert.equal(res.matched, null, 'Must never auto-match when name conflicts');
    assert.ok(res.note.includes('SAP ID / Name Mismatch'));
    assert.equal(res.registeredStudent.name, 'Riya Shah');
  });

  test('3. Correct SAP ID with completely unrelated name -> SAP ID / Name Mismatch (blocked)', () => {
    const res = matchStudentToRoster('Random Person', '24CE01', '60001240001', sampleRoster);
    assert.equal(res.matchStatus, 'ambiguous');
    assert.equal(res.matched, null);
    assert.ok(res.note.includes('SAP ID / Name Mismatch'));
  });

  test('4. Unknown SAP ID -> Unknown SAP ID error (blocked)', () => {
    const res = matchStudentToRoster('Riya Shah', '24CE01', '60001249999', sampleRoster);
    assert.equal(res.matchStatus, 'unmatched');
    assert.equal(res.matched, null);
    assert.ok(res.note.includes('Unknown SAP ID'));
  });

  test('5. Missing SAP ID (even if exact name and roll number match) -> SAP ID Required (blocked)', () => {
    const res = matchStudentToRoster('Riya Shah', '24CE01', '', sampleRoster);
    assert.equal(res.matchStatus, 'ambiguous');
    assert.equal(res.matched, null, 'Must NEVER match on name or roll number alone when SAP ID is missing');
    assert.ok(res.note.includes('SAP ID Required'));
  });

  test('6. Similar name belonging to different student / abbreviated name -> Flagged for manual review (ambiguous)', () => {
    // Extracted name is "R. Shah" for Riya Shah
    const res = matchStudentToRoster('Riya S.', '24CE01', '60001240001', sampleRoster);
    assert.equal(res.matchStatus, 'ambiguous');
    assert.equal(res.matched, null, 'Must not auto-approve based on fuzzy or abbreviated match');
    assert.ok(res.note.includes('Name verification required'));
  });

  test('7. Duplicate SAP ID in database roster -> Data integrity error (blocked)', () => {
    const corruptedRoster = [
      ...sampleRoster,
      { id: 'STU-099', name: 'Duplicate Imposter', rollNo: '24CE99', sapId: '60001240001' } // Duplicate of STU-001
    ];
    const res = matchStudentToRoster('Riya Shah', '24CE01', '60001240001', corruptedRoster);
    assert.equal(res.matchStatus, 'ambiguous');
    assert.equal(res.matched, null);
    assert.ok(res.note.includes('Data integrity error: Duplicate SAP ID'));
  });
});

describe('Strict SAP ID & Name Verification: Backend API Enforcement & Database Safeguards', () => {
  test('8. POST /api/letters batch queueing strictly verifies SAP ID', async () => {
    const online = await testDatabaseConnection();
    if (!online) return;

    // Direct database test of queueBatchAttendanceLetters
    const student1 = await findStudentById('STU-001');
    assert.ok(student1?.sapId);

    // Queue valid batch item
    const batch = [{
      studentId: 'STU-001',
      studentName: 'Riya Shah',
      rawStudentName: 'Riya Shah',
      rawStudentId: '24CE01',
      sapId: student1.sapId,
      date: '2026-10-14',
      startTime: '10:00',
      endTime: '11:00',
      subject: 'Database Systems',
      reference: 'REF-TEST-BATCH-SAP-1',
      validation: 'Exact lecture/time candidate',
      matchedSubject: 'Database Systems',
      lectureId: 'LEC-101'
    }];

    const queued = await queueBatchAttendanceLetters(batch, 'SAP Test Suite');
    assert.equal(queued.length, 1);
    assert.equal(queued[0].sapId, student1.sapId);
    assert.equal(queued[0].status, 'Pending');
  });

  test('9. Approval blocked when letter has conflicting name vs registered SAP ID student', async () => {
    const online = await testDatabaseConnection();
    if (!online) return;

    const student1 = await findStudentById('STU-001'); // Riya Shah
    const timestamp = Date.now();
    const letterId = `LTR-TEST-CONFLICT-${timestamp}`;

    // Create a letter where rawStudentName conflicts (Dev Patel listed, but studentId is STU-001 Riya Shah)
    await prisma.attendanceLetter.create({
      data: {
        id: letterId,
        studentId: 'STU-001',
        studentName: 'Riya Shah',
        rawStudentName: 'Dev Patel', // Conflict with registered student STU-004
        rawStudentId: '24CE01',
        sapId: student1.sapId,
        date: '2026-10-14',
        startTime: '10:00',
        endTime: '11:00',
        subject: 'Database Systems',
        reference: 'REF-CONFLICT-SAP-TEST',
        matchedSubject: 'Database Systems',
        lectureId: 'LEC-101',
        validation: 'Exact lecture/time candidate',
        status: 'Pending',
        createdBy: 'Test Suite'
      }
    });

    // Attempt to approve via recordBatchLetterDecision
    const batchRes = await recordBatchLetterDecision({
      letterIds: [letterId],
      decision: 'approve',
      actor: 'Coordinator Test'
    });

    assert.equal(batchRes.approved.length, 0, 'Conflicting student letter must NOT be approved in batch');
    assert.equal(batchRes.skipped.length, 1, 'Conflicting letter must be skipped');
    assert.ok(batchRes.skipped[0].reason.includes('SAP ID / Name Mismatch'));

    // Attempt direct approval via recordLetterDecision
    await assert.rejects(
      async () => {
        await recordLetterDecision({
          letterId,
          decision: 'approve',
          actor: 'Coordinator Test'
        });
      },
      /SAP ID \/ Name Mismatch/
    );

    // Verify letter status remains Pending and attendance was NOT modified
    const letter = await findLetterById(letterId);
    assert.equal(letter.status, 'Pending');
  });

  test('10. Batch containing both valid and invalid entries: valid is approved, invalid is safely skipped', async () => {
    const online = await testDatabaseConnection();
    if (!online) return;

    const student2 = await findStudentById('STU-002'); // Arjun Mehta
    const timestamp = Date.now();
    const validLetterId = `LTR-VALID-${timestamp}`;
    const invalidLetterId = `LTR-INVALID-${timestamp}`;

    // Valid letter for Arjun Mehta
    await prisma.attendanceLetter.create({
      data: {
        id: validLetterId,
        studentId: 'STU-002',
        studentName: 'Arjun Mehta',
        rawStudentName: 'Arjun Mehta',
        sapId: student2.sapId,
        date: '2026-10-14',
        startTime: '10:00',
        endTime: '11:00',
        subject: 'Database Systems',
        reference: 'REF-MIXED-1',
        matchedSubject: 'Database Systems',
        lectureId: 'LEC-101',
        validation: 'Exact lecture/time candidate',
        status: 'Pending',
        createdBy: 'Test Suite'
      }
    });

    // Invalid letter: studentId with no registered SAP ID or unvalidated
    await prisma.attendanceLetter.create({
      data: {
        id: invalidLetterId,
        studentId: 'STU-003',
        studentName: 'Sara Khan',
        rawStudentName: 'Different Unknown Name',
        sapId: '60001240003',
        date: '2026-10-14',
        startTime: '10:00',
        endTime: '11:00',
        subject: 'Database Systems',
        reference: 'REF-MIXED-2',
        matchedSubject: 'Database Systems',
        lectureId: 'LEC-101',
        validation: 'Needs clarification: partial time overlap', // Unvalidated!
        status: 'Pending',
        createdBy: 'Test Suite'
      }
    });

    const result = await recordBatchLetterDecision({
      letterIds: [validLetterId, invalidLetterId],
      decision: 'approve',
      actor: 'Batch Coordinator'
    });

    assert.equal(result.approved.length, 1, 'Valid letter must be approved');
    assert.equal(result.approved[0].id, validLetterId);
    assert.equal(result.skipped.length, 1, 'Invalid letter must be skipped');
    assert.equal(result.skipped[0].id, invalidLetterId);

    // Verify database record for valid letter is Approved
    const updatedValid = await findLetterById(validLetterId);
    assert.equal(updatedValid.status, 'Approved');

    // Verify invalid letter remains Pending
    const updatedInvalid = await findLetterById(invalidLetterId);
    assert.equal(updatedInvalid.status, 'Pending');
  });

  test('11. Direct API attempt to approve letter without verified SAP ID is blocked and logged', async () => {
    const online = await testDatabaseConnection();
    if (!online) return;

    // Use an existing enrolled student
    const student = await prisma.student.findFirst();
    assert.ok(student, 'Student exists in database');
    assert.ok(student.sapId, 'Student has registered SAP ID');

    const timestamp = Date.now();
    const letterId = `LTR-NO-SAP-${timestamp}`;

    await prisma.attendanceLetter.create({
      data: {
        id: letterId,
        studentId: student.id,
        studentName: student.name,
        rawStudentName: student.name,
        sapId: null, // Letter lacks SAP ID
        date: '2026-10-14',
        startTime: '10:00',
        endTime: '11:00',
        subject: 'Database Systems',
        reference: 'REF-NO-SAP',
        matchedSubject: 'Database Systems',
        lectureId: 'LEC-101',
        validation: 'Exact lecture/time candidate',
        status: 'Pending',
        createdBy: 'Test Suite'
      }
    });

    await assert.rejects(
      async () => {
        await recordLetterDecision({
          letterId,
          decision: 'approve',
          actor: 'Direct API Hacker'
        });
      },
      /verified, non-empty SAP ID/
    );

    // Wait briefly for asynchronous audit log event
    await new Promise(r => setTimeout(r, 60));

    // Check that audit log recorded the blocked approval attempt
    const auditEvents = await prisma.auditEvent.findMany({
      where: { action: 'Letter approval blocked (SAP ID missing)' },
      orderBy: { timestamp: 'desc' },
      take: 1
    });
    assert.ok(auditEvents.length > 0);
    assert.ok(auditEvents[0].details.includes(letterId));
  });

  test('12. Persistence across restarts: SAP ID is preserved as a string with leading zeros', async () => {
    const online = await testDatabaseConnection();
    if (!online) return;

    const student = await findStudentBySapId('60001240001');
    assert.ok(student);
    assert.equal(typeof student.sapId, 'string');
    assert.equal(student.sapId, '60001240001');
    assert.equal(student.sapId.length, 11);
  });

  test('13. Database and application allow multiple students with the same roll number (non-unique rollNo)', async () => {
    const online = await testDatabaseConnection();
    if (!online) return;

    // Verify roll number uniqueness is not enforced:
    // Create two students with the SAME roll number
    const sharedRollNo = 'SHARED_ROLL_99';
    const tempStudent1 = await prisma.student.create({
      data: {
        id: `STU-TEST-ROLL1-${Date.now()}`,
        name: 'Shared Roll Student 1',
        sapId: `99000000001`,
        rollNo: sharedRollNo,
        branch: 'Computer Engineering'
      }
    });

    const tempStudent2 = await prisma.student.create({
      data: {
        id: `STU-TEST-ROLL2-${Date.now()}`,
        name: 'Shared Roll Student 2',
        sapId: `99000000002`,
        rollNo: sharedRollNo, // Duplicate roll number is allowed!
        branch: 'Information Technology'
      }
    });

    assert.equal(tempStudent1.rollNo, tempStudent2.rollNo);
    assert.notEqual(tempStudent1.sapId, tempStudent2.sapId);

    // Clean up temporary students
    await prisma.student.deleteMany({
      where: { id: { in: [tempStudent1.id, tempStudent2.id] } }
    });
  });

  test('14. Matching prioritizes SAP ID and rejects matching on roll number alone', () => {
    const roster = [
      { id: 'STU-10', name: 'Alok Nath', sapId: '60001240010', rollNo: 'ROLL-101' },
      { id: 'STU-11', name: 'Rohan Joshi', sapId: '60001240011', rollNo: 'ROLL-101' } // same roll number!
    ];

    // Attempting to match without SAP ID (only name and roll number) is BLOCKED
    const matchWithoutSap = matchStudentToRoster('Alok Nath', 'ROLL-101', '', roster);
    assert.equal(matchWithoutSap.matchStatus, 'ambiguous');
    assert.ok(matchWithoutSap.note.includes('SAP ID Required'));

    // Matching with correct SAP ID matches the exact student despite duplicate roll number
    const matchWithSap = matchStudentToRoster('Alok Nath', 'ROLL-101', '60001240010', roster);
    assert.equal(matchWithSap.matchStatus, 'matched');
    assert.equal(matchWithSap.matched.sapId, '60001240010');
    assert.equal(matchWithSap.matched.name, 'Alok Nath');
  });
});
