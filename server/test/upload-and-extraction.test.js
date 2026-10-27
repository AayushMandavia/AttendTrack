import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import { detectFileSignature, handleLetterUpload } from '../src/upload.js';
import { prisma, testDatabaseConnection } from '../src/db.js';
import { extractFieldsFromText, parsePdfDocument, parseImageDocument, parseDateString, parseTimes, terminateOcrWorker } from '../src/extractor.js';
import { students, lectures, letters } from '../src/data.js';

describe('Unit Tests: File Signature Detection', () => {
  test('correctly identifies PDF signature', () => {
    const pdfHeader = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]); // %PDF-1.4
    assert.equal(detectFileSignature(pdfHeader), 'application/pdf');
  });

  test('correctly identifies PNG signature', () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    assert.equal(detectFileSignature(pngHeader), 'image/png');
  });

  test('correctly identifies JPEG signature', () => {
    const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
    assert.equal(detectFileSignature(jpegHeader), 'image/jpeg');
  });

  test('rejects disguised text or executable files', () => {
    const textFile = Buffer.from('This is a plain text file pretending to be a document.');
    const exeFile = Buffer.from([0x4D, 0x5A, 0x90, 0x00]); // MZ header
    assert.equal(detectFileSignature(textFile), null);
    assert.equal(detectFileSignature(exeFile), null);
    assert.equal(detectFileSignature(Buffer.alloc(0)), null);
    assert.equal(detectFileSignature(null), null);
  });
});

describe('Unit Tests: Document Field Extractor & Label Variations', () => {
  test('extracts full details from standard format', () => {
    const letterText = `
      COLLEGE OF ENGINEERING
      Official Attendance Excuse Letter
      Date: 2026-10-14
      Student: Riya Shah (ID: STU-001)
      Subject: Database Systems
      Time: 10:00 - 11:00
      Reference No: EVT-2026-99
    `;
    const res = extractFieldsFromText(letterText);
    assert.equal(res.extracted.studentId, 'STU-001');
    assert.equal(res.extracted.studentName, 'Riya Shah');
    assert.equal(res.extracted.date, '2026-10-14');
    assert.equal(res.extracted.subject, 'Database Systems');
    assert.equal(res.extracted.startTime, '10:00');
    assert.equal(res.extracted.endTime, '11:00');
    assert.equal(res.extracted.reference, 'EVT-2026-99');
    assert.equal(res.status, 'success');
  });

  test('supports label variations: Name, Roll No, Course, separate From/To lines, Month DD YYYY', () => {
    const letterText = `
      Name: Dev Patel
      Roll No: STU-004
      Date: October 14, 2026
      Course: Computer Networks
      From: 11:00 AM
      To: 12:00 PM
      Ref No: REF-2026-99
    `;
    const res = extractFieldsFromText(letterText);
    assert.equal(res.extracted.studentId, 'STU-004');
    assert.equal(res.extracted.studentName, 'Dev Patel');
    assert.equal(res.extracted.rawStudentName, 'Dev Patel');
    assert.equal(res.extracted.rawStudentId, 'STU-004');
    assert.equal(res.extracted.date, '2026-10-14');
    assert.equal(res.extracted.subject, 'Computer Networks');
    assert.equal(res.extracted.startTime, '11:00');
    assert.equal(res.extracted.endTime, '12:00');
    assert.equal(res.extracted.reference, 'REF-2026-99');
    assert.equal(res.status, 'success');
  });

  test('supports label variations: Student Name, Applicant Name, Name of Student', () => {
    const applicantText = 'Applicant Name: Maya Verma\nDate: 2026-10-14';
    const applicantRes = extractFieldsFromText(applicantText);
    assert.equal(applicantRes.extracted.rawStudentName, 'Maya Verma');

    const nameOfStudentText = 'Name of Student: Priya Rao\nDate: 2026-10-14';
    const nameOfRes = extractFieldsFromText(nameOfStudentText);
    assert.equal(nameOfRes.extracted.rawStudentName, 'Priya Rao');
  });

  test('does not guess roster identity for external or non-enrolled students', () => {
    const letterText = `
      Candidate Name: Aarav Sharma
      ID: EXT-999
      Date: 2026-10-14
      Subject: Database Systems
      Time: 10:00 - 11:00
    `;
    const res = extractFieldsFromText(letterText);
    assert.equal(res.extracted.rawStudentName, 'Aarav Sharma');
    assert.equal(res.extracted.rawStudentId, 'EXT-999');
    assert.equal(res.extracted.studentName, 'Aarav Sharma');
    assert.equal(res.extracted.studentId, ''); // Unresolved!
    assert.equal(res.extracted.rosterMatched, false);
    assert.ok(res.notes.some(n => n.includes('does not match an enrolled student in the current roster')));
  });

  test('marks missing fields when document text is incomplete', () => {
    const incompleteText = `
      Student ID: STU-002
      Participated in college sports event on 2026-10-14.
    `;
    const res = extractFieldsFromText(incompleteText);
    assert.equal(res.extracted.studentId, 'STU-002');
    assert.equal(res.extracted.date, '2026-10-14');
    assert.equal(res.status, 'partial');
    assert.ok(res.missingFields.includes('startTime'));
    assert.ok(res.missingFields.includes('endTime'));
  });

  test('handles unreadable or empty text safely without crashing', () => {
    const res = extractFieldsFromText('');
    assert.equal(res.status, 'failed');
    assert.deepEqual(res.extracted, {});
    assert.ok(res.missingFields.length > 0);
  });

  test('handles corrupted PDF buffer gracefully', async () => {
    const corruptBuffer = Buffer.from('%PDF-corrupted-data-with-no-valid-trailer');
    const res = await parsePdfDocument(corruptBuffer);
    assert.equal(res.status, 'failed');
    assert.ok(res.notes[0].includes('Failed to parse PDF document'));
  });
});

