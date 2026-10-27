import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { hashPassword } from '../src/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

export async function migrateStudentCredentials() {
  console.log('[Migration] Beginning student credential database migration...');

  // 1. Add passwordHash and defaultPassword columns if they do not exist
  console.log('[Migration] Ensuring passwordHash and defaultPassword columns exist in "students" table...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "defaultPassword" TEXT;
  `);

  // 2. Fetch all students from the database
  const students = await prisma.student.findMany({
    orderBy: { sapId: 'asc' }
  });
  console.log(`[Migration] Found ${students.length} student records in PostgreSQL database.`);

  let updatedCount = 0;

  for (const s of students) {
    let plainPassword;
    if (s.sapId === '60001240001') {
      plainPassword = process.env.DEMO_STUDENT_A_PASSWORD || 'DemoStudentA#DJSCE2026!Secure';
    } else if (s.sapId === '60001240002') {
      plainPassword = process.env.DEMO_STUDENT_B_PASSWORD || 'DemoStudentB#DJSCE2026!Secure';
    } else {
      plainPassword = `Student@${s.sapId}`;
    }

    const secureHash = hashPassword(plainPassword);

    await prisma.student.update({
      where: { id: s.id },
      data: {
        passwordHash: secureHash,
        defaultPassword: plainPassword
      }
    });

    updatedCount++;
  }

  // 3. Log audit event
  await prisma.auditEvent.create({
    data: {
      id: `LOG-CRED-MIGRATE-${Date.now()}`,
      action: 'Student database credentials provisioned',
      details: `Cryptographic passwordHash and defaultPassword columns provisioned for all ${updatedCount} enrolled students in PostgreSQL database.`,
      actor: 'Database Migration'
    }
  });

  console.log(`[Migration] Successfully provisioned login credentials for ${updatedCount} students in database.`);
  return { updatedCount, totalStudents: students.length };
}

if (process.argv[1] && (process.argv[1].endsWith('migrate-student-credentials.js') || process.argv[1].endsWith('migrate-student-credentials'))) {
  migrateStudentCredentials()
    .then(async (res) => {
      console.log('[Migration] Done:', res);
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Migration] Failed:', err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
