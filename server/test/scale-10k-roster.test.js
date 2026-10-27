import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {
  parseRosterBuffer,
  validateRosterRows,
  executeBulkImport
} from '../src/roster-import.js';
import { prisma, testDatabaseConnection, getStudentsPaginated } from '../src/db.js';

test('10,000 Synthetic Student Scale & Performance Test', async (t) => {
  const isOnline = await testDatabaseConnection();
  if (!isOnline) {
    t.skip('PostgreSQL database is offline');
    return;
  }

  const initialCount = await prisma.student.count();
  console.log(`\n[Scale Test] Starting 10,000 Student Test. Initial DB Count: ${initialCount}`);
  assert.ok(initialCount >= 50, 'Baseline students must be at least 50 before scale test');

  // 1. Generate 10,000 synthetic student records in isolated range: 80001000001 to 80001010000
  const branches = [
    { name: 'Computer Engineering', code: 'CE' },
    { name: 'Information Technology', code: 'IT' },
    { name: 'EXTC', code: 'EX' },
    { name: 'Electrical Engineering', code: 'EE' },
    { name: 'Mechanical Engineering', code: 'ME' }
  ];
  const years = ['First Year', 'Second Year', 'Third Year', 'Fourth Year'];
  const divisions = ['A', 'B'];

  const synthetic10k = [];
  const TOTAL_SYNTHETIC = 10000;

  for (let i = 1; i <= TOTAL_SYNTHETIC; i++) {
    const branchObj = branches[(i - 1) % branches.length];
    const yearIdx = Math.floor((i - 1) / branches.length) % years.length;
    const year = years[yearIdx];
    const div = divisions[i % divisions.length];
    const sapId = `80001${String(i).padStart(6, '0')}`;
    const rollNo = `26${branchObj.code}${String(i % 100).padStart(2, '0')}`;

    synthetic10k.push({
      'SAP ID': sapId,
      'Full Name': `Synthetic Student ${i}`,
      'Roll Number': rollNo,
      'Branch': branchObj.name,
      'Academic Year': year,
      'Class Group': `${branchObj.code} — Year ${yearIdx + 1} / ${div}`,
      'Division': div,
      'Enrollment Status': 'Enrolled'
    });
  }

  // 2. Generate CSV buffer for the 10,000 records
  const t0 = Date.now();
  const ws = XLSX.utils.json_to_sheet(synthetic10k);
  const csvBuffer = Buffer.from(XLSX.utils.sheet_to_csv(ws), 'utf-8');
  const csvGenDuration = Date.now() - t0;
  console.log(`[Scale Test] Generated 10,000 CSV buffer (${(csvBuffer.length / (1024 * 1024)).toFixed(2)} MB) in ${csvGenDuration}ms`);

  // 3. Parse buffer
  const t1 = Date.now();
  const parsedRows = parseRosterBuffer(csvBuffer);
  const parseDuration = Date.now() - t1;
  assert.equal(parsedRows.length, TOTAL_SYNTHETIC);
  console.log(`[Scale Test] Parsed 10,000 rows in ${parseDuration}ms`);

  // 4. Pre-commit validation
  const t2 = Date.now();
  const validationReport = await validateRosterRows(parsedRows);
  const valDuration = Date.now() - t2;
  console.log(`[Scale Test] Validated 10,000 rows in ${valDuration}ms:`);
  console.log(`  - Valid New: ${validationReport.validNewCount}`);
  console.log(`  - Update Candidates: ${validationReport.updateCandidatesCount}`);
  console.log(`  - Invalid Rows: ${validationReport.invalidCount}`);

  assert.equal(validationReport.validNewCount, TOTAL_SYNTHETIC);
  assert.equal(validationReport.invalidCount, 0);

  // 5. Execute Bulk Import in batches of 500
  const t3 = Date.now();
  const importSummary = await executeBulkImport({
    mode: 'create_only',
    validNew: validationReport.validNew,
    updateCandidates: [],
    actor: 'Scale Test Runner',
    filename: 'synthetic_10k_students.csv'
  });
  const importDuration = Date.now() - t3;
  console.log(`[Scale Test] Bulk imported 10,000 students to PostgreSQL in ${importDuration}ms (Throughput: ${(TOTAL_SYNTHETIC / (importDuration / 1000)).toFixed(1)} students/sec)`);

  assert.equal(importSummary.created, TOTAL_SYNTHETIC);
  assert.equal(importSummary.failed, 0);

  // 6. Verify PostgreSQL count
  const countAfterImport = await prisma.student.count();
  console.log(`[Scale Test] PostgreSQL Count After Import: ${countAfterImport} (Expected: ${initialCount + TOTAL_SYNTHETIC})`);
  assert.equal(countAfterImport, initialCount + TOTAL_SYNTHETIC);

  // 7. Verify Server-Side Search and Pagination
  const page1 = await getStudentsPaginated({ page: 1, limit: 25 });
  assert.equal(page1.students.length, 25);
  assert.equal(page1.pagination.total, countAfterImport);

  // Search by SAP ID in isolated range
  const searchBySap = await getStudentsPaginated({ search: '80001005000' });
  assert.equal(searchBySap.students.length, 1);
  assert.equal(searchBySap.students[0].name, 'Synthetic Student 5000');

  // Search by Branch
  const ceStudents = await getStudentsPaginated({ branch: 'Computer Engineering', limit: 10 });
  assert.equal(ceStudents.students.length, 10);
  assert.ok(ceStudents.pagination.total >= 2000);

  // 8. Test Re-importing same roster in 'create_only' mode: must NOT create duplicates
  const secondValidation = await validateRosterRows(parsedRows);
  assert.equal(secondValidation.validNewCount, 0);
  assert.equal(secondValidation.identicalCount, TOTAL_SYNTHETIC);

  // 9. Clean up ONLY the isolated synthetic test records (SAP ID starting with 80001)
  console.log('[Scale Test] Cleaning up isolated test records...');
  const deleteResult = await prisma.student.deleteMany({
    where: {
      sapId: {
        startsWith: '80001'
      }
    }
  });
  console.log(`[Scale Test] Deleted ${deleteResult.count} synthetic test students.`);

  // 10. Verify original 50 students remain completely intact
  const finalCount = await prisma.student.count();
  console.log(`[Scale Test] Final PostgreSQL Count: ${finalCount}`);
  assert.equal(finalCount, initialCount, 'Baseline students must remain exactly 50');

  const originalStudent = await prisma.student.findUnique({
    where: { sapId: '60001240001' }
  });
  assert.ok(originalStudent);
  assert.equal(originalStudent.name, 'Riya Shah');
  await prisma.$disconnect();
});