describe('Unit Tests: OCR Image Extraction with Tesseract.js', () => {
  const sampleImagePath = path.join(process.cwd(), '..', 'docs', 'sample-letters', 'sample_maya_verma.jpg');

  test('OCR successfully extracts text and student name from synthetic JPEG image', async () => {
    if (!fs.existsSync(sampleImagePath)) {
      console.log('Skipping image OCR test: sample_maya_verma.jpg not found');
      return;
    }
    const imageBuf = fs.readFileSync(sampleImagePath);
    const res = await parseImageDocument(imageBuf);

    assert.equal(res.extracted.rawStudentName, 'Maya Verma');
    assert.equal(res.extracted.studentName, 'Maya Verma');
    assert.equal(res.extracted.date, '2026-10-14');
    assert.equal(res.extracted.subject, 'Database Systems');
    assert.equal(res.extracted.startTime, '10:00');
    assert.equal(res.extracted.endTime, '11:00');
    // Ensure non-roster student leaves roster match unresolved
    assert.equal(res.extracted.studentId, '');
    assert.equal(res.extracted.rosterMatched, false);
    assert.ok(res.notes.some(n => n.includes('does not match an enrolled student in the current roster')));
  });

  test('OCR on corrupted or invalid image buffer returns clean error note', async () => {
    const corruptBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0xDE, 0xAD, 0xBE, 0xEF]);
    const res = await parseImageDocument(corruptBuffer);
    assert.equal(res.status, 'failed');
    assert.ok(res.notes[0].includes('OCR extraction failed'));
  });
});

