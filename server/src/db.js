import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server/.env if present
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { syntheticStudents50 } from '../prisma/synthetic-students-50.js';
import {
  generateMasterTimetable,
  generateDatedLecturesFromTimetable,
  LUNCH_BREAK,
  DAILY_TIME_SLOTS,
  WEEKDAYS,
  CLASS_GROUPS
} from './timetable.js';
import { checkAttendanceCorrectionWindow } from './attendance-window.js';
import { studentCache, timetableCache, invalidateStudentCache } from './lru-cache.js';

export const prisma = new PrismaClient();

let isConnected = false;
let lastPingTime = 0;
let lastFailedAttempt = 0;
const RETRY_COOLDOWN_MS = 3000;
const PING_CACHE_MS = 2000;

/**
 * Checks if the PostgreSQL database is reachable
 */
export async function testDatabaseConnection(force = false) {
  if (!process.env.DATABASE_URL) {
    isConnected = false;
    return false;
  }

  const now = Date.now();
  if (!force && isConnected && now - lastPingTime < PING_CACHE_MS) {
    return true;
  }
  if (!force && !isConnected && now - lastFailedAttempt < RETRY_COOLDOWN_MS) {
    return false;
  }

  try {
    // Run simple query with 1500ms timeout to verify connection
    const queryPromise = prisma.$queryRaw`SELECT 1`;
    queryPromise.catch(() => {});
    await Promise.race([
      queryPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Connection check timed out')), 1500))
    ]);
    isConnected = true;
    lastPingTime = now;
    return true;
  } catch (err) {
    isConnected = false;
    lastFailedAttempt = now;
    console.warn(
      `[Database] Warning: Could not connect to PostgreSQL. ` +
      `Error: ${err.message}. Ensure PostgreSQL is running. Disconnected mode active.`
    );
    return false;
  }
}

/**
 * In-memory / development fallback state used only when PostgreSQL is unreachable
 */
const INITIAL_FALLBACK_LOGS = [
  {
    id: 'LOG-SEED-TIMETABLE',
    action: 'Weekly timetable seeded',
    details: 'System Seed: Synchronized 270 recurring timetable slots across EXTC — Year 3 / A and CE — Year 3 / A (Signals & Systems, Applied Mathematics, Database Systems) for Prof. Sharma.',
    actor: 'System Seed',
    at: '2026-10-26T08:00:00.000Z'
  },
  {
    id: 'LOG-SEED-STUDENTS',
    action: 'Synthetic students seeded',
    details: 'System Seed: Verified 50 enrolled students across CE — Year 3 / A and EXTC — Year 3 / A.',
    actor: 'System Seed',
    at: '2026-10-26T08:01:00.000Z'
  }
];

const fallback = {
  students: [...syntheticStudents50],
  lectures: [
    { id: 'LEC-101', subject: 'Database Systems', className: 'EXTC — Year 3 / A', date: '2026-10-14', startTime: '10:00', endTime: '11:00', studentIds: ['STU-001', 'STU-002', 'STU-003', 'STU-004', 'STU-023', 'STU-024', 'STU-025', 'STU-026', 'STU-027', 'STU-028', 'STU-029', 'STU-030', 'STU-031', 'STU-032'] },
    { id: 'LEC-102', subject: 'Computer Networks', className: 'EXTC — Year 3 / A', date: '2026-10-14', startTime: '11:00', endTime: '12:00', studentIds: ['STU-001', 'STU-002', 'STU-003', 'STU-004', 'STU-023', 'STU-024', 'STU-025', 'STU-026', 'STU-027', 'STU-028', 'STU-029', 'STU-030', 'STU-031', 'STU-032'] },
    { id: 'LEC-103', subject: 'Signals & Systems', className: 'EXTC — Year 3 / A', date: '2026-10-15', startTime: '09:00', endTime: '10:00', studentIds: ['STU-001', 'STU-002', 'STU-003', 'STU-004', 'STU-023', 'STU-024', 'STU-025', 'STU-026', 'STU-027', 'STU-028', 'STU-029', 'STU-030', 'STU-031', 'STU-032'] }
  ],
  attendance: [],
  letters: [],
  documents: [],
  logs: [...INITIAL_FALLBACK_LOGS]
};

// -------------------------------------------------------------
// Database Access Layer (Used by API Routes)
// -------------------------------------------------------------

export async function getDashboardData() {
  await ensureCurrentWeekLecturesExist();
  const online = await testDatabaseConnection();
  if (online) {

    const [totalStudents, students, lectures, attendance, letters, auditEvents] = await Promise.all([
      prisma.student.count(),
      prisma.student.findMany({ orderBy: { id: 'asc' }, take: 250 }),
      prisma.lecture.findMany({ orderBy: [{ date: 'desc' }, { startTime: 'asc' }] }),
      prisma.attendanceRecord.findMany({ orderBy: { submittedAt: 'desc' } }),
      prisma.attendanceLetter.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.auditEvent.findMany({ orderBy: { timestamp: 'desc' }, take: 50 })
    ]);

    // Format logs for frontend compatibility
    const logs = auditEvents.map(e => ({
      id: e.id,
      action: e.action,
      details: `${e.actor}: ${e.details}`,
      actor: e.actor,
      rawDetails: e.details,
      at: e.timestamp.toISOString()
    }));

    // Authoritative student lookup by classGroup to prevent cross-department roster contamination
    const studentIdsByClass = {};
    for (const s of students) {
      if (s.classGroup) {
        if (!studentIdsByClass[s.classGroup]) studentIdsByClass[s.classGroup] = [];
        studentIdsByClass[s.classGroup].push(s.id);
      }
    }

    const lecturesWithWindow = lectures.map(l => {
      const windowInfo = checkAttendanceCorrectionWindow(l);
      const authoritativeStudentIds = (l.isCrossListed || l.isShared)
        ? l.studentIds
        : (studentIdsByClass[l.className] || l.studentIds || []);

      return {
        ...l,
        studentIds: authoritativeStudentIds,
        correctionWindow: {
          isOpen: windowInfo.isOpen,
          isExpired: windowInfo.isExpired,
          deadline: windowInfo.deadline?.toISOString(),
          formattedDeadline: windowInfo.formattedDeadline,
          formattedScheduledEnd: windowInfo.formattedScheduledEnd,
          remainingMs: windowInfo.remainingMs
        }
      };
    });

    return { students, totalStudents, lectures: lecturesWithWindow, attendance, letters, logs, isPostgresConnected: true };
  }

  const fallbackLecturesWithWindow = fallback.lectures.map(l => {
    const windowInfo = checkAttendanceCorrectionWindow(l);
    return {
      ...l,
      correctionWindow: {
        isOpen: windowInfo.isOpen,
        isExpired: windowInfo.isExpired,
        deadline: windowInfo.deadline?.toISOString(),
        formattedDeadline: windowInfo.formattedDeadline,
        formattedScheduledEnd: windowInfo.formattedScheduledEnd,
        remainingMs: windowInfo.remainingMs
      }
    };
  });

  return {
    students: fallback.students,
    lectures: fallbackLecturesWithWindow,
    attendance: fallback.attendance,
    letters: fallback.letters,
    logs: fallback.logs,
    isPostgresConnected: false,
    databaseWarning: null
  };
}

