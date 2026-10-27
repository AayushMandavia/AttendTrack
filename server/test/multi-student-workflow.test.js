import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cors from 'cors';
import {
  extractStudentsFromText,
  extractFieldsFromText
} from '../src/extractor.js';
import {
  testDatabaseConnection,
  createDocumentRecord,
  queueBatchAttendanceLetters,
  recordLetterDecision,
  recordBatchLetterDecision,
  findLetterById,
  findDocumentById,
  findStudentById,
  getAttendanceByLecture,
  getStudents,
  getLectures
} from '../src/db.js';

describe('Multi-Student Workflow: Multi-Name Extraction & Matching', () => {
  const mockRoster = [
    { id: 'STU-001', name: 'Riya Shah' },
    { id: 'STU-002', name: 'Aman Gupta' },
    { id: 'STU-003', name: 'Sneha Patel' },
    { id: 'STU-004', name: 'Dev Patel' }
  ];

  test('extracts multiple student names and IDs from numbered list', () => {
    const docText = `
      OFFICIAL OD LETTER - INTER-COLLEGE HACKATHON
      The following students attended the hackathon on 2026-10-14:
      1. Riya Shah (ID: STU-001)
      2. Aman Gupta - STU-002
      3. Dev Patel (STU-004)
      Subject: Database Systems
      Time: 10:00 - 11:00
      Ref: EVT-HACK-2026
    `;

    const candidates = extractStudentsFromText(docText, mockRoster);
    assert.equal(candidates.length, 3);

    assert.equal(candidates[0].studentId, 'STU-001');
    assert.equal(candidates[0].studentName, 'Riya Shah');
    assert.equal(candidates[0].matchStatus, 'matched');

    assert.equal(candidates[1].studentId, 'STU-002');
    assert.equal(candidates[1].studentName, 'Aman Gupta');
    assert.equal(candidates[1].matchStatus, 'matched');

    assert.equal(candidates[2].studentId, 'STU-004');
    assert.equal(candidates[2].studentName, 'Dev Patel');
    assert.equal(candidates[2].matchStatus, 'matched');
  });

  test('extracts tabular student lists and preserves raw values separately from roster', () => {
    const tableText = `
      ATTENDANCE EXCUSE SHEET
      Date: 2026-10-14
      ID | Student Name
      STU-001 | Riya Shah
      EXT-888 | John Doe
      STU-003 | Sneha Patel
    `;

    const candidates = extractStudentsFromText(tableText, mockRoster);
    assert.ok(candidates.length >= 3);

    const external = candidates.find(c => c.rawStudentId === 'EXT-888' || c.rawStudentName.includes('John Doe'));
    assert.ok(external, 'External student must not be silently discarded');
    assert.equal(external.rawStudentName, 'John Doe');
    assert.equal(external.rawStudentId, 'EXT-888');
    assert.equal(external.studentId, ''); // Unmatched to roster
    assert.equal(external.matchStatus, 'unmatched');
    assert.equal(external.rosterMatched, false);

    const riya = candidates.find(c => c.studentId === 'STU-001');
    assert.ok(riya);
    assert.equal(riya.matchStatus, 'matched');
  });

  test('handles duplicate names in document without creating duplicate candidates', () => {
    const textWithDupes = `
      Participant List:
      1. Riya Shah (STU-001)
      2. Riya Shah (STU-001)
      3. Aman Gupta (STU-002)
    `;

    const candidates = extractStudentsFromText(textWithDupes, mockRoster);
    const riyaMatches = candidates.filter(c => c.studentId === 'STU-001');
    assert.equal(riyaMatches.length, 1, 'Duplicate candidate must be cleanly deduplicated');
    assert.equal(candidates.length, 2);
  });

  test('extractFieldsFromText exposes full students array along with top-level backwards compatible fields', () => {
    const multiText = `
      DEPARTMENT OF COMPUTER SCIENCE
      Date: 2026-10-14
      Course: Database Systems
      From: 10:00 To: 11:00
      Ref: MED-2026-55
      Students:
      1. Riya Shah (STU-001)
      2. Dev Patel (STU-004)
    `;

    const res = extractFieldsFromText(multiText, { roster: mockRoster });
    assert.ok(Array.isArray(res.extracted.students));
    assert.equal(res.extracted.students.length, 2);
    // Backwards compatibility check: primary student is exposed at top level
    assert.equal(res.extracted.studentId, 'STU-001');
    assert.equal(res.extracted.studentName, 'Riya Shah');
    assert.equal(res.extracted.date, '2026-10-14');
    assert.equal(res.extracted.subject, 'Database Systems');
  });
});