describe('Integration Tests: Upload & Approval Safeguards', () => {
  let server;
  let baseUrl;
  const localLetters = [];

  before(async () => {
    const app = express();
    app.use(cors());
    app.use(express.json());
    app.post('/api/letters/upload', handleLetterUpload);
    app.post('/api/letters', (req, res) => {
      const { studentId, date, subject = '', startTime = '', endTime = '', reference = '', uploadId = '', documentName = '', actor = 'Attendance Coordinator' } = req.body || {};
      const student = students.find(s => s.id === studentId);
      if (!student || !date) return res.status(400).json({ error: 'A valid student and letter date are required.' });
      const candidates = lectures.filter(l => l.date === date && l.studentIds.includes(studentId) && (!subject.trim() || l.subject.toLowerCase().includes(subject.trim().toLowerCase())));
      const exact = candidates.filter(l => (!startTime || l.startTime >= startTime) && (!endTime || l.endTime <= endTime));
      const partial = candidates.some(l => startTime && endTime && l.startTime < endTime && l.endTime > startTime && !(l.startTime >= startTime && l.endTime <= endTime));
      const matched = exact.length === 1 ? exact[0] : null;
      const validation = matched ? 'Exact lecture/time candidate' : partial ? 'Needs clarification: partial time overlap' : candidates.length > 1 ? 'Needs clarification: multiple lecture matches' : 'Needs clarification: no exact match';
      const item = { id: `LTR-TEST-${Date.now()}`, studentId, studentName: student.name, date, startTime, endTime, subject, reference, uploadId, documentName, matchedSubject: matched?.subject || '', lectureId: matched?.id || '', validation, status: 'Pending' };
      localLetters.unshift(item);
      res.status(201).json({ message: `Letter queued. ${validation}.`, item });
    });
    app.post('/api/letters/:id/decision', (req, res) => {
      const item = localLetters.find(l => l.id === req.params.id);
      const { decision } = req.body || {};
      if (!item) return res.status(404).json({ error: 'Letter not found.' });
      if (decision === 'approve' && (!item.lectureId || item.validation !== 'Exact lecture/time candidate')) {
        return res.status(400).json({ error: 'This letter needs clarification before it can be approved.' });
      }
      item.status = decision === 'approve' ? 'Approved' : 'Rejected';
      res.json({ message: `Letter ${item.status.toLowerCase()}.` });
    });

    await new Promise(resolve => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise(resolve => server.close(resolve));
    }
    await terminateOcrWorker();
    await prisma.$disconnect();
  });

  test('rejects upload with no file', async () => {
    const res = await fetch(`${baseUrl}/api/letters/upload`, {
      method: 'POST',
      body: new FormData()
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes('select a document'));
  });

  test('rejects upload with invalid signature (fake PDF)', async () => {
    const fd = new FormData();
    const fakePdf = new Blob(['plain text pretending to be a pdf file'], { type: 'application/pdf' });
    fd.append('document', fakePdf, 'fake.pdf');

    const res = await fetch(`${baseUrl}/api/letters/upload`, {
      method: 'POST',
      body: fd
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes('Unsupported file format'));
  });

  test('accepts valid JPEG image and runs OCR successfully', async () => {
    const sampleJpg = path.join(process.cwd(), '..', 'docs', 'sample-letters', 'sample_maya_verma.jpg');
    if (!fs.existsSync(sampleJpg)) return;

    const fd = new FormData();
    const jpgBlob = new Blob([fs.readFileSync(sampleJpg)], { type: 'image/jpeg' });
    fd.append('document', jpgBlob, 'sample_maya_verma.jpg');

    const res = await fetch(`${baseUrl}/api/letters/upload`, {
      method: 'POST',
      body: fd
    });
    const body = await res.json();
    const online = await testDatabaseConnection();
    if (online) {
      assert.equal(res.status, 200);
      assert.equal(body.ok, true);
      assert.equal(body.fileType, 'image/jpeg');
      assert.equal(body.extraction.extracted.rawStudentName, 'Maya Verma');
      assert.equal(body.extraction.extracted.studentName, 'Maya Verma');
    } else {
      assert.equal(res.status, 503);
      assert.ok(body.error.includes('PostgreSQL is disconnected'));
    }
  });

  test('safeguard: ambiguous letter uploaded cannot be approved', async () => {
    const qRes = await fetch(`${baseUrl}/api/letters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: 'STU-001',
        date: '2026-10-14',
        startTime: '10:30', // partial overlap
        endTime: '11:30'
      })
    });
    const qBody = await qRes.json();
    assert.equal(qRes.status, 201);
    const letterId = qBody.item.id;

    // Attempt to approve
    const aRes = await fetch(`${baseUrl}/api/letters/${letterId}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'approve' })
    });
    assert.equal(aRes.status, 400);
    const aBody = await aRes.json();
    assert.equal(aBody.error, 'This letter needs clarification before it can be approved.');

    // Rejecting is allowed
    const rRes = await fetch(`${baseUrl}/api/letters/${letterId}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'reject' })
    });
    assert.equal(rRes.status, 200);
    const rBody = await rRes.json();
    assert.equal(rBody.message, 'Letter rejected.');
  });
});