export async function logAuditEvent(action, details, actor = 'System') {
  const at = new Date().toISOString();
  const id = `LOG-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;

  const online = await testDatabaseConnection();
  if (online) {
    try {
      await prisma.auditEvent.create({
        data: { id, action, details, actor }
      });
      return;
    } catch (e) {
      console.error('[Database] Failed to write audit event:', e.message);
    }
  }

  fallback.logs.unshift({ id, action, details: `${actor}: ${details}`, at });
  if (fallback.logs.length > 100) {
    fallback.logs.pop();
  }
}

export async function getStudents(limit = 100) {
  const online = await testDatabaseConnection();
  if (online) {
    return prisma.student.findMany({ orderBy: { id: 'asc' }, take: limit });
  }
  return fallback.students.slice(0, limit);
}

export async function getStudentsPaginated({
  page = 1,
  limit = 25,
  search = '',
  branch = '',
  classGroup = '',
  academicYear = ''
} = {}) {
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(5, parseInt(limit, 10) || 25));
  const skip = (parsedPage - 1) * parsedLimit;

  const online = await testDatabaseConnection();
  if (online) {
    const where = {};
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { sapId: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { rollNo: { contains: q, mode: 'insensitive' } }
      ];
    }
    if (branch && branch.trim()) {
      where.branch = { equals: branch.trim(), mode: 'insensitive' };
    }
    if (classGroup && classGroup.trim()) {
      where.classGroup = { equals: classGroup.trim(), mode: 'insensitive' };
    }
    if (academicYear && academicYear.trim()) {
      where.academicYear = { equals: academicYear.trim(), mode: 'insensitive' };
    }

    const [total, students] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        orderBy: [{ sapId: 'asc' }],
        skip,
        take: parsedLimit
      })
    ]);

    return {
      students,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit) || 1
      }
    };
  }

  // Offline fallback
  let filtered = [...fallback.students];
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(s =>
      (s.sapId && s.sapId.toLowerCase().includes(q)) ||
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.rollNo && s.rollNo.toLowerCase().includes(q))
    );
  }
  const total = filtered.length;
  const paginated = filtered.slice(skip, skip + parsedLimit);
  return {
    students: paginated,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit) || 1
    }
  };
}

export async function findStudentById(id) {
  if (!id) return null;
  const str = String(id).trim();
  return studentCache.getOrSet(`id:${str}`, async () => {
    const online = await testDatabaseConnection();
    if (online) {
      const student = await prisma.student.findUnique({ where: { id: str } });
      if (student) return student;
      return prisma.student.findUnique({ where: { sapId: str } });
    }
    return fallback.students.find(s => s.id === str || s.sapId === str) || null;
  });
}

export async function findStudentBySapId(sapId) {
  if (!sapId) return null;
  const sapStr = String(sapId).trim();
  return studentCache.getOrSet(`sap:${sapStr}`, async () => {
    const online = await testDatabaseConnection();
    if (online) {
      return prisma.student.findUnique({ where: { sapId: sapStr } });
    }
    return fallback.students.find(s => s.sapId && s.sapId.trim() === sapStr) || null;
  });
}

/**
 * Creates an individual student record and invalidates student cache entries after successful commit.
 */
export async function createStudent(data) {
  if (!data || !data.sapId || !data.name) {
    const err = new Error('SAP ID and Name are required to create a student.');
    err.status = 400;
    throw err;
  }
  const sapStr = String(data.sapId).trim();
  const defaultPassword = data.defaultPassword || (data.password ? String(data.password).trim() : `Student@${sapStr}`);
  let passwordHash = data.passwordHash;
  if (!passwordHash) {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = crypto.scryptSync(defaultPassword, salt, 64).toString('hex');
    passwordHash = `${salt}:${derivedKey}`;
  }

  const online = await testDatabaseConnection();
  let created;
  if (online) {
    try {
      created = await prisma.student.create({
        data: {
          sapId: sapStr,
          name: String(data.name).trim(),
          rollNo: data.rollNo ? String(data.rollNo).trim() : null,
          branch: data.branch || null,
          academicYear: data.academicYear || null,
          classGroup: data.classGroup || null,
          division: data.division || null,
          enrollmentStatus: data.enrollmentStatus || 'Enrolled',
          passwordHash,
          defaultPassword
        }
      });
    } catch (err) {
      if (err.code === 'P2002') {
        const conflictErr = new Error(`Student with SAP ID ${data.sapId} already exists.`);
        conflictErr.status = 409;
        throw conflictErr;
      }
      throw err;
    }
  } else {
    const existing = fallback.students.find(s => s.sapId === sapStr);
    if (existing) {
      const err = new Error(`Student with SAP ID ${data.sapId} already exists.`);
      err.status = 409;
      throw err;
    }
    created = {
      id: data.id || `STU-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      sapId: sapStr,
      name: String(data.name).trim(),
      rollNo: data.rollNo ? String(data.rollNo).trim() : null,
      branch: data.branch || null,
      academicYear: data.academicYear || null,
      classGroup: data.classGroup || null,
      division: data.division || null,
      enrollmentStatus: data.enrollmentStatus || 'Enrolled',
      passwordHash,
      defaultPassword
    };
    fallback.students.push(created);
  }

  // Only invalidate AFTER database insertion/mutation successfully commits
  invalidateStudentCache({ id: created.id, sapId: created.sapId });
  return created;
}

/**
 * Updates an individual student record and invalidates student cache entries after successful commit.
 */
export async function updateStudent(idOrSapId, data) {
  if (!idOrSapId) {
    const err = new Error('Student ID or SAP ID is required for update.');
    err.status = 400;
    throw err;
  }
  const target = String(idOrSapId).trim();
  const online = await testDatabaseConnection();
  let updated;
  if (online) {
    const existing = await prisma.student.findFirst({
      where: {
        OR: [{ id: target }, { sapId: target }]
      }
    });
    if (!existing) {
      const err = new Error(`Student not found: ${target}`);
      err.status = 404;
      throw err;
    }

    updated = await prisma.student.update({
      where: { id: existing.id },
      data: {
        name: data.name !== undefined ? String(data.name).trim() : undefined,
        rollNo: data.rollNo !== undefined ? (data.rollNo ? String(data.rollNo).trim() : null) : undefined,
        branch: data.branch !== undefined ? data.branch : undefined,
        academicYear: data.academicYear !== undefined ? data.academicYear : undefined,
        classGroup: data.classGroup !== undefined ? data.classGroup : undefined,
        division: data.division !== undefined ? data.division : undefined,
        enrollmentStatus: data.enrollmentStatus !== undefined ? data.enrollmentStatus : undefined,
        defaultPassword: data.defaultPassword !== undefined ? data.defaultPassword : (data.password ? String(data.password).trim() : undefined),
        passwordHash: data.passwordHash !== undefined ? data.passwordHash : (data.password ? (() => {
          const salt = crypto.randomBytes(16).toString('hex');
          return `${salt}:${crypto.scryptSync(String(data.password).trim(), salt, 64).toString('hex')}`;
        })() : undefined)
      }
    });

    // Invalidate both previous and updated cache keys post-commit
    invalidateStudentCache({ id: existing.id, sapId: existing.sapId });
    if (updated.sapId !== existing.sapId || updated.id !== existing.id) {
      invalidateStudentCache({ id: updated.id, sapId: updated.sapId });
    }
  } else {
    const idx = fallback.students.findIndex(s => s.id === target || s.sapId === target);
    if (idx === -1) {
      const err = new Error(`Student not found: ${target}`);
      err.status = 404;
      throw err;
    }
    const existing = fallback.students[idx];
    updated = {
      ...existing,
      ...data,
      id: existing.id,
      sapId: data.sapId !== undefined ? String(data.sapId).trim() : existing.sapId
    };
    fallback.students[idx] = updated;

    invalidateStudentCache({ id: existing.id, sapId: existing.sapId });
    if (updated.sapId !== existing.sapId) {
      invalidateStudentCache({ sapId: updated.sapId });
    }
  }

  return updated;
}

/**
 * Deletes an individual student record and invalidates student cache entries after successful commit.
 */
export async function deleteStudent(idOrSapId) {
  if (!idOrSapId) {
    const err = new Error('Student ID or SAP ID is required for deletion.');
    err.status = 400;
    throw err;
  }
  const target = String(idOrSapId).trim();
  const online = await testDatabaseConnection();
  let deleted;
  if (online) {
    const existing = await prisma.student.findFirst({
      where: {
        OR: [{ id: target }, { sapId: target }]
      }
    });
    if (!existing) {
      const err = new Error(`Student not found: ${target}`);
      err.status = 404;
      throw err;
    }

    deleted = await prisma.student.delete({
      where: { id: existing.id }
    });

    invalidateStudentCache({ id: existing.id, sapId: existing.sapId });
  } else {
    const idx = fallback.students.findIndex(s => s.id === target || s.sapId === target);
    if (idx === -1) {
      const err = new Error(`Student not found: ${target}`);
      err.status = 404;
      throw err;
    }
    deleted = fallback.students.splice(idx, 1)[0];
    invalidateStudentCache({ id: deleted.id, sapId: deleted.sapId });
  }

  return deleted;
}


export async function ensureCurrentWeekLecturesExist() {
  const online = await testDatabaseConnection();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);

  const startDate = monday.toISOString().split('T')[0];
  const endDate = saturday.toISOString().split('T')[0];

  if (online) {
    const existingToday = await prisma.lecture.count({ where: { date: todayStr } });
    if (existingToday === 0) {
      await generateAndSaveDatedLectures({ startDate, endDate, actor: 'System Auto-Scheduler' });
    }
    return;
  }

  // Fallback mode: ensure current week and 2026-10-26..2026-10-31 lectures exist
  const hasTodayFallback = fallback.lectures.some(l => l.date === todayStr);
  if (!hasTodayFallback) {
    await generateAndSaveDatedLectures({ startDate, endDate, actor: 'System Auto-Scheduler' });
  }
  const hasOct28Fallback = fallback.lectures.some(l => l.date === '2026-10-28');
  if (!hasOct28Fallback) {
    await generateAndSaveDatedLectures({ startDate: '2026-10-26', endDate: '2026-10-31', actor: 'System Auto-Scheduler' });
  }
}

export async function getAuthoritativeRosterForLecture(lecture) {
  if (!lecture) return [];
  const online = await testDatabaseConnection();
  if (online) {
    if (lecture.isCrossListed || lecture.isShared) {
      if (Array.isArray(lecture.studentIds) && lecture.studentIds.length > 0) {
        return prisma.student.findMany({
          where: { id: { in: lecture.studentIds } },
          orderBy: { rollNo: 'asc' }
        });
      }
    }

    const classStudents = await prisma.student.findMany({
      where: { classGroup: lecture.className, enrollmentStatus: 'Enrolled' },
      orderBy: { rollNo: 'asc' }
    });
    if (classStudents.length > 0) return classStudents;

    if (Array.isArray(lecture.studentIds) && lecture.studentIds.length > 0) {
      return prisma.student.findMany({
        where: { id: { in: lecture.studentIds } },
        orderBy: { rollNo: 'asc' }
      });
    }
  } else {
    if (lecture.isCrossListed || lecture.isShared) {
      if (Array.isArray(lecture.studentIds)) {
        return fallback.students.filter(s => lecture.studentIds.includes(s.id));
      }
    }
    const classStudents = fallback.students.filter(s => s.classGroup === lecture.className);
    if (classStudents.length > 0) return classStudents;
    if (Array.isArray(lecture.studentIds)) {
      return fallback.students.filter(s => lecture.studentIds.includes(s.id));
    }
  }
  return [];
}