describe('Multi-Student Workflow: Database Batch Queueing & Document Linkage', () => {
  let docId;
  let isDbOnline = false;

  before(async () => {
    isDbOnline = await testDatabaseConnection();
    docId = `DOC-TEST-MULTI-${Date.now()}`;
    await createDocumentRecord({
      id: docId,
      storageKey: `documents/test/${docId}.pdf`,
      storageProvider: 'local',
      originalFilename: 'batch_permission_letter.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 4096,
      extractionStatus: 'success',
      rawExtractedJson: {
        students: [
          { rawStudentName: 'Riya Shah', rawStudentId: 'STU-001', studentId: 'STU-001', studentName: 'Riya Shah' },
          { rawStudentName: 'Dev Patel', rawStudentId: 'STU-004', studentId: 'STU-004', studentName: 'Dev Patel' }
        ]
      },
      missingFields: [],
      notes: []
    });
  });

  test('links multiple student letters to a single document upload record', async () => {
    const batchList = [
      {
        studentId: 'STU-001',
        studentName: 'Riya Shah',
        rawStudentName: 'Riya Shah Extracted',
        rawStudentId: 'STU-001',
        date: '2026-10-14',
        startTime: '10:00',
        endTime: '11:00',
        subject: 'Database Systems',
        reference: 'MULTI-EVT-01',
        uploadId: docId,
        documentName: 'batch_permission_letter.pdf',
        matchedSubject: 'Database Systems',
        lectureId: 'LEC-101',
        validation: 'Exact lecture/time candidate'
      },
      {
        studentId: 'STU-004',
        studentName: 'Dev Patel',
        rawStudentName: 'Dev Patel Extracted',
        rawStudentId: 'STU-004',
        date: '2026-10-14',
        startTime: '10:00',
        endTime: '11:00',
        subject: 'Database Systems',
        reference: 'MULTI-EVT-01',
        uploadId: docId,
        documentName: 'batch_permission_letter.pdf',
        matchedSubject: 'Database Systems',
        lectureId: 'LEC-101',
        validation: 'Exact lecture/time candidate'
      }
    ];

    const queued = await queueBatchAttendanceLetters(batchList, 'Coordinator Tester');
    assert.equal(queued.length, 2);

    assert.equal(queued[0].uploadId, docId);
    assert.equal(queued[1].uploadId, docId);

    // Verify raw fields are preserved
    assert.equal(queued[0].rawStudentName, 'Riya Shah Extracted');
    assert.equal(queued[1].rawStudentName, 'Dev Patel Extracted');

    // Document lookup check
    const doc = await findDocumentById(docId);
    assert.ok(doc);
    assert.equal(doc.id, docId);
  });

  test('validates each student independently (ambiguous vs exact match)', async () => {
    const mixedBatch = [
      {
        studentId: 'STU-001',
        studentName: 'Riya Shah',
        rawStudentName: 'Riya Shah',
        rawStudentId: 'STU-001',
        date: '2026-10-14',
        startTime: '10:00',
        endTime: '11:00',
        subject: 'Database Systems',
        uploadId: docId,
        documentName: 'batch_permission_letter.pdf',
        matchedSubject: 'Database Systems',
        lectureId: 'LEC-101',
        validation: 'Exact lecture/time candidate'
      },
      {
        studentId: 'STU-002',
        studentName: 'Aman Gupta',
        rawStudentName: 'Aman Gupta',
        rawStudentId: 'STU-002',
        date: '2026-10-14',
        startTime: '15:00',
        endTime: '16:00',
        subject: 'Unknown Lecture',
        uploadId: docId,
        documentName: 'batch_permission_letter.pdf',
        matchedSubject: '',
        lectureId: null,
        validation: 'Needs clarification: no exact match'
      }
    ];

    const queued = await queueBatchAttendanceLetters(mixedBatch, 'Coordinator Tester');
    assert.equal(queued.length, 2);

    const exactItem = queued.find(l => l.studentId === 'STU-001');
    const ambiguousItem = queued.find(l => l.studentId === 'STU-002');

    assert.equal(exactItem.validation, 'Exact lecture/time candidate');
    assert.equal(ambiguousItem.validation, 'Needs clarification: no exact match');

    // Safeguard check: ambiguous item must reject approval attempt
    await assert.rejects(
      async () => {
        await recordLetterDecision({
          letterId: ambiguousItem.id,
          decision: 'approve',
          actor: 'Coordinator Tester'
        });
      },
      (err) => err.status === 400 || err.message.includes('clarification')
    );
  });

  test('bulk approval approves eligible letters while safely skipping ambiguous ones', async () => {
    const lettersToTest = [
      {
        studentId: 'STU-003',
        studentName: 'Sneha Patel',
        rawStudentName: 'Sneha Patel',
        rawStudentId: 'STU-003',
        date: '2026-10-14',
        startTime: '10:00',
        endTime: '11:00',
        subject: 'Database Systems',
        uploadId: docId,
        documentName: 'batch_permission_letter.pdf',
        matchedSubject: 'Database Systems',
        lectureId: 'LEC-101',
        validation: 'Exact lecture/time candidate'
      },
      {
        studentId: 'STU-004',
        studentName: 'Dev Patel',
        rawStudentName: 'Dev Patel',
        rawStudentId: 'STU-004',
        date: '2026-10-14',
        startTime: '20:00',
        endTime: '21:00', // Ambiguous / off hours
        subject: 'Database Systems',
        uploadId: docId,
        documentName: 'batch_permission_letter.pdf',
        matchedSubject: '',
        lectureId: null,
        validation: 'Needs clarification: no exact match'
      }
    ];

    const queued = await queueBatchAttendanceLetters(lettersToTest, 'Coordinator Tester');
    const letterIds = queued.map(l => l.id);

    const result = await recordBatchLetterDecision({
      letterIds,
      decision: 'approve',
      actor: 'Coordinator Tester'
    });

    assert.equal(result.approved.length, 1);
    assert.equal(result.approved[0].studentId, 'STU-003');
    assert.equal(result.approved[0].status, 'Approved');

    assert.equal(result.skipped.length, 1);
    assert.equal(result.skipped[0].id, queued[1].id);
    assert.ok(result.skipped[0].reason.includes('clarification'));

    // Verify attendance was updated for STU-003 in LEC-101
    const lec101Attendance = await getAttendanceByLecture('LEC-101');
    const snehaRecord = lec101Attendance.find(a => a.studentId === 'STU-003');
    assert.ok(snehaRecord);
    assert.equal(snehaRecord.status, 'Present');
  });

  test('duplicate submissions do not create duplicate attendance records', async () => {
    // If a second letter is approved for the same lecture and student
    const dupLetter = {
      studentId: 'STU-003',
      studentName: 'Sneha Patel',
      rawStudentName: 'Sneha Patel',
      rawStudentId: 'STU-003',
      date: '2026-10-14',
      startTime: '10:00',
      endTime: '11:00',
      subject: 'Database Systems',
      uploadId: docId,
      documentName: 'batch_permission_letter.pdf',
      matchedSubject: 'Database Systems',
      lectureId: 'LEC-101',
      validation: 'Exact lecture/time candidate'
    };

    const [secondQueued] = await queueBatchAttendanceLetters([dupLetter], 'Coordinator Tester');
    await recordLetterDecision({
      letterId: secondQueued.id,
      decision: 'approve',
      actor: 'Coordinator Tester'
    });

    const lec101Attendance = await getAttendanceByLecture('LEC-101');
    const snehaRecords = lec101Attendance.filter(a => a.studentId === 'STU-003');
    assert.equal(snehaRecords.length, 1, 'Attendance record must remain unique (no duplicate rows)');
    assert.equal(snehaRecords[0].status, 'Present');
  });

  test('rejection marks letter as Rejected without modifying attendance', async () => {
    const rejectItem = {
      studentId: 'STU-002',
      studentName: 'Aman Gupta',
      rawStudentName: 'Aman Gupta',
      rawStudentId: 'STU-002',
      date: '2026-10-14',
      startTime: '10:00',
      endTime: '11:00',
      subject: 'Database Systems',
      uploadId: docId,
      documentName: 'batch_permission_letter.pdf',
      matchedSubject: 'Database Systems',
      lectureId: 'LEC-101',
      validation: 'Exact lecture/time candidate'
    };

    const [queued] = await queueBatchAttendanceLetters([rejectItem], 'Coordinator Tester');
    const updated = await recordLetterDecision({
      letterId: queued.id,
      decision: 'reject',
      actor: 'Coordinator Tester'
    });

    assert.equal(updated.status, 'Rejected');
    const checked = await findLetterById(queued.id);
    assert.equal(checked.status, 'Rejected');
  });
});

