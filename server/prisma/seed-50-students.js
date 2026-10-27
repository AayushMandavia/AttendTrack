import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { syntheticStudents50 } from './synthetic-students-50.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

function getStudentCredentials(sapId) {
  let plainPassword;
  if (sapId === '60001240001') {
    plainPassword = process.env.DEMO_STUDENT_A_PASSWORD || 'DemoStudentA#DJSCE2026!Secure';
  } else if (sapId === '60001240002') {
    plainPassword = process.env.DEMO_STUDENT_B_PASSWORD || 'DemoStudentB#DJSCE2026!Secure';
  } else {
    plainPassword = `Student@${sapId}`;
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(plainPassword, salt, 64).toString('hex');
  return { defaultPassword: plainPassword, passwordHash: `${salt}:${derivedKey}` };
}

export async function seed50Students() {
  console.log(`[Seed] Beginning idempotent upsert of ${syntheticStudents50.length} synthetic students...`);

  let createdCount = 0;
  let updatedCount = 0;

  for (const s of syntheticStudents50) {
    const existing = await prisma.student.findUnique({ where: { id: s.id } });
    const creds = getStudentCredentials(s.sapId);

    await prisma.student.upsert({
      where: { id: s.id },
      update: {
        name: s.name,
        branch: s.branch,
        rollNo: s.rollNo,
        sapId: s.sapId,
        classGroup: s.classGroup || null,
        defaultPassword: existing?.defaultPassword || creds.defaultPassword,
        passwordHash: existing?.passwordHash || creds.passwordHash
      },
      create: {
        id: s.id,
        name: s.name,
        branch: s.branch,
        rollNo: s.rollNo,
        sapId: s.sapId,
        classGroup: s.classGroup || null,
        defaultPassword: creds.defaultPassword,
        passwordHash: creds.passwordHash
      }
    });

    if (existing) {
      updatedCount++;
    } else {
      createdCount++;
    }
  }

  // Audit trail entry
  await prisma.auditEvent.create({
    data: {
      id: `LOG-SEED-50-${Date.now()}`,
      action: 'Synthetic students seeded',
      details: `Idempotently synchronized 50 synthetic student records (${createdCount} created, ${updatedCount} updated).`,
      actor: 'System Seed'
    }
  });

  const totalInDb = await prisma.student.count();
  console.log(`[Seed] Finished! Created: ${createdCount}, Updated: ${updatedCount}. Total students in database: ${totalInDb}`);

  return { createdCount, updatedCount, totalInDb };
}

if (process.argv[1] && (process.argv[1].endsWith('seed-50-students.js') || process.argv[1].endsWith('seed-50-students'))) {
  seed50Students()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Seed] Error seeding 50 synthetic students:', err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
