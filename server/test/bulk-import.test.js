import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {
  generateSampleTemplate,
  parseRosterBuffer,
  validateRosterRows,
  executeBulkImport,
  cleanString,
  validateAcademicYear,
  validateClassGroup
} from '../src/roster-import.js';
import { prisma, testDatabaseConnection } from '../src/db.js';

test('Bulk Import - cleanString preserves strings and leading zeros', () => {
  assert.equal(cleanString('  0012345  '), '0012345');
  assert.equal(cleanString(12345), '12345');
  assert.equal(cleanString(null), '');
  assert.equal(cleanString(undefined), '');
});

test('Bulk Import - Sample Template Generation', () => {
  // CSV Template
  const csv = generateSampleTemplate('csv');
  assert.ok(csv.includes('SAP ID,Full Name,Roll Number,Branch,Academic Year,Class Group,Division,Enrollment Status'));
  assert.ok(csv.includes('60001260001'));

  // XLSX Template
  const xlsxBuf = generateSampleTemplate('xlsx');
  assert.ok(Buffer.isBuffer(xlsxBuf));
  const wb = XLSX.read(xlsxBuf, { type: 'buffer' });
  assert.ok(wb.SheetNames.includes('Student Roster Template'));
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Student Roster Template']);
  assert.ok(rows.length >= 3);
  assert.equal(rows[0]['SAP ID'], '60001260001');
});

test('Bulk Import - Academic Year Validation & Normalization', () => {
  assert.deepEqual(validateAcademicYear('First Year'), { valid: true, normalized: 'First Year' });
  assert.deepEqual(validateAcademicYear('FE'), { valid: true, normalized: 'First Year' });
  assert.deepEqual(validateAcademicYear('se'), { valid: true, normalized: 'Second Year' });
  assert.deepEqual(validateAcademicYear('Year 3'), { valid: true, normalized: 'Third Year' });
  assert.deepEqual(validateAcademicYear('BE'), { valid: true, normalized: 'Fourth Year' });

  const invalid = validateAcademicYear('Grade 11');
  assert.equal(invalid.valid, false);
  assert.ok(invalid.reason.includes('Invalid Academic Year'));
});

test('Bulk Import - Pre-Commit Validation detects missing fields and intra-file duplicates', async () => {
  const testRows = [
    // Row 1: Valid
    {
      rowNumber: 2,
      sapId: '60009990001',
      name: 'Valid New Student',
      rollNo: '24CE99',
      branch: 'Computer Engineering',
      academicYear: 'Third Year',
      classGroup: 'CE — Year 3 / A',
      division: 'A',
      enrollmentStatus: 'Enrolled'
    },
    // Row 2: Missing SAP ID
    {
      rowNumber: 3,
      sapId: '',
      name: 'No SAP ID Student',
      rollNo: '24CE98',
      branch: 'Computer Engineering',
      academicYear: 'Third Year',
      classGroup: 'CE — Year 3 / A',
      division: 'A',
      enrollmentStatus: 'Enrolled'
    },
    // Row 3: Missing Name
    {
      rowNumber: 4,
      sapId: '60009990002',
      name: '',
      rollNo: '24CE97',
      branch: 'Computer Engineering',
      academicYear: 'Third Year',
      classGroup: 'CE — Year 3 / A',
      division: 'A',
      enrollmentStatus: 'Enrolled'
    },
    // Row 4: Duplicate SAP ID in file
    {
      rowNumber: 5,
      sapId: '60009990001',
      name: 'Duplicate SAP Student',
      rollNo: '24CE96',
      branch: 'Computer Engineering',
      academicYear: 'Third Year',
      classGroup: 'CE — Year 3 / A',
      division: 'A',
      enrollmentStatus: 'Enrolled'
    },
    // Row 5: Invalid Academic Year
    {
      rowNumber: 6,
      sapId: '60009990003',
      name: 'Invalid Year Student',
      rollNo: '24CE95',
      branch: 'Computer Engineering',
      academicYear: 'Twelfth Grade',
      classGroup: 'CE — Year 3 / A',
      division: 'A',
      enrollmentStatus: 'Enrolled'
    }
  ];

  const report = await validateRosterRows(testRows);
  assert.equal(report.totalRows, 5);
  assert.equal(report.validNewCount, 1);
  assert.equal(report.validNew[0].sapId, '60009990001');

  assert.equal(report.invalidCount, 4);
  const row3Err = report.invalid.find(r => r.rowNumber === 3);
  assert.ok(row3Err.errors.some(e => e.includes('SAP ID is mandatory')));

  const row4Err = report.invalid.find(r => r.rowNumber === 4);
  assert.ok(row4Err.errors.some(e => e.includes('Full Name is mandatory')));

  const row5Err = report.invalid.find(r => r.rowNumber === 5);
  assert.ok(row5Err.errors.some(e => e.includes('Duplicate SAP ID')));

  const row6Err = report.invalid.find(r => r.rowNumber === 6);
  assert.ok(row6Err.errors.some(e => e.includes('Invalid Academic Year')));
});

test('Bulk Import - Conflict Detection with existing database record', async () => {
  const isOnline = await testDatabaseConnection();
  if (!isOnline) return;

  // STU-001 has sapId: '60001240001', name: 'Riya Shah'
  const rows = [
    {
      rowNumber: 2,
      sapId: '60001240001',
      name: 'Riya R. Shah Modified',
      rollNo: '24CE01-MOD',
      branch: 'Computer Engineering',
      academicYear: 'Third Year',
      classGroup: 'CE — Year 3 / A',
      division: 'A',
      enrollmentStatus: 'Enrolled'
    }
  ];

  const report = await validateRosterRows(rows);
  assert.equal(report.updateCandidatesCount, 1);
  const cand = report.updateCandidates[0];
  assert.equal(cand.sapId, '60001240001');
  assert.ok(cand.diffs.some(d => d.field === 'Full Name' && d.current === 'Riya Shah'));
  assert.ok(cand.diffs.some(d => d.field === 'Roll Number' && d.proposed === '24CE01-MOD'));
});

test('Bulk Import - Mode "create_only" skips existing students without modifying them', async () => {
  const isOnline = await testDatabaseConnection();
  if (!isOnline) return;

  const originalStudent = await prisma.student.findUnique({
    where: { sapId: '60001240001' }
  });
  assert.ok(originalStudent, 'STU-001 should exist in DB');

  const summary = await executeBulkImport({
    mode: 'create_only',
    validNew: [],
    updateCandidates: [{
      sapId: '60001240001',
      name: 'Unwanted Overwrite Name',
      rollNo: '999999'
    }],
    actor: 'Admin',
    filename: 'test_create_only.xlsx'
  });

  assert.equal(summary.created, 0);
  assert.equal(summary.updated, 0);
  assert.equal(summary.skipped, 1);

  // Verify DB record remained unchanged!
  const afterStudent = await prisma.student.findUnique({
    where: { sapId: '60001240001' }
  });
  assert.equal(afterStudent.name, originalStudent.name);
  assert.equal(afterStudent.rollNo, originalStudent.rollNo);
});
