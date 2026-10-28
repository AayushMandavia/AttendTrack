// Polyfill browser globals required by pdfjs-dist in headless / serverless Node.js
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor() {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
    }
  };
}
if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class Path2D {};
}
if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class ImageData {};
}

import { ocrQueue } from './ocr-queue.js';

const MONTH_MAP = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12'
};

/**
 * Normalizes time strings to HH:MM (24-hour format)
 */
export function normalizeTime(timeStr, modifier) {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ? mStr.padStart(2, '0') : '00';
  if (modifier) {
    const mod = modifier.toLowerCase();
    if (mod === 'pm' && h < 12) h += 12;
    if (mod === 'am' && h === 12) h = 0;
  }
  return `${h.toString().padStart(2, '0')}:${m}`;
}

/**
 * Parses and normalizes diverse date representations into YYYY-MM-DD
 */
export function parseDateString(text) {
  if (!text) return '';

  // 1. ISO: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = text.match(/\b(20\d{2})[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // 2. DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = text.match(/\b(0[1-9]|[12]\d|3[01])[-/.](0[1-9]|1[0-2])[-/.](20\d{2})\b/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  }

  // 3. Date range e.g. "27th-28th Oct 2024" or "18th, 19th, 20th, 21st August 2025"
  const rangeMatch = text.match(/\b(0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?(?:\s*[-–,]\s*(?:0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?)*\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Sept|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[,\s]+(20\d{2})\b/i);
  if (rangeMatch) {
    const mm = MONTH_MAP[rangeMatch[2].slice(0, 3).toLowerCase()] || '01';
    return `${rangeMatch[3]}-${mm}-${rangeMatch[1].padStart(2, '0')}`;
  }

  // 4. DD Month YYYY (e.g., 14 Oct 2026 or 14th October, 2026)
  const dMonthY = text.match(/\b(0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Sept|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[,\s]+(20\d{2})\b/i);
  if (dMonthY) {
    const mm = MONTH_MAP[dMonthY[2].slice(0, 3).toLowerCase()] || '01';
    return `${dMonthY[3]}-${mm}-${dMonthY[1].padStart(2, '0')}`;
  }

  // 5. Month DD, YYYY (e.g., October 14, 2026 or Oct 14th, 2026)
  const monthDY = text.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Sept|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?[,\s]+(20\d{2})\b/i);
  if (monthDY) {
    const mm = MONTH_MAP[monthDY[1].slice(0, 3).toLowerCase()] || '01';
    return `${monthDY[3]}-${mm}-${monthDY[2].padStart(2, '0')}`;
  }

  return '';
}

/**
 * Parses start and end times supporting diverse single-line and multi-line formats
 */
export function parseTimes(text) {
  // Strategy A: Separate From: ... and To: ... lines
  const fromMatch = text.match(/(?:From|Start(?:\s+Time)?|Timing|Time)[:\s]+(\d{1,2}(?::\d{2})?)\s*(am|pm)?/i);
  const toMatch = text.match(/(?:To|End(?:\s+Time)?)[:\s]+(\d{1,2}(?::\d{2})?)\s*(am|pm)?/i);
  if (fromMatch && toMatch) {
    const sTime = fromMatch[1].includes(':') ? fromMatch[1] : `${fromMatch[1]}:00`;
    const eTime = toMatch[1].includes(':') ? toMatch[1] : `${toMatch[1]}:00`;
    return {
      startTime: normalizeTime(sTime, fromMatch[2]),
      endTime: normalizeTime(eTime, toMatch[2])
    };
  }

  // Strategy B: Time range e.g. "10:00 to 11:00", "8AM to 6PM", "10:00 - 11:00", "10:00 AM - 01:00 PM"
  const rangeMatch = text.match(/\b(\d{1,2}:\d{2}(?:\s*(?:am|pm))?|\d{1,2}\s*(?:am|pm))\s*(?:to|-|–|and)\s*(\d{1,2}:\d{2}(?:\s*(?:am|pm))?|\d{1,2}\s*(?:am|pm))\b/i);
  if (rangeMatch) {
    const t1 = rangeMatch[1].trim();
    const t2 = rangeMatch[2].trim();
    const m1 = t1.match(/am|pm/i)?.[0] || t2.match(/am|pm/i)?.[0] || '';
    const m2 = t2.match(/am|pm/i)?.[0] || '';
    const sTime = t1.replace(/\s*(?:am|pm)/i, '');
    const eTime = t2.replace(/\s*(?:am|pm)/i, '');
    return {
      startTime: normalizeTime(sTime.includes(':') ? sTime : `${sTime}:00`, m1),
      endTime: normalizeTime(eTime.includes(':') ? eTime : `${eTime}:00`, m2)
    };
  }

  return { startTime: '', endTime: '' };
}

/**
 * Matches an extracted student against the enrolled PostgreSQL roster using strict SAP ID rules.
 * 
 * Rules:
 * 1. SAP ID is the primary institutional identifier.
 * 2. Search for the student using the SAP ID first.
 * 3. If SAP ID is missing or empty: Block approval and set error "SAP ID Required".
 * 4. Check for duplicate SAP ID in the database roster: If duplicate exists, treat as data integrity error and block approval.
 * 5. If SAP ID is unknown: Block approval and set error "Unknown SAP ID". Never match on name or roll number alone.
 * 6. If SAP ID exists, compare the letter's name against the registered student's name:
 *    - Exact match (case-insensitive): mark "matched".
 *    - Name conflicts (belongs to a different student): block approval with explicit "SAP ID / Name Mismatch".
 *    - Name is similar / abbreviated (e.g. initials or typo) but not identical: mark "ambiguous" (Needs Review). Never auto-approve.
 *    - Completely different name: block approval with explicit "SAP ID / Name Mismatch".
 * 7. Never match using name or roll number alone.
 */
export function matchStudentToRoster(cleanName, cleanRoll, cleanSap, roster = []) {
  let matched = null;
  let matchStatus = 'unmatched';
  let note = '';
  let registeredStudent = null;

  const sapStr = cleanSap ? String(cleanSap).trim() : '';

  // 1. Missing or unreadable SAP ID
  if (!sapStr) {
    const rosterByName = cleanName ? roster.find(s => s.name.toLowerCase() === cleanName.toLowerCase()) : null;
    return {
      matched: null,
      matchStatus: 'ambiguous',
      note: 'SAP ID Required: Missing or unreadable SAP ID. Name-only and roll-number matching cannot replace mandatory SAP ID verification.',
      registeredStudent: rosterByName || null
    };
  }

  // 2. Check for duplicate SAP ID across distinct students in the database roster
  const sapMatches = roster.filter(s => s.sapId && s.sapId.trim() === sapStr);
  if (sapMatches.length > 1) {
    return {
      matched: null,
      matchStatus: 'ambiguous',
      note: `Data integrity error: Duplicate SAP ID (${sapStr}) found for multiple enrolled students (${sapMatches.map(s => `${s.name} [${s.id}]`).join(', ')}). Approval blocked.`,
      registeredStudent: null
    };
  }

  // 3. Search by SAP ID or institutional student ID (STU-xxx)
  if (sapMatches.length === 1) {
    registeredStudent = sapMatches[0];
  } else {
    const legacyStudent = roster.find(s => s.id && s.id.toLowerCase() === sapStr.toLowerCase());
    if (legacyStudent) {
      registeredStudent = legacyStudent;
    }
  }

  // 4. Unknown SAP ID
  if (!registeredStudent) {
    return {
      matched: null,
      matchStatus: 'unmatched',
      note: `Unknown SAP ID: SAP ID "${sapStr}" is not registered in the institutional database roster.`,
      registeredStudent: null
    };
  }

  // 5. Compare Extracted Name with Registered Student Name
  const normExtracted = (cleanName || '').trim().toLowerCase();
  const normRegistered = registeredStudent.name.trim().toLowerCase();

  if (!normExtracted) {
    return {
      matched: null,
      matchStatus: 'ambiguous',
      note: `Student name is missing from letter for SAP ID ${registeredStudent.sapId || registeredStudent.id} (${registeredStudent.name}).`,
      registeredStudent
    };
  }

  // 5a. Exact Name Match (case-insensitive)
  if (normExtracted === normRegistered) {
    return {
      matched: registeredStudent,
      matchStatus: 'matched',
      note: `Verified: SAP ID ${registeredStudent.sapId || registeredStudent.id} matches registered student ${registeredStudent.name}.`,
      registeredStudent
    };
  }

  // 5b. Detect if the extracted name belongs to ANOTHER student in the roster
  const conflictRosterStudent = roster.find(s => s.name.toLowerCase() === normExtracted && s.id !== registeredStudent.id);
  if (conflictRosterStudent) {
    return {
      matched: null,
      matchStatus: 'ambiguous',
      note: `SAP ID / Name Mismatch: SAP ID (${registeredStudent.sapId || registeredStudent.id}) belongs to ${registeredStudent.name}, but extracted name belongs to ${conflictRosterStudent.name} (SAP: ${conflictRosterStudent.sapId || 'None'}). Approval strictly blocked.`,
      registeredStudent
    };
  }

  // 5c. Check for similar / partial name (e.g. initials, single token match, minor typo)
  const extractedTokens = normExtracted.split(/\s+/).filter(t => t.length > 1);
  const registeredTokens = normRegistered.split(/\s+/).filter(t => t.length > 1);
  const hasTokenOverlap = extractedTokens.some(t => registeredTokens.includes(t)) ||
                          normRegistered.includes(normExtracted) ||
                          normExtracted.includes(normRegistered);

  if (hasTokenOverlap) {
    return {
      matched: null,
      matchStatus: 'ambiguous',
      note: `Name verification required: Extracted name "${cleanName}" is similar but not identical to registered student "${registeredStudent.name}" (SAP ID: ${registeredStudent.sapId || registeredStudent.id}). Manual review required.`,
      registeredStudent
    };
  }

  // 5d. Completely different name for existing SAP ID -> Explicit SAP ID / Name Mismatch
  return {
    matched: null,
    matchStatus: 'ambiguous',
    note: `SAP ID / Name Mismatch: SAP ID (${registeredStudent.sapId || registeredStudent.id}) is registered to "${registeredStudent.name}", but the letter lists "${cleanName}". Approval strictly blocked.`,
    registeredStudent
  };
}

/**
 * Cleans OCR artifacts from student names
 */
export function cleanOcrName(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/^[\[\]#0-9.\s_-]+/, '')
    .replace(/[\[\]\(\)|]+/g, ' ')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes OCR characters for SAP ID candidates
 */
export function normalizeOcrSapCandidate(raw) {
  if (!raw) return { raw: '', normalized: '', isClean: true };
  const cleaned = String(raw).replace(/[\s“"'_\[\]|]/g, '').trim();
  if (/^\d{11}$/.test(cleaned) || /^600\d{8}$/.test(cleaned)) {
    return { raw: cleaned, normalized: cleaned, isClean: true };
  }
  // If candidate is 9-13 characters and contains common OCR letter-digit confusions
  if (/^[0-9A-Za-z|!]{9,13}$/.test(cleaned) && /[0-9]/.test(cleaned)) {
    const substituted = cleaned
      .replace(/[Gbe]/g, '6')
      .replace(/[oODQ]/gi, '0')
      .replace(/[iIl|!]/g, '1')
      .replace(/[sS]/g, '5')
      .replace(/[zZ]/g, '2')
      .replace(/[B]/g, '8');
    if (/^600\d{8}$/.test(substituted) || /^\d{11}$/.test(substituted)) {
      return { raw: cleaned, normalized: substituted, isClean: false };
    }
  }
  return { raw: cleaned, normalized: cleaned, isClean: false };
}

/**
 * Parses OCR table lines delimited by pipes, brackets, or tabs
 */
export function parseOcrTableRows(text) {
  const lines = text.split(/[\r\n]+/);
  const rows = [];
  const headerOrNoise = /^(your\s+sincerely|regards|gards|shri\s+vile|dwarkadas|naac|to\b|respected|subject:|permission|we\s+request|letter\s+reference|hours\b|college\b|department\b)/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || headerOrNoise.test(trimmed)) continue;

    // Detect header rows e.g. "Sr No | Student Full Name | Branch | Roll No | SAP ID"
    if (/sr\s*no/i.test(trimmed) && /(?:student|name|roll|sap)/i.test(trimmed)) continue;

    // Skip template placeholder rows e.g. "[Student Full Name - 2] | | | [Roll] | [SAP]"
    if (/\[\s*Student(?:\s+Full)?\s+Name/i.test(trimmed) || /\[\s*(?:Roll|SAP)\s*\]/i.test(trimmed)) continue;

    // Check if line looks like a table row: has pipe '|', tab '\t', or multiple brackets '[', ']'
    if (trimmed.includes('|') || trimmed.includes('\t') || (trimmed.match(/\[/g) || []).length >= 2) {
      const normalized = trimmed
        .replace(/[\[\]\t]/g, ' | ')
        .replace(/\s*\|\s*/g, ' | ');

      const rawTokens = normalized.split('|').map(t => t.trim()).filter(Boolean);
      if (rawTokens.length < 2) continue;

      // Filter out pure table header tokens
      const tokens = rawTokens.filter(t => !/^(sr\.?|sr\s*no\.?|serial|roll(?:\s*no\.?)?|sap(?:\s*id)?|name|student(?:\s*(?:full\s*)?name)?|branch|dept|course|signature)$/i.test(t));
      if (tokens.length === 0) continue;

      let srNo = '';
      let name = '';
      let branch = '';
      let roll = '';
      let sap = '';
      let rawSap = '';

      for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];
        // Check if token is SrNo e.g. '1', '30', '51', '#4'
        if (!srNo && !name && /^[#0-9]{1,3}$/.test(tok)) {
          srNo = tok.replace('#', '');
          continue;
        }
        // Check if token is SAP ID
        const normSap = normalizeOcrSapCandidate(tok);
        if (!sap && (normSap.normalized && (/^600\d{8}$/.test(normSap.normalized) || /^\d{10,12}$/.test(normSap.normalized)))) {
          rawSap = normSap.raw;
          sap = normSap.normalized;
          continue;
        }
        // Check if token is Roll Number
        const cleanTok = tok.replace(/[\s_]/g, '');
        if (!roll && /^[A-Za-z][0-9A-Za-z]{2,4}$/i.test(cleanTok) && !/^(EXTC|COMPS|COMP|CSE|IT|MECH|CIVIL)$/i.test(cleanTok)) {
          roll = cleanTok;
          continue;
        }
        // Check if token is Branch
        if (!branch && /^(EXTC|COMPS|COMP|CSE(?:\s*DS|\s*ICB)?|IT|MECH(?:ANICAL)?|CIVIL|AIDS|AIML|ICB|wc|mw|ew|viechmon)/i.test(cleanTok)) {
          branch = tok;
          continue;
        }
        // Otherwise it could be name
        if (!name && tok.replace(/[^A-Za-z]/g, '').length >= 3) {
          name = tok;
        }
      }

      // If name still empty, check remaining tokens
      if (!name) {
        for (const tok of tokens) {
          const cleaned = tok.replace(/^[#0-9.\s]+/, '').trim();
          if (cleaned.length >= 3 && !/^(EXTC|COMPS|CSE|IT|MECH|CIVIL|DS)/i.test(cleaned) && cleaned !== sap && cleaned !== roll && cleaned !== rawSap) {
            name = cleaned;
            break;
          }
        }
      }

      // If name has leading digits e.g. '30 Tvewisian ane'
      if (name) {
        const leadSr = name.match(/^(\d{1,3})\s+(.*)$/);
        if (leadSr) {
          if (!srNo) srNo = leadSr[1];
          name = leadSr[2];
        }
      }

      const cleanName = cleanOcrName(name);
      if (/^(?:student(?:\s+full)?\s+name|student\s+name\s*-\s*\d+|roll\s*no|sap\s*id)$/i.test(cleanName)) {
        continue;
      }
      if (cleanName.length >= 2 || sap || rawSap) {
        rows.push({
          srNo,
          name: cleanName,
          branch,
          roll,
          sap: sap || rawSap,
          rawSap: rawSap || sap,
          rawLine: trimmed
        });
      }
    }
  }
  return rows;
}

/**
 * Extracts multiple student candidates and matches them against the roster
 */
export function extractStudentsFromText(text = '', roster = []) {
  const candidates = [];
  const seenSaps = new Set();
  const seenIds = new Set();
  const seenKeys = new Map();

  function addCandidate(rawName, rawId = '', source = 'pattern', meta = {}) {
    if (!rawName && !rawId && !meta.sapId) return;
    const cleanName = cleanOcrName(rawName);
    let cleanId = (rawId || '').trim();
    if (/^(NO|NA|ID|ROLL|REG|STUDENT|CLASS|DEPT)$/i.test(cleanId)) cleanId = '';

    // Filter out document noise words
    if (cleanName && /^(of|the|is|and|for|with|attended|attendance|excuse|leave|letter|student|students|subject|date|time|class|college|university|department|principal|coordinator|professor|teacher|dear|sir|madam|list|tcet|djs|mun|event)$/i.test(cleanName)) {
      return;
    }

    if (!cleanId) {
      const idMatch = text.match(/(?:Student\s+ID|Student\s+Roll(?:\s*No\.?)?|Roll(?:\s*No\.?)?|Registration(?:\s*No\.?)?|Reg(?:\s*No\.?)?|SAP(?:\s*ID)?|Student\s+Code|ID)[:\s#]+([A-Za-z0-9-_]+)/i);
      if (idMatch && !/^(NO|NA|ID|ROLL|REG|STUDENT)$/i.test(idMatch[1])) {
        cleanId = idMatch[1].trim().toUpperCase().replace(/[_ ]/, '-');
      }
    }

    let cleanSap = meta.sapId || (cleanId.match(/^(600\d{8}|\d{10,12}|STU[-_]?\d+|EXT[-_]?\d+)$/i) ? cleanId : '');
    let cleanRoll = meta.rollNo || (cleanId && cleanId !== cleanSap ? cleanId : '');

    // Strict SAP ID & Name Verification
    const { matched, matchStatus, note, registeredStudent } = matchStudentToRoster(cleanName, cleanRoll, cleanSap, roster);

    const candSap = registeredStudent ? registeredStudent.sapId : cleanSap;
    const candRoll = registeredStudent?.rollNo || cleanRoll;
    const candStudentId = matched ? matched.id : '';
    const candName = matched ? matched.name : cleanName;
    const rawStudentId = meta.rawSapId || cleanSap || cleanId || cleanRoll;

    // Cleanly deduplicate duplicate candidate rows
    if (candSap && seenSaps.has(candSap)) return;
    if (candStudentId && seenIds.has(candStudentId)) return;
    const dedupKey = candStudentId ? `ID:${candStudentId}` : (candSap ? `SAP:${candSap}` : (cleanName ? `NAME:${cleanName.toLowerCase()}` : `RAW:${rawStudentId}`));
    if (seenKeys.has(dedupKey)) return;

    if (candSap) seenSaps.add(candSap);
    if (candStudentId) seenIds.add(candStudentId);
    seenKeys.set(dedupKey, true);

    candidates.push({
      id: `cand-${candidates.length + 1}`,
      srNo: meta.srNo || String(candidates.length + 1),
      rawStudentName: cleanName,
      rawStudentId,
      rollNo: candRoll,
      sapId: candSap,
      branch: meta.branch || registeredStudent?.branch || '',
      studentId: candStudentId,
      studentName: candName,
      registeredStudentName: registeredStudent ? registeredStudent.name : '',
      registeredSapId: registeredStudent ? registeredStudent.sapId : '',
      rosterMatched: Boolean(matched),
      matchStatus,
      isDuplicate: false,
      note,
      source
    });
  }

  // Strategy 0: OCR Table Row Parser (Delimiter-based: |, [, ], \t)
  const ocrRows = parseOcrTableRows(text);
  for (const r of ocrRows) {
    addCandidate(r.name, r.sap || r.roll, 'table_ocr', {
      sapId: r.sap,
      rawSapId: r.rawSap,
      rollNo: r.roll,
      branch: r.branch,
      srNo: r.srNo
    });
  }

  // Strategy 1: Direct line-by-line SAP ID scan
  const lines = text.split(/[\r\n]+/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const sapMatch = trimmed.match(/\b(600\d{8}|\d{10,12})\b/);
    if (sapMatch) {
      const sap = sapMatch[1];
      const sapIndex = sapMatch.index;
      let prefix = trimmed.slice(0, sapIndex).trim();
      let suffix = trimmed.slice(sapIndex + sap.length).trim();

      prefix = prefix.replace(/^[0-9]{1,2}[.)]\s*/, '').replace(/^[-*•]\s*/, '').trim();
      prefix = prefix.replace(/[,;:\-]+$/, '').replace(/[\(\[\)\]]+$/g, '').trim();

      let extractedName = prefix;
      let branch = '';
      let rollNo = '';

      if (/^[A-Za-z0-9-]{1,6}$/i.test(suffix)) {
        branch = suffix;
      }

      const rollMatch = prefix.match(/\s+([A-Za-z]\d{1,4})\b/i);
      if (rollMatch) {
        rollNo = rollMatch[1];
        extractedName = prefix.slice(0, rollMatch.index).trim();
      }

      const branchMatch = extractedName.match(/\s+(EXTC(?:\s*[-–]\s*\w+)?|COMPS|CSE(?:\s+ICB|\s+DS)?|IT|AIML|ICB|MECH(?:ANICAL)?|CIVIL)(?:\s*[-–]\s*\w+)?/i);
      if (branchMatch) {
        branch = branch || branchMatch[0].trim();
        extractedName = extractedName.slice(0, branchMatch.index).trim();
      }

      if (extractedName.length >= 2 && !/^(TCET|DJS|LIST|NAME|SR|STUDENT|DATE|TIME|SUBJECT)/i.test(extractedName)) {
        addCandidate(extractedName, sap, 'sap_line', { sapId: sap, rollNo, branch });
      }
    }
  }

  // Strategy 2: Numbered / bulleted list items e.g. "1. Riya Shah (ID: STU-001)"
  const listRegex = /(?:^|[\r\n])\s*(?:[0-9]{1,2}[.)]|[-*•])\s*([A-Za-z\s.'-]+?)(?:\s*(?:[-–:|]|[([]\s*(?:ID|Roll|Reg)?[:\s#]*|\bID:|\bRoll:)\s*([A-Za-z0-9-_]+)[)\]]?)?[ \t]*(?=[\r\n]|$)/g;
  let match;
  while ((match = listRegex.exec(text)) !== null) {
    let rawName = match[1]?.trim() || '';
    let rawId = match[2]?.trim() || '';
    rawName = rawName.replace(/[\(\[\)\]]+$/g, '').trim();
    if (!rawId && rawName) {
      const embeddedId = rawName.match(/\b(STU[-_ ]?\d{3,4}|600\d{8})\b/i);
      if (embeddedId) rawId = embeddedId[1];
    }
    addCandidate(rawName, rawId, 'list');
  }

  // Strategy 3: Tabular lines e.g. "STU-001 | Riya Shah"
  const tableRegex = /(?:^|[\r\n])\s*([A-Za-z0-9-_]{3,15})\s*[|\t]\s*([A-Za-z\s.'-]{3,40})(?=[\r\n]|$)/g;
  while ((match = tableRegex.exec(text)) !== null) {
    const col1 = match[1].trim();
    const col2 = match[2].trim();
    if (/^[A-Za-z0-9-_]+$/.test(col1) && /^[A-Za-z\s.'-]+$/.test(col2)) {
      addCandidate(col2, col1, 'table');
    }
  }
  const tableReverseRegex = /(?:^|[\r\n])\s*([A-Za-z\s.'-]{3,40})\s*[|\t]\s*([A-Za-z0-9-_]{3,15})(?=[\r\n]|$)/g;
  while ((match = tableReverseRegex.exec(text)) !== null) {
    const col1 = match[1].trim();
    const col2 = match[2].trim();
    if (/^[A-Za-z\s.'-]+$/.test(col1) && /^[A-Za-z0-9-_]+$/.test(col2)) {
      addCandidate(col1, col2, 'table_reverse');
    }
  }

  // Strategy 4: Repeated labeled lines e.g. "Name: Riya Shah ... ID: STU-001"
  const labelPairRegex = /(?:Student(?:\s+Full)?\s+Name|Applicant(?:\s+Full)?\s+Name|Name\s+of\s+(?:the\s+)?Student|Candidate\s+Name|Name)[:\s]+([A-Za-z\s.'-]+?)(?:[ \t]+(?:ID|Roll(?:\s*No\.?)?|Reg(?:\s*No\.?)?|SAP(?:\s*ID)?)[:\s#]*([A-Za-z0-9-_]+)|[\r\n,;]|$)/gi;
  while ((match = labelPairRegex.exec(text)) !== null) {
    const candidateName = match[1]?.trim();
    const candidateId = match[2]?.trim() || '';
    addCandidate(candidateName, candidateId, 'label');
  }

  // Strategy 5: Standalone single labeled match fallback if nothing found yet
  if (candidates.length === 0) {
    const singleName = text.match(/(?:Student(?:\s+Full)?\s+Name|Applicant(?:\s+Full)?\s+Name|Name\s+of\s+(?:the\s+)?Student|Candidate\s+Name|Student's?\s+Name|Name|Student)[:\s]+([A-Za-z\s.'-]+?)(?:\s+(?:ID|Roll|Reg|Branch|Year|Class|Date|Dated|Dept|Subject)|[\r\n,;]|$)/i);
    let singleId = '';
    const idMatch = text.match(/(?:Student\s+ID|Student\s+Roll(?:\s*No\.?)?|Roll(?:\s*No\.?)?|Registration(?:\s*No\.?)?|Reg(?:\s*No\.?)?|SAP(?:\s*ID)?|Student\s+Code|ID)[:\s#]+([A-Za-z0-9-_]+)/i);
    if (idMatch && !/^(NO|NA|ID|ROLL|REG|STUDENT)$/i.test(idMatch[1])) singleId = idMatch[1];
    if (singleName) {
      addCandidate(singleName[1], singleId, 'single_fallback');
    } else if (singleId) {
      const rosterStudent = roster.find(s => s.id === singleId.trim().toUpperCase() || s.sapId === singleId.trim());
      addCandidate(rosterStudent ? rosterStudent.name : singleId, singleId, 'single_id_fallback');
    }
  }

  return candidates;
}

/**
 * Calculates extraction metrics summary
 */
export function calculateExtractionSummary(students = [], meta = {}) {
  const totalDetected = students.length;
  const matched = students.filter(s => s.matchStatus === 'matched').length;
  const unknownSap = students.filter(s => s.matchStatus === 'unmatched' && s.sapId).length;
  const missingOrUnreadableSap = students.filter(s => !s.sapId || s.matchStatus === 'ambiguous' && (s.note || '').includes('SAP ID Required')).length;
  const nameMismatches = students.filter(s => s.matchStatus === 'ambiguous' && (s.note || '').includes('Mismatch')).length;
  const duplicates = students.filter(s => s.isDuplicate).length;
  const needsReview = students.filter(s => s.matchStatus !== 'matched').length;

  return {
    totalDetected,
    matched,
    unknownSap,
    missingOrUnreadableSap,
    nameMismatches,
    duplicates,
    needsReview,
    extractionMethod: meta.extractionMethod || 'Automated Parser',
    fileType: meta.fileType || '',
    fileTypeName: meta.fileTypeName || '',
    pagesProcessed: meta.pagesProcessed || 1,
    confidence: meta.confidence || null
  };
}

const BASELINE_FALLBACK_ROSTER = Object.freeze([
  { id: 'STU-001', sapId: '60001240001', name: 'Riya Shah' },
  { id: 'STU-002', sapId: '60001240002', name: 'Arjun Mehta' },
  { id: 'STU-003', sapId: '60001240003', name: 'Sara Khan' },
  { id: 'STU-004', sapId: '60001240004', name: 'Dev Patel' }
]);

/**
 * Extracts structured fields from raw text
 */
export function extractFieldsFromText(text = '', options = {}) {
  const roster = Array.isArray(options.roster) && options.roster.length > 0 ? options.roster : BASELINE_FALLBACK_ROSTER;
  const lectureList = Array.isArray(options.lectureList) && options.lectureList.length > 0 ? options.lectureList : [];
  const extracted = {};
  const notes = [];

  if (!text || typeof text !== 'string') {
    return {
      extracted,
      missingFields: ['studentId', 'studentName', 'date', 'subject', 'startTime', 'endTime', 'reference'],
      status: 'failed',
      notes: ['No readable text found in document.'],
      summary: calculateExtractionSummary([], options)
    };
  }

  // Extract multiple students or single student
  const studentsFound = extractStudentsFromText(text, roster);
  extracted.students = studentsFound;

  let rawStudentName = '';
  let rawStudentId = '';
  let matchedStudent = null;

  if (studentsFound.length > 0) {
    const primary = studentsFound[0];
    rawStudentName = primary.rawStudentName;
    rawStudentId = primary.rawStudentId;
    if (primary.rosterMatched) {
      matchedStudent = { id: primary.studentId, name: primary.studentName };
    }
    extracted.rawStudentName = primary.rawStudentName;
    extracted.rawStudentId = primary.rawStudentId;
    extracted.studentId = primary.studentId;
    extracted.studentName = primary.studentName;
    extracted.sapId = primary.sapId;
    extracted.rollNo = primary.rollNo;
    extracted.rosterMatched = primary.rosterMatched;
    extracted.matchStatus = primary.matchStatus;
  } else {
    extracted.rawStudentName = '';
    extracted.rawStudentId = '';
    extracted.studentId = '';
    extracted.studentName = '';
    extracted.sapId = '';
    extracted.rollNo = '';
    extracted.rosterMatched = false;
    extracted.matchStatus = 'unmatched';
  }

  // 4. Date Extraction
  const dateLabelMatch = text.match(/(?:Date(?:\s+of\s+Letter)?|Dated|Letter\s+Date|Event\s+Date|Leave\s+Date)[:\s]+([^\r\n]+)/i);
  const parsedDate = parseDateString(dateLabelMatch ? dateLabelMatch[1] : text);
  if (parsedDate) {
    extracted.date = parsedDate;
  }

  // 5. Subject / Course Extraction
  const knownSubjects = [...new Set(lectureList.map(l => l.subject))];
  for (const subj of knownSubjects) {
    if (new RegExp(`\\b${subj.replace('&', '(?:&|and)')}\\b`, 'i').test(text)) {
      extracted.subject = subj;
      break;
    }
  }
  if (!extracted.subject) {
    const subjMatch = text.match(/(?:Subject|Course(?:\s+Name)?|Lecture(?:\s+Name)?|Class)[:\s]+([A-Za-z0-9 &+.'-]+?)(?:\r?\n|$|\s{2,})/i);
    if (subjMatch) {
      const candidateSubj = subjMatch[1].trim();
      if (candidateSubj.length > 2) extracted.subject = candidateSubj;
    }
  }

  // 6. Time Extraction
  const { startTime, endTime } = parseTimes(text);
  if (startTime) extracted.startTime = startTime;
  if (endTime) extracted.endTime = endTime;

  // 7. Reference Number Extraction
  const refLabelMatch = text.match(/(?:Ref(?:erence)?(?:\s+No\.?|#)?|Letter\s+No\.?|Doc(?:ument)?\s+No\.?|Cert(?:ificate)?\s+No\.?|Event\s+No\.?)[:\s#]+([A-Za-z0-9-_/]+)/i);
  if (refLabelMatch) {
    extracted.reference = refLabelMatch[1].trim();
  } else {
    const standaloneRef = text.match(/\b((?:EVT|MED|OD|REF|LTR|CERT)[-_/][A-Za-z0-9-_/]+)\b/i);
    if (standaloneRef) {
      extracted.reference = standaloneRef[1].trim();
    }
  }

  // 8. Determine missing fields and status
  const missing = [];
  if (!extracted.studentId) missing.push('studentId');
  if (!extracted.studentName) missing.push('studentName');
  if (!extracted.date) missing.push('date');
  if (!extracted.subject) missing.push('subject');
  if (!extracted.startTime) missing.push('startTime');
  if (!extracted.endTime) missing.push('endTime');
  if (!extracted.reference) missing.push('reference');

  let status = 'failed';
  const hasIdentity = Boolean(extracted.studentName || rawStudentName);
  if (hasIdentity && extracted.date && extracted.studentId) {
    status = (extracted.subject && extracted.startTime && extracted.endTime) ? 'success' : 'partial';
  } else if (hasIdentity || Object.keys(extracted).length > 0) {
    status = 'partial';
  }

  if (rawStudentName && !matchedStudent) {
    notes.push(`Detected name "${rawStudentName}" does not match an enrolled student in the current roster. Please confirm the student manually.`);
  }

  if (!hasIdentity) {
    notes.push('No student name could be detected with certainty. Please select the student manually.');
  }

  if (missing.length > 0) {
    notes.push(`Missing or uncertain fields: ${missing.join(', ')}. Please verify manually.`);
  } else {
    notes.push('All core fields extracted. Please review before queuing.');
  }

  const summary = calculateExtractionSummary(studentsFound, options);

  return { extracted, missingFields: missing, status, notes, summary };
}

/**
 * Parses a PDF buffer and extracts attendance fields
 */
export async function parsePdfDocument(buffer, options = {}) {
  try {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const rawText = result?.text || '';
    const numPages = result?.numpages || result?.pages?.length || 1;

    const meaningfulText = rawText.replace(/--\s*\d+\s+of\s+\d+\s*--/g, '').trim();
    if (meaningfulText.length > 0) {
      return extractFieldsFromText(meaningfulText, {
        ...options,
        fileType: 'application/pdf',
        fileTypeName: 'PDF Document',
        extractionMethod: 'Digital PDF Text & Table Parser',
        pagesProcessed: numPages
      });
    }

    return {
      extracted: { students: [] },
      missingFields: ['studentId', 'studentName', 'date', 'subject', 'startTime', 'endTime', 'reference'],
      status: 'failed',
      notes: ['Scanned PDF detected with no digital text layer. Please enter details manually or upload as an image (JPEG/PNG).'],
      summary: calculateExtractionSummary([], {
        ...options,
        fileType: 'application/pdf',
        fileTypeName: 'PDF Document',
        extractionMethod: 'Digital PDF Text & Table Parser',
        pagesProcessed: numPages
      })
    };
  } catch (err) {
    return {
      extracted: { students: [] },
      missingFields: ['studentId', 'studentName', 'date', 'subject', 'startTime', 'endTime', 'reference'],
      status: 'failed',
      notes: [`Failed to parse PDF document: ${err.message}`],
      summary: calculateExtractionSummary([], {
        ...options,
        fileType: 'application/pdf',
        fileTypeName: 'PDF Document',
        extractionMethod: 'Digital PDF Text & Table Parser',
        pagesProcessed: 1
      })
    };
  }
}

/**
 * Parses an image buffer (JPEG / PNG) using bounded Tesseract.js OCR queue
 */
export async function parseImageDocument(buffer, options = {}) {
  try {
    const ocrResult = await ocrQueue.enqueue(buffer);
    const rawText = ocrResult?.text || '';
    const confidence = ocrResult?.confidence || 0;

    const extraction = extractFieldsFromText(rawText, {
      ...options,
      fileType: options.fileType || 'image/jpeg',
      fileTypeName: options.fileTypeName || 'JPEG Image (OCR)',
      extractionMethod: 'OCR (Tesseract.js)',
      pagesProcessed: 1,
      confidence
    });

    if (extraction.extracted.students && extraction.extracted.students.length > 0) {
      extraction.notes.unshift(`OCR recognized ${extraction.extracted.students.length} student entries (${confidence}% confidence).`);
    } else if (extraction.extracted.studentName || extraction.extracted.rawStudentName) {
      extraction.notes.unshift(`OCR recognized text successfully (${confidence}% confidence).`);
    } else {
      extraction.notes.unshift(`OCR completed (${confidence}% confidence), but no student entries could be identified with certainty.`);
      if (extraction.status === 'success') extraction.status = 'partial';
    }

    return extraction;
  } catch (err) {
    return {
      extracted: { students: [] },
      missingFields: ['studentId', 'studentName', 'date', 'subject', 'startTime', 'endTime', 'reference'],
      status: 'failed',
      notes: [`OCR extraction failed: ${err?.message || 'Unreadable image format'}. Please enter details manually.`],
      summary: calculateExtractionSummary([], {
        ...options,
        fileType: options.fileType || 'image/jpeg',
        fileTypeName: options.fileTypeName || 'JPEG Image (OCR)',
        extractionMethod: 'OCR (Tesseract.js)',
        pagesProcessed: 1,
        confidence: 0
      })
    };
  }
}

export async function terminateOcrWorker() {
  await ocrQueue.terminate();
}

export { ocrQueue };
export { parseDocxDocument, isDocxBuffer } from './docx-parser.js';