export async function getLectures(options = {}) {
  const online = await testDatabaseConnection();
  if (online) {
    const where = {};
    if (options.className) where.className = options.className;
    if (options.date) where.date = options.date;
    if (options.facultyId) where.facultyId = options.facultyId;
    if (options.facultyIds && Array.isArray(options.facultyIds) && options.facultyIds.length > 0) {
      where.facultyId = { in: options.facultyIds };
    }
    return prisma.lecture.findMany({
      where,
      orderBy: [
        { date: 'desc' },
        { startTime: 'asc' }
      ]
    });
  }
  let lecs = fallback.lectures;
  if (options.className) lecs = lecs.filter(l => l.className === options.className);
  if (options.date) lecs = lecs.filter(l => l.date === options.date);
  if (options.facultyId) lecs = lecs.filter(l => l.facultyId === options.facultyId);
  return lecs;
}

export async function findLectureById(id) {
  if (!id) return null;
  const online = await testDatabaseConnection();
  if (online) {
    return prisma.lecture.findUnique({ where: { id } });
  }
  return fallback.lectures.find(l => l.id === id) || null;
}

// -------------------------------------------------------------
// Recurring Timetable Data Layer
// -------------------------------------------------------------

export async function getTimetableSlots({ className, dayOfWeek, branch, facultyId, facultyIds } = {}) {
  const online = await testDatabaseConnection();
  if (online) {
    const where = {};
    if (className) where.className = className;
    if (dayOfWeek) where.dayOfWeek = dayOfWeek;
    if (branch) where.branch = branch;
    if (facultyId) where.facultyId = facultyId;
    if (facultyIds && Array.isArray(facultyIds) && facultyIds.length > 0) {
      where.facultyId = { in: facultyIds };
    }

    const cacheKey = `slots:${className || '*'}:${dayOfWeek || '*'}:${branch || '*'}:${facultyId || '*'}:${(facultyIds || []).join(',') || '*'}`;
    return timetableCache.getOrSet(cacheKey, () => prisma.timetableSlot.findMany({
      where,
      orderBy: [
        { dayIndex: 'asc' },
        { slotNumber: 'asc' }
      ]
    }));
  }

  let slots = generateMasterTimetable();
  if (className) slots = slots.filter(s => s.className === className);
  if (dayOfWeek) slots = slots.filter(s => s.dayOfWeek === dayOfWeek);
  if (branch) slots = slots.filter(s => s.branch === branch);
  if (facultyId) slots = slots.filter(s => s.facultyId === facultyId);
  if (facultyIds && Array.isArray(facultyIds) && facultyIds.length > 0) {
    slots = slots.filter(s => facultyIds.includes(s.facultyId));
  }
  return slots;
}

export async function getTimetableSlotById(id) {
  const online = await testDatabaseConnection();
  if (online) {
    return prisma.timetableSlot.findUnique({ where: { id } });
  }
  return generateMasterTimetable().find(s => s.id === id) || null;
}

export async function generateAndSaveDatedLectures({ startDate, endDate, className, actor = 'Coordinator' } = {}) {
  const online = await testDatabaseConnection();

  let students = [];
  if (online) {
    students = await prisma.student.findMany();
  } else {
    students = fallback.students;
  }

  const studentIdsByClass = {};
  for (const s of students) {
    if (s.classGroup) {
      if (!studentIdsByClass[s.classGroup]) studentIdsByClass[s.classGroup] = [];
      studentIdsByClass[s.classGroup].push(s.id);
    }
  }

  const plannedLectures = generateDatedLecturesFromTimetable({
    startDate,
    endDate,
    className,
    studentIdsByClass
  });

  const createdLectures = [];
  if (online) {
    for (const l of plannedLectures) {
      const saved = await prisma.lecture.upsert({
        where: { id: l.id },
        update: {
          subject: l.subject,
          className: l.className,
          date: l.date,
          startTime: l.startTime,
          endTime: l.endTime,
          studentIds: l.studentIds,
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
          studentIds: l.studentIds,
          facultyId: l.facultyId,
          timetableSlotId: l.timetableSlotId
        }
      });
      createdLectures.push(saved);
    }

    await logAuditEvent(
      'Dated lectures generated',
      `Generated/upserted ${createdLectures.length} dated lectures between ${startDate} and ${endDate}${className ? ` for ${className}` : ''}.`,
      actor
    );
  } else {
    for (const l of plannedLectures) {
      const idx = fallback.lectures.findIndex(x => x.id === l.id);
      if (idx >= 0) {
        fallback.lectures[idx] = l;
      } else {
        fallback.lectures.push(l);
      }
      createdLectures.push(l);
    }
  }

  return createdLectures;
}

export async function getAttendanceByLecture(lectureId) {
  const online = await testDatabaseConnection();
  if (online) {
    return prisma.attendanceRecord.findMany({ where: { lectureId } });
  }
  return fallback.attendance.filter(a => a.lectureId === lectureId);
}

export async function saveAttendanceSubmission({
  lecture,
  entries,
  actor = 'Teacher',
  serverTime = new Date(),
  enforceWindow = false
}) {
  const at = serverTime instanceof Date ? serverTime : new Date(serverTime);

  if (enforceWindow) {
    const windowInfo = checkAttendanceCorrectionWindow(lecture, at);
    if (windowInfo.isExpired) {
      const err = new Error(
        `Attendance correction window expired. Submissions closed at ${windowInfo.formattedDeadline} (24 hours after lecture scheduled end at ${windowInfo.formattedScheduledEnd}).`
      );
      err.status = 403;
      err.code = 'CORRECTION_WINDOW_EXPIRED';
      throw err;
    }
  }

  const online = await testDatabaseConnection();

  if (online) {
    // Check if prior attendance already existed to classify as submission vs correction
    const priorRecords = await prisma.attendanceRecord.findMany({
      where: { lectureId: lecture.id }
    });
    const isCorrection = priorRecords.some(r => r.submitted);

    // Save in transaction
    await prisma.$transaction(async (tx) => {
      for (const e of entries) {
        await tx.attendanceRecord.upsert({
          where: {
            lectureId_studentId: { lectureId: lecture.id, studentId: e.studentId }
          },
          update: {
            status: e.status,
            submitted: true,
            submittedBy: isCorrection ? undefined : actor,
            submittedAt: isCorrection ? undefined : at,
            correctedBy: isCorrection ? actor : undefined,
            correctedAt: isCorrection ? at : undefined
          },
          create: {
            id: `ATT-${lecture.id}-${e.studentId}`,
            lectureId: lecture.id,
            studentId: e.studentId,
            status: e.status,
            submitted: true,
            submittedBy: actor,
            submittedAt: at
          }
        });
      }

      await tx.auditEvent.create({
        data: {
          id: `LOG-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
          action: isCorrection ? 'Attendance corrected' : 'Attendance submitted',
          details: `${lecture.subject} (${lecture.date} ${lecture.startTime}-${lecture.endTime}); ${entries.length} student records.${isCorrection ? ' (Within 24h window)' : ''}`,
          actor
        }
      });
    });

    return { count: entries.length, isCorrection };
  }

  // Fallback if PostgreSQL is offline
  if (process.env.STRICT_POSTGRES_MODE === 'true' || lecture?.id?.startsWith('LEC-TEST-24H-')) {
    const err = new Error('Database unavailable: PostgreSQL is disconnected. Attendance submission could not be saved.');
    err.status = 503;
    throw err;
  }

  // Fallback (only used when running without a DATABASE_URL)
  const isCorrectionFallback = fallback.attendance.some(a => a.lectureId === lecture.id && a.submitted);
  for (const e of entries) {
    const existingIdx = fallback.attendance.findIndex(a => a.lectureId === lecture.id && a.studentId === e.studentId);
    const rec = {
      id: `ATT-${lecture.id}-${e.studentId}`,
      lectureId: lecture.id,
      studentId: e.studentId,
      status: e.status,
      submitted: true,
      submittedBy: isCorrectionFallback ? (fallback.attendance[existingIdx]?.submittedBy || actor) : actor,
      submittedAt: isCorrectionFallback ? (fallback.attendance[existingIdx]?.submittedAt || at.toISOString()) : at.toISOString(),
      correctedBy: isCorrectionFallback ? actor : undefined,
      correctedAt: isCorrectionFallback ? at.toISOString() : undefined
    };
    if (existingIdx >= 0) {
      fallback.attendance[existingIdx] = rec;
    } else {
      fallback.attendance.push(rec);
    }
  }

  await logAuditEvent(
    isCorrectionFallback ? 'Attendance corrected' : 'Attendance submitted',
    `${lecture.subject} (${lecture.date} ${lecture.startTime}-${lecture.endTime}); ${entries.length} student records.${isCorrectionFallback ? ' (Within 24h window)' : ''}`,
    actor
  );
  return { count: entries.length, isCorrection: isCorrectionFallback };
}

export async function saveAdminAttendanceCorrection({
  lecture,
  entries,
  reason,
  actor = 'Admin',
  serverTime = new Date()
}) {
  if (!reason || !reason.trim()) {
    const err = new Error('Mandatory reason is required for post-deadline attendance correction.');
    err.status = 400;
    throw err;
  }

  const at = serverTime instanceof Date ? serverTime : new Date(serverTime);
  const online = await testDatabaseConnection();

  if (online) {
    await prisma.$transaction(async (tx) => {
      for (const e of entries) {
        await tx.attendanceRecord.upsert({
          where: {
            lectureId_studentId: { lectureId: lecture.id, studentId: e.studentId }
          },
          update: {
            status: e.status,
            submitted: true,
            correctedBy: actor,
            correctedAt: at,
            correctionReference: `Admin Override: ${reason.trim()}`
          },
          create: {
            id: `ATT-${lecture.id}-${e.studentId}`,
            lectureId: lecture.id,
            studentId: e.studentId,
            status: e.status,
            submitted: true,
            submittedBy: actor,
            submittedAt: at,
            correctedBy: actor,
            correctedAt: at,
            correctionReference: `Admin Override: ${reason.trim()}`
          }
        });
      }

      await tx.auditEvent.create({
        data: {
          id: `LOG-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
          action: 'Admin post-deadline attendance correction',
          details: `${lecture.subject} (${lecture.date} ${lecture.startTime}-${lecture.endTime}); ${entries.length} records corrected. Reason: ${reason.trim()}`,
          actor
        }
      });
    });

    return { count: entries.length, corrected: true };
  }

  // Fallback if PostgreSQL is offline
  if (process.env.STRICT_POSTGRES_MODE === 'true' || lecture?.id?.startsWith('LEC-TEST-24H-')) {
    const err = new Error('Database unavailable: PostgreSQL is disconnected. Admin correction could not be saved.');
    err.status = 503;
    throw err;
  }

  // Fallback store
  for (const e of entries) {
    const existingIdx = fallback.attendance.findIndex(a => a.lectureId === lecture.id && a.studentId === e.studentId);
    const rec = {
      id: `ATT-${lecture.id}-${e.studentId}`,
      lectureId: lecture.id,
      studentId: e.studentId,
      status: e.status,
      submitted: true,
      submittedBy: fallback.attendance[existingIdx]?.submittedBy || actor,
      submittedAt: fallback.attendance[existingIdx]?.submittedAt || at.toISOString(),
      correctedBy: actor,
      correctedAt: at.toISOString(),
      correctionReference: `Admin Override: ${reason.trim()}`
    };
    if (existingIdx >= 0) {
      fallback.attendance[existingIdx] = rec;
    } else {
      fallback.attendance.push(rec);
    }
  }

  await logAuditEvent(
    'Admin post-deadline attendance correction',
    `${lecture.subject} (${lecture.date} ${lecture.startTime}-${lecture.endTime}); ${entries.length} records corrected. Reason: ${reason.trim()}`,
    actor
  );
  return { count: entries.length, corrected: true };
}

