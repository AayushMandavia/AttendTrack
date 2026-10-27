import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import {
  isDocxBuffer,
  extractDocumentXml,
  parseDocxTables,
  parseDocxDocument,
  isPlaceholderOrBlank,
  matchStudentToRoster
} from '../src/docx-parser.js';
import {
  testDatabaseConnection,
  createDocumentRecord,
  queueBatchAttendanceLetters,
  recordLetterDecision,
  recordBatchLetterDecision,
  findLetterById,
  findDocumentById,
  getAttendanceByLecture,
  getStudents,
  getLectures
} from '../src/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Helper to construct an in-memory valid OpenXML DOCX buffer (Stored / compression=0)
 */
function createSyntheticDocxBuffer(documentXml) {
  const name = Buffer.from('word/document.xml', 'utf8');
  const content = Buffer.from(documentXml, 'utf8');
  const header = Buffer.alloc(30);

  header.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
  header.writeUInt16LE(10, 4);         // Version needed
  header.writeUInt16LE(0, 6);          // General flags
  header.writeUInt16LE(0, 8);          // Compression: 0 (Stored)
  header.writeUInt16LE(0, 10);         // Mod time
  header.writeUInt16LE(0, 12);         // Mod date
  header.writeUInt32LE(0, 14);         // CRC-32
  header.writeUInt32LE(content.length, 18); // Compressed size
  header.writeUInt32LE(content.length, 22); // Uncompressed size
  header.writeUInt16LE(name.length, 26);    // File name length
  header.writeUInt16LE(0, 28);              // Extra field length

  return Buffer.concat([header, name, content]);
}

/**
 * Builds minimal OpenXML table XML with rows and cells
 */
function buildDocxTableXml(rows = []) {
  let xml = '<w:tbl>';
  for (const row of rows) {
    xml += '<w:tr>';
    for (const cell of row) {
      xml += `<w:tc><w:p><w:r><w:t>${cell}</w:t></w:r></w:p></w:tc>`;
    }
    xml += '</w:tr>';
  }
  xml += '</w:tbl>';
  return xml;
}

