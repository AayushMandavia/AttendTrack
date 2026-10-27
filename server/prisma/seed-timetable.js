import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateMasterTimetable } from '../src/timetable.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

export async function seedTimetable() {
  const masterSlots = generateMasterTimetable();
  console.log(`[Timetable Seed] Seeding ${masterSlots.length} recurring weekly slots across 5 class groups (54 slots/class group)...`);

  let created = 0;
  let updated = 0;

  for (const slot of masterSlots) {
    const existing = await prisma.timetableSlot.findUnique({ where: { id: slot.id } });
    await prisma.timetableSlot.upsert({
      where: { id: slot.id },
      update: {
        dayOfWeek: slot.dayOfWeek,
        dayIndex: slot.dayIndex,
        slotNumber: slot.slotNumber,
        startTime: slot.startTime,
        endTime: slot.endTime,
        subject: slot.subject,
        className: slot.className,
        branch: slot.branch,
        facultyId: slot.facultyId,
        facultyName: slot.facultyName,
        room: slot.room
      },
      create: {
        id: slot.id,
        dayOfWeek: slot.dayOfWeek,
        dayIndex: slot.dayIndex,
        slotNumber: slot.slotNumber,
        startTime: slot.startTime,
        endTime: slot.endTime,
        subject: slot.subject,
        className: slot.className,
        branch: slot.branch,
        facultyId: slot.facultyId,
        facultyName: slot.facultyName,
        room: slot.room
      }
    });

    if (existing) {
      updated++;
    } else {
      created++;
    }
  }

  await prisma.auditEvent.create({
    data: {
      id: `LOG-TIMETABLE-SEED-${Date.now()}`,
      action: 'Weekly timetable seeded',
      details: `Idempotently synchronized ${masterSlots.length} recurring timetable slots (${created} created, ${updated} updated) across Monday-Saturday with lunch exclusion.`,
      actor: 'System Seed'
    }
  });

  const totalSlots = await prisma.timetableSlot.count();
  console.log(`[Timetable Seed] Finished! Created: ${created}, Updated: ${updated}. Total timetable slots in DB: ${totalSlots}`);
  return { created, updated, totalSlots };
}

if (process.argv[1] && process.argv[1].endsWith('seed-timetable.js')) {
  seedTimetable()
    .catch((e) => {
      console.error('Timetable seeding error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
