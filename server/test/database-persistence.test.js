import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import { prisma } from '../src/db.js';
import { LocalStorageProvider, S3StorageProvider } from '../src/storage/index.js';
import {
  createDocumentRecord,
  findDocumentById,
  queueAttendanceLetter,
  findLetterById,
  recordLetterDecision,
  saveAttendanceSubmission,
  getAttendanceByLecture,
  findStudentById,
  findLectureById,
  getDashboardData,
  logAuditEvent,
  resetFallbackStore
} from '../src/db.js';
import { handleDocumentDownload } from '../src/upload.js';

describe('Database Models & Architecture Verification', () => {
  test('Prisma client exposes all required persistent models', () => {
    assert.ok(prisma.student, 'Student model should be defined on Prisma client');
    assert.ok(prisma.lecture, 'Lecture model should be defined on Prisma client');
    assert.ok(prisma.attendanceRecord, 'AttendanceRecord model should be defined on Prisma client');
    assert.ok(prisma.document, 'Document model should be defined on Prisma client');
    assert.ok(prisma.attendanceLetter, 'AttendanceLetter model should be defined on Prisma client');
    assert.ok(prisma.auditEvent, 'AuditEvent model should be defined on Prisma client');
  });

  test('Database service exposes all required entity operations', () => {
    assert.equal(typeof getDashboardData, 'function');
    assert.equal(typeof findStudentById, 'function');
    assert.equal(typeof findLectureById, 'function');
    assert.equal(typeof getAttendanceByLecture, 'function');
    assert.equal(typeof saveAttendanceSubmission, 'function');
    assert.equal(typeof createDocumentRecord, 'function');
    assert.equal(typeof findDocumentById, 'function');
    assert.equal(typeof queueAttendanceLetter, 'function');
    assert.equal(typeof findLetterById, 'function');
    assert.equal(typeof recordLetterDecision, 'function');
    assert.equal(typeof logAuditEvent, 'function');
  });
});

describe('Document Storage Abstraction (Private Storage)', () => {
  const testDir = path.join(process.cwd(), 'storage', 'test_private_files');
  let storage;

  before(() => {
    storage = new LocalStorageProvider(testDir);
  });

  after(async () => {
    if (fs.existsSync(testDir)) {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    }
  });

  test('LocalStorageProvider saves and retrieves file bytes privately', async () => {
    const key = 'test/2026/test_document.pdf';
    const testBuffer = Buffer.from('%PDF-1.4\n%Test private document content');
    const mimeType = 'application/pdf';

    const putRes = await storage.putObject({ key, buffer: testBuffer, mimeType });
    assert.equal(putRes.key, key);
    assert.equal(putRes.provider, 'local');
    assert.equal(putRes.sizeBytes, testBuffer.length);

    // Verify file actually exists in private storage dir and not in a public directory
    const expectedPath = path.join(testDir, 'test', '2026', 'test_document.pdf');
    assert.ok(fs.existsSync(expectedPath), 'File should exist on disk in private storage');

    // Retrieve file
    const getRes = await storage.getObject({ key });
    assert.equal(getRes.buffer.toString(), testBuffer.toString());

    // Delete file
    await storage.deleteObject({ key });
    assert.equal(fs.existsSync(expectedPath), false, 'File should be removed after deletion');
  });

  test('S3StorageProvider reports correctly configured status based on environment', () => {
    const s3 = new S3StorageProvider();
    assert.equal(s3.getProviderName(), 's3');
    // In local development without AWS credentials, isConfigured should return false safely
    if (!process.env.AWS_S3_BUCKET || !process.env.AWS_ACCESS_KEY_ID) {
      assert.equal(s3.isConfigured(), false);
    }
  });
});

