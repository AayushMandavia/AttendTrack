import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

async function auditTimetable() {
  console.log('=== AUDITING ATTENDTRACK TIMETABLE & STUDENT DATA ===\n');

  // 1. Check student class groups
  const students = await prisma.student.findMany({
    select: { id: true, name: true, branch: true, classGroup: true, sapId: true }
  });
  console.log(`Total students in PostgreSQL: ${students.length}`);

  const studentCountByGroup = {};
  for (const s of students) {
    const cg = s.classGroup || 'NO_CLASS_GROUP';
    studentCountByGroup[cg] = (studentCountByGroup[cg] || 0) + 1;
  }
  console.log('Student count by class group:', studentCountByGroup);

  const distinctClassGroups = Object.keys(studentCountByGroup).sort();

  // 2. Query all timetable slots
  const slots = await prisma.timetableSlot.findMany({
    orderBy: [{ className: 'asc' }, { dayIndex: 'asc' }, { slotNumber: 'asc' }]
  });
  console.log(`\nTotal timetable slots in PostgreSQL: ${slots.length}`);

  // 3. Days and Slots Analysis
  const countByClassAndDay = {};
  const subjectsByClass = {};
  const facultyAssignmentsByClass = {};
  let lunchOverlapCount = 0;
  let nonOneHourSlots = 0;
  const duplicateMap = new Map();
  const duplicates = [];
  const invalidOperatingHours = [];

  for (const slot of slots) {
    const key = `${slot.className}_${slot.dayOfWeek}_${slot.slotNumber}`;
    if (duplicateMap.has(key)) {
      duplicates.push({ key, id1: duplicateMap.get(key), id2: slot.id });
    } else {
      duplicateMap.set(key, slot.id);
    }

    if (!countByClassAndDay[slot.className]) {
      countByClassAndDay[slot.className] = {};
      subjectsByClass[slot.className] = new Set();
      facultyAssignmentsByClass[slot.className] = new Set();
    }
    countByClassAndDay[slot.className][slot.dayOfWeek] = (countByClassAndDay[slot.className][slot.dayOfWeek] || 0) + 1;
    subjectsByClass[slot.className].add(slot.subject);
    facultyAssignmentsByClass[slot.className].add(`${slot.facultyName || 'Unknown'} (${slot.facultyId})`);

    // Check operating hours: 08:00 to 18:00
    if (slot.startTime < '08:00' || slot.endTime > '18:00') {
      invalidOperatingHours.push(slot);
    }

    // Check lunch overlap (13:00 to 14:00)
    if (slot.startTime === '13:00' || slot.endTime === '14:00' || (slot.startTime < '14:00' && slot.endTime > '13:00')) {
      lunchOverlapCount++;
    }

    // Check duration (exactly 1 hour)
    const [sh, sm] = slot.startTime.split(':').map(Number);
    const [eh, em] = slot.endTime.split(':').map(Number);
    const durationMinutes = (eh * 60 + em) - (sh * 60 + sm);
    if (durationMinutes !== 60) {
      nonOneHourSlots++;
    }
  }

  console.log('\n--- Slot Counts by Class Group and Working Day ---');
  for (const cg of Object.keys(countByClassAndDay)) {
    const days = countByClassAndDay[cg];
    const totalForCg = Object.values(days).reduce((a, b) => a + b, 0);
    console.log(`\nClass Group: "${cg}" (Total: ${totalForCg} slots)`);
    for (const [day, count] of Object.entries(days)) {
      console.log(`  - ${day}: ${count} slots`);
    }
  }

  console.log('\n--- Integrity & Constraint Checks ---');
  console.log(`- Duplicate slots found: ${duplicates.length}`);
  console.log(`- Lunch break overlaps (13:00 - 14:00): ${lunchOverlapCount}`);
  console.log(`- Non-1-hour slots: ${nonOneHourSlots}`);
  console.log(`- Out of operating hours (08:00 - 18:00): ${invalidOperatingHours.length}`);

  // 4. Missing class group schedules check
  const missingClassGroups = distinctClassGroups.filter(cg => !countByClassAndDay[cg]);
  console.log(`- Missing class groups without schedules: ${missingClassGroups.length > 0 ? missingClassGroups.join(', ') : 'None'}`);

  // 5. Subject curriculum check
  console.log('\n--- Curriculum & Faculty by Class Group ---');
  for (const [cg, subs] of Object.entries(subjectsByClass)) {
    console.log(`\nClass Group: "${cg}"`);
    console.log(`  Subjects (${subs.size}): ${[...subs].join(', ')}`);
    console.log(`  Faculty (${facultyAssignmentsByClass[cg].size}): ${[...facultyAssignmentsByClass[cg]].join(', ')}`);
  }

  // 6. Check simultaneous faculty conflicts
  const facultyConflictMap = {};
  let facultyConflictCount = 0;
  for (const slot of slots) {
    const key = `${slot.dayOfWeek}_${slot.slotNumber}_${slot.facultyId}`;
    if (!facultyConflictMap[key]) {
      facultyConflictMap[key] = [];
    }
    facultyConflictMap[key].push(slot);
    if (facultyConflictMap[key].length > 1) {
      facultyConflictCount++;
      console.warn(`[Conflict] Faculty ${slot.facultyId} double-booked on ${slot.dayOfWeek} slot ${slot.slotNumber} (${slot.startTime}-${slot.endTime}) between:`,
        facultyConflictMap[key].map(s => s.className).join(' AND ')
      );
    }
  }
  console.log(`\n- Faculty simultaneous lecture conflicts: ${facultyConflictCount}`);

  // 7. Check dated lectures vs recurring slots separation
  const datedLectures = await prisma.lecture.findMany();
  console.log(`\nDated lectures in database: ${datedLectures.length}`);
  for (const dl of datedLectures) {
    console.log(`  - ${dl.id}: "${dl.subject}" on ${dl.date} (${dl.startTime}-${dl.endTime}) for ${dl.className} [linked timetable slot: ${dl.timetableSlotId || 'None'}]`);
  }
}

auditTimetable()
  .catch(err => {
    console.error('Audit failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
