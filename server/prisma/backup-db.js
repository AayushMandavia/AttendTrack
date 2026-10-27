import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

export async function createDatabaseBackup() {
  const backupsDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup_attendtrack_${timestamp}.json`;
  const backupPath = path.join(backupsDir, filename);

  console.log(`[Backup] Exporting all PostgreSQL tables to ${backupPath}...`);

  const [
    students,
    lectures,
    timetableSlots,
    attendanceRecords,
    attendanceLetters,
    documents,
    auditEvents
  ] = await Promise.all([
    prisma.student.findMany(),
    prisma.lecture.findMany(),
    prisma.timetableSlot.findMany(),
    prisma.attendanceRecord.findMany(),
    prisma.attendanceLetter.findMany(),
    prisma.document.findMany(),
    prisma.auditEvent.findMany()
  ]);

  const backupData = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    counts: {
      students: students.length,
      lectures: lectures.length,
      timetableSlots: timetableSlots.length,
      attendanceRecords: attendanceRecords.length,
      attendanceLetters: attendanceLetters.length,
      documents: documents.length,
      auditEvents: auditEvents.length
    },
    data: {
      students,
      lectures,
      timetableSlots,
      attendanceRecords,
      attendanceLetters,
      documents,
      auditEvents
    }
  };

  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');
  const stats = fs.statSync(backupPath);
  console.log(`[Backup] Verified backup file created at: ${backupPath} (Size: ${stats.size} bytes).`);
  return { backupPath, size: stats.size, counts: backupData.counts };
}

if (process.argv[1] && process.argv[1].endsWith('backup-db.js')) {
  createDatabaseBackup()
    .then(res => {
      console.log('Backup successful:', res);
      process.exit(0);
    })
    .catch(err => {
      console.error('Backup failed:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
