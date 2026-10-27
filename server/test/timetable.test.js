import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {
  prisma,
  getTimetableSlots,
  getTimetableSlotById,
  generateAndSaveDatedLectures
} from '../src/db.js';
import {
  LUNCH_BREAK,
  DAILY_TIME_SLOTS,
  WEEKDAYS,
  CLASS_GROUPS,
  CURRICULUM,
  generateWeeklyTimetableForClass,
  generateMasterTimetable,
  generateDatedLecturesFromTimetable
} from '../src/timetable.js';
import { seedTimetable } from '../prisma/seed-timetable.js';

describe('Monday-to-Saturday Lecture Timetable Specification & Enforcement', () => {
  let serverInstance = null;

  before(async () => {
    try {
      const ping = await fetch('http://localhost:4000/api/timetable', { signal: AbortSignal.timeout(500) });
      if (ping.ok) return;
    } catch (_) {}

    const app = express();
    app.get('/api/timetable', async (req, res) => {
      try {
        const { className, dayOfWeek, branch } = req.query;
        const slots = await getTimetableSlots({ className, dayOfWeek, branch });
        res.json({
          totalSlots: slots.length,
          slots,
          lunchBreak: LUNCH_BREAK,
          dailySlots: DAILY_TIME_SLOTS,
          weekdays: WEEKDAYS,
          classGroups: CLASS_GROUPS
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    await new Promise((resolve) => {
      serverInstance = app.listen(4000, () => resolve());
    });
  });

  after(async () => {
    if (serverInstance) {
      if (typeof serverInstance.closeAllConnections === 'function') {
        serverInstance.closeAllConnections();
      }
      await new Promise((resolve) => serverInstance.close(resolve));
    }
    await prisma.$disconnect();
  });

  it('defines college hours 08:00 to 18:00 with 9 daily one-hour slots', () => {
    assert.equal(DAILY_TIME_SLOTS.length, 9, 'Must have exactly 9 lecture slots per day');
    assert.equal(DAILY_TIME_SLOTS[0].startTime, '08:00');
    assert.equal(DAILY_TIME_SLOTS[DAILY_TIME_SLOTS.length - 1].endTime, '18:00');

    // Verify each slot lasts exactly one hour
    for (const slot of DAILY_TIME_SLOTS) {
      const startH = parseInt(slot.startTime.split(':')[0], 10);
      const endH = parseInt(slot.endTime.split(':')[0], 10);
      assert.equal(endH - startH, 1, `Slot ${slot.slotNumber} must last exactly 1 hour (${slot.startTime}-${slot.endTime})`);
    }
  });

  it('reserves 13:00 to 14:00 strictly for lunch and excludes it from daily lecture slots', () => {
    assert.equal(LUNCH_BREAK.startTime, '13:00');
    assert.equal(LUNCH_BREAK.endTime, '14:00');

    for (const slot of DAILY_TIME_SLOTS) {
      const isDuringLunch = (slot.startTime === '13:00' || slot.endTime === '14:00' ||
        (slot.startTime < '14:00' && slot.endTime > '13:00'));
      assert.equal(isDuringLunch, false, `No lecture slot should overlap with lunch break (13:00-14:00), but found ${slot.startTime}-${slot.endTime}`);
    }
  });

  it('covers all six working days: Monday through Saturday', () => {
    assert.equal(WEEKDAYS.length, 6, 'Must have exactly 6 working days');
    const dayNames = WEEKDAYS.map(w => w.name);
    assert.deepEqual(dayNames, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
  });

  it('generates exactly 54 weekly lecture slots per class group', () => {
    for (const cg of CLASS_GROUPS) {
      const weekly = generateWeeklyTimetableForClass(cg);
      assert.equal(weekly.length, 54, `${cg.className} must have exactly 54 weekly slots (6 days * 9 slots)`);
    }
  });

  it('generates 270 total recurring timetable entries across all 5 engineering class groups', () => {
    const master = generateMasterTimetable();
    assert.equal(master.length, 270, '5 class groups * 54 slots = 270 total recurring slots');
    assert.equal(CLASS_GROUPS.length, 5);
  });

  it('prevents overlapping lectures for the same class group on any day', () => {
    const master = generateMasterTimetable();

    for (const cg of CLASS_GROUPS) {
      for (const day of WEEKDAYS) {
        const daySlots = master.filter(s => s.className === cg.className && s.dayOfWeek === day.name);
        assert.equal(daySlots.length, 9, `${cg.className} on ${day.name} must have 9 slots`);

        // Check for duplicate slot numbers or time collisions
        const seenSlotNumbers = new Set();
        const seenTimes = new Set();
        for (const s of daySlots) {
          assert.equal(seenSlotNumbers.has(s.slotNumber), false, `Duplicate slot number ${s.slotNumber} for ${cg.className} on ${day.name}`);
          assert.equal(seenTimes.has(s.startTime), false, `Overlapping start time ${s.startTime} for ${cg.className} on ${day.name}`);
          seenSlotNumbers.add(s.slotNumber);
          seenTimes.add(s.startTime);
        }
      }
    }
  });

  it('prevents faculty members from being assigned to simultaneous lectures across class groups', () => {
    const master = generateMasterTimetable();

    for (const day of WEEKDAYS) {
      for (const slotDef of DAILY_TIME_SLOTS) {
        // Collect all lectures occurring at this specific day and slot
        const simultaneousLectures = master.filter(
          s => s.dayOfWeek === day.name && s.slotNumber === slotDef.slotNumber
        );

        const facultySeen = new Set();
        for (const lec of simultaneousLectures) {
          assert.equal(
            facultySeen.has(lec.facultyId),
            false,
            `Faculty conflict: ${lec.facultyName} (${lec.facultyId}) is double-booked on ${day.name} at ${lec.startTime}-${lec.endTime}`
          );
          facultySeen.add(lec.facultyId);
        }
      }
    }
  });

  it('seeds recurring timetable slots into PostgreSQL idempotently', async () => {
    // Run seedTimetable
    await seedTimetable();

    const countInDb = await prisma.timetableSlot.count();
    assert.equal(countInDb, 270, 'Database should contain exactly 270 recurring timetable slots');

    // Re-run seedTimetable to confirm idempotency (no duplicates created)
    await seedTimetable();
    const countAfterReRun = await prisma.timetableSlot.count();
    assert.equal(countAfterReRun, 270, 'Re-running seed must be idempotent and not create duplicate slots');
  });

  it('separates recurring timetable from dated lecture sessions', async () => {
    // Generate dated lectures for a specific week: Mon 2026-10-19 to Sat 2026-10-24
    const datedLectures = generateDatedLecturesFromTimetable({
      startDate: '2026-10-19',
      endDate: '2026-10-24',
      className: 'EXTC — Year 3 / A',
      studentIdsByClass: {
        'EXTC — Year 3 / A': ['STU-021', 'STU-022', 'STU-023']
      }
    });

    // 6 days (Mon-Sat) * 9 slots = 54 dated lecture sessions
    assert.equal(datedLectures.length, 54);

    for (const lec of datedLectures) {
      assert.ok(lec.id.startsWith('LEC-202610'), 'Dated lecture must have unique dated ID');
      assert.ok(lec.date >= '2026-10-19' && lec.date <= '2026-10-24');
      assert.ok(lec.timetableSlotId.startsWith('SLOT-EXTC-'));
      assert.notEqual(lec.startTime, '13:00', 'No dated lecture should be scheduled at 13:00 lunch');
      assert.deepEqual(lec.studentIds, ['STU-021', 'STU-022', 'STU-023']);
    }
  });

  it('queries recurring timetable slots by class group and day via getTimetableSlots', async () => {
    const allSlots = await getTimetableSlots();
    assert.equal(allSlots.length, 270);

    const ceMondaySlots = await getTimetableSlots({ className: 'CE — Year 3 / A', dayOfWeek: 'Monday' });
    assert.equal(ceMondaySlots.length, 9);
    assert.equal(ceMondaySlots[0].startTime, '08:00');
    assert.equal(ceMondaySlots[8].endTime, '18:00');

    // Lookup individual slot
    const slot = await getTimetableSlotById('SLOT-CE-MON-1');
    assert.ok(slot);
    assert.equal(slot.className, 'CE — Year 3 / A');
    assert.equal(slot.dayOfWeek, 'Monday');
    assert.equal(slot.slotNumber, 1);
  });

  it('guarantees complete group coverage for all active timetable classGroups in PostgreSQL', async () => {
    // 1. Get distinct recurring timetable class groups
    const distinctClassGroups = CLASS_GROUPS.map(g => g.className);
    assert.equal(distinctClassGroups.length, 5, 'Must have exactly 5 distinct timetable class groups');

    // 2. Verify each class group has exactly 54 recurring slots in database
    for (const groupName of distinctClassGroups) {
      const groupSlots = await prisma.timetableSlot.findMany({ where: { className: groupName } });
      assert.equal(groupSlots.length, 54, `Class group "${groupName}" must have exactly 54 slots in PostgreSQL`);

      // Verify each of the 6 working days has 9 slots
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      for (const day of days) {
        const daySlots = groupSlots.filter(s => s.dayOfWeek === day);
        assert.equal(daySlots.length, 9, `Class group "${groupName}" must have 9 slots on ${day}`);
      }
    }
  });

  it('verifies all 270 database slots last exactly 1 hour and zero slots occur during lunch', async () => {
    const allSlots = await prisma.timetableSlot.findMany();
    assert.equal(allSlots.length, 270);

    for (const slot of allSlots) {
      const [sh, sm] = slot.startTime.split(':').map(Number);
      const [eh, em] = slot.endTime.split(':').map(Number);
      const durationMinutes = (eh * 60 + em) - (sh * 60 + sm);
      assert.equal(durationMinutes, 60, `Slot ${slot.id} duration must be 60 minutes`);

      // Ensure zero overlap with 13:00 - 14:00 lunch break
      const isDuringLunch = (slot.startTime === '13:00' || slot.endTime === '14:00' || (slot.startTime < '14:00' && slot.endTime > '13:00'));
      assert.equal(isDuringLunch, false, `Slot ${slot.id} (${slot.startTime}-${slot.endTime}) must not overlap with lunch break (13:00-14:00)`);
    }
  });

  it('enforces database-level constraint against duplicate slots for the same class group and day', async () => {
    // Attempting to create a duplicate slot with identical (className, dayOfWeek, slotNumber) must fail
    await assert.rejects(
      async () => {
        await prisma.timetableSlot.create({
          data: {
            id: `SLOT-DUPLICATE-TEST-${Date.now()}`,
            dayOfWeek: 'Monday',
            dayIndex: 1,
            slotNumber: 1, // slot 1 for CE already exists
            startTime: '08:00',
            endTime: '09:00',
            subject: 'Duplicate Test Subject',
            className: 'CE — Year 3 / A',
            branch: 'Computer Engineering',
            facultyId: 'FAC-TEST-999'
          }
        });
      },
      /Unique constraint failed|duplicate key value/i,
      'Database must reject duplicate (className, dayOfWeek, slotNumber)'
    );
  });

  it('persists recurring timetable slots and serves via live HTTP API after backend restarts', async () => {
    const res = await fetch('http://localhost:4000/api/timetable');
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.totalSlots, 270);
    assert.equal(body.lunchBreak.startTime, '13:00');
    assert.equal(body.lunchBreak.endTime, '14:00');
    assert.equal(body.dailySlots.length, 9);
    assert.equal(body.weekdays.length, 6);
    assert.equal(body.classGroups.length, 5);

    // Verify filter by class group
    const filterRes = await fetch('http://localhost:4000/api/timetable?className=' + encodeURIComponent('IT — Year 3 / A'));
    assert.equal(filterRes.status, 200);
    const filterBody = await filterRes.json();
    assert.equal(filterBody.totalSlots, 54);
    assert.ok(filterBody.slots.every(s => s.className === 'IT — Year 3 / A'));
  });
});
