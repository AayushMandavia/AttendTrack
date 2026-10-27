import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { syntheticStudents50 } from '../prisma/synthetic-students-50.js';
import { seed50Students } from '../prisma/seed-50-students.js';
import { matchStudentToRoster } from '../src/docx-parser.js';
import { getStudents, findStudentById, testDatabaseConnection } from '../src/db.js';

describe('Synthetic 50-Student Dataset: Data Integrity & Identifier Verification', () => {
  test('contains exactly 50 student records', () => {
    assert.equal(syntheticStudents50.length, 50, 'Dataset must have exactly 50 students');
  });

  test('all student IDs are strictly unique and match STU-001 through STU-050', () => {
    const ids = syntheticStudents50.map(s => s.id);
    const uniqueIds = new Set(ids);
    assert.equal(uniqueIds.size, 50, 'All student IDs must be unique');

    for (let i = 1; i <= 50; i++) {
      const expectedId = `STU-${String(i).padStart(3, '0')}`;
      assert.ok(uniqueIds.has(expectedId), `Must contain ID ${expectedId}`);
    }
  });

  test('all roll numbers are strictly unique across engineering branches', () => {
    const rollNumbers = syntheticStudents50.map(s => s.rollNo);
    const uniqueRolls = new Set(rollNumbers);
    assert.equal(uniqueRolls.size, 50, 'All roll numbers must be unique');

    // Verify branch prefixes
    const ceRolls = rollNumbers.filter(r => r.startsWith('24CE'));
    const itRolls = rollNumbers.filter(r => r.startsWith('24IT'));
    const exRolls = rollNumbers.filter(r => r.startsWith('24EX'));
    const eeRolls = rollNumbers.filter(r => r.startsWith('24EE'));
    const meRolls = rollNumbers.filter(r => r.startsWith('24ME'));

    assert.equal(ceRolls.length, 12, '12 Computer Engineering roll numbers');
    assert.equal(itRolls.length, 10, '10 Information Technology roll numbers');
    assert.equal(exRolls.length, 10, '10 EXTC roll numbers');
    assert.equal(eeRolls.length, 9, '9 Electrical Engineering roll numbers');
    assert.equal(meRolls.length, 9, '9 Mechanical Engineering roll numbers');
  });

  test('all SAP IDs are strictly unique 11-digit strings', () => {
    const sapIds = syntheticStudents50.map(s => s.sapId);
    const uniqueSaps = new Set(sapIds);
    assert.equal(uniqueSaps.size, 50, 'All SAP IDs must be unique');

    for (const sap of sapIds) {
      assert.match(sap, /^6000124\d{4}$/, `SAP ID ${sap} must match expected 11-digit institutional format`);
    }
  });

  test('covers all 5 engineering branches with valid names and branches', () => {
    const branches = new Set(syntheticStudents50.map(s => s.branch));
    assert.ok(branches.has('Computer Engineering'));
    assert.ok(branches.has('Information Technology'));
    assert.ok(branches.has('EXTC'));
    assert.ok(branches.has('Electrical Engineering'));
    assert.ok(branches.has('Mechanical Engineering'));

    for (const s of syntheticStudents50) {
      assert.ok(s.name && s.name.length >= 3, `Student ${s.id} must have a valid full name`);
      assert.ok(s.branch && s.branch.length >= 3, `Student ${s.id} must have a valid branch`);
    }
  });
});

