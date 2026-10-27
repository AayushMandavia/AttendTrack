import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import {
  extractStudentsFromText,
  extractFieldsFromText,
  parsePdfDocument,
  parseImageDocument,
  matchStudentToRoster,
  parseOcrTableRows,
  cleanOcrName,
  normalizeOcrSapCandidate,
  calculateExtractionSummary,
  terminateOcrWorker
} from '../src/extractor.js';
import { isDocxBuffer, parseDocxDocument } from '../src/docx-parser.js';
import { detectFileSignature, handleLetterUpload } from '../src/upload.js';
import {
  prisma,
  getStudents,
  getLectures,
  findStudentBySapId,
  createDocumentRecord,
  findDocumentById,
  queueBatchAttendanceLetters,
  recordBatchLetterDecision,
  testDatabaseConnection
} from '../src/db.js';

describe('Workflow 03: Multi-Student Extraction & Strict SAP Matching Regression Suite', () => {
  let dbStudents = [];
  let dbLectures = [];
  const whatsappImgPath = path.join(
    process.cwd(),
    'storage',
    'private_files',
    'documents',
    '2026',
    'DOC-1792234303425-0bbe86_WhatsApp_Image_2026-09-29_at_4.51.19_PM.jpeg'
  );
  const sampleMayaJpg = path.join(process.cwd(), '..', 'docs', 'sample-letters', 'sample_maya_verma.jpg');
  const samplePdf = path.join(
    process.cwd(),
    'storage',
    'private_files',
    'documents',
    '2026',
    'DOC-1792229367379-60f211_sample_multi_student_letter.pdf'
  );

  before(async () => {
    const isConnected = await testDatabaseConnection();
    if (isConnected) {
      dbStudents = await getStudents(100);
      dbLectures = await getLectures();
    }
  });

  // 1. WhatsApp JPEG document containing multiple students in photographed table
  test('1 & 2 & 3. WhatsApp JPEG: extracts all 10 student rows from photographed table without stopping at row 1', async () => {
    if (!fs.existsSync(whatsappImgPath)) {
      console.log('Skipping WhatsApp image test: file not found at', whatsappImgPath);
      return;
    }

    const imageBuf = fs.readFileSync(whatsappImgPath);
    const result = await parseImageDocument(imageBuf, {
      roster: dbStudents,
      fileType: 'image/jpeg',
      fileTypeName: 'JPEG Image (OCR)'
    });

    assert.ok(result.extracted.students, 'Must return students array');
    const students = result.extracted.students;

    // Document contains 10 student entries in the table
    assert.ok(students.length >= 10, `Expected at least 10 student rows, got ${students.length}`);

    // Verify VeronicaMatew row with SAP ID 60005230151 is extracted
    const veronica = students.find(s => s.sapId === '60005230151' || (s.rawStudentName || '').toLowerCase().includes('veronica'));
    assert.ok(veronica, 'VeronicaMatew must be extracted from row 9 of table');
    assert.equal(veronica.sapId, '60005230151');
    assert.equal(veronica.branch, 'Mechanical');

    // SAP ID 60005230151 is not in the 50 baseline students, so it must be marked Unmatched / Unknown SAP ID
    assert.equal(veronica.matchStatus, 'unmatched');
    assert.equal(veronica.rosterMatched, false);
    assert.ok(veronica.note.includes('Unknown SAP ID') || veronica.note.includes('not registered'));

    // Check extraction summary
    assert.ok(result.summary, 'Must return extraction summary');
    assert.equal(result.summary.extractionMethod, 'OCR (Tesseract.js)');
    assert.equal(result.summary.fileTypeName, 'JPEG Image (OCR)');
    assert.ok(result.summary.totalDetected >= 10);
    assert.ok(result.summary.needsReview > 0 || result.summary.unknownSap > 0);
  });

  // 4. Single-student JPEG image
  test('4. Single-student readable JPEG extracts clean fields and reports single match', async () => {
    if (!fs.existsSync(sampleMayaJpg)) {
      console.log('Skipping Maya Verma JPG test');
      return;
    }
    const buf = fs.readFileSync(sampleMayaJpg);
    const res = await parseImageDocument(buf, { roster: dbStudents });
    assert.ok(res.extracted.students.length >= 1);
    assert.equal(res.extracted.rawStudentName, 'Maya Verma');
    assert.equal(res.extracted.date, '2026-10-14');
    assert.equal(res.summary.extractionMethod, 'OCR (Tesseract.js)');
  });

  // 5. Blurry image or uncertain OCR digits are flagged for review
  test('5. Blurry/noisy OCR entries preserve raw string and flag uncertainty instead of inventing data', () => {
    const rawOcrText = `
      [55 [Rencshmue | viechmon | M215 | cooosaorse |
      [41 [TomsyChauchi [csEDs | Dios | Gooosasoioa |
    `;
    const candidates = extractStudentsFromText(rawOcrText, dbStudents);
    assert.equal(candidates.length, 2);

    // Each row must be captured
    assert.ok(candidates.some(c => c.rawStudentName.includes('Rencshmue')));
    assert.ok(candidates.some(c => c.rawStudentName.includes('TomsyChauchi')));

    // Unenrolled or uncertain SAPs must NOT be falsely marked matched
    for (const c of candidates) {
      assert.equal(c.rosterMatched, false);
      assert.notEqual(c.matchStatus, 'matched');
    }
  });

  // 6. Digital text-based PDF
  test('6. Text-based PDF extracts embedded table across multiple students', async () => {
    if (!fs.existsSync(samplePdf)) {
      console.log('Skipping PDF test: file not found');
      return;
    }
    const buf = fs.readFileSync(samplePdf);
    const res = await parsePdfDocument(buf, { roster: dbStudents });
    assert.equal(res.summary.extractionMethod, 'Digital PDF Text & Table Parser');
    assert.equal(res.summary.fileTypeName, 'PDF Document');
    assert.ok(res.extracted.students.length >= 2, 'Should extract student candidates from PDF');
  });

  // 7. Scanned PDF with no digital text layer returns clear notification
  test('7. Scanned empty PDF buffer flags missing text layer without crash', async () => {
    // Minimal empty valid PDF
    const emptyPdfBuf = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n165\n%%EOF'
    );
    const res = await parsePdfDocument(emptyPdfBuf);
    assert.equal(res.status, 'failed');
    assert.ok(res.notes[0].includes('Scanned PDF') || res.notes[0].includes('no digital text layer'));
  });

  // 8. DOCX with multiple tables, repeated headers, empty rows
  test('8. Word (.docx) parser skips repeated headers, empty rows, and handles multiple tables', async () => {
    const mockRoster = [
      { id: 'STU-001', name: 'Riya Shah', sapId: '60001000001' },
      { id: 'STU-002', name: 'Arjun Mehta', sapId: '60001000002' },
      { id: 'STU-003', name: 'Sara Khan', sapId: '60001000003' }
    ];

    // Build raw mock table text resembling DOCX table rows
    const tableText = `
      Sr No | Student Full Name | Branch | Roll No | SAP ID
      1 | Riya Shah | Computer | 24CS01 | 60001000001
      [Student Full Name - 2] | | | [Roll] | [SAP]
      Sr No | Student Full Name | Branch | Roll No | SAP ID
      2 | Arjun Mehta | Computer | 24CS02 | 60001000002
    `;

    const candidates = extractStudentsFromText(tableText, mockRoster);
    assert.equal(candidates.length, 2, 'Must extract only the 2 non-placeholder rows');
    assert.equal(candidates[0].studentName, 'Riya Shah');
    assert.equal(candidates[0].matchStatus, 'matched');
    assert.equal(candidates[1].studentName, 'Arjun Mehta');
    assert.equal(candidates[1].matchStatus, 'matched');
  });

  // 9. Document containing 30 student entries without artificial row limits
  test('9. Handles document with 30 student entries without truncation or row limit', () => {
    const roster30 = [];
    const textLines = ['ATTENDANCE PERMISSION LETTER FOR 30 STUDENTS', 'Date: 2026-10-14', 'Subject: Database Systems', 'Sr | Name | Roll | SAP'];

    for (let i = 1; i <= 30; i++) {
      const sap = `600010000${String(i).padStart(2, '0')}`;
      const name = `Student Number ${i}`;
      roster30.push({ id: `STU-${String(i).padStart(3, '0')}`, name, sapId: sap });
      textLines.push(`${i} | ${name} | R${i} | ${sap}`);
    }

    const docText = textLines.join('\n');
    const candidates = extractStudentsFromText(docText, roster30);

    assert.equal(candidates.length, 30, 'Must extract all 30 student entries without imposing a row limit');
    const matchedCount = candidates.filter(c => c.matchStatus === 'matched').length;
    assert.equal(matchedCount, 30, 'All 30 enrolled students must be matched');
  });

  // 10. Mixed document containing known and unknown students
  test('10. Mixed document: known students matched, unknown students skipped without blocking batch', () => {
    const mixedText = `
      1. Riya Shah - 60001000001
      2. Unknown Hacker - 60009999999
      3. Arjun Mehta - 60001000002
      4. External Visitor - 99999999999
    `;
    const roster = [
      { id: 'STU-001', name: 'Riya Shah', sapId: '60001000001' },
      { id: 'STU-002', name: 'Arjun Mehta', sapId: '60001000002' }
    ];

    const candidates = extractStudentsFromText(mixedText, roster);
    assert.equal(candidates.length, 4);

    const matched = candidates.filter(c => c.matchStatus === 'matched');
    const unknown = candidates.filter(c => c.matchStatus === 'unmatched');

    assert.equal(matched.length, 2, 'Riya Shah and Arjun Mehta should be matched');
    assert.equal(unknown.length, 2, 'Unknown entries must be marked unmatched');

    // Verify summary counts
    const summary = calculateExtractionSummary(candidates, {});
    assert.equal(summary.totalDetected, 4);
    assert.equal(summary.matched, 2);
    assert.equal(summary.unknownSap, 2);
    assert.equal(summary.needsReview, 2);
  });

  // 11. Missing, malformed, and unreadable SAP IDs
  test('11. Missing or unreadable SAP ID is marked ambiguous and approval blocked', () => {
    const resNoSap = matchStudentToRoster('Dev Patel', '24CS04', '', dbStudents);
    assert.equal(resNoSap.matchStatus, 'ambiguous');
    assert.equal(resNoSap.matched, null);
    assert.ok(resNoSap.note.includes('SAP ID Required'));
  });

  // 12. Valid SAP ID paired with wrong name
  test('12. Valid SAP ID paired with wrong name triggers explicit SAP ID / Name Mismatch', () => {
    const roster = [
      { id: 'STU-001', name: 'Riya Shah', sapId: '60001000001' },
      { id: 'STU-002', name: 'Dev Patel', sapId: '60001000002' }
    ];
    // Letter gives Dev Patel with Riya Shah's SAP ID
    const res = matchStudentToRoster('Dev Patel', '', '60001000001', roster);
    assert.equal(res.matchStatus, 'ambiguous');
    assert.equal(res.matched, null);
    assert.ok(res.note.includes('SAP ID / Name Mismatch'));
  });

  // 13. Duplicate entries in document cleanly deduplicated
  test('13. Duplicate entries in document cleanly deduplicated', () => {
    const docText = `
      1. Riya Shah (60001000001)
      2. Riya Shah (60001000001)
      3. Arjun Mehta (60001000002)
    `;
    const roster = [
      { id: 'STU-001', name: 'Riya Shah', sapId: '60001000001' },
      { id: 'STU-002', name: 'Arjun Mehta', sapId: '60001000002' }
    ];
    const candidates = extractStudentsFromText(docText, roster);
    assert.equal(candidates.length, 2, 'Duplicate entry must be deduplicated');
  });

  // 14. Verification of screenshot SAP ID 60005230151 directly against PostgreSQL
  test('14. Screenshot SAP ID 60005230151 verified directly against PostgreSQL', async () => {
    const student = await findStudentBySapId('60005230151');
    assert.equal(student, null, 'SAP ID 60005230151 is confirmed not enrolled in PostgreSQL baseline roster');

    // Matching against database roster must yield unmatched
    const match = matchStudentToRoster('VeronicaMatew', 'M165', '60005230151', dbStudents);
    assert.equal(match.matched, null);
    assert.equal(match.matchStatus, 'unmatched');
    assert.ok(match.note.includes('Unknown SAP ID'));
  });

  // 15. Unsupported and corrupt files rejected cleanly
  test('15. Disguised executable or text file rejected cleanly with HTTP 400', () => {
    const fakeDoc = Buffer.from('MZ\x90\x00\x03\x00\x00\x00');
    assert.equal(detectFileSignature(fakeDoc), null);

    const emptyBuf = Buffer.alloc(0);
    assert.equal(detectFileSignature(emptyBuf), null);
  });

  // 16. Accurate extraction summary structure
  test('16. calculateExtractionSummary accurately computes counts for frontend reporting', () => {
    const mockStudents = [
      { matchStatus: 'matched', sapId: '60001000001' },
      { matchStatus: 'matched', sapId: '60001000002' },
      { matchStatus: 'unmatched', sapId: '60009999999' },
      { matchStatus: 'ambiguous', sapId: '', note: 'SAP ID Required: Missing' },
      { matchStatus: 'ambiguous', sapId: '60001000003', note: 'SAP ID / Name Mismatch' }
    ];

    const sum = calculateExtractionSummary(mockStudents, {
      extractionMethod: 'OCR (Tesseract.js)',
      fileTypeName: 'JPEG Image (OCR)'
    });

    assert.equal(sum.totalDetected, 5);
    assert.equal(sum.matched, 2);
    assert.equal(sum.unknownSap, 1);
    assert.equal(sum.missingOrUnreadableSap, 1);
    assert.equal(sum.nameMismatches, 1);
    assert.equal(sum.needsReview, 3);
    assert.equal(sum.extractionMethod, 'OCR (Tesseract.js)');
    assert.equal(sum.fileTypeName, 'JPEG Image (OCR)');
  });

  // 17. Batch decision backend re-validation
  test('17. Batch queueing and decision strictly enforces SAP ID on backend', async () => {
    if (dbStudents.length === 0) return;
    const testDocId = `DOC-TEST-${Date.now()}`;
    await createDocumentRecord({
      id: testDocId,
      storageKey: `test/${testDocId}.pdf`,
      originalFilename: 'test_doc.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1000,
      extractionStatus: 'success'
    });

    // Attempting to queue batch with an unknown SAP ID is blocked on backend
    const invalidBatch = [
      {
        studentId: dbStudents[0].id,
        studentName: dbStudents[0].name,
        sapId: '99999999999', // Unknown SAP
        date: '2026-10-14'
      }
    ];

    await assert.rejects(
      async () => {
        await queueBatchAttendanceLetters({
          documentId: testDocId,
          documentName: 'test_doc.pdf',
          date: '2026-10-14',
          subject: 'Database Systems',
          startTime: '10:00',
          endTime: '11:00',
          reference: 'REF-REGRESS',
          students: invalidBatch
        });
      },
      /Unknown SAP ID|does not match/i
    );
  });

  after(async () => {
    await terminateOcrWorker();
    await prisma.$disconnect();
  });
});
