import * as XLSX from 'xlsx';
import { prisma, testDatabaseConnection } from './db.js';
import { studentCache } from './lru-cache.js';

// Standard academic years accepted by college
export const VALID_ACADEMIC_YEARS = [
  'First Year', 'Second Year', 'Third Year', 'Fourth Year',
  'FE', 'SE', 'TE', 'BE',
  'Year 1', 'Year 2', 'Year 3', 'Year 4'
];

export const NORMALIZED_ACADEMIC_YEAR_MAP = {
  'fe': 'First Year',
  'first year': 'First Year',
  'year 1': 'First Year',
  '1st year': 'First Year',
  'se': 'Second Year',
  'second year': 'Second Year',
  'year 2': 'Second Year',
  '2nd year': 'Second Year',
  'te': 'Third Year',
  'third year': 'Third Year',
  'year 3': 'Third Year',
  '3rd year': 'Third Year',
  'be': 'Fourth Year',
  'fourth year': 'Fourth Year',
  'year 4': 'Fourth Year',
  '4th year': 'Fourth Year'
};

// Known college branches
export const VALID_BRANCHES = [
  'Computer Engineering',
  'Information Technology',
  'EXTC',
  'Electronics & Telecommunication',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Artificial Intelligence & Data Science',
  'Computer Science & Engineering'
];

// Sample template rows
export const SAMPLE_TEMPLATE_ROWS = [
  {
    'SAP ID': '60001260001',
    'Full Name': 'Aarav Ramesh Shah',
    'Roll Number': '26CE01',
    'Branch': 'Computer Engineering',
    'Academic Year': 'First Year',
    'Class Group': 'CE — Year 1 / A',
    'Division': 'A',
    'Enrollment Status': 'Enrolled'
  },
  {
    'SAP ID': '60001260002',
    'Full Name': 'Diya Mukesh Patel',
    'Roll Number': '26CE02',
    'Branch': 'Computer Engineering',
    'Academic Year': 'First Year',
    'Class Group': 'CE — Year 1 / A',
    'Division': 'A',
    'Enrollment Status': 'Enrolled'
  },
  {
    'SAP ID': '60001260003',
    'Full Name': 'Kabir Vikram Mehta',
    'Roll Number': '26IT01',
    'Branch': 'Information Technology',
    'Academic Year': 'First Year',
    'Class Group': 'IT — Year 1 / A',
    'Division': 'A',
    'Enrollment Status': 'Enrolled'
  },
  {
    'SAP ID': '60001250001',
    'Full Name': 'Ananya Rajesh Deshmukh',
    'Roll Number': '25EX01',
    'Branch': 'EXTC',
    'Academic Year': 'Second Year',
    'Class Group': 'EXTC — Year 2 / A',
    'Division': 'A',
    'Enrollment Status': 'Enrolled'
  },
  {
    'SAP ID': '60001240051',
    'Full Name': 'Siddharth Nitin Joshi',
    'Roll Number': '24EE01',
    'Branch': 'Electrical Engineering',
    'Academic Year': 'Third Year',
    'Class Group': 'EE — Year 3 / A',
    'Division': 'A',
    'Enrollment Status': 'Enrolled'
  }
];

/**
 * Generates sample template buffer (CSV or XLSX)
 */
