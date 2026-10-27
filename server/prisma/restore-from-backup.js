import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

async function main() {
  const backupFile = path.join(__dirname, '..', 'backups', 'backup_attendtrack_2026-10-19T11-24-06-133Z.json');
  if (!fs.existsSync(backupFile)) {
    console.error('Backup file not found:', backupFile);
    process.exit(1);
  }

  console.log(`[Restore] Reading backup from ${backupFile}...`);
  const raw = fs.readFileSync(backupFile, 'utf8');
  const backup = JSON.parse(raw);
  const { data } = backup;

  console.log(`[Restore] Restoring ${data.students?.length || 0} students...`);
  for (const s of data.students || []) {
    await prisma.student.upsert({
      where: { id: s.id },
      update: {
        name: s.name,
        branch: s.branch,
        rollNo: s.rollNo,
        sapId: s.sapId,
        academicYear: s.academicYear,
        classGroup: s.classGroup,
        division: s.division,
        enrollmentStatus: s.enrollmentStatus || 'Enrolled'
      },
      create: {
        id: s.id,
        name: s.name,
        branch: s.branch,
        rollNo: s.rollNo,
        sapId: s.sapId,
        academicYear: s.academicYear,
        classGroup: s.classGroup,
        division: s.division,
        enrollmentStatus: s.enrollmentStatus || 'Enrolled'
      }
    });
  }

  console.log(`[Restore] Restoring ${data.lectures?.length || 0} lectures...`);
  for (const l of data.lectures || []) {
    await prisma.lecture.upsert({
      where: { id: l.id },
      update: {
        subject: l.subject,
        className: l.className,
        date: l.date,
        startTime: l.startTime,
        endTime: l.endTime,
        studentIds: l.studentIds || [],
        facultyId: l.facultyId,
        timetableSlotId: l.timetableSlotId
      },
      create: {
        id: l.id,
        subject: l.subject,
        className: l.className,
        date: l.date,
        startTime: l.startTime,
        endTime: l.endTime,
        studentIds: l.studentIds || [],
        facultyId: l.facultyId,
        timetableSlotId: l.timetableSlotId
      }
    });
  }

  console.log(`[Restore] Restoring ${data.timetableSlots?.length || 0} timetable slots...`);
  for (const t of data.timetableSlots || []) {
    await prisma.timetableSlot.upsert({
      where: { id: t.id },
      update: {
        dayOfWeek: t.dayOfWeek,
        dayIndex: t.dayIndex,
        slotNumber: t.slotNumber,
        startTime: t.startTime,
        endTime: t.endTime,
        subject: t.subject,
        className: t.className,
        branch: t.branch,
        facultyId: t.facultyId
      },
      create: {
        id: t.id,
        dayOfWeek: t.dayOfWeek,
        dayIndex: t.dayIndex,
        slotNumber: t.slotNumber,
        startTime: t.startTime,
        endTime: t.endTime,
        subject: t.subject,
        className: t.className,
        branch: t.branch,
        facultyId: t.facultyId
      }
    });
  }

  console.log(`[Restore] Restoring ${data.attendanceRecords?.length || 0} attendance records...`);
  for (const a of data.attendanceRecords || []) {
    await prisma.attendanceRecord.upsert({
      where: { id: a.id },
      update: {
        lectureId: a.lectureId,
        studentId: a.studentId,
        status: a.status,
        submitted: a.submitted ?? true,
        submittedBy: a.submittedBy || 'Teacher',
        correctedBy: a.correctedBy,
        correctedAt: a.correctedAt ? new Date(a.correctedAt) : null,
        correctionReference: a.correctionReference
      },
      create: {
        id: a.id,
        lectureId: a.lectureId,
        studentId: a.studentId,
        status: a.status,
        submitted: a.submitted ?? true,
        submittedBy: a.submittedBy || 'Teacher',
        submittedAt: a.submittedAt ? new Date(a.submittedAt) : new Date(),
        correctedBy: a.correctedBy,
        correctedAt: a.correctedAt ? new Date(a.correctedAt) : null,
        correctionReference: a.correctionReference
      }
    });
  }

  console.log(`[Restore] Restoring ${data.documents?.length || 0} documents...`);
  for (const d of data.documents || []) {
    await prisma.document.upsert({
      where: { id: d.id },
      update: {
        storageKey: d.storageKey,
        storageProvider: d.storageProvider || 'local',
        originalFilename: d.originalFilename,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes || 0,
        extractionStatus: d.extractionStatus || 'pending',
        rawExtractedJson: d.rawExtractedJson || undefined,
        missingFields: d.missingFields || [],
        notes: d.notes || [],
        manualVerified: d.manualVerified || false
      },
      create: {
        id: d.id,
        storageKey: d.storageKey,
        storageProvider: d.storageProvider || 'local',
        originalFilename: d.originalFilename,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes || 0,
        uploadTimestamp: d.uploadTimestamp ? new Date(d.uploadTimestamp) : new Date(),
        extractionStatus: d.extractionStatus || 'pending',
        rawExtractedJson: d.rawExtractedJson || undefined,
        missingFields: d.missingFields || [],
        notes: d.notes || [],
        manualVerified: d.manualVerified || false
      }
    });
  }

  console.log(`[Restore] Restoring ${data.attendanceLetters?.length || 0} attendance letters...`);
  for (const l of data.attendanceLetters || []) {
    await prisma.attendanceLetter.upsert({
      where: { id: l.id },
      update: {
        studentId: l.studentId,
        studentName: l.studentName,
        rawStudentName: l.rawStudentName,
        rawStudentId: l.rawStudentId,
        sapId: l.sapId,
        rollNo: l.rollNo,
        date: l.date,
        startTime: l.startTime,
        endTime: l.endTime,
        subject: l.subject,
        reference: l.reference,
        status: l.status,
        matchedSubject: l.matchedSubject,
        lectureId: l.lectureId,
        validation: l.validation,
        uploadId: l.uploadId,
        documentName: l.documentName,
        createdBy: l.createdBy || 'Attendance Coordinator'
      },
      create: {
        id: l.id,
        studentId: l.studentId,
        studentName: l.studentName,
        rawStudentName: l.rawStudentName,
        rawStudentId: l.rawStudentId,
        sapId: l.sapId,
        rollNo: l.rollNo,
        date: l.date,
        startTime: l.startTime,
        endTime: l.endTime,
        subject: l.subject,
        reference: l.reference,
        status: l.status,
        matchedSubject: l.matchedSubject,
        lectureId: l.lectureId,
        validation: l.validation,
        uploadId: l.uploadId,
        documentName: l.documentName,
        createdBy: l.createdBy || 'Attendance Coordinator',
        createdAt: l.createdAt ? new Date(l.createdAt) : new Date()
      }
    });
  }

  console.log(`[Restore] Restoring ${data.auditEvents?.length || 0} audit events...`);
  for (const a of data.auditEvents || []) {
    await prisma.auditEvent.upsert({
      where: { id: a.id },
      update: {
        action: a.action,
        actor: a.actor,
        details: a.details,
        metadata: a.metadata || undefined
      },
      create: {
        id: a.id,
        action: a.action,
        actor: a.actor,
        details: a.details,
        metadata: a.metadata || undefined,
        timestamp: a.timestamp ? new Date(a.timestamp) : new Date()
      }
    });
  }

  console.log('[Restore] Database restore completed successfully.');
}

main()
  .catch(err => {
    console.error('[Restore] Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