describe('Document Metadata Persistence & Controlled Download Endpoint', () => {
  let server;
  let baseUrl;

  before(async () => {
    const app = express();
    app.use(cors());
    app.use(express.json());
    app.get('/api/documents/:id/download', handleDocumentDownload);

    await new Promise(resolve => {
      server = app.listen(0, () => {
        baseUrl = `http://localhost:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
  });

  test('persists document metadata and allows controlled streaming download', async () => {
    const docId = `DOC-TEST-${Date.now()}`;
    const storageKey = `documents/2026/${docId}_sample.pdf`;
    const content = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Attendance Record) >>\nendobj');

    // Save to private local storage
    const storage = new LocalStorageProvider();
    await storage.putObject({ key: storageKey, buffer: content, mimeType: 'application/pdf' });

    // Save metadata record
    const created = await createDocumentRecord({
      id: docId,
      storageKey,
      storageProvider: 'local',
      originalFilename: 'sample.pdf',
      mimeType: 'application/pdf',
      sizeBytes: content.length,
      extractionStatus: 'success',
      rawExtractedJson: { studentName: 'Riya Shah', studentId: 'STU-001' },
      missingFields: [],
      notes: ['All fields extracted'],
      manualVerified: false
    });

    assert.equal(created.id, docId);
    assert.equal(created.storageKey, storageKey);

    // Retrieve metadata via database query
    const fetched = await findDocumentById(docId);
    assert.ok(fetched);
    assert.equal(fetched.originalFilename, 'sample.pdf');
    assert.equal(fetched.mimeType, 'application/pdf');
    assert.equal(fetched.sizeBytes, content.length);
    assert.equal(fetched.extractionStatus, 'success');

    // Download via secure controlled endpoint
    const res = await fetch(`${baseUrl}/api/documents/${docId}/download`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(res.headers.get('content-disposition').includes('sample.pdf'));

    const downloadedBytes = Buffer.from(await res.arrayBuffer());
    assert.equal(downloadedBytes.toString(), content.toString());

    // Cleanup storage file
    await storage.deleteObject({ key: storageKey });
  });

  test('download endpoint returns 404 for unknown document ID', async () => {
    const res = await fetch(`${baseUrl}/api/documents/NON-EXISTENT-DOC/download`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error, 'Document not found.');
  });
});

describe('Attendance Workflow & Safeguard Persistence', () => {
  before(() => {
    resetFallbackStore();
  });

  test('submitting lecture attendance persists records and creates audit event', async () => {
    const lecture = await findLectureById('LEC-101');
    assert.ok(lecture, 'Lecture LEC-101 must exist');

    const entries = [
      { studentId: 'STU-001', status: 'Present' },
      { studentId: 'STU-002', status: 'Absent' },
      { studentId: 'STU-003', status: 'Present' },
      { studentId: 'STU-004', status: 'Absent' }
    ];

    const result = await saveAttendanceSubmission({
      lecture,
      entries,
      actor: 'Prof. Sharma'
    });

    assert.equal(result.count, 4);

    const lectureAttendance = await getAttendanceByLecture('LEC-101');
    assert.equal(lectureAttendance.length, 4);

    const stu1 = lectureAttendance.find(a => a.studentId === 'STU-001');
    assert.equal(stu1.status, 'Present');
    assert.equal(stu1.submitted, true);

    const stu2 = lectureAttendance.find(a => a.studentId === 'STU-002');
    assert.equal(stu2.status, 'Absent');
  });

  test('queues attendance letter preserving raw unmapped extraction fields', async () => {
    const letter = await queueAttendanceLetter({
      studentId: 'STU-001',
      studentName: 'Riya Shah',
      rawStudentName: 'Riya S. Shah',
      rawStudentId: 'STU-001',
      date: '2026-10-14',
      startTime: '10:00',
      endTime: '11:00',
      subject: 'Database Systems',
      reference: 'EVT-2026-PERSIST-1',
      uploadId: 'DOC-PERSIST-1',
      documentName: 'excuse_letter.pdf',
      matchedSubject: 'Database Systems',
      lectureId: 'LEC-101',
      validation: 'Exact lecture/time candidate'
    }, 'Attendance Coordinator');

    assert.ok(letter.id.startsWith('LTR-'));
    assert.equal(letter.rawStudentName, 'Riya S. Shah');
    assert.equal(letter.status, 'Pending');
    assert.equal(letter.validation, 'Exact lecture/time candidate');

    const retrieved = await findLetterById(letter.id);
    assert.ok(retrieved);
    assert.equal(retrieved.studentName, 'Riya Shah');
    assert.equal(retrieved.rawStudentName, 'Riya S. Shah');
  });

  test('safeguard: ambiguous letter cannot be approved', async () => {
    const ambiguousLetter = await queueAttendanceLetter({
      studentId: 'STU-002',
      studentName: 'Arjun Mehta',
      rawStudentName: 'Arjun Mehta',
      rawStudentId: 'STU-002',
      date: '2026-10-14',
      startTime: '10:30', // Partial overlap
      endTime: '11:30',
      subject: 'Database Systems',
      validation: 'Needs clarification: partial time overlap',
      lectureId: 'LEC-101'
    }, 'Attendance Coordinator');

    await assert.rejects(
      async () => {
        await recordLetterDecision({
          letterId: ambiguousLetter.id,
          decision: 'approve',
          actor: 'Attendance Coordinator'
        });
      },
      (err) => {
        assert.equal(err.message, 'This letter needs clarification before it can be approved.');
        assert.equal(err.status, 400);
        return true;
      }
    );

    // Letter must remain Pending
    const unapproved = await findLetterById(ambiguousLetter.id);
    assert.equal(unapproved.status, 'Pending');
  });

  test('approving exact match updates attendance to Present and records audit trail', async () => {
    // STU-002 was marked Absent in earlier test
    const exactLetter = await queueAttendanceLetter({
      studentId: 'STU-002',
      studentName: 'Arjun Mehta',
      rawStudentName: 'Arjun Mehta',
      rawStudentId: 'STU-002',
      date: '2026-10-14',
      startTime: '10:00',
      endTime: '11:00',
      subject: 'Database Systems',
      reference: 'CERT-2026-APPROVED',
      lectureId: 'LEC-101',
      matchedSubject: 'Database Systems',
      validation: 'Exact lecture/time candidate'
    }, 'Attendance Coordinator');

    const approved = await recordLetterDecision({
      letterId: exactLetter.id,
      decision: 'approve',
      actor: 'Coordinator Verma'
    });

    assert.equal(approved.status, 'Approved');
    assert.equal(approved.reviewedBy, 'Coordinator Verma');

    // Verify STU-002 attendance was updated from Absent to Present
    const lectureAttendance = await getAttendanceByLecture('LEC-101');
    const stu2 = lectureAttendance.find(a => a.studentId === 'STU-002');
    assert.equal(stu2.status, 'Present');
    assert.equal(stu2.correctedBy, 'Coordinator Verma');
    assert.equal(stu2.correctionReference, 'CERT-2026-APPROVED');

    // Dashboard includes updated audit logs and status
    const dashboard = await getDashboardData();
    assert.ok(dashboard.logs.some(l => l.action === 'Attendance corrected' && l.details.includes('Coordinator Verma')));
  });

  test('rejecting letter marks status as Rejected without modifying attendance', async () => {
    // STU-004 was marked Absent
    const rejectLetter = await queueAttendanceLetter({
      studentId: 'STU-004',
      studentName: 'Dev Patel',
      date: '2026-10-14',
      validation: 'Needs clarification: no exact match',
      lectureId: ''
    }, 'Attendance Coordinator');

    const rejected = await recordLetterDecision({
      letterId: rejectLetter.id,
      decision: 'reject',
      actor: 'Coordinator Verma'
    });

    assert.equal(rejected.status, 'Rejected');

    // STU-004 attendance remains Absent
    const lectureAttendance = await getAttendanceByLecture('LEC-101');
    const stu4 = lectureAttendance.find(a => a.studentId === 'STU-004');
    assert.equal(stu4.status, 'Absent');
  });

  after(async () => {
    await prisma.$disconnect();
  });
});