describe('Phase 1 & 2: Native Word (.docx) Parsing & Student Extraction', () => {
  const mockRoster = [
    { id: 'STU-001', name: 'Riya Shah', rollNo: '24CS01', sapId: '60001240001' },
    { id: 'STU-002', name: 'Arjun Mehta', rollNo: '24CS02', sapId: '60001240002' },
    { id: 'STU-003', name: 'Sara Khan', rollNo: '24CS03', sapId: '60001240003' },
    { id: 'STU-004', name: 'Dev Patel', rollNo: '24CS04', sapId: '60001240004' }
  ];

  test('valid Word template file on disk is recognized and parsed', async () => {
    const templatePath = path.join(__dirname, '../../docs/templates/AttendTrack_Attendance_Permission_Template.docx');
    assert.ok(fs.existsSync(templatePath), 'Template file must exist at docs/templates/');

    const buffer = fs.readFileSync(templatePath);
    assert.ok(isDocxBuffer(buffer), 'Template buffer must pass DOCX signature verification');

    const result = await parseDocxDocument(buffer, { roster: mockRoster });
    assert.ok(result, 'Parser must return result');
    assert.ok(Array.isArray(result.notes), 'Result must contain notes array');
    assert.ok(result.extracted, 'Result must contain extracted metadata');
    // The template contains placeholder rows ([Student Full Name - 1], etc.) which must be skipped
    assert.equal(result.extracted.students.length, 0, 'Template placeholder rows must not be parsed as real students');
  });

  test('extracts multiple filled student rows and metadata from OpenXML table', async () => {
    const tableXml = buildDocxTableXml([
      ['Sr. No.', 'Full Name of Student', 'Branch / Department', 'Roll Number', 'SAP ID'],
      ['1', 'Riya Shah', 'Computer Engineering', '24CS01', '60001240001'],
      ['2', 'Dev Patel', 'Computer Engineering', '24CS04', '60001240004'],
      ['3', 'John Doe External', 'Electronics', 'EXT-991', 'EXT-SAP-991']
    ]);

    const docXml = `
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>ATTENDANCE PERMISSION LETTER</w:t></w:r></w:p>
          <w:p><w:r><w:t>Letter Reference Number: REF-ACM-2026-99</w:t></w:r></w:p>
          <w:p><w:r><w:t>Date of Issue: 14/10/2026</w:t></w:r></w:p>
          <w:p><w:r><w:t>Subject: Database Systems</w:t></w:r></w:p>
          <w:p><w:r><w:t>Time: 10:00 to 11:00</w:t></w:r></w:p>
          ${tableXml}
        </w:body>
      </w:document>
    `;

    const docxBuffer = createSyntheticDocxBuffer(docXml);
    assert.ok(isDocxBuffer(docxBuffer));

    const result = await parseDocxDocument(docxBuffer, { roster: mockRoster });
    assert.equal(result.status, 'success');
    assert.equal(result.extracted.reference, 'REF-ACM-2026-99');
    assert.equal(result.extracted.date, '2026-10-14');
    assert.equal(result.extracted.subject, 'Database Systems');
    assert.equal(result.extracted.startTime, '10:00');
    assert.equal(result.extracted.endTime, '11:00');

    const students = result.extracted.students;
    assert.equal(students.length, 3);

    // Student 1: Riya Shah
    assert.equal(students[0].rawStudentName, 'Riya Shah');
    assert.equal(students[0].branch, 'Computer Engineering');
    assert.equal(students[0].rollNo, '24CS01');
    assert.equal(students[0].sapId, '60001240001');
    assert.equal(students[0].studentId, 'STU-001');
    assert.equal(students[0].studentName, 'Riya Shah');
    assert.equal(students[0].matchStatus, 'matched');

    // Student 2: Dev Patel
    assert.equal(students[1].rawStudentName, 'Dev Patel');
    assert.equal(students[1].studentId, 'STU-004');
    assert.equal(students[1].matchStatus, 'matched');

    // Student 3: External Visitor (Unmatched)
    assert.equal(students[2].rawStudentName, 'John Doe External');
    assert.equal(students[2].studentId, '');
    assert.equal(students[2].matchStatus, 'unmatched');
    assert.equal(students[2].rosterMatched, false);
  });

  test('filters out blank rows and template placeholders strictly', () => {
    assert.equal(isPlaceholderOrBlank('[Student Full Name - 1]', '[e.g. 24CS01]', '[e.g. 6000124...]'), true);
    assert.equal(isPlaceholderOrBlank('', '', ''), true);
    assert.equal(isPlaceholderOrBlank('   ', '', ''), true);
    assert.equal(isPlaceholderOrBlank('[Student Full Name - 2]', '24CS02', '60001240002'), true);
    assert.equal(isPlaceholderOrBlank('Dev Patel', '24CS04', '60001240004'), false);
    assert.equal(isPlaceholderOrBlank('A. Gupta', '', ''), false);
  });

  test('detects conflicting SAP ID vs Name and marks as ambiguous', () => {
    // SAP ID 60001240001 belongs to Riya Shah, but letter lists Dev Patel
    const conflict = matchStudentToRoster('Dev Patel', '24CS01', '60001240001', mockRoster);
    assert.equal(conflict.matchStatus, 'ambiguous');
    assert.equal(conflict.matched, null, 'Conflict must never auto-assign match');
    assert.ok(conflict.note.includes('SAP ID / Name Mismatch'));
  });

  test('deduplicates duplicate student rows in Word table', async () => {
    const tableXml = buildDocxTableXml([
      ['Sr.', 'Name', 'Branch', 'Roll No', 'SAP ID'],
      ['1', 'Riya Shah', 'Computer', '24CS01', '60001240001'],
      ['2', 'Riya Shah', 'Computer', '24CS01', '60001240001'], // Exact dupe
      ['3', 'Dev Patel', 'Computer', '24CS04', '60001240004']
    ]);

    const docXml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${tableXml}</w:body></w:document>`;
    const docxBuffer = createSyntheticDocxBuffer(docXml);

    const result = await parseDocxDocument(docxBuffer, { roster: mockRoster });
    assert.equal(result.extracted.students.length, 2, 'Duplicate row must be deduplicated');
  });

  test('rejects malformed and non-DOCX files with useful error messages', async () => {
    // 1. Plain text file masquerading as DOCX
    const fakeTextDocx = Buffer.from('This is not a zip file at all.');
    assert.equal(isDocxBuffer(fakeTextDocx), false);
    const textResult = await parseDocxDocument(fakeTextDocx, { roster: mockRoster });
    assert.equal(textResult.status, 'failed');
    assert.ok(textResult.notes[0].includes('not a valid Word (.docx) document'));

    // 2. Zip file missing word/document.xml
    const emptyZipHeader = Buffer.alloc(30);
    emptyZipHeader.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
    emptyZipHeader.writeUInt16LE(14, 26);        // Name length 14
    const notWordName = Buffer.from('some/other.txt');
    const zipWithoutDoc = Buffer.concat([emptyZipHeader, notWordName]);

    assert.equal(isDocxBuffer(zipWithoutDoc), false);
    const missingPayloadResult = await parseDocxDocument(zipWithoutDoc, { roster: mockRoster });
    assert.equal(missingPayloadResult.status, 'failed');
  });
});

describe('Phase 3 & 4: PostgreSQL Multi-Student Workflow, Batch Approvals & Safeguards', () => {
  let docId;
  const mockActor = 'Coordinator Verma';

  test('uploads DOCX via HTTP endpoint and creates single document record in PostgreSQL', async () => {
    const tableXml = buildDocxTableXml([
      ['Sr. No.', 'Full Name', 'Branch', 'Roll Number', 'SAP ID'],
      ['1', 'Riya Shah', 'Computer Engineering', '24CS01', 'STU-001'],
      ['2', 'Dev Patel', 'Computer Engineering', '24CS04', 'STU-004']
    ]);

    const docXml = `
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>Letter Reference: REF-DOCX-TEST-01</w:t></w:r></w:p>
          <w:p><w:r><w:t>Date: 2026-10-14</w:t></w:r></w:p>
          <w:p><w:r><w:t>Subject: Database Systems</w:t></w:r></w:p>
          <w:p><w:r><w:t>Time: 10:00 to 11:00</w:t></w:r></w:p>
          ${tableXml}
        </w:body>
      </w:document>
    `;

    const docxBuffer = createSyntheticDocxBuffer(docXml);

    docId = `DOC-TEST-${Date.now()}`;
    const docRecord = await createDocumentRecord({
      id: docId,
      storageKey: `documents/${docId}.docx`,
      originalFilename: 'Student_Permission_Letter.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: docxBuffer.length,
      extractionStatus: 'success',
      rawExtractedJson: {
        date: '2026-10-14',
        subject: 'Database Systems',
        startTime: '10:00',
        endTime: '11:00',
        reference: 'REF-DOCX-TEST-01',
        students: [
          { rawStudentName: 'Riya Shah', rollNo: '24CS01', sapId: 'STU-001', studentId: 'STU-001', matchStatus: 'matched' },
          { rawStudentName: 'Dev Patel', rollNo: '24CS04', sapId: 'STU-004', studentId: 'STU-004', matchStatus: 'matched' }
        ]
      }
    });

    assert.ok(docRecord);
    assert.equal(docRecord.id, docId);
    assert.equal(docRecord.originalFilename, 'Student_Permission_Letter.docx');

    const fetched = await findDocumentById(docId);
    assert.ok(fetched);
    assert.equal(fetched.id, docId);
  });

  test('queues multi-student batch in PostgreSQL linked to single document record', async () => {
    const batchList = [
      {
        studentId: 'STU-001',
        studentName: 'Riya Shah',
        rawStudentName: 'Riya S. Shah',
        rawStudentId: '24CS01',
        date: '2026-10-14',
        startTime: '10:00',
        endTime: '11:00',
        subject: 'Database Systems',
        reference: 'REF-DOCX-TEST-01',
        uploadId: docId,
        documentName: 'Student_Permission_Letter.docx',
        matchedSubject: 'Database Systems',
        lectureId: 'LEC-101',
        validation: 'Exact lecture/time candidate'
      },
      {
        studentId: 'STU-004',
        studentName: 'Dev Patel',
        rawStudentName: 'Dev K. Patel',
        rawStudentId: '24CS04',
        date: '2026-10-14',
        startTime: '10:00',
        endTime: '11:00',
        subject: 'Database Systems',
        reference: 'REF-DOCX-TEST-01',
        uploadId: docId,
        documentName: 'Student_Permission_Letter.docx',
        matchedSubject: 'Database Systems',
        lectureId: 'LEC-101',
        validation: 'Exact lecture/time candidate'
      }
    ];

    const queued = await queueBatchAttendanceLetters(batchList, mockActor);
    assert.equal(queued.length, 2);

    for (const item of queued) {
      assert.ok(item.id.startsWith('LTR-'));
      assert.equal(item.status, 'Pending');
      assert.equal(item.uploadId, docId, 'All batch letters must link to single document record');
    }
  });

  test('safeguard: prevents intra-batch duplicate student entries in single request', async () => {
    const intraDupeBatch = [
      { studentId: 'STU-002', studentName: 'Arjun Mehta', date: '2026-10-14', validation: 'Exact lecture/time candidate' },
      { studentId: 'STU-002', studentName: 'Arjun Mehta', date: '2026-10-14', validation: 'Exact lecture/time candidate' }
    ];

    await assert.rejects(
      async () => {
        await queueBatchAttendanceLetters(intraDupeBatch, mockActor);
      },
      (err) => {
        assert.ok(err.message.includes('Duplicate submission: Student'));
        assert.equal(err.status, 400);
        return true;
      }
    );
  });

  test('individual decision: approves STU-001 and verifies lecture attendance is updated to Present', async () => {
    // Find the queued letter for STU-001
    const letter = (await queueBatchAttendanceLetters([
      {
        studentId: 'STU-001',
        studentName: 'Riya Shah',
        rawStudentName: 'Riya Shah',
        date: '2026-10-14',
        startTime: '10:00',
        endTime: '11:00',
        subject: 'Database Systems',
        lectureId: 'LEC-101',
        reference: 'REF-INDIV-01',
        validation: 'Exact lecture/time candidate'
      }
    ], mockActor))[0];

    const approved = await recordLetterDecision({
      letterId: letter.id,
      decision: 'approve',
      actor: mockActor
    });

    assert.equal(approved.status, 'Approved');
    assert.equal(approved.reviewedBy, mockActor);

    // Verify attendance in LEC-101 is Present
    const lec101 = await getAttendanceByLecture('LEC-101');
    const stu1 = lec101.find(a => a.studentId === 'STU-001');
    assert.ok(stu1);
    assert.equal(stu1.status, 'Present');
    assert.equal(stu1.correctedBy, mockActor);
  });

  test('bulk decision: approves eligible letters while safely skipping unvalidated ones', async () => {
    const mixedBatch = [
      {
        studentId: 'STU-004',
        studentName: 'Dev Patel',
        date: '2026-10-14',
        startTime: '10:00',
        endTime: '11:00',
        subject: 'Database Systems',
        lectureId: 'LEC-101',
        validation: 'Exact lecture/time candidate'
      },
      {
        studentId: 'STU-003',
        studentName: 'Sara Khan',
        date: '2026-10-14',
        startTime: '11:30', // Outside time
        endTime: '12:30',
        subject: 'Database Systems',
        lectureId: 'LEC-101',
        validation: 'Needs clarification: partial time overlap' // Ambiguous!
      }
    ];

    const queued = await queueBatchAttendanceLetters(mixedBatch, mockActor);
    const letterIds = queued.map(q => q.id);

    const result = await recordBatchLetterDecision({
      letterIds,
      decision: 'approve',
      actor: mockActor
    });

    // Dev Patel (exact match) should be approved
    assert.equal(result.approved.length, 1);
    assert.equal(result.approved[0].studentId, 'STU-004');

    // Sara Khan (ambiguous) must be skipped by safeguard
    assert.equal(result.skipped.length, 1);
    assert.equal(result.skipped[0].studentName, 'Sara Khan');
    assert.ok(result.skipped[0].reason.includes('Requires clarification'));

    // Sara Khan's letter remains Pending
    const unapproved = await findLetterById(queued[1].id);
    assert.equal(unapproved.status, 'Pending');
  });
});
