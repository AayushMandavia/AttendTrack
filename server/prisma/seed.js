import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { syntheticStudents50 } from './synthetic-students-50.js';
import { seedTimetable } from './seed-timetable.js';

const prisma = new PrismaClient();

export const initialStudents = syntheticStudents50;

export const initialLectures = [
  {
    id: 'LEC-101',
    subject: 'Database Systems',
    className: 'EXTC — Year 3 / A',
    date: '2026-10-14',
    startTime: '10:00',
    endTime: '11:00',
    studentIds: ['STU-001', 'STU-002', 'STU-003', 'STU-004']
  },
  {
    id: 'LEC-102',
    subject: 'Computer Networks',
    className: 'EXTC — Year 3 / A',
    date: '2026-10-14',
    startTime: '11:00',
    endTime: '12:00',
    studentIds: ['STU-001', 'STU-002', 'STU-003', 'STU-004']
  },
  {
    id: 'LEC-103',
    subject: 'Signals & Systems',
    className: 'EXTC — Year 3 / A',
    date: '2026-10-15',
    startTime: '09:00',
    endTime: '10:00',
    studentIds: ['STU-001', 'STU-002', 'STU-003', 'STU-004']
  }
];

export async function main() {
  console.log('Seeding demo students...');
  for (const student of initialStudents) {
    await prisma.student.upsert({
      where: { id: student.id },
      update: {
        name: student.name,
        branch: student.branch,
        rollNo: student.rollNo,
        sapId: student.sapId,
        classGroup: student.classGroup
      },
      create: {
        id: student.id,
        name: student.name,
        branch: student.branch,
        rollNo: student.rollNo,
        sapId: student.sapId,
        classGroup: student.classGroup
      }
    });
  }

  console.log('Seeding recurring weekly timetable slots...');
  await seedTimetable();

  console.log('Seeding demo lectures...');
  for (const lecture of initialLectures) {
    await prisma.lecture.upsert({
      where: { id: lecture.id },
      update: {
        subject: lecture.subject,
        className: lecture.className,
        date: lecture.date,
        startTime: lecture.startTime,
        endTime: lecture.endTime,
        studentIds: lecture.studentIds
      },
      create: {
        id: lecture.id,
        subject: lecture.subject,
        className: lecture.className,
        date: lecture.date,
        startTime: lecture.startTime,
        endTime: lecture.endTime,
        studentIds: lecture.studentIds
      }
    });
  }

  console.log('Seeding initial audit event...');
  await prisma.auditEvent.create({
    data: {
      id: `LOG-SEED-${Date.now()}`,
      action: 'Database seeded',
      details: 'System initialized demo students, recurring timetable, and scheduled lectures.',
      actor: 'System'
    }
  });

  console.log('Seeding completed successfully.');
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  main()
    .catch((e) => {
      console.error('Seeding error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