describe('Synthetic 50-Student Dataset: PostgreSQL Integration & Idempotency', () => {
  test('persists all 50 synthetic students in PostgreSQL with branch, roll number, and SAP ID', async () => {
    const online = await testDatabaseConnection();
    if (!online) {
      console.log('Skipping PostgreSQL test: database offline.');
      return;
    }

    const students = await getStudents();
    assert.ok(students.length >= 50, `Database must contain at least 50 students (found: ${students.length})`);

    // Verify a sample student from each department in PostgreSQL
    const ce = await findStudentById('STU-001');
    assert.ok(ce);
    assert.equal(ce.name, 'Riya Shah');
    assert.equal(ce.branch, 'Computer Engineering');
    assert.equal(ce.rollNo, '24CE01');
    assert.equal(ce.sapId, '60001240001');

    const it = await findStudentById('STU-015');
    assert.ok(it);
    assert.equal(it.name, 'Ishita Roy');
    assert.equal(it.branch, 'Information Technology');
    assert.equal(it.rollNo, '24IT03');
    assert.equal(it.sapId, '60001240015');

    const extc = await findStudentById('STU-023');
    assert.ok(extc);
    assert.equal(extc.name, 'Kavya Sen');
    assert.equal(extc.branch, 'EXTC');
    assert.equal(extc.rollNo, '24EX01');
    assert.equal(extc.sapId, '60001240023');

    const ee = await findStudentById('STU-033');
    assert.ok(ee);
    assert.equal(ee.name, 'Preeti Salunkhe');
    assert.equal(ee.branch, 'Electrical Engineering');
    assert.equal(ee.rollNo, '24EE01');

    const me = await findStudentById('STU-042');
    assert.ok(me);
    assert.equal(me.name, 'Omkar Sawant');
    assert.equal(me.branch, 'Mechanical Engineering');
    assert.equal(me.rollNo, '24ME01');
  });

  test('seeding is idempotent: re-running does not create duplicate student records', async () => {
    const online = await testDatabaseConnection();
    if (!online) return;

    const countBefore = (await getStudents()).length;
    const result = await seed50Students();

    assert.equal(result.createdCount, 0, 'Re-running seed must create 0 new students');
    assert.equal(result.updatedCount, 50, 'Re-running seed must update existing 50 students');

    const countAfter = (await getStudents()).length;
    assert.equal(countAfter, countBefore, 'Total student count in database must remain identical');
  });
});

describe('Synthetic 50-Student Dataset: Multi-Student Matching Engine Integration', () => {
  const roster = syntheticStudents50;

  test('matches candidate by verified SAP ID and exact name across departments', () => {
    const result = matchStudentToRoster('Varun Somani', '24IT02', '60001240014', roster);
    assert.equal(result.matchStatus, 'matched');
    assert.equal(result.matched.id, 'STU-014');
    assert.equal(result.matched.name, 'Varun Somani');
    assert.equal(result.matched.sapId, '60001240014');
  });

  test('blocks approval with SAP ID Required when SAP ID is missing', () => {
    const result = matchStudentToRoster('Omkar Sawant', '24ME01', '', roster);
    assert.equal(result.matchStatus, 'ambiguous');
    assert.equal(result.matched, null);
    assert.ok(result.note.includes('SAP ID Required'));
  });

  test('blocks approval with Unknown SAP ID when SAP ID is not in roster', () => {
    const result = matchStudentToRoster('Zoya Merchant', '', '99999999999', roster);
    assert.equal(result.matchStatus, 'unmatched');
    assert.equal(result.matched, null);
    assert.ok(result.note.includes('Unknown SAP ID'));
  });

  test('flags conflicting identifiers with explicit SAP ID / Name Mismatch', () => {
    // SAP 60001240005 belongs to Ananya Deshmukh (STU-005), but letter lists Sneha Bansal (STU-013)
    const result = matchStudentToRoster('Sneha Bansal', '24CE05', '60001240005', roster);
    assert.equal(result.matchStatus, 'ambiguous');
    assert.equal(result.matched, null);
    assert.ok(result.note.includes('SAP ID / Name Mismatch'));
  });

  test('marks non-enrolled attendee as unmatched', () => {
    const result = matchStudentToRoster('John External Visitor', 'EXT-999', '99001240999', roster);
    assert.equal(result.matchStatus, 'unmatched');
    assert.equal(result.matched, null);
  });
});
