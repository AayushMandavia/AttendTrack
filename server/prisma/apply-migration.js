import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('[Migration] Checking current students table schema...');
  const indexes = await prisma.$queryRawUnsafe(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'students';
  `);
  console.log('Current indexes on students:', indexes);

  const columns = await prisma.$queryRawUnsafe(`
    SELECT column_name, is_nullable, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'students';
  `);
  console.log('Current columns on students:', columns);

  // 1. Remove unique constraint on rollNo if it exists
  console.log('[Migration] Dropping unique constraint on rollNo...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "students" DROP CONSTRAINT IF EXISTS "students_rollNo_key";
  `);
  await prisma.$executeRawUnsafe(`
    DROP INDEX IF EXISTS "students_rollNo_key";
  `);

  // 2. Set sapId to NOT NULL
  console.log('[Migration] Setting sapId to NOT NULL...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "students" ALTER COLUMN "sapId" SET NOT NULL;
  `);

  // 3. Ensure unique constraint/index on sapId
  console.log('[Migration] Ensuring unique index on sapId...');
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "students_sapId_key" ON "students"("sapId");
  `);

  // 4. Add academicYear, division, enrollmentStatus, passwordHash, defaultPassword columns
  console.log('[Migration] Adding academicYear, division, enrollmentStatus, passwordHash, defaultPassword columns...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "academicYear" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "division" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "enrollmentStatus" TEXT DEFAULT 'Enrolled';
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "defaultPassword" TEXT;
  `);

  // 5. Add query performance indexes
  console.log('[Migration] Adding query performance indexes...');
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "students_classGroup_idx" ON "students"("classGroup");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "students_branch_idx" ON "students"("branch");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "students_academicYear_idx" ON "students"("academicYear");
  `);

  // Verify updated schema
  const updatedIndexes = await prisma.$queryRawUnsafe(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'students';
  `);
  console.log('Updated indexes on students:', updatedIndexes);

  const updatedColumns = await prisma.$queryRawUnsafe(`
    SELECT column_name, is_nullable, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'students';
  `);
  console.log('Updated columns on students:', updatedColumns);

  console.log('[Migration] Successfully migrated PostgreSQL students table.');
}

main()
  .catch(err => {
    console.error('Migration error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