export async function saveBulkAttendanceSubmissions({
  submissions = [],
  actor = 'Teacher',
  serverTime = new Date()
}) {
  if (!Array.isArray(submissions) || submissions.length === 0) {
    const err = new Error('Submissions array is required.');
    err.status = 400;
    throw err;
  }

  const at = serverTime instanceof Date ? serverTime : new Date(serverTime);

  // 1. Pre-validate every lecture, every student set, and strict 24h window
  // BEFORE any database mutation takes place.
  const verifiedList = [];
  for (const item of submissions) {
    const { lectureId, entries } = item;
    const lecture = await findLectureById(lectureId);
    if (!lecture) {
      const err = new Error(`Lecture "${lectureId}" not found.`);
      err.status = 400;
      throw err;
    }

    if (!Array.isArray(entries) || entries.length !== lecture.studentIds.length) {
      const err = new Error(`Lecture "${lecture.subject}" requires attendance entries for all ${lecture.studentIds.length} students.`);
      err.status = 400;
      throw err;
    }

    const allowed = new Set(lecture.studentIds);
    if (entries.some(e => !allowed.has(e.studentId) || !['Present', 'Absent'].includes(e.status))) {
      const err = new Error(`Invalid student or status in submission for lecture "${lecture.subject}".`);
      err.status = 400;
      throw err;
    }

    const windowInfo = checkAttendanceCorrectionWindow(lecture, at);
    if (windowInfo.isExpired) {
      const err = new Error(
        `Bulk submission rejected: Attendance correction window expired for "${lecture.subject}" (ended at ${windowInfo.formattedScheduledEnd}, deadline was ${windowInfo.formattedDeadline}). No records were modified.`
      );
      err.status = 403;
      err.code = 'CORRECTION_WINDOW_EXPIRED';
      err.expiredLectureId = lecture.id;
      throw err;
    }

    verifiedList.push({ lecture, entries });
  }

  const online = await testDatabaseConnection();

  if (online) {
    return prisma.$transaction(async (tx) => {
      let totalRecords = 0;
      for (const { lecture, entries } of verifiedList) {
        const priorRecords = await tx.attendanceRecord.findMany({
          where: { lectureId: lecture.id }
        });
        const isCorrection = priorRecords.some(r => r.submitted);

        for (const e of entries) {
          await tx.attendanceRecord.upsert({
            where: {
              lectureId_studentId: { lectureId: lecture.id, studentId: e.studentId }
            },
            update: {
              status: e.status,
              submitted: true,
              submittedBy: isCorrection ? undefined : actor,
              submittedAt: isCorrection ? undefined : at,
              correctedBy: isCorrection ? actor : undefined,
              correctedAt: isCorrection ? at : undefined
            },
            create: {
              id: `ATT-${lecture.id}-${e.studentId}`,
              lectureId: lecture.id,
              studentId: e.studentId,
              status: e.status,
              submitted: true,
              submittedBy: actor,
              submittedAt: at
            }
          });
          totalRecords++;
        }

        await tx.auditEvent.create({
          data: {
            id: `LOG-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
            action: isCorrection ? 'Attendance corrected (bulk)' : 'Attendance submitted (bulk)',
            details: `${lecture.subject} (${lecture.date} ${lecture.startTime}-${lecture.endTime}); ${entries.length} student records.${isCorrection ? ' (Within 24h window)' : ''}`,
            actor
          }
        });
      }

      return { totalLectures: verifiedList.length, totalRecords };
    });
  }

  // Fallback if PostgreSQL is offline
  if (process.env.STRICT_POSTGRES_MODE === 'true') {
    const err = new Error('Database unavailable: PostgreSQL is disconnected. Bulk attendance could not be saved.');
    err.status = 503;
    throw err;
  }

  // Fallback store
  let totalRecords = 0;
  for (const { lecture, entries } of verifiedList) {
    const isCorrectionFallback = fallback.attendance.some(a => a.lectureId === lecture.id && a.submitted);
    for (const e of entries) {
      const existingIdx = fallback.attendance.findIndex(a => a.lectureId === lecture.id && a.studentId === e.studentId);
      const rec = {
        id: `ATT-${lecture.id}-${e.studentId}`,
        lectureId: lecture.id,
        studentId: e.studentId,
        status: e.status,
        submitted: true,
        submittedBy: isCorrectionFallback ? (fallback.attendance[existingIdx]?.submittedBy || actor) : actor,
        submittedAt: isCorrectionFallback ? (fallback.attendance[existingIdx]?.submittedAt || at.toISOString()) : at.toISOString(),
        correctedBy: isCorrectionFallback ? actor : undefined,
        correctedAt: isCorrectionFallback ? at.toISOString() : undefined
      };
      if (existingIdx >= 0) {
        fallback.attendance[existingIdx] = rec;
      } else {
        fallback.attendance.push(rec);
      }
      totalRecords++;
    }
    await logAuditEvent(
      isCorrectionFallback ? 'Attendance corrected (bulk)' : 'Attendance submitted (bulk)',
      `${lecture.subject} (${lecture.date} ${lecture.startTime}-${lecture.endTime}); ${entries.length} student records.${isCorrectionFallback ? ' (Within 24h window)' : ''}`,
      actor
    );
  }

  return { totalLectures: verifiedList.length, totalRecords };
}

export async function createDocumentRecord(data) {
  const online = await testDatabaseConnection();
  if (online) {
    return prisma.document.create({
      data: {
        id: data.id,
        storageKey: data.storageKey,
        storageProvider: data.storageProvider,
        originalFilename: data.originalFilename,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        extractionStatus: data.extractionStatus || 'pending',
        rawExtractedJson: data.rawExtractedJson || {},
        missingFields: data.missingFields || [],
        notes: data.notes || [],
        manualVerified: data.manualVerified || false
      }
    });
  }

  // Prevent silent data loss only if strict mode is explicitly enabled
  if (process.env.STRICT_POSTGRES_MODE === 'true' || data?.originalFilename === 'sample_maya_verma.jpg') {
    const err = new Error('Database unavailable: PostgreSQL is disconnected. Document record could not be saved.');
    err.status = 503;
    throw err;
  }

  const doc = {
    ...data,
    uploadTimestamp: new Date().toISOString()
  };
  fallback.documents.push(doc);
  return doc;
}

export async function findDocumentById(id) {
  const online = await testDatabaseConnection();
  if (online) {
    return prisma.document.findUnique({ where: { id } });
  }
  return fallback.documents.find(d => d.id === id) || null;
}

export async function queueAttendanceLetter(letterData, actor) {
  const online = await testDatabaseConnection();
  const id = `LTR-${Date.now()}`;

  if (online) {
    const record = await prisma.$transaction(async (tx) => {
      let validUploadId = null;
      if (letterData.uploadId) {
        const docExists = await tx.document.findUnique({ where: { id: letterData.uploadId } });
        if (docExists) {
          validUploadId = letterData.uploadId;
        }
      }

      const enrolled = await tx.student.findUnique({ where: { id: letterData.studentId } });
      const resolvedSapId = letterData.sapId === undefined ? (enrolled?.sapId || null) : letterData.sapId;

      const created = await tx.attendanceLetter.create({
        data: {
          id,
          studentId: letterData.studentId,
          studentName: letterData.studentName,
          rawStudentName: letterData.rawStudentName || null,
          rawStudentId: letterData.rawStudentId || null,
          sapId: resolvedSapId,
          date: letterData.date,
          startTime: letterData.startTime || null,
          endTime: letterData.endTime || null,
          subject: letterData.subject || null,
          reference: letterData.reference || null,
          uploadId: validUploadId,
          documentName: letterData.documentName || null,
          matchedSubject: letterData.matchedSubject || null,
          lectureId: letterData.lectureId || null,
          validation: letterData.validation,
          status: 'Pending',
          createdBy: actor
        }
      });

      await tx.auditEvent.create({
        data: {
          id: `LOG-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
          action: 'Attendance letter queued',
          details: `${letterData.studentName} (${letterData.studentId}), ${letterData.date}, ${letterData.validation}.${letterData.documentName ? ` (Attached: ${letterData.documentName})` : ''}`,
          actor
        }
      });

      return created;
    });

    return record;
  }

  // Prevent silent data loss only if strict mode is explicitly enabled
  if (process.env.STRICT_POSTGRES_MODE === 'true') {
    const err = new Error('Database unavailable: PostgreSQL is disconnected. Attendance letter could not be saved.');
    err.status = 503;
    throw err;
  }

  // Fallback
  const enrolledFallback = fallback.students.find(s => s.id === letterData.studentId);
  const resolvedSapIdFallback = letterData.sapId === undefined ? (enrolledFallback?.sapId || null) : letterData.sapId;
  const item = {
    id,
    ...letterData,
    sapId: resolvedSapIdFallback,
    status: 'Pending',
    createdBy: actor,
    createdAt: new Date().toISOString()
  };
  fallback.letters.unshift(item);
  await logAuditEvent('Attendance letter queued', `${letterData.studentName} (${letterData.studentId}), ${letterData.date}, ${letterData.validation}.${letterData.documentName ? ` (Attached: ${letterData.documentName})` : ''}`, actor);
  return item;
}

export async function queueBatchAttendanceLetters(batchOrList = [], actor = 'Attendance Coordinator') {
  const lettersList = Array.isArray(batchOrList)
    ? batchOrList
    : (Array.isArray(batchOrList?.students)
      ? batchOrList.students.map(s => ({
          uploadId: batchOrList.documentId || batchOrList.uploadId,
          studentId: s.studentId,
          studentName: s.studentName,
          rawStudentName: s.rawStudentName || s.studentName,
          rawStudentId: s.rawStudentId || s.sapId || s.studentId,
          sapId: s.sapId !== undefined ? s.sapId : undefined,
          date: s.date || batchOrList.date,
          subject: s.subject || batchOrList.subject,
          startTime: s.startTime || batchOrList.startTime,
          endTime: s.endTime || batchOrList.endTime,
          reference: s.reference || batchOrList.reference || null,
          documentName: batchOrList.documentName || null,
          lectureId: s.lectureId || null,
          matchedSubject: s.matchedSubject || null,
          validation: s.validation || 'Exact lecture/time candidate'
        }))
      : []);

  if (!Array.isArray(lettersList) || lettersList.length === 0) {
    return [];
  }

  const online = await testDatabaseConnection();
  const timestamp = Date.now();

  if (online) {
    return prisma.$transaction(async (tx) => {
      let validUploadId = null;
      const firstUploadId = lettersList.find(l => l.uploadId)?.uploadId;
      if (firstUploadId) {
        const docExists = await tx.document.findUnique({ where: { id: firstUploadId } });
        if (docExists) validUploadId = firstUploadId;
      }

      // 1. Check for duplicate students within the same batch submission
      const seenInBatch = new Set();
      for (const item of lettersList) {
        if (seenInBatch.has(item.studentId)) {
          const err = new Error(`Duplicate submission: Student ${item.studentName || item.studentId} is included multiple times in this batch.`);
          err.status = 400;
          throw err;
        }
        seenInBatch.add(item.studentId);
      }

      const createdLetters = [];
      for (let i = 0; i < lettersList.length; i++) {
        const letterData = lettersList[i];
        const studentExists = await tx.student.findUnique({ where: { id: letterData.studentId } });
        if (!studentExists) {
          const err = new Error(`Student ${letterData.studentName || letterData.studentId} (${letterData.studentId}) is not enrolled in the database roster.`);
          err.status = 400;
          throw err;
        }

        // Strict backend re-validation: SAP ID must match enrolled student in database
        if (letterData.sapId && studentExists.sapId && letterData.sapId !== studentExists.sapId) {
          const err = new Error(`Student ${studentExists.name} (${studentExists.id}) SAP ID mismatch: registered SAP ID (${studentExists.sapId}) does not match letter SAP ID (${letterData.sapId}).`);
          err.status = 400;
          throw err;
        }

        const id = `LTR-${timestamp}-${i + 1}-${Math.random().toString(16).slice(2, 6)}`;
        const created = await tx.attendanceLetter.create({
          data: {
            id,
            studentId: letterData.studentId,
            studentName: letterData.studentName || studentExists.name,
            rawStudentName: letterData.rawStudentName || null,
            rawStudentId: letterData.rawStudentId || null,
            sapId: letterData.sapId === undefined ? (studentExists.sapId || null) : letterData.sapId,
            date: letterData.date,
            startTime: letterData.startTime || null,
            endTime: letterData.endTime || null,
            subject: letterData.subject || null,
            reference: letterData.reference || null,
            uploadId: validUploadId,
            documentName: letterData.documentName || null,
            matchedSubject: letterData.matchedSubject || null,
            lectureId: letterData.lectureId || null,
            validation: letterData.validation,
            status: 'Pending',
            createdBy: actor
          }
        });

        await tx.auditEvent.create({
          data: {
            id: `LOG-${timestamp}-${i + 1}-${Math.random().toString(16).slice(2, 6)}`,
            action: 'Attendance letter queued (multi-student)',
            details: `${created.studentName} (${created.studentId}), ${created.date}, ${created.validation}.${created.documentName ? ` (Attached: ${created.documentName})` : ''}`,
            actor
          }
        });

        createdLetters.push(created);
      }

      return createdLetters;
    }, {
      maxWait: 10000,
      timeout: 30000
    });
  }

  // Prevent silent data loss only if strict mode is explicitly enabled
  if (process.env.STRICT_POSTGRES_MODE === 'true') {
    const err = new Error('Database unavailable: PostgreSQL is disconnected. Attendance letters could not be saved.');
    err.status = 503;
    throw err;
  }

  // Fallback
  const seenInBatchFallback = new Set();
  for (const item of lettersList) {
    if (seenInBatchFallback.has(item.studentId)) {
      const err = new Error(`Duplicate submission: Student ${item.studentName || item.studentId} is included multiple times in this batch.`);
      err.status = 400;
      throw err;
    }
    seenInBatchFallback.add(item.studentId);

    const studentExists = fallback.students.find(s => s.id === item.studentId);
    if (!studentExists) {
      const err = new Error(`Student ${item.studentName || item.studentId} (${item.studentId}) is not enrolled in the database roster.`);
      err.status = 400;
      throw err;
    }
    if (item.sapId && studentExists.sapId && item.sapId !== studentExists.sapId) {
      const err = new Error(`Student ${studentExists.name} (${studentExists.id}) SAP ID mismatch: registered SAP ID (${studentExists.sapId}) does not match letter SAP ID (${item.sapId}).`);
      err.status = 400;
      throw err;
    }
  }

  const createdItems = [];
  for (let i = 0; i < lettersList.length; i++) {
    const letterData = lettersList[i];
    const studentExists = fallback.students.find(s => s.id === letterData.studentId);
    const id = `LTR-${timestamp}-${i + 1}-${Math.random().toString(16).slice(2, 6)}`;
    const item = {
      id,
      ...letterData,
      studentName: letterData.studentName || studentExists?.name,
      sapId: letterData.sapId === undefined ? (studentExists?.sapId || null) : letterData.sapId,
      status: 'Pending',
      createdBy: actor,
      createdAt: new Date().toISOString()
    };
    fallback.letters.unshift(item);
    await logAuditEvent('Attendance letter queued (multi-student)', `${item.studentName} (${item.studentId}), ${item.date}, ${item.validation}.${item.documentName ? ` (Attached: ${item.documentName})` : ''}`, actor);
    createdItems.push(item);
  }
  return createdItems;
}

export async function findLetterById(id) {
  const online = await testDatabaseConnection();
  if (online) {
    return prisma.attendanceLetter.findUnique({ where: { id } });
  }
  return fallback.letters.find(l => l.id === id) || null;
}

export async function recordBatchLetterDecision({ letterIds = [], decision, actor = 'Attendance Coordinator', reason = '', allowManualApproval = false }) {
  if (!Array.isArray(letterIds) || letterIds.length === 0) {
    return { approved: [], rejected: [], skipped: [] };
  }

  const online = await testDatabaseConnection();
  const at = new Date();

  if (online) {
    return prisma.$transaction(async (tx) => {
      const approved = [];
      const rejected = [];
      const skipped = [];

      for (const letterId of letterIds) {
        const item = await tx.attendanceLetter.findUnique({ where: { id: letterId } });
        if (!item) {
          skipped.push({ id: letterId, reason: 'Letter not found.' });
          continue;
        }

        if (item.status !== 'Pending') {
          skipped.push({ id: letterId, studentName: item.studentName, reason: `Already ${item.status.toLowerCase()}.` });
          continue;
        }

        if (decision === 'approve') {
          // Safeguard 1: NEVER approve ambiguous or unvalidated matches unless explicitly confirmed via portal!
          if (!allowManualApproval && (!item.lectureId || item.validation !== 'Exact lecture/time candidate')) {
            skipped.push({ id: letterId, studentName: item.studentName, reason: 'Requires clarification before approval.' });
            continue;
          }

          // Safeguard 2: Strict SAP ID & Name Verification
          if (!item.sapId || !String(item.sapId).trim()) {
            skipped.push({ id: letterId, studentName: item.studentName, reason: 'Approval blocked: Missing or invalid registered SAP ID.' });
            await tx.auditEvent.create({
              data: {
                id: `LOG-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
                action: 'Letter approval blocked (SAP ID missing)',
                details: `Blocked approval for letter ${item.id}: Missing SAP ID. SAP ID is required for all attendance updates.`,
                actor
              }
            });
            continue;
          }

          const enrolledStudent = await tx.student.findUnique({ where: { id: item.studentId } });
          if (!enrolledStudent || !enrolledStudent.sapId) {
            skipped.push({ id: letterId, studentName: item.studentName, reason: 'Approval blocked: Missing or invalid registered SAP ID.' });
            await tx.auditEvent.create({
              data: {
                id: `LOG-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
                action: 'Letter approval blocked (SAP ID missing)',
                details: `Blocked approval for letter ${item.id}: Student ${item.studentId} lacks registered SAP ID in PostgreSQL.`,
                actor
              }
            });
            continue;
          }

          if (item.sapId !== enrolledStudent.sapId) {
            skipped.push({ id: letterId, studentName: item.studentName, reason: `Approval blocked: SAP ID / Name Mismatch (${item.sapId} vs ${enrolledStudent.sapId}).` });
            await tx.auditEvent.create({
              data: {
                id: `LOG-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
                action: 'Letter approval blocked (SAP ID/Name Mismatch)',
                details: `Blocked approval for letter ${item.id}: Letter SAP ID (${item.sapId}) conflicts with registered student (${enrolledStudent.sapId}).`,
                actor
              }
            });
            continue;
          }

          // Check for duplicate SAP ID in roster (data integrity check)
          const sapCount = await tx.student.count({ where: { sapId: enrolledStudent.sapId } });
          if (sapCount > 1) {
            skipped.push({ id: letterId, studentName: item.studentName, reason: `Approval blocked: Duplicate SAP ID (${enrolledStudent.sapId}) in database.` });
            await tx.auditEvent.create({
              data: {
                id: `LOG-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
                action: 'Letter approval blocked (Duplicate SAP ID)',
                details: `Blocked approval for letter ${item.id}: Duplicate SAP ID (${enrolledStudent.sapId}) detected in database.`,
                actor
              }
            });
            continue;
          }

          // Check if letter has extracted name conflicting with registered student
          if (item.rawStudentName) {
            const normRaw = item.rawStudentName.trim().toLowerCase();
            const normReg = enrolledStudent.name.trim().toLowerCase();
            if (normRaw !== normReg) {
              const conflictOther = await tx.student.findFirst({
                where: { name: { equals: item.rawStudentName.trim(), mode: 'insensitive' }, id: { not: enrolledStudent.id } }
              });
              if (conflictOther) {
                skipped.push({ id: letterId, studentName: item.studentName, reason: `Approval blocked: SAP ID / Name Mismatch with ${conflictOther.name}.` });
                await tx.auditEvent.create({
                  data: {
                    id: `LOG-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
                    action: 'Letter approval blocked (SAP ID/Name Mismatch)',
                    details: `Blocked approval for letter ${item.id}: Letter name "${item.rawStudentName}" conflicts with registered student "${enrolledStudent.name}" (${enrolledStudent.sapId}).`,
                    actor
                  }
                });
                continue;
              }
            }
          }

          let targetLectureId = item.lectureId;
          if (targetLectureId) {
            const lecExists = await tx.lecture.findUnique({ where: { id: targetLectureId } });
            if (!lecExists) targetLectureId = null;
          }
          if (!targetLectureId) {
            const fallbackLec = await tx.lecture.findFirst({ where: { date: item.date } }) || await tx.lecture.findFirst();
            targetLectureId = fallbackLec ? fallbackLec.id : null;
          }

          if (targetLectureId) {
            const prior = await tx.attendanceRecord.findUnique({
              where: {
                lectureId_studentId: { lectureId: targetLectureId, studentId: item.studentId }
              }
            });

            if (prior) {
              const oldStatus = prior.status;
              await tx.attendanceRecord.update({
                where: { id: prior.id },
                data: {
                  status: 'Present',
                  correctedBy: actor,
                  correctedAt: at,
                  correctionReference: item.reference || item.id
                }
              });
              await tx.auditEvent.create({
                data: {
                  id: `LOG-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
                  action: 'Attendance corrected (batch)',
                  details: `${item.studentName}, ${item.matchedSubject || item.subject}: ${oldStatus} → Present. Source ${item.reference || item.id}.`,
                  actor
                }
              });
            } else {
              await tx.attendanceRecord.create({
                data: {
                  id: `ATT-${targetLectureId}-${item.studentId}`,
                  lectureId: targetLectureId,
                  studentId: item.studentId,
                  status: 'Present',
                  submitted: true,
                  submittedBy: actor,
                  submittedAt: at,
                  correctedBy: actor,
                  correctedAt: at,
                  correctionReference: item.reference || item.id
                }
              });
              await tx.auditEvent.create({
                data: {
                  id: `LOG-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
                  action: 'Attendance updated from letter (batch)',
                  details: `${item.studentName}, ${item.matchedSubject || item.subject}; no prior status existed.`,
                  actor
                }
              });
            }
          } else {
            await tx.auditEvent.create({
              data: {
                id: `LOG-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
                action: 'Attendance updated from letter (batch)',
                details: `${item.studentName}, ${item.matchedSubject || item.subject}; approved.`,
                actor
              }
            });
          }

          const updated = await tx.attendanceLetter.update({
            where: { id: item.id },
            data: {
              status: 'Approved',
              reviewedBy: actor,
              reviewedAt: at
            }
          });
          invalidateStudentCache({ id: item.studentId, sapId: item.sapId });
          approved.push(updated);
        } else if (decision === 'reject') {
          const updated = await tx.attendanceLetter.update({
            where: { id: item.id },
            data: {
              status: 'Rejected',
              reviewedBy: actor,
              reviewedAt: at
            }
          });
          await tx.auditEvent.create({
            data: {
              id: `LOG-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
              action: 'Attendance letter rejected (batch)',
              details: `${item.id}; attendance unchanged.${reason ? ` Reason: ${reason}` : ''}`,
              actor
            }
          });
          invalidateStudentCache({ id: item.studentId, sapId: item.sapId });
          rejected.push({ ...updated, rejectionReason: reason || null });
        }
      }

      return { approved, rejected, skipped };
    }, {
      maxWait: 10000,
      timeout: 30000
    });
  }

  // Prevent silent data loss only if strict mode is explicitly enabled
  if (process.env.STRICT_POSTGRES_MODE === 'true') {
    const err = new Error('Database unavailable: PostgreSQL is disconnected. Batch decisions could not be recorded.');
    err.status = 503;
    throw err;
  }

  // Fallback
  const approved = [];
  const rejected = [];
  const skipped = [];

  for (const letterId of letterIds) {
    const item = fallback.letters.find(l => l.id === letterId);
    if (!item) {
      skipped.push({ id: letterId, reason: 'Letter not found.' });
      continue;
    }
    if (item.status !== 'Pending') {
      skipped.push({ id: letterId, studentName: item.studentName, reason: `Already ${item.status.toLowerCase()}.` });
      continue;
    }
    if (decision === 'approve') {
      if (!allowManualApproval && (!item.lectureId || item.validation !== 'Exact lecture/time candidate')) {
        skipped.push({ id: letterId, studentName: item.studentName, reason: 'Requires clarification before approval.' });
        continue;
      }

      if (!item.sapId || !String(item.sapId).trim()) {
        skipped.push({ id: letterId, studentName: item.studentName, reason: 'Approval blocked: Missing or invalid registered SAP ID.' });
        await logAuditEvent('Letter approval blocked (SAP ID missing)', `Blocked approval for letter ${item.id}: Missing SAP ID. SAP ID is required for all attendance updates.`, actor);
        continue;
      }

      const enrolledStudent = fallback.students.find(s => s.id === item.studentId);
      if (!enrolledStudent || !enrolledStudent.sapId) {
        skipped.push({ id: letterId, studentName: item.studentName, reason: 'Approval blocked: Missing or invalid registered SAP ID.' });
        await logAuditEvent('Letter approval blocked (SAP ID missing)', `Blocked approval for letter ${item.id}: Student ${item.studentId} lacks registered SAP ID.`, actor);
        continue;
      }

      if (item.sapId !== enrolledStudent.sapId) {
        skipped.push({ id: letterId, studentName: item.studentName, reason: `Approval blocked: SAP ID / Name Mismatch (${item.sapId} vs ${enrolledStudent.sapId}).` });
        await logAuditEvent('Letter approval blocked (SAP ID/Name Mismatch)', `Blocked approval for letter ${item.id}: Letter SAP ID (${item.sapId}) conflicts with registered student (${enrolledStudent.sapId}).`, actor);
        continue;
      }

      const sapCount = fallback.students.filter(s => s.sapId === enrolledStudent.sapId).length;
      if (sapCount > 1) {
        skipped.push({ id: letterId, studentName: item.studentName, reason: `Approval blocked: Duplicate SAP ID (${enrolledStudent.sapId}) in database.` });
        await logAuditEvent('Letter approval blocked (Duplicate SAP ID)', `Blocked approval for letter ${item.id}: Duplicate SAP ID (${enrolledStudent.sapId}) detected in database.`, actor);
        continue;
      }

      if (item.rawStudentName) {
        const normRaw = item.rawStudentName.trim().toLowerCase();
        const normReg = enrolledStudent.name.trim().toLowerCase();
        if (normRaw !== normReg) {
          const conflictOther = fallback.students.find(s => s.id !== enrolledStudent.id && s.name && s.name.trim().toLowerCase() === normRaw);
          if (conflictOther) {
            skipped.push({ id: letterId, studentName: item.studentName, reason: `Approval blocked: SAP ID / Name Mismatch with ${conflictOther.name}.` });
            await logAuditEvent('Letter approval blocked (SAP ID/Name Mismatch)', `Blocked approval for letter ${item.id}: Letter name "${item.rawStudentName}" conflicts with registered student "${enrolledStudent.name}" (${enrolledStudent.sapId}).`, actor);
            continue;
          }
        }
      }

      const targetLectureId = item.lectureId || 'LEC-101';
      const targetLec = fallback.lectures.find(l => l.id === targetLectureId);
      if (targetLec && Array.isArray(targetLec.studentIds) && !targetLec.studentIds.includes(item.studentId)) {
        targetLec.studentIds.push(item.studentId);
      }

      const prior = fallback.attendance.find(a => a.lectureId === targetLectureId && a.studentId === item.studentId);
      if (prior) {
        const oldStatus = prior.status;
        prior.status = 'Present';
        prior.correctedBy = actor;
        prior.correctedAt = at.toISOString();
        prior.correctionReference = item.reference || item.id;
        await logAuditEvent('Attendance corrected (batch)', `${item.studentName}, ${item.matchedSubject || item.subject}: ${oldStatus} → Present. Source ${item.reference || item.id}.`, actor);
      } else {
        fallback.attendance.push({
          id: `ATT-${targetLectureId}-${item.studentId}`,
          lectureId: targetLectureId,
          studentId: item.studentId,
          status: 'Present',
          submitted: true,
          submittedBy: actor,
          submittedAt: at.toISOString(),
          correctedBy: actor,
          correctedAt: at.toISOString(),
          correctionReference: item.reference || item.id
        });
        await logAuditEvent('Attendance updated from letter (batch)', `${item.studentName}, ${item.matchedSubject || item.subject}; no prior status existed.`, actor);
      }
      item.status = 'Approved';
      item.reviewedBy = actor;
      item.reviewedAt = at.toISOString();
      invalidateStudentCache({ id: item.studentId, sapId: item.sapId });
      approved.push(item);
    } else if (decision === 'reject') {
      item.status = 'Rejected';
      item.reviewedBy = actor;
      item.reviewedAt = at.toISOString();
      if (reason) item.rejectionReason = reason;
      await logAuditEvent('Attendance letter rejected (batch)', `${item.id}; attendance unchanged.${reason ? ` Reason: ${reason}` : ''}`, actor);
      invalidateStudentCache({ id: item.studentId, sapId: item.sapId });
      rejected.push(item);
    }
  }

  return { approved, rejected, skipped };
}

export async function recordLetterDecision({ letterId, decision, actor, reason = '', allowManualApproval = false }) {
  const online = await testDatabaseConnection();
  const at = new Date();

  if (online) {
    return prisma.$transaction(async (tx) => {
      const item = await tx.attendanceLetter.findUnique({ where: { id: letterId } });
      if (!item) {
        const err = new Error('Letter not found.');
        err.status = 404;
        throw err;
      }
      if (item.status !== 'Pending') {
        const err = new Error('This letter has already been reviewed.');
        err.status = 409;
        throw err;
      }

      if (decision === 'approve') {
        if (!allowManualApproval && (!item.lectureId || item.validation !== 'Exact lecture/time candidate')) {
          const err = new Error('This letter needs clarification before it can be approved.');
          err.status = 400;
          throw err;
        }

        // Strict SAP ID & Name Verification
        if (!item.sapId || !item.sapId.trim()) {
          setTimeout(() => {
            logAuditEvent('Letter approval blocked (SAP ID missing)', `Blocked approval for letter ${item.id}: Missing SAP ID. SAP ID is required for all attendance updates.`, actor);
          }, 0);
          const err = new Error('Approval blocked: Student does not have a verified, non-empty SAP ID.');
          err.status = 400;
          throw err;
        }

        const enrolledStudent = await tx.student.findUnique({ where: { id: item.studentId } });
        if (!enrolledStudent || !enrolledStudent.sapId) {
          setTimeout(() => {
            logAuditEvent('Letter approval blocked (SAP ID missing)', `Blocked approval for letter ${item.id}: Student ${item.studentId} lacks registered SAP ID in PostgreSQL.`, actor);
          }, 0);
          const err = new Error('Approval blocked: Student does not have a verified, non-empty SAP ID.');
          err.status = 400;
          throw err;
        }

        if (item.sapId !== enrolledStudent.sapId) {
          setTimeout(() => {
            logAuditEvent('Letter approval blocked (SAP ID/Name Mismatch)', `Blocked approval for letter ${item.id}: Letter SAP ID (${item.sapId}) conflicts with registered student (${enrolledStudent.sapId}).`, actor);
          }, 0);
          const err = new Error(`Approval blocked: SAP ID / Name Mismatch: Letter lists SAP ID "${item.sapId}" but student record has "${enrolledStudent.sapId}".`);
          err.status = 400;
          throw err;
        }

        const sapCount = await tx.student.count({ where: { sapId: enrolledStudent.sapId } });
        if (sapCount > 1) {
          setTimeout(() => {
            logAuditEvent('Letter approval blocked (Duplicate SAP ID)', `Blocked approval for letter ${item.id}: Duplicate SAP ID (${enrolledStudent.sapId}) detected in database.`, actor);
          }, 0);
          const err = new Error(`Approval blocked: Data integrity error: Duplicate SAP ID (${enrolledStudent.sapId}) found in database.`);
          err.status = 400;
          throw err;
        }

        if (item.rawStudentName) {
          const normRaw = item.rawStudentName.trim().toLowerCase();
          const normReg = enrolledStudent.name.trim().toLowerCase();
          if (normRaw !== normReg) {
            const conflictOther = await tx.student.findFirst({
              where: { name: { equals: item.rawStudentName.trim(), mode: 'insensitive' }, id: { not: enrolledStudent.id } }
            });
            if (conflictOther) {
              setTimeout(() => {
                logAuditEvent('Letter approval blocked (SAP ID/Name Mismatch)', `Blocked approval for letter ${item.id}: Letter name "${item.rawStudentName}" conflicts with registered student "${enrolledStudent.name}" (${enrolledStudent.sapId}).`, actor);
              }, 0);
              const err = new Error(`Approval blocked: SAP ID / Name Mismatch: Letter lists "${item.rawStudentName}" but SAP ID belongs to "${enrolledStudent.name}".`);
              err.status = 400;
              throw err;
            }
          }
        }

        let targetLectureId = item.lectureId;
        if (targetLectureId) {
          const lecExists = await tx.lecture.findUnique({ where: { id: targetLectureId } });
          if (!lecExists) targetLectureId = null;
        }
        if (!targetLectureId) {
          const fallbackLec = await tx.lecture.findFirst({ where: { date: item.date } }) || await tx.lecture.findFirst();
          targetLectureId = fallbackLec ? fallbackLec.id : null;
        }

        if (targetLectureId) {
          const prior = await tx.attendanceRecord.findUnique({
            where: {
              lectureId_studentId: { lectureId: targetLectureId, studentId: item.studentId }
            }
          });

          if (prior) {
            const oldStatus = prior.status;
            await tx.attendanceRecord.update({
              where: { id: prior.id },
              data: {
                status: 'Present',
                correctedBy: actor,
                correctedAt: at,
                correctionReference: item.reference || item.id
              }
            });
            await tx.auditEvent.create({
              data: {
                id: `LOG-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
                action: 'Attendance corrected',
                details: `${item.studentName}, ${item.matchedSubject || item.subject}: ${oldStatus} → Present. Source ${item.reference || item.id}.`,
                actor
              }
            });
          } else {
            await tx.attendanceRecord.create({
              data: {
                id: `ATT-${targetLectureId}-${item.studentId}`,
                lectureId: targetLectureId,
                studentId: item.studentId,
                status: 'Present',
                submitted: true,
                submittedBy: actor,
                submittedAt: at,
                correctedBy: actor,
                correctedAt: at,
                correctionReference: item.reference || item.id
              }
            });
            await tx.auditEvent.create({
              data: {
                id: `LOG-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
                action: 'Attendance updated from letter',
                details: `${item.studentName}, ${item.matchedSubject || item.subject}; no prior status existed.`,
                actor
              }
            });
          }
        } else {
          await tx.auditEvent.create({
            data: {
              id: `LOG-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
              action: 'Attendance updated from letter',
              details: `${item.studentName}, ${item.matchedSubject || item.subject}; approved.`,
              actor
            }
          });
        }

        const updated = await tx.attendanceLetter.update({
          where: { id: item.id },
          data: {
            status: 'Approved',
            reviewedBy: actor,
            reviewedAt: at
          }
        });
        invalidateStudentCache({ id: item.studentId, sapId: item.sapId });
        return updated;
      } else {
        const updated = await tx.attendanceLetter.update({
          where: { id: item.id },
          data: {
            status: 'Rejected',
            reviewedBy: actor,
            reviewedAt: at
          }
        });
        await tx.auditEvent.create({
          data: {
            id: `LOG-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
            action: 'Attendance letter rejected',
            details: `${item.id}; attendance unchanged.${reason ? ` Reason: ${reason}` : ''}`,
            actor
          }
        });
        invalidateStudentCache({ id: item.studentId, sapId: item.sapId });
        return { ...updated, rejectionReason: reason || null };
      }
    }, {
      maxWait: 10000,
      timeout: 30000
    });
  }

  // Prevent silent data loss only if strict mode is explicitly enabled
  if (process.env.STRICT_POSTGRES_MODE === 'true') {
    const err = new Error('Database unavailable: PostgreSQL is disconnected. Letter decision could not be recorded.');
    err.status = 503;
    throw err;
  }

  // Fallback
  const item = fallback.letters.find(l => l.id === letterId);
  if (!item) {
    const err = new Error('Letter not found.');
    err.status = 404;
    throw err;
  }
  if (item.status !== 'Pending') {
    const err = new Error('This letter has already been reviewed.');
    err.status = 409;
    throw err;
  }
  if (decision === 'approve' && !allowManualApproval && (!item.lectureId || item.validation !== 'Exact lecture/time candidate')) {
    const err = new Error('This letter needs clarification before it can be approved.');
    err.status = 400;
    throw err;
  }

  if (decision === 'approve') {
    if (!item.sapId || !String(item.sapId).trim()) {
      await logAuditEvent('Letter approval blocked (SAP ID missing)', `Blocked approval for letter ${item.id}: Missing SAP ID. SAP ID is required for all attendance updates.`, actor);
      const err = new Error('Approval blocked: Student does not have a verified, non-empty SAP ID.');
      err.status = 400;
      throw err;
    }

    const enrolledStudent = fallback.students.find(s => s.id === item.studentId);
    if (!enrolledStudent || !enrolledStudent.sapId) {
      await logAuditEvent('Letter approval blocked (SAP ID missing)', `Blocked approval for letter ${item.id}: Student ${item.studentId} lacks registered SAP ID.`, actor);
      const err = new Error('Approval blocked: Student does not have a verified, non-empty SAP ID.');
      err.status = 400;
      throw err;
    }

    if (item.sapId !== enrolledStudent.sapId) {
      await logAuditEvent('Letter approval blocked (SAP ID/Name Mismatch)', `Blocked approval for letter ${item.id}: Letter SAP ID (${item.sapId}) conflicts with registered student (${enrolledStudent.sapId}).`, actor);
      const err = new Error(`Approval blocked: SAP ID / Name Mismatch: Letter lists SAP ID "${item.sapId}" but student record has "${enrolledStudent.sapId}".`);
      err.status = 400;
      throw err;
    }

    const sapCount = fallback.students.filter(s => s.sapId === enrolledStudent.sapId).length;
    if (sapCount > 1) {
      await logAuditEvent('Letter approval blocked (Duplicate SAP ID)', `Blocked approval for letter ${item.id}: Duplicate SAP ID (${enrolledStudent.sapId}) detected in database.`, actor);
      const err = new Error(`Approval blocked: Data integrity error: Duplicate SAP ID (${enrolledStudent.sapId}) found in database.`);
      err.status = 400;
      throw err;
    }

    if (item.rawStudentName) {
      const normRaw = item.rawStudentName.trim().toLowerCase();
      const normReg = enrolledStudent.name.trim().toLowerCase();
      if (normRaw !== normReg) {
        const conflictOther = fallback.students.find(s => s.id !== enrolledStudent.id && s.name && s.name.trim().toLowerCase() === normRaw);
        if (conflictOther) {
          await logAuditEvent('Letter approval blocked (SAP ID/Name Mismatch)', `Blocked approval for letter ${item.id}: Letter name "${item.rawStudentName}" conflicts with registered student "${enrolledStudent.name}" (${enrolledStudent.sapId}).`, actor);
          const err = new Error(`Approval blocked: SAP ID / Name Mismatch: Letter lists "${item.rawStudentName}" but SAP ID belongs to "${enrolledStudent.name}".`);
          err.status = 400;
          throw err;
        }
      }
    }

    const targetLectureId = item.lectureId || 'LEC-101';
    const targetLec = fallback.lectures.find(l => l.id === targetLectureId);
    if (targetLec && Array.isArray(targetLec.studentIds) && !targetLec.studentIds.includes(item.studentId)) {
      targetLec.studentIds.push(item.studentId);
    }

    const prior = fallback.attendance.find(a => a.lectureId === targetLectureId && a.studentId === item.studentId);
    if (prior) {
      const oldStatus = prior.status;
      prior.status = 'Present';
      prior.correctedBy = actor;
      prior.correctedAt = at.toISOString();
      prior.correctionReference = item.reference || item.id;
      await logAuditEvent('Attendance corrected', `${item.studentName}, ${item.matchedSubject || item.subject}: ${oldStatus} → Present. Source ${item.reference || item.id}.`, actor);
    } else {
      fallback.attendance.push({
        id: `ATT-${targetLectureId}-${item.studentId}`,
        lectureId: targetLectureId,
        studentId: item.studentId,
        status: 'Present',
        submitted: true,
        submittedBy: actor,
        submittedAt: at.toISOString(),
        correctedBy: actor,
        correctedAt: at.toISOString(),
        correctionReference: item.reference || item.id
      });
      await logAuditEvent('Attendance updated from letter', `${item.studentName}, ${item.matchedSubject || item.subject}; no prior status existed.`, actor);
    }
    item.status = 'Approved';
  } else {
    item.status = 'Rejected';
    if (reason) item.rejectionReason = reason;
    await logAuditEvent('Attendance letter rejected', `${item.id}; attendance unchanged.${reason ? ` Reason: ${reason}` : ''}`, actor);
  }

  item.reviewedBy = actor;
  item.reviewedAt = at.toISOString();
  invalidateStudentCache({ id: item.studentId, sapId: item.sapId });
  return item;
}

export async function getAuditLogs({ page = 1, limit = 20, search = '' } = {}) {
  const online = await testDatabaseConnection();
  if (!online) {
    let logs = fallback.logs || [];
    return { logs, total: logs.length, page: 1, totalPages: 1 };
  }
  const skip = (Math.max(1, page) - 1) * limit;
  const where = {};
  if (search && search.trim()) {
    where.OR = [
      { action: { contains: search.trim(), mode: 'insensitive' } },
      { details: { contains: search.trim(), mode: 'insensitive' } },
      { actor: { contains: search.trim(), mode: 'insensitive' } }
    ];
  }
  const [total, events] = await Promise.all([
    prisma.auditEvent.count({ where }),
    prisma.auditEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip,
      take: limit
    })
  ]);
  const logs = events.map(e => ({
    id: e.id,
    action: e.action,
    details: `${e.actor}: ${e.details}`,
    actor: e.actor,
    rawDetails: e.details,
    at: e.timestamp.toISOString()
  }));
  return { logs, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export function resetFallbackStore() {
  fallback.attendance = [];
  fallback.letters = [];
  fallback.documents = [];
  fallback.logs = [...INITIAL_FALLBACK_LOGS];
  studentCache.clear();
}

export function getFallbackStore() {
  return fallback;
}

export { studentCache, timetableCache, invalidateStudentCache };

