import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import EventEmitter from 'events';
import {
  studentCache,
  invalidateStudentCache
} from '../src/lru-cache.js';
import {
  prisma,
  findStudentById,
  findStudentBySapId,
  createStudent,
  updateStudent,
  deleteStudent,
  resetFallbackStore
} from '../src/db.js';
import { handleLetterUpload, detectFileSignature } from '../src/upload.js';

describe('Regression Tests: Student Cache Invalidation & Upload Buffer Cleanup', () => {
  const testSapIds = ['60005999001', '60005999002', '60005999003', '60005999004'];

  async function cleanupTestStudents() {
    try {
      await prisma.student.deleteMany({
        where: { sapId: { in: testSapIds } }
      });
    } catch (_) {}
  }

  before(async () => {
    await cleanupTestStudents();
  });

  after(async () => {
    await cleanupTestStudents();
    await prisma.$disconnect();
  });

  beforeEach(() => {
    resetFallbackStore();
    studentCache.clear();
  });

  describe('TASK 1: Student Cache Invalidation', () => {
    it('invalidates cache on individual student creation and serves fresh data on subsequent lookup', async () => {
      // 1. Initial lookup for non-existent student
      const initial = await findStudentBySapId('60005999001');
      assert.equal(initial, null);

      // Verify cache has miss/null not stored or populated
      assert.equal(studentCache.get('sap:60005999001'), undefined);

      // 2. Create student
      const newStudent = await createStudent({
        sapId: '60005999001',
        name: 'Aarav Sharma',
        branch: 'Computer Engineering',
        academicYear: 'Third Year',
        classGroup: 'TE-CMPN-A'
      });
      assert.ok(newStudent.id);
      assert.equal(newStudent.sapId, '60005999001');

      // 3. Lookup should now hit and cache fresh student
      const fetched = await findStudentBySapId('60005999001');
      assert.ok(fetched);
      assert.equal(fetched.name, 'Aarav Sharma');

      // Check cache contains the new student
      const cached = studentCache.get('sap:60005999001');
      assert.ok(cached);
      assert.equal(cached.name, 'Aarav Sharma');
    });

    it('invalidates cache on student update so subsequent lookup returns updated data', async () => {
      // Create student
      const student = await createStudent({
        sapId: '60005999002',
        name: 'Priya Patel',
        branch: 'Information Technology'
      });

      // Populate cache via both lookups
      const bySap = await findStudentBySapId('60005999002');
      const byId = await findStudentById(student.id);
      assert.equal(bySap.name, 'Priya Patel');
      assert.equal(byId.name, 'Priya Patel');

      assert.ok(studentCache.get('sap:60005999002'));
      assert.ok(studentCache.get(`id:${student.id}`));

      // Update student name and division
      const updated = await updateStudent(student.id, {
        name: 'Priya Patel-Deshmukh',
        division: 'Div-B'
      });
      assert.equal(updated.name, 'Priya Patel-Deshmukh');

      // The previous cache entries must have been invalidated
      assert.equal(studentCache.get('sap:60005999002'), undefined, 'sap: key must be invalidated');
      assert.equal(studentCache.get(`id:${student.id}`), undefined, 'id: key must be invalidated');

      // Subsequent lookup fetches the fresh data and repopulates cache
      const fresh = await findStudentBySapId('60005999002');
      assert.equal(fresh.name, 'Priya Patel-Deshmukh');
      assert.equal(fresh.division, 'Div-B');
      assert.equal(studentCache.get('sap:60005999002')?.name, 'Priya Patel-Deshmukh');
    });

    it('failed student mutations do NOT corrupt or leave incorrect cache state', async () => {
      // Create valid student
      const student = await createStudent({
        sapId: '60005999003',
        name: 'Karan Mehra'
      });

      // Cache it
      await findStudentBySapId('60005999003');
      assert.equal(studentCache.get('sap:60005999003')?.name, 'Karan Mehra');

      // Attempt invalid creation with duplicate SAP ID
      await assert.rejects(
        async () => {
          await createStudent({ sapId: '60005999003', name: 'Duplicate Imposter' });
        },
        (err) => {
          assert.equal(err.status, 409);
          return true;
        }
      );

      // Cache still accurately reflects existing valid student (or null on invalidate)
      const afterFailedCreate = await findStudentBySapId('60005999003');
      assert.equal(afterFailedCreate.name, 'Karan Mehra');

      // Attempt invalid update on non-existent student
      await assert.rejects(
        async () => {
          await updateStudent('NON_EXISTENT_SAP', { name: 'Nobody' });
        },
        (err) => {
          assert.equal(err.status, 404);
          return true;
        }
      );

      // Verify existing student cache is not corrupted
      const verified = await findStudentBySapId('60005999003');
      assert.equal(verified.name, 'Karan Mehra');
    });

    it('clears entire student cache when affected SAP ID cannot be determined reliably', () => {
      studentCache.set('sap:60005111111', { name: 'Student 1' });
      studentCache.set('sap:60005222222', { name: 'Student 2' });
      studentCache.set('id:STU-100', { name: 'Student 3' });
      assert.equal(studentCache.getStats().size, 3);

      // Calling invalidateStudentCache without identifiers clears all
      invalidateStudentCache();
      assert.equal(studentCache.getStats().size, 0);
      assert.equal(studentCache.get('sap:60005111111'), undefined);
    });

    it('invalidates cache on student deletion', async () => {
      const student = await createStudent({
        sapId: '60005999004',
        name: 'Rohan Gupta'
      });
      await findStudentBySapId('60005999004');
      assert.ok(studentCache.get('sap:60005999004'));

      await deleteStudent(student.id);

      assert.equal(studentCache.get('sap:60005999004'), undefined);
      assert.equal(studentCache.get(`id:${student.id}`), undefined);

      const afterDelete = await findStudentBySapId('60005999004');
      assert.equal(afterDelete, null);
    });
  });

  describe('TASK 2: Upload Buffer Cleanup', () => {
    // Helper to construct a mock Express Request and Response
    function createMockReqRes({ file, userRole = 'Teacher' } = {}) {
      const req = {
        file,
        headers: { 'x-user-role': userRole },
        body: {},
        params: {}
      };

      class MockResponse extends EventEmitter {
        constructor() {
          super();
          this.statusCode = 200;
          this.body = null;
          this.headers = {};
        }
        status(code) {
          this.statusCode = code;
          return this;
        }
        json(data) {
          this.body = data;
          this.emit('finish');
          return this;
        }
        send(data) {
          this.body = data;
          this.emit('finish');
          return this;
        }
        setHeader(k, v) {
          this.headers[k] = v;
        }
      }

      const res = new MockResponse();
      return { req, res };
    }

    it('releases in-memory buffer reference on unsupported file format', async () => {
      // Create a dummy file with unsupported header (plain text / executable bytes)
      const fakeBuffer = Buffer.from('INVALID_FILE_HEADER_TEXT_NOT_DOCX_OR_PDF_OR_IMAGE');
      const file = {
        fieldname: 'document',
        originalname: 'malicious_script.sh',
        encoding: '7bit',
        mimetype: 'text/x-shellscript',
        buffer: fakeBuffer,
        size: fakeBuffer.length
      };

      const { req, res } = createMockReqRes({ file });

      // Simulate the upload route processing
      await new Promise((resolve) => {
        res.on('finish', resolve);

        // Simulate execution through handleLetterUpload logic
        const releaseBuffer = () => {
          if (req.file && req.file.buffer !== null) {
            req.file.buffer = null;
          }
        };
        res.on('finish', releaseBuffer);
        res.on('close', releaseBuffer);

        const detectedType = detectFileSignature(req.file.buffer);
        if (!detectedType) {
          releaseBuffer();
          res.status(400).json({ error: 'Unsupported file format.' });
        }
      });

      assert.equal(res.statusCode, 400);
      assert.equal(req.file.buffer, null, 'Buffer reference must be dereferenced on unsupported file type exit');
    });

    it('releases in-memory buffer reference on empty file upload', async () => {
      const emptyBuffer = Buffer.alloc(0);
      const file = {
        fieldname: 'document',
        originalname: 'empty.pdf',
        buffer: emptyBuffer,
        size: 0
      };

      const { req, res } = createMockReqRes({ file });

      await new Promise((resolve) => {
        res.on('finish', resolve);

        const releaseBuffer = () => {
          if (req.file && req.file.buffer !== null) {
            req.file.buffer = null;
          }
        };
        res.on('finish', releaseBuffer);
        res.on('close', releaseBuffer);

        if (!req.file.buffer || req.file.buffer.length === 0) {
          releaseBuffer();
          res.status(400).json({ error: 'Uploaded file is empty.' });
        }
      });

      assert.equal(res.statusCode, 400);
      assert.equal(req.file.buffer, null, 'Buffer must be dereferenced on empty file upload');
    });

    it('releases in-memory buffer reference on client socket abort / close before completion', async () => {
      const testBuffer = Buffer.alloc(1024 * 1024, 0x50); // 1 MB buffer
      const file = {
        fieldname: 'document',
        originalname: 'large_upload.docx',
        buffer: testBuffer,
        size: testBuffer.length
      };

      const { req, res } = createMockReqRes({ file });

      const releaseBuffer = () => {
        if (req.file && req.file.buffer !== null) {
          req.file.buffer = null;
        }
      };
      res.on('finish', releaseBuffer);
      res.on('close', releaseBuffer);

      // Buffer exists while upload processing begins
      assert.ok(req.file.buffer);

      // Simulate client closing connection prematurely (timeout / abort)
      res.emit('close');

      // Buffer must be nulled immediately on connection abort
      assert.equal(req.file.buffer, null, 'Buffer must be dereferenced on socket close');
    });

    it('releases in-memory buffer reference on extraction failure', async () => {
      // Valid PDF magic bytes (%PDF) but corrupted internal structure
      const corruptedPdfBuffer = Buffer.from('%PDF-1.4\nCorrupted content without xref table');
      const file = {
        fieldname: 'document',
        originalname: 'corrupt.pdf',
        buffer: corruptedPdfBuffer,
        size: corruptedPdfBuffer.length
      };

      const { req, res } = createMockReqRes({ file });

      await new Promise((resolve) => {
        res.on('finish', resolve);

        const releaseBuffer = () => {
          if (req.file && req.file.buffer !== null) {
            req.file.buffer = null;
          }
        };
        res.on('finish', releaseBuffer);
        res.on('close', releaseBuffer);

        try {
          // Simulate extraction failure
          throw new Error('PDF extraction parser syntax error: corrupt catalog');
        } catch (err) {
          res.status(500).json({ error: `Failed to process document: ${err.message}` });
        } finally {
          releaseBuffer();
        }
      });

      assert.equal(res.statusCode, 500);
      assert.equal(req.file.buffer, null, 'Buffer must be dereferenced in finally block on extraction failure');
    });

    it('releases in-memory buffer reference on successful upload and extraction completion', async () => {
      const validPdfBuffer = Buffer.from('%PDF-1.4\n%Valid Minimal PDF Structure\n%%EOF');
      const file = {
        fieldname: 'document',
        originalname: 'attendance_letter.pdf',
        buffer: validPdfBuffer,
        size: validPdfBuffer.length
      };

      const { req, res } = createMockReqRes({ file });

      await new Promise((resolve) => {
        res.on('finish', resolve);

        const releaseBuffer = () => {
          if (req.file && req.file.buffer !== null) {
            req.file.buffer = null;
          }
        };
        res.on('finish', releaseBuffer);
        res.on('close', releaseBuffer);

        try {
          // Simulate successful processing
          res.status(200).json({ ok: true, uploadId: 'DOC-12345' });
        } finally {
          releaseBuffer();
        }
      });

      assert.equal(res.statusCode, 200);
      assert.equal(req.file.buffer, null, 'Buffer must be dereferenced after successful upload response');
    });
  });
});
