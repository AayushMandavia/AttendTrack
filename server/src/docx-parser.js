import zlib from 'zlib';
import { parseDateString, parseTimes, matchStudentToRoster } from './extractor.js';
export { matchStudentToRoster };

/**
 * Checks whether buffer has valid ZIP signature (PK\x03\x04)
 * and contains 'word/document.xml' without extracting the full archive to disk.
 */
export function isDocxBuffer(buffer) {
  if (!buffer || buffer.length < 30) return false;
  // ZIP signature: 0x04034b50 (PK\x03\x04)
  if (buffer.readUInt32LE(0) !== 0x04034b50) return false;

  try {
    let offset = 0;
    let foundDocXml = false;
    // Scan local file headers
    while (offset < buffer.length - 30) {
      if (buffer.readUInt32LE(offset) !== 0x04034b50) break;
      const compressedSize = buffer.readUInt32LE(offset + 18);
      const nameLen = buffer.readUInt16LE(offset + 26);
      const extraLen = buffer.readUInt16LE(offset + 28);
      const name = buffer.toString('utf8', offset + 30, offset + 30 + nameLen);
      
      if (name === 'word/document.xml') {
        foundDocXml = true;
        break;
      }
      
      offset = offset + 30 + nameLen + extraLen + compressedSize;
    }
    return foundDocXml;
  } catch (_) {
    return false;
  }
}

/**
 * Safely extracts 'word/document.xml' from a DOCX buffer in memory.
 * Enforces a 20MB decompression limit to prevent zip bombs.
 */
export function extractDocumentXml(buffer, maxDecompressedSize = 20 * 1024 * 1024) {
  if (!buffer || buffer.length < 30 || buffer.readUInt32LE(0) !== 0x04034b50) {
    throw new Error('Invalid file format: not a valid Word (.docx) document.');
  }

  let offset = 0;
  let docXml = null;

  while (offset < buffer.length - 30) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) break;

    const compression = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const nameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);
    const name = buffer.toString('utf8', offset + 30, offset + 30 + nameLen);
    const dataOffset = offset + 30 + nameLen + extraLen;
    const rawData = buffer.slice(dataOffset, dataOffset + compressedSize);

    if (uncompressedSize > maxDecompressedSize) {
      throw new Error(`DOCX entry ${name} exceeds maximum uncompressed size limit (${Math.round(maxDecompressedSize / 1024 / 1024)}MB).`);
    }

    if (name === 'word/document.xml') {
      if (compression === 8) {
        docXml = zlib.inflateRawSync(rawData).toString('utf8');
      } else if (compression === 0) {
        docXml = rawData.toString('utf8');
      } else {
        throw new Error(`Unsupported compression method (${compression}) in DOCX file.`);
      }
      break;
    }

    offset = dataOffset + compressedSize;
  }

  if (!docXml) {
    throw new Error('Invalid DOCX document: missing Word document payload (word/document.xml).');
  }

  return docXml;
}

/**
 * Parses all tables from word/document.xml into structured rows and cells.
 */
export function parseDocxTables(docXml) {
  const tblRegex = /<w:tbl[\s>][\s\S]*?<\/w:tbl>/g;
  const tables = [];
  let tMatch;

  while ((tMatch = tblRegex.exec(docXml)) !== null) {
    const tblXml = tMatch[0];
    const trRegex = /<w:tr[\s>][\s\S]*?<\/w:tr>/g;
    const rows = [];
    let rMatch;

    while ((rMatch = trRegex.exec(tblXml)) !== null) {
      const trXml = rMatch[0];
      const tcRegex = /<w:tc[\s>][\s\S]*?<\/w:tc>/g;
      const cells = [];
      let cMatch;

      while ((cMatch = tcRegex.exec(trXml)) !== null) {
        const tcXml = cMatch[0];
        const tTagRegex = /<w:t[\s>][\s\S]*?<\/w:t>/g;
        let cellText = '';
        let tValMatch;
        while ((tValMatch = tTagRegex.exec(tcXml)) !== null) {
          cellText += tValMatch[0].replace(/<[^>]+>/g, '');
        }
        cells.push(cellText.trim());
      }
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length > 0) tables.push(rows);
  }

  return tables;
}

/**
 * Checks if a row or name string is a blank or template placeholder.
 */
export function isPlaceholderOrBlank(rawName, rawRoll = '', rawSap = '') {
  if (!rawName || typeof rawName !== 'string') return true;
  const name = rawName.trim();
  if (name.length === 0) return true;

  // Bracket placeholders e.g. [Student Full Name - 1], [Student Full Name], [Name]
  if (/^\[.*\]$/.test(name)) return true;
  if (/student\s+full\s+name/i.test(name)) return true;
  if (/name\s+of\s+student/i.test(name)) return true;
  if (/\be\.g\./i.test(name)) return true;

  // Placeholder check on IDs
  if (/^\[.*\]$/.test(rawRoll) && /roll/i.test(rawRoll)) return true;
  if (/^\[.*\]$/.test(rawSap) && /sap/i.test(rawSap)) return true;

  // Header column names repeated
  if (/^(full\s+name|student\s+name|name|sr\.?\s*no\.?|serial\s+number)$/i.test(name)) return true;

  return false;
}


