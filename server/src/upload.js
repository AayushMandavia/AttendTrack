import multer from 'multer';
import path from 'path';
import { parsePdfDocument, parseImageDocument } from './extractor.js';
import { isDocxBuffer, parseDocxDocument } from './docx-parser.js';
import { storage } from './storage/index.js';
import { createDocumentRecord, findDocumentById, getStudents, getLectures } from './db.js';

export const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_BYTES, 10) || 10 * 1024 * 1024; // 10MB default

// Memory storage so we can validate magic bytes and size safely before writing
const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1
  }
}).single('document');

/**
 * Validates real file magic bytes and format signatures
 */
export function detectFileSignature(buffer) {
  if (!buffer || buffer.length < 4) return null;

  // PDF signature: %PDF (0x25 0x50 0x44 0x46)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return 'application/pdf';
  }

  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (buffer.length >= 8 &&
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
      buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A) {
    return 'image/png';
  }

  // JPEG signature: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }

  // DOCX signature: PK\x03\x04 (0x50 0x4B 0x03 0x04) and contains word/document.xml
  if (isDocxBuffer(buffer)) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  return null;
}

/**
 * Upload route handler - saves file to private storage provider and records metadata in database
 */
export function handleLetterUpload(req, res) {
  uploadMiddleware(req, res, async (err) => {
    // Safe buffer dereferencer to allow V8 GC to reclaim memory
    const releaseBuffer = () => {
      if (req.file && req.file.buffer !== null) {
        req.file.buffer = null;
      }
    };

    // Attach listeners so buffer reference is released on response completion or socket abort/timeout
    res.on('finish', releaseBuffer);
    res.on('close', releaseBuffer);

    if (err) {
      releaseBuffer();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: `File is too large. Maximum allowed size is ${Math.round(MAX_FILE_SIZE / (1024 * 1024))} MB.` });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Please select a document to upload.' });
    }

    const { buffer, originalname } = req.file;

    if (!buffer || buffer.length === 0) {
      releaseBuffer();
      return res.status(400).json({ error: 'Uploaded file is empty.' });
    }

    const detectedType = detectFileSignature(buffer);
    if (!detectedType) {
      releaseBuffer();
      return res.status(400).json({
        error: 'Unsupported file format. Please upload a genuine Word (.docx), PDF, JPG, JPEG, or PNG document.'
      });
    }

    const ext = detectedType === 'application/pdf' ? '.pdf' :
                detectedType === 'image/png' ? '.png' :
                detectedType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ? '.docx' : '.jpg';
    const uploadId = `DOC-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const safeOriginalName = path.basename(originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `documents/${new Date().getFullYear()}/${uploadId}_${safeOriginalName}`;

    try {
      // 1. Save file to configured private storage provider (S3 or local private storage)
      const storageResult = await storage.putObject({
        key: storageKey,
        buffer,
        mimeType: detectedType
      });

      // 2. Perform OCR / text extraction with dynamic database roster (bounded for memory safety)
      const [roster, lectureList] = await Promise.all([getStudents(500), getLectures()]);

      const fileTypeName =
        detectedType === 'application/pdf' ? 'PDF Document' :
        detectedType === 'image/png' ? 'PNG Image (OCR)' :
        detectedType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ? 'Word Document (.docx)' :
        'JPEG Image (OCR)';

      const parseOptions = { roster, lectureList, fileType: detectedType, fileTypeName };
      let extraction;
      if (detectedType === 'application/pdf') {
        extraction = await parsePdfDocument(buffer, parseOptions);
      } else if (detectedType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        extraction = await parseDocxDocument(buffer, parseOptions);
      } else if (detectedType === 'image/png' || detectedType === 'image/jpeg') {
        extraction = await parseImageDocument(buffer, parseOptions);
      } else {
        extraction = {
          extracted: {},
          missingFields: ['studentId', 'studentName', 'date', 'subject', 'startTime', 'endTime', 'reference'],
          status: 'failed',
          notes: ['Unsupported file format for automated extraction. Please fill fields manually.'],
          summary: {
            totalDetected: 0,
            matched: 0,
            unknownSap: 0,
            missingOrUnreadableSap: 0,
            nameMismatches: 0,
            duplicates: 0,
            needsReview: 0,
            extractionMethod: 'Unsupported',
            fileType: detectedType,
            fileTypeName,
            pagesProcessed: 0
          }
        };
      }

      // 3. Persist document metadata in PostgreSQL
      const documentRecord = await createDocumentRecord({
        id: uploadId,
        storageKey,
        storageProvider: storageResult.provider,
        originalFilename: safeOriginalName,
        mimeType: detectedType,
        sizeBytes: buffer.length,
        extractionStatus: extraction?.status || 'pending',
        rawExtractedJson: extraction?.extracted || {},
        missingFields: extraction?.missingFields || [],
        notes: extraction?.notes || [],
        manualVerified: false
      });

      return res.status(200).json({
        ok: true,
        uploadId: documentRecord.id,
        storageKey: documentRecord.storageKey,
        storageProvider: documentRecord.storageProvider,
        originalName: safeOriginalName,
        fileType: detectedType,
        fileTypeName,
        extractionMethod: extraction?.summary?.extractionMethod || (detectedType.startsWith('image/') ? 'OCR (Tesseract.js)' : detectedType === 'application/pdf' ? 'Digital PDF Text & Table Parser' : 'Word Document Table Parser'),
        fileSize: buffer.length,
        summary: extraction?.summary,
        extraction
      });
    } catch (saveErr) {
      const statusCode = saveErr.status || 500;
      return res.status(statusCode).json({ error: `Failed to process document: ${saveErr.message}` });
    } finally {
      // Explicitly dereference uploaded buffer so V8 GC can immediately reclaim buffer memory
      if (req.file) {
        req.file.buffer = null;
      }
    }
  });
}

/**
 * Controlled private document download handler - streams file securely without exposing public URLs
 */
export async function handleDocumentDownload(req, res) {
  try {
    const { id } = req.params;
    const documentRecord = await findDocumentById(id);

    if (!documentRecord) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    const fileData = await storage.getObject({ key: documentRecord.storageKey });

    res.setHeader('Content-Type', documentRecord.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${documentRecord.originalFilename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (fileData.stream && typeof fileData.stream.pipe === 'function') {
      fileData.stream.pipe(res);
    } else if (fileData.getStream) {
      fileData.getStream().pipe(res);
    } else {
      res.send(fileData.buffer);
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'File content not found in storage.' });
    }
    return res.status(500).json({ error: `Failed to retrieve document: ${err.message}` });
  }
}