export function generateSampleTemplate(format = 'xlsx') {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(SAMPLE_TEMPLATE_ROWS);

  // Set explicit column widths for readability
  ws['!cols'] = [
    { wch: 16 }, // SAP ID
    { wch: 28 }, // Full Name
    { wch: 14 }, // Roll Number
    { wch: 26 }, // Branch
    { wch: 16 }, // Academic Year
    { wch: 22 }, // Class Group
    { wch: 10 }, // Division
    { wch: 18 }  // Enrollment Status
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Student Roster Template');

  if (format === 'csv') {
    return XLSX.utils.sheet_to_csv(ws);
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Normalizes and extracts string safely from any cell value, preserving leading zeros
 */
export function cleanString(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

/**
 * Parses raw CSV or XLSX buffer into structured array of row objects
 */
export function parseRosterBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', raw: false, cellText: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('Uploaded spreadsheet does not contain any sheets.');

  const ws = wb.Sheets[sheetName];
  // Parse rows as raw 2D array or objects with header row
  const rawRows = XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' });
  if (!rawRows || rawRows.length === 0) {
    throw new Error('Spreadsheet is empty. No student rows found.');
  }

  // Map flexible column headers to standardized keys
  return rawRows.map((row, index) => {
    const rowKeys = Object.keys(row);
    const getVal = (possibleNames) => {
      for (const name of possibleNames) {
        const found = rowKeys.find(k => k.trim().toLowerCase() === name.toLowerCase());
        if (found !== undefined && row[found] !== undefined) {
          return cleanString(row[found]);
        }
      }
      return '';
    };

    return {
      rowNumber: index + 2, // 1-indexed header + row index
      sapId: getVal(['SAP ID', 'sapId', 'sap_id', 'sap', 'institutional id', 'student id']),
      name: getVal(['Full Name', 'Name', 'Student Name', 'student_name', 'fullName']),
      rollNo: getVal(['Roll Number', 'Roll No', 'Roll', 'roll_no', 'rollNo']),
      branch: getVal(['Branch', 'Department', 'dept', 'branch_name']),
      academicYear: getVal(['Academic Year', 'Year', 'academic_year', 'year_of_study']),
      classGroup: getVal(['Class Group', 'Class', 'class_group', 'classGroup', 'batch']),
      division: getVal(['Division', 'Div', 'division_name']),
      enrollmentStatus: getVal(['Enrollment Status', 'Status', 'enrollment_status']) || 'Enrolled'
    };
  });
}

/**
 * Validates academic year string
 */
export function validateAcademicYear(yearStr) {
  if (!yearStr) return { valid: false, reason: 'Academic Year is missing' };
  const norm = yearStr.trim().toLowerCase();
  if (NORMALIZED_ACADEMIC_YEAR_MAP[norm]) {
    return { valid: true, normalized: NORMALIZED_ACADEMIC_YEAR_MAP[norm] };
  }
  return {
    valid: false,
    reason: `Invalid Academic Year "${yearStr}". Must be one of: First Year, Second Year, Third Year, Fourth Year (or FE, SE, TE, BE).`
  };
}

/**
 * Validates class group string
 */
export function validateClassGroup(classGroupStr) {
  if (!classGroupStr) return { valid: true, normalized: '' }; // optional
  const trimmed = classGroupStr.trim();
  // Valid pattern: e.g. "CE — Year 3 / A", "IT — Year 1 / B", "EXTC - Year 2 / A", "CE-A"
  // Needs to have at least department / year or division identifier
  if (trimmed.length < 2 || /^[^a-zA-Z0-9]+$/.test(trimmed)) {
    return { valid: false, reason: `Invalid Class Group "${classGroupStr}". Expected format like "CE — Year 3 / A".` };
  }
  return { valid: true, normalized: trimmed };
}

/**
 * Performs complete pre-commit validation of parsed roster rows
 * Compares against existing PostgreSQL database records without modifying anything
 */
export async function validateRosterRows(rows) {
  const validationReport = {
    totalRows: rows.length,
    validNewCount: 0,
    updateCandidatesCount: 0,
    identicalCount: 0,
    invalidCount: 0,
    validNew: [],
    updateCandidates: [],
    identical: [],
    invalid: [],
    summary: {}
  };

  const seenSapIds = new Map(); // sapId -> rowNumber
  const sapIdsToLookup = new Set();

  // First pass: in-memory field validation & intra-file duplicate detection
  const firstPassRows = [];

  for (const r of rows) {
    const errors = [];

    // SAP ID validation
    if (!r.sapId) {
      errors.push('SAP ID is mandatory.');
    } else {
      if (seenSapIds.has(r.sapId)) {
        errors.push(`Duplicate SAP ID "${r.sapId}" within file (previously seen on row ${seenSapIds.get(r.sapId)}).`);
      } else {
        seenSapIds.set(r.sapId, r.rowNumber);
        sapIdsToLookup.add(r.sapId);
      }
    }

    // Name validation
    if (!r.name) {
      errors.push('Full Name is mandatory.');
    } else if (r.name.length < 2) {
      errors.push('Full Name must be at least 2 characters.');
    }

    // Academic Year validation
    let normalizedYear = r.academicYear;
    if (r.academicYear) {
      const yearCheck = validateAcademicYear(r.academicYear);
      if (!yearCheck.valid) {
        errors.push(yearCheck.reason);
      } else {
        normalizedYear = yearCheck.normalized;
      }
    }

    // Class Group validation
    let normalizedClassGroup = r.classGroup;
    if (r.classGroup) {
      const classCheck = validateClassGroup(r.classGroup);
      if (!classCheck.valid) {
        errors.push(classCheck.reason);
      } else {
        normalizedClassGroup = classCheck.normalized;
      }
    }

    if (errors.length > 0) {
      validationReport.invalid.push({
        rowNumber: r.rowNumber,
        sapId: r.sapId,
        name: r.name,
        rollNo: r.rollNo,
        branch: r.branch,
        academicYear: r.academicYear,
        classGroup: r.classGroup,
        division: r.division,
        enrollmentStatus: r.enrollmentStatus,
        errors
      });
    } else {
      firstPassRows.push({
        ...r,
        academicYear: normalizedYear,
        classGroup: normalizedClassGroup
      });
    }
  }

  // Second pass: query existing students from database by SAP IDs
  const isOnline = await testDatabaseConnection();
  const existingMap = new Map();

  if (isOnline && sapIdsToLookup.size > 0) {
    const sapList = Array.from(sapIdsToLookup);
    const CHUNK_SIZE = 1000;
    for (let i = 0; i < sapList.length; i += CHUNK_SIZE) {
      const chunk = sapList.slice(i, i + CHUNK_SIZE);
      const existingStudents = await prisma.student.findMany({
        where: { sapId: { in: chunk } },
        select: {
          id: true,
          sapId: true,
          name: true,
          rollNo: true,
          branch: true,
          classGroup: true,
          academicYear: true,
          division: true,
          enrollmentStatus: true
        }
      });
      for (const ex of existingStudents) {
        existingMap.set(ex.sapId, ex);
      }
    }
  }

  // Categorize valid rows into New vs Update Candidates
  for (const r of firstPassRows) {
    const existing = existingMap.get(r.sapId);

    if (!existing) {
      // Brand new student to be inserted
      validationReport.validNew.push({
        rowNumber: r.rowNumber,
        sapId: r.sapId,
        name: r.name,
        rollNo: r.rollNo,
        branch: r.branch,
        academicYear: r.academicYear,
        classGroup: r.classGroup,
        division: r.division,
        enrollmentStatus: r.enrollmentStatus
      });
    } else {
      // SAP ID exists in PostgreSQL! Check if fields differ or if it's identical
      const diffs = [];
      if (r.name && r.name !== existing.name) {
        diffs.push({ field: 'Full Name', current: existing.name, proposed: r.name });
      }
      if (r.rollNo && r.rollNo !== (existing.rollNo || '')) {
        diffs.push({ field: 'Roll Number', current: existing.rollNo || '—', proposed: r.rollNo });
      }
      if (r.branch && r.branch !== (existing.branch || '')) {
        diffs.push({ field: 'Branch', current: existing.branch || '—', proposed: r.branch });
      }
      if (r.academicYear && r.academicYear !== (existing.academicYear || '')) {
        diffs.push({ field: 'Academic Year', current: existing.academicYear || '—', proposed: r.academicYear });
      }
      if (r.classGroup && r.classGroup !== (existing.classGroup || '')) {
        diffs.push({ field: 'Class Group', current: existing.classGroup || '—', proposed: r.classGroup });
      }
      if (r.division && r.division !== (existing.division || '')) {
        diffs.push({ field: 'Division', current: existing.division || '—', proposed: r.division });
      }
      if (r.enrollmentStatus && r.enrollmentStatus !== (existing.enrollmentStatus || '')) {
        diffs.push({ field: 'Enrollment Status', current: existing.enrollmentStatus || '—', proposed: r.enrollmentStatus });
      }

      if (diffs.length > 0) {
        validationReport.updateCandidates.push({
          rowNumber: r.rowNumber,
          studentId: existing.id,
          sapId: r.sapId,
          name: r.name,
          rollNo: r.rollNo,
          branch: r.branch,
          academicYear: r.academicYear,
          classGroup: r.classGroup,
          division: r.division,
          enrollmentStatus: r.enrollmentStatus,
          existingRecord: existing,
          diffs
        });
      } else {
        validationReport.identical.push({
          rowNumber: r.rowNumber,
          studentId: existing.id,
          sapId: r.sapId,
          name: r.name,
          rollNo: r.rollNo,
          branch: r.branch
        });
      }
    }
  }

  validationReport.validNewCount = validationReport.validNew.length;
  validationReport.updateCandidatesCount = validationReport.updateCandidates.length;
  validationReport.identicalCount = validationReport.identical.length;
  validationReport.invalidCount = validationReport.invalid.length;

  validationReport.summary = {
    total: validationReport.totalRows,
    newStudents: validationReport.validNewCount,
    updatesPending: validationReport.updateCandidatesCount,
    alreadyUpToDate: validationReport.identicalCount,
    errorsFound: validationReport.invalidCount
  };

  return validationReport;
}

/**
 * Executes confirmed bulk student roster import in safe batches using transactions
 * Modes:
 *  - 'create_only': only insert brand new students; skip existing SAP IDs
 *  - 'update_existing': insert brand new students AND update existing students with confirmed diffs
 */
export async function executeBulkImport({
  mode = 'create_only',
  validNew = [],
  updateCandidates = [],
  actor = 'Admin',
  filename = 'roster_upload'
}) {
  const startTime = Date.now();
  const summary = {
    totalProcessed: validNew.length + updateCandidates.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    failures: [],
    mode,
    durationMs: 0
  };

  const isOnline = await testDatabaseConnection();
  if (!isOnline) {
    throw new Error('Cannot commit bulk import: PostgreSQL database connection is offline.');
  }

  const BATCH_SIZE = 500;

  // 1. Process New Students in batches
  if (validNew.length > 0) {
    for (let i = 0; i < validNew.length; i += BATCH_SIZE) {
      const chunk = validNew.slice(i, i + BATCH_SIZE);
      try {
        await prisma.$transaction(async (tx) => {
          // createMany avoids individual roundtrips
          await tx.student.createMany({
            data: chunk.map(s => ({
              sapId: s.sapId,
              name: s.name,
              rollNo: s.rollNo || null,
              branch: s.branch || null,
              academicYear: s.academicYear || null,
              classGroup: s.classGroup || null,
              division: s.division || null,
              enrollmentStatus: s.enrollmentStatus || 'Enrolled'
            })),
            skipDuplicates: true
          });
        }, {
          timeout: 30000
        });
        summary.created += chunk.length;
      } catch (err) {
        // Fallback to row-by-row in this chunk to isolate any failing record
        for (const s of chunk) {
          try {
            await prisma.student.create({
              data: {
                sapId: s.sapId,
                name: s.name,
                rollNo: s.rollNo || null,
                branch: s.branch || null,
                academicYear: s.academicYear || null,
                classGroup: s.classGroup || null,
                division: s.division || null,
                enrollmentStatus: s.enrollmentStatus || 'Enrolled'
              }
            });
            summary.created++;
          } catch (rowErr) {
            summary.failed++;
            summary.failures.push({
              sapId: s.sapId,
              name: s.name,
              reason: `Insert failed: ${rowErr.message}`
            });
          }
        }
      }
    }
  }

  // 2. Process Updates if mode is 'update_existing'
  if (updateCandidates.length > 0) {
    if (mode === 'update_existing') {
      for (let i = 0; i < updateCandidates.length; i += BATCH_SIZE) {
        const chunk = updateCandidates.slice(i, i + BATCH_SIZE);
        try {
          await prisma.$transaction(async (tx) => {
            for (const s of chunk) {
              await tx.student.update({
                where: { sapId: s.sapId },
                data: {
                  name: s.name,
                  rollNo: s.rollNo || undefined,
                  branch: s.branch || undefined,
                  academicYear: s.academicYear || undefined,
                  classGroup: s.classGroup || undefined,
                  division: s.division || undefined,
                  enrollmentStatus: s.enrollmentStatus || undefined
                }
              });
            }
          }, {
            timeout: 30000
          });
          summary.updated += chunk.length;
        } catch (err) {
          // Fallback to row-by-row in chunk
          for (const s of chunk) {
            try {
              await prisma.student.update({
                where: { sapId: s.sapId },
                data: {
                  name: s.name,
                  rollNo: s.rollNo || undefined,
                  branch: s.branch || undefined,
                  academicYear: s.academicYear || undefined,
                  classGroup: s.classGroup || undefined,
                  division: s.division || undefined,
                  enrollmentStatus: s.enrollmentStatus || undefined
                }
              });
              summary.updated++;
            } catch (updateErr) {
              summary.failed++;
              summary.failures.push({
                sapId: s.sapId,
                name: s.name,
                reason: `Update failed: ${updateErr.message}`
              });
            }
          }
        }
      }
    } else {
      // Mode is 'create_only': existing students are skipped safely without modifying them
      summary.skipped += updateCandidates.length;
    }
  }

  summary.durationMs = Date.now() - startTime;

  // Invalidate local in-memory student cache to ensure fresh reads
  studentCache.clear();

  // Record Audit Event
  try {
    await prisma.auditEvent.create({
      data: {
        id: `AUDIT-IMPORT-${Date.now()}`,
        action: 'Student Roster Bulk Import',
        details: `Imported roster "${filename}" [Mode: ${mode}]. Created: ${summary.created}, Updated: ${summary.updated}, Skipped: ${summary.skipped}, Failed: ${summary.failed} in ${summary.durationMs}ms.`,
        actor,
        timestamp: new Date()
      }
    });
  } catch (auditErr) {
    console.warn('[Audit] Could not record import audit event:', auditErr.message);
  }

  return summary;
}