describe('Multi-Student Workflow: HTTP API Integration Endpoints', () => {
  let server;
  let baseUrl;

  before(async () => {
    const testApp = express();
    testApp.use(cors());
    testApp.use(express.json());

    testApp.post('/api/letters', async (req, res) => {
      try {
        if (Array.isArray(req.body.students) && req.body.students.length > 0) {
          const {
            students: rawStudents,
            date,
            subject = '',
            startTime = '',
            endTime = '',
            reference = '',
            uploadId = '',
            documentName = '',
            actor = 'Attendance Coordinator'
          } = req.body;

          if (!date) return res.status(400).json({ error: 'Letter date is required.' });

          const allLectures = await getLectures();
          const batchItems = [];

          for (const st of rawStudents) {
            const student = await findStudentById(st.studentId);
            if (!student) {
              return res.status(400).json({
                error: `Student ${st.studentName || st.studentId || st.rawStudentName || ''} (${st.studentId}) is not enrolled in the database roster.`
              });
            }

            const studentSubject = st.subject !== undefined ? st.subject : subject;
            const studentDate = st.date || date;
            const studentStart = st.startTime !== undefined ? st.startTime : startTime;
            const studentEnd = st.endTime !== undefined ? st.endTime : endTime;

            const candidates = allLectures.filter(
              l => l.date === studentDate && l.studentIds.includes(student.id) && (!studentSubject.trim() || l.subject.toLowerCase().includes(studentSubject.trim().toLowerCase()))
            );
            const exact = candidates.filter(l => (!studentStart || l.startTime >= studentStart) && (!studentEnd || l.endTime <= studentEnd));
            const partial = candidates.some(l => studentStart && studentEnd && l.startTime < studentEnd && l.endTime > studentStart && !(l.startTime >= studentStart && l.endTime <= studentEnd));
            const matched = exact.length === 1 ? exact[0] : null;

            const validation = matched
              ? 'Exact lecture/time candidate'
              : partial
              ? 'Needs clarification: partial time overlap'
              : candidates.length > 1
              ? 'Needs clarification: multiple lecture matches'
              : 'Needs clarification: no exact match';

            batchItems.push({
              studentId: student.id,
              studentName: student.name,
              rawStudentName: st.rawStudentName || student.name,
              rawStudentId: st.rawStudentId || student.id,
              date: studentDate,
              startTime: studentStart,
              endTime: studentEnd,
              subject: studentSubject,
              reference: st.reference || reference,
              uploadId,
              documentName,
              matchedSubject: matched?.subject || '',
              lectureId: matched?.id || '',
              validation
            });
          }

          const items = await queueBatchAttendanceLetters(batchItems, actor);
          return res.status(201).json({
            message: `Queued ${items.length} student attendance letters for review.`,
            items
          });
        }
        res.status(400).json({ error: 'Invalid payload' });
      } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
      }
    });

    testApp.post('/api/letters/batch-decision', async (req, res) => {
      try {
        const { letterIds, decision, actor = 'Attendance Coordinator' } = req.body || {};
        if (!['approve', 'reject'].includes(decision)) return res.status(400).json({ error: 'Choose approve or reject.' });
        if (!Array.isArray(letterIds) || letterIds.length === 0) return res.status(400).json({ error: 'Provide at least one letter ID.' });

        const result = await recordBatchLetterDecision({ letterIds, decision, actor });
        const approvedCount = result.approved.length;
        const rejectedCount = result.rejected.length;
        const skippedCount = result.skipped.length;

        let message = '';
        if (decision === 'approve') {
          message = `Approved ${approvedCount} eligible attendance letter${approvedCount === 1 ? '' : 's'}.${skippedCount > 0 ? ` ${skippedCount} skipped (ambiguous or requires clarification).` : ''}`;
        } else {
          message = `Rejected ${rejectedCount} attendance letter${rejectedCount === 1 ? '' : 's'}.`;
        }

        res.json({ message, ...result });
      } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
      }
    });

    await new Promise(resolve => {
      server = testApp.listen(0, () => {
        baseUrl = `http://localhost:${server.address().port}/api`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
  });

  test('POST /api/letters accepts batch students array and returns queued items', async () => {
    const payload = {
      date: '2026-10-14',
      subject: 'Database Systems',
      startTime: '10:00',
      endTime: '11:00',
      reference: 'API-BATCH-TEST-01',
      actor: 'API Integration Tester',
      students: [
        {
          studentId: 'STU-001',
          studentName: 'Riya Shah',
          rawStudentName: 'Riya Shah OCR',
          rawStudentId: 'STU-001'
        },
        {
          studentId: 'STU-004',
          studentName: 'Dev Patel',
          rawStudentName: 'Dev Patel OCR',
          rawStudentId: 'STU-004'
        }
      ]
    };

    const res = await fetch(`${baseUrl}/letters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.message.includes('Queued 2'));
    assert.ok(Array.isArray(body.items));
    assert.equal(body.items.length, 2);

    assert.equal(body.items[0].studentId, 'STU-001');
    assert.equal(body.items[0].rawStudentName, 'Riya Shah OCR');
    assert.equal(body.items[1].studentId, 'STU-004');
    assert.equal(body.items[1].rawStudentName, 'Dev Patel OCR');
  });

  test('POST /api/letters/batch-decision approves eligible items and returns summary', async () => {
    const setupRes = await fetch(`${baseUrl}/letters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: '2026-10-14',
        subject: 'Database Systems',
        startTime: '10:00',
        endTime: '11:00',
        reference: 'API-BATCH-DECISION-01',
        students: [
          { studentId: 'STU-001', rawStudentName: 'Riya Shah' }
        ]
      })
    });
    const setupBody = await setupRes.json();
    const queuedId = setupBody.items[0].id;

    const decisionRes = await fetch(`${baseUrl}/letters/batch-decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        letterIds: [queuedId],
        decision: 'approve',
        actor: 'Coordinator API Tester'
      })
    });

    assert.equal(decisionRes.status, 200);
    const decisionBody = await decisionRes.json();
    assert.ok(decisionBody.message.includes('Approved 1'));
    assert.equal(decisionBody.approved.length, 1);
    assert.equal(decisionBody.approved[0].id, queuedId);
    assert.equal(decisionBody.approved[0].status, 'Approved');
  });

  test('POST /api/letters rejects when unknown student is submitted in batch', async () => {
    const res = await fetch(`${baseUrl}/letters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: '2026-10-14',
        students: [
          { studentId: 'STU-NONEXISTENT', rawStudentName: 'Unknown Person' }
        ]
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes('not enrolled'));
  });
});