/**
 * Parses a native .docx buffer, extracts the student table and document metadata,
 * and matches each student candidate against the database roster.
 */
export async function parseDocxDocument(buffer, options = {}) {
  const roster = options.roster || [];
  const lectureList = options.lectureList || [];
  const notes = [];
  const missingFields = [];

  try {
    const docXml = extractDocumentXml(buffer);
    const tables = parseDocxTables(docXml);

    // Extract raw text for fallback/metadata
    const tTagRegex = /<w:t[\s>][\s\S]*?<\/w:t>/g;
    let fullText = '';
    let match;
    while ((match = tTagRegex.exec(docXml)) !== null) {
      fullText += ' ' + match[0].replace(/<[^>]+>/g, '');
    }

    // 1. Metadata Extraction
    let reference = '';
    const refMatch = fullText.match(/(?:Letter\s+Reference\s+Number|Ref(?:erence)?(?:\s+No\.?|#)?|Letter\s+No\.?)[:\s#]+([A-Za-z0-9/_-]+)/i);
    if (refMatch) reference = refMatch[1].trim();

    let date = '';
    const dateMatch = fullText.match(/(?:Date(?:\s+of\s+Issue)?|Start\s+Date|Event\s+Date|Date)[:\s]+(\d{1,2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:20\d{2}))/i);
    if (dateMatch) {
      const parts = dateMatch[1].split(/[-/.]/);
      if (parts[2].length === 4) {
        date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    } else {
      date = parseDateString(fullText);
    }

    let startTime = '';
    let endTime = '';
    const startMatch = fullText.match(/(?:Start\s+Time|From)[:\s]+(\d{1,2}:\d{2})\s*(am|pm)?/i);
    const endMatch = fullText.match(/(?:End\s+Time|To)[:\s]+(\d{1,2}:\d{2})\s*(am|pm)?/i);
    if (startMatch && endMatch) {
      const times = parseTimes(`From: ${startMatch[1]} ${startMatch[2] || ''} To: ${endMatch[1]} ${endMatch[2] || ''}`);
      startTime = times.startTime;
      endTime = times.endTime;
    } else {
      const times = parseTimes(fullText);
      startTime = times.startTime;
      endTime = times.endTime;
    }

    // Subject / Event matching against known lectures
    let subject = '';
    const knownSubjects = [...new Set(lectureList.map(l => l.subject))];
    for (const subj of knownSubjects) {
      if (new RegExp(`\\b${subj.replace('&', '(?:&|and)')}\\b`, 'i').test(fullText)) {
        subject = subj;
        break;
      }
    }
    if (!subject) {
      const evMatch = fullText.match(/(?:Event\s+Name|Subject)[:\s]+([^\r\n.]+?)(?=\s*(?:Event\s+Organizer|Event\s+Purpose|Event\s+Venue|Start\s+Date|Time|From|To|Date|\[|$))/i);
      if (evMatch && evMatch[1].trim().length > 2) {
        subject = evMatch[1].trim();
      }
    }

    // 2. Student Table Extraction
    const extractedStudents = [];
    const seenNames = new Set();

    for (const table of tables) {
      if (table.length < 2) continue;
      const headerRow = table[0];
      const headerLower = headerRow.map(h => h.toLowerCase());

      const nameIdx = headerLower.findIndex(h => h.includes('name'));
      const rollIdx = headerLower.findIndex(h => h.includes('roll'));
      const sapIdx = headerLower.findIndex(h => h.includes('sap'));
      const branchIdx = headerLower.findIndex(h => h.includes('branch') || h.includes('dept'));
      const srIdx = headerLower.findIndex(h => h.includes('sr') || h.includes('serial'));

      // Table matches student roster table signature
      if (nameIdx !== -1 && (rollIdx !== -1 || sapIdx !== -1 || branchIdx !== -1)) {
        for (let r = 1; r < table.length; r++) {
          const row = table[r];
          const rawName = (row[nameIdx] || '').trim();
          const rawRoll = rollIdx !== -1 ? (row[rollIdx] || '').trim() : '';
          const rawSap = sapIdx !== -1 ? (row[sapIdx] || '').trim() : '';
          const rawBranch = branchIdx !== -1 ? (row[branchIdx] || '').trim() : '';
          const rawSr = srIdx !== -1 ? (row[srIdx] || '').trim() : '';

          // Filter out blank or placeholder rows
          if (isPlaceholderOrBlank(rawName, rawRoll, rawSap)) {
            continue;
          }

          const cleanName = rawName.replace(/^\[|\]$/g, '').trim();
          const cleanRoll = rawRoll.replace(/^\[|\]$/g, '').trim();
          const cleanSap = rawSap.replace(/^\[|\]$/g, '').trim();

          // Deduplicate identical duplicate student rows if already seen
          const dedupKey = `${cleanName.toLowerCase()}|${cleanRoll.toLowerCase()}|${cleanSap.toLowerCase()}`;
          if (seenNames.has(dedupKey)) continue;
          seenNames.add(dedupKey);

          // Match student against PostgreSQL roster
          const { matched, matchStatus, note, registeredStudent } = matchStudentToRoster(cleanName, cleanRoll, cleanSap, roster);

          extractedStudents.push({
            id: `cand-${extractedStudents.length + 1}`,
            srNo: rawSr || String(extractedStudents.length + 1),
            rawStudentName: cleanName,
            rawStudentId: cleanRoll || cleanSap,
            rollNo: cleanRoll,
            sapId: cleanSap,
            branch: rawBranch,
            studentId: matched ? matched.id : '',
            studentName: matched ? matched.name : cleanName,
            registeredStudentName: registeredStudent ? registeredStudent.name : '',
            registeredSapId: registeredStudent ? registeredStudent.sapId : '',
            rosterMatched: Boolean(matched),
            matchStatus,
            note
          });
        }
      }
    }

    // 3. Validation and Status
    const primary = extractedStudents[0] || {};
    const extracted = {
      students: extractedStudents,
      studentId: primary.studentId || '',
      studentName: primary.studentName || primary.rawStudentName || '',
      rawStudentName: primary.rawStudentName || '',
      rawStudentId: primary.rawStudentId || '',
      date,
      subject,
      startTime,
      endTime,
      reference
    };

    if (!extracted.studentName) missingFields.push('studentName');
    if (!extracted.date) missingFields.push('date');
    if (!extracted.subject) missingFields.push('subject');
    if (!extracted.startTime) missingFields.push('startTime');
    if (!extracted.endTime) missingFields.push('endTime');
    if (!extracted.reference) missingFields.push('reference');

    let status = 'failed';
    if (extractedStudents.length > 0 && extracted.date) {
      status = (extracted.subject && extracted.startTime && extracted.endTime) ? 'success' : 'partial';
      notes.push(`Extracted ${extractedStudents.length} student rows from Word (.docx) table.`);
    } else if (extractedStudents.length === 0) {
      status = 'partial';
      notes.push('Word document parsed, but no non-placeholder student rows were identified in the student table.');
    }

    const matchedCount = extractedStudents.filter(s => s.matchStatus === 'matched').length;
    const reviewCount = extractedStudents.filter(s => s.matchStatus !== 'matched').length;
    if (matchedCount > 0) notes.push(`${matchedCount} student(s) matched with institutional roster.`);
    if (reviewCount > 0) notes.push(`${reviewCount} student(s) require review (ambiguous or external).`);

    const summary = {
      totalDetected: extractedStudents.length,
      matched: extractedStudents.filter(s => s.matchStatus === 'matched').length,
      unknownSap: extractedStudents.filter(s => s.sapId && s.matchStatus === 'unmatched').length,
      missingOrUnreadableSap: extractedStudents.filter(s => !s.sapId || s.matchStatus === 'ambiguous' && (s.note || '').includes('SAP ID Required')).length,
      nameMismatches: extractedStudents.filter(s => s.matchStatus === 'ambiguous' && (s.note || '').includes('Mismatch')).length,
      duplicates: extractedStudents.filter(s => s.isDuplicate).length,
      needsReview: extractedStudents.filter(s => s.matchStatus !== 'matched').length,
      extractionMethod: 'Word Document Table Parser',
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileTypeName: 'Word Document (.docx)',
      pagesProcessed: 1
    };

    return {
      extracted,
      missingFields,
      status,
      notes,
      summary
    };
  } catch (err) {
    return {
      extracted: { students: [] },
      missingFields: ['studentName', 'date', 'subject', 'startTime', 'endTime', 'reference'],
      status: 'failed',
      notes: [`Failed to parse Word (.docx) document: ${err.message}`],
      summary: {
        totalDetected: 0,
        matched: 0,
        unknownSap: 0,
        missingOrUnreadableSap: 0,
        nameMismatches: 0,
        duplicates: 0,
        needsReview: 0,
        extractionMethod: 'Word Document Table Parser',
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileTypeName: 'Word Document (.docx)',
        pagesProcessed: 1
      }
    };
  }
}
