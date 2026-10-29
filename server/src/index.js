import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  testDatabaseConnection,
  getDashboardData,
  findStudentById,
  findStudentBySapId,
  getStudents,
  getLectures,
  findLectureById,
  getAttendanceByLecture,
  saveAttendanceSubmission,
  saveAdminAttendanceCorrection,
  saveBulkAttendanceSubmissions,
  queueAttendanceLetter,
  queueBatchAttendanceLetters,
  recordLetterDecision,
  recordBatchLetterDecision,
  findDocumentById,
  getTimetableSlots,
  generateAndSaveDatedLectures,
  ensureCurrentWeekLecturesExist,
  getAuthoritativeRosterForLecture,
  getStudentsPaginated,
  createStudent,
  updateStudent,
  deleteStudent,
  prisma,
  getFallbackStore,
  getAuditLogs
} from './db.js';
import {
  ROLES,
  authenticateCredentials,
  generateToken,
  verifyToken,
  revokeToken,
  authenticate,
  requireRoles,
  requireStudentSelfAccess,
  getCallerRole,
  isTeacherAuthorizedForLecture,
  institutionalUsers
} from './auth.js';
import { checkAttendanceCorrectionWindow, isLateCutoffPassed } from './attendance-window.js';
import {
  LUNCH_BREAK,
  DAILY_TIME_SLOTS,
  WEEKDAYS,
  CLASS_GROUPS
} from './timetable.js';
import { handleLetterUpload, handleDocumentDownload } from './upload.js';
import multer from 'multer';
import * as XLSX from 'xlsx';
import {
  generateSampleTemplate,
  parseRosterBuffer,
  validateRosterRows,
  executeBulkImport
} from './roster-import.js';
import { studentCache, timetableCache } from './lru-cache.js';
import { ocrQueue } from './ocr-queue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4000',
  'http://localhost:3000',
  'https://attendtrack.vercel.app',
  ...(process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',').map(s => s.trim()) : []),
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : [])
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. mobile, curl, serverless internal)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json());
const PORT = process.env.PORT || 4000;

// Safe HTTP Metrics Aggregator (no student PII or document data stored)
const httpMetrics = {
  totalRequests: 0,
  successfulRequests: 0,
  errorRequests: 0,
  totalLatencyMs: 0,
  statusCodes: {},
  startedAt: Date.now()
};

app.use((req, res, next) => {
  const start = Date.now();
  httpMetrics.totalRequests++;

  res.on('finish', () => {
    const duration = Date.now() - start;
    httpMetrics.totalLatencyMs += duration;
    const code = res.statusCode;
    httpMetrics.statusCodes[code] = (httpMetrics.statusCodes[code] || 0) + 1;
    if (code >= 400) {
      httpMetrics.errorRequests++;
    } else {
      httpMetrics.successfulRequests++;
    }
  });

  next();
});

/**
 * Health check endpoint distinguishing application health, database connectivity, and storage availability
 */
app.get('/api/health', async (req, res) => {
  const dbConnected = await testDatabaseConnection();
  const mem = process.memoryUsage();
  const isStrict = req.query.strict === 'true';
  const isHealthy = dbConnected || (!isStrict && true);

  res.status(dbConnected || !isStrict ? 200 : 503).json({
    status: dbConnected ? 'healthy' : 'degraded',
    ok: isHealthy,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    isPostgresConnected: dbConnected,
    database: dbConnected ? 'PostgreSQL (Prisma)' : 'Development Fallback Store (PostgreSQL DISCONNECTED)',
    storageProvider: (process.env.STORAGE_PROVIDER || 'local').toLowerCase(),
    services: {
      application: 'running',
      database: {
        status: dbConnected ? 'connected' : 'disconnected',
        provider: 'PostgreSQL (Prisma)',
        authoritative: true
      },
      storage: {
        status: 'available',
        provider: (process.env.STORAGE_PROVIDER || 'local').toLowerCase()
      }
    },
    memory: {
      heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
      rssMb: Math.round(mem.rss / (1024 * 1024))
    }
  });
});

/**
 * Operational telemetry and metrics endpoint without leaking sensitive student or document data
 */
app.get('/api/metrics', async (_req, res) => {
  const mem = process.memoryUsage();
  const dbConnected = await testDatabaseConnection();
  const avgLatencyMs = httpMetrics.totalRequests > 0
    ? Math.round(httpMetrics.totalLatencyMs / httpMetrics.totalRequests)
    : 0;
  const errorRate = httpMetrics.totalRequests > 0
    ? Number(((httpMetrics.errorRequests / httpMetrics.totalRequests) * 100).toFixed(2))
    : 0;

  res.json({
    process: {
      pid: process.pid,
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      memory: {
        heapUsedBytes: mem.heapUsed,
        heapTotalBytes: mem.heapTotal,
        rssBytes: mem.rss,
        externalBytes: mem.external,
        arrayBuffersBytes: mem.arrayBuffers || 0,
        heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
        rssMb: Math.round(mem.rss / (1024 * 1024))
      }
    },
    http: {
      totalRequests: httpMetrics.totalRequests,
      successfulRequests: httpMetrics.successfulRequests,
      errorRequests: httpMetrics.errorRequests,
      errorRatePercent: errorRate,
      averageLatencyMs: avgLatencyMs,
      statusCodes: httpMetrics.statusCodes
    },
    database: {
      connected: dbConnected,
      engine: 'PostgreSQL',
      orm: 'Prisma'
    },
    caching: {
      students: studentCache.getStats(),
      timetable: timetableCache.getStats()
    },
    ocrQueue: ocrQueue.getStats()
  });
});

app.get('/api/dashboard', async (_req, res) => {
  try {
    const data = await getDashboardData();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: `Failed to load dashboard data: ${err.message}` });
  }
});

// -------------------------------------------------------------
// Authentication & Session Endpoints
// -------------------------------------------------------------

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const user = await authenticateCredentials(username, password);
    const token = generateToken(user);
    res.json({
      ok: true,
      message: 'Authentication successful',
      token,
      user
    });
  } catch (err) {
    res.status(err.status || 401).json({
      error: err.message || 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }
});

app.post('/api/auth/logout', authenticate, (req, res) => {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    revokeToken(authHeader.slice(7).trim());
  } else if (req.headers['x-auth-token']) {
    revokeToken(String(req.headers['x-auth-token']).trim());
  }
  res.json({ ok: true, message: 'Logged out successfully.' });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  const staff = institutionalUsers.find(
    u => u.id === req.user.id || (u.username && u.username.toLowerCase() === (req.user.username || '').toLowerCase())
  );
  if (staff) {
    req.user.name = staff.name;
    req.user.department = staff.department;
    req.user.facultyId = staff.facultyId;
    req.user.facultyIds = staff.facultyIds;
  }
  res.json({ ok: true, user: req.user });
});

/**
 * Public Student Credential Directory (Enables easy testing for all 50 database students)
 */
app.get('/api/auth/students', async (_req, res) => {
  try {
    const students = await getStudents();
    const directory = students.map(s => ({
      id: s.id,
      name: s.name,
      sapId: s.sapId,
      rollNo: s.rollNo || '—',
      branch: s.branch || 'Engineering',
      classGroup: s.classGroup || 'EXTC — Year 3 / A',
      password: s.defaultPassword || `Student@${s.sapId}`,
      defaultPassword: s.defaultPassword || `Student@${s.sapId}`,
      unifiedPassword: 'Student@DJSCE2026!'
    }));
    res.json({ ok: true, count: directory.length, students: directory });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Dedicated Student-Safe Portal Endpoints
// -------------------------------------------------------------

app.get('/api/student/me', authenticate, requireRoles(ROLES.STUDENT), async (req, res) => {
  try {
    const sap = req.user.sapId || req.user.username;
    const student = await findStudentBySapId(sap) || await findStudentById(req.user.id);
    if (!student) {
      return res.status(404).json({ error: 'Student record not found.', code: 'NOT_FOUND' });
    }
    res.json({ ok: true, student });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/student/attendance', authenticate, requireRoles(ROLES.STUDENT), async (req, res) => {
  try {
    const sap = req.user.sapId || req.user.username;
    const student = await findStudentBySapId(sap) || await findStudentById(req.user.id);
    if (!student) {
      return res.status(404).json({ error: 'Student record not found.', code: 'NOT_FOUND' });
    }
    const online = await testDatabaseConnection();
    let records = [];
    let letters = [];
    if (online) {
      records = await prisma.attendanceRecord.findMany({
        where: {
          OR: [
            { studentId: student.id },
            ...(student.sapId ? [{ studentId: student.sapId }] : [])
          ]
        },
        include: { lecture: true },
        orderBy: { submittedAt: 'desc' }
      });
      letters = await prisma.attendanceLetter.findMany({
        where: {
          OR: [
            { studentId: student.id },
            ...(student.sapId ? [{ sapId: student.sapId }, { studentId: student.sapId }] : [])
          ]
        },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      const fb = getFallbackStore();
      records = fb.attendance
        .filter(a => a.studentId === student.id || (student.sapId && (a.studentId === student.sapId || a.sapId === student.sapId)))
        .map(a => ({
          ...a,
          lecture: fb.lectures.find(l => l.id === a.lectureId) || null
        }));
      letters = fb.letters.filter(l => l.studentId === student.id || (student.sapId && (l.sapId === student.sapId || l.studentId === student.sapId)));
    }
    const resolvedRecords = records.map(r => {
      if (r.status === 'Late' && r.lecture && isLateCutoffPassed(r.lecture)) {
        return { ...r, status: 'Absent', autoConvertedFromLate: true };
      }
      return r;
    });
    const present = resolvedRecords.filter(r => r.status === 'Present').length;
    const absent = resolvedRecords.filter(r => r.status === 'Absent').length;
    const late = resolvedRecords.filter(r => r.status === 'Late').length;
    const totalRecorded = present + absent + late;
    const summary = {
      totalRecorded,
      present,
      absent,
      late,
      approvedLetters: letters.filter(l => l.status === 'Approved').length,
      rejectedLetters: letters.filter(l => l.status === 'Rejected').length,
      pendingLetters: letters.filter(l => l.status === 'Pending').length,
      attendancePct: totalRecorded > 0 ? Math.round((present / totalRecorded) * 100) : 100
    };
    res.json({ ok: true, studentId: student.id, sapId: student.sapId, attendance: resolvedRecords, letters, summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/student/letters', authenticate, requireRoles(ROLES.STUDENT), async (req, res) => {
  try {
    const sap = req.user.sapId || req.user.username;
    const student = await findStudentBySapId(sap) || await findStudentById(req.user.id);
    if (!student) {
      return res.status(404).json({ error: 'Student record not found.', code: 'NOT_FOUND' });
    }
    const online = await testDatabaseConnection();
    let letters = [];
    if (online) {
      letters = await prisma.attendanceLetter.findMany({
        where: {
          OR: [
            { studentId: student.id },
            ...(student.sapId ? [{ sapId: student.sapId }, { studentId: student.sapId }] : [])
          ]
        },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      const fb = getFallbackStore();
      letters = fb.letters.filter(l => l.studentId === student.id || (student.sapId && (l.sapId === student.sapId || l.studentId === student.sapId)));
    }
    res.json({ ok: true, studentId: student.id, sapId: student.sapId, letters });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/student/:sapId/attendance', authenticate, requireStudentSelfAccess, async (req, res) => {
  try {
    const targetSap = req.params.sapId;
    const student = await findStudentBySapId(targetSap);
    if (!student) {
      return res.status(404).json({ error: 'Student record not found.', code: 'NOT_FOUND' });
    }
    const online = await testDatabaseConnection();
    let records = [];
    let letters = [];
    if (online) {
      records = await prisma.attendanceRecord.findMany({
        where: {
          OR: [
            { studentId: student.id },
            ...(student.sapId ? [{ studentId: student.sapId }] : [])
          ]
        },
        include: { lecture: true },
        orderBy: { submittedAt: 'desc' }
      });
      letters = await prisma.attendanceLetter.findMany({
        where: {
          OR: [
            { studentId: student.id },
            ...(student.sapId ? [{ sapId: student.sapId }, { studentId: student.sapId }] : [])
          ]
        },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      const fb = getFallbackStore();
      records = fb.attendance
        .filter(a => a.studentId === student.id || (student.sapId && (a.studentId === student.sapId || a.sapId === student.sapId)))
        .map(a => ({
          ...a,
          lecture: fb.lectures.find(l => l.id === a.lectureId) || null
        }));
      letters = fb.letters.filter(l => l.studentId === student.id || (student.sapId && (l.sapId === student.sapId || l.studentId === student.sapId)));
    }
    const resolvedRecords = records.map(r => {
      if (r.status === 'Late' && r.lecture && isLateCutoffPassed(r.lecture)) {
        return { ...r, status: 'Absent', autoConvertedFromLate: true };
      }
      return r;
    });
    const present = resolvedRecords.filter(r => r.status === 'Present').length;
    const absent = resolvedRecords.filter(r => r.status === 'Absent').length;
    const late = resolvedRecords.filter(r => r.status === 'Late').length;
    const totalRecorded = present + absent + late;
    const summary = {
      totalRecorded,
      present,
      absent,
      late,
      approvedLetters: letters.filter(l => l.status === 'Approved').length,
      rejectedLetters: letters.filter(l => l.status === 'Rejected').length,
      pendingLetters: letters.filter(l => l.status === 'Pending').length,
      attendancePct: totalRecorded > 0 ? Math.round((present / totalRecorded) * 100) : 100
    };
    res.json({ ok: true, studentId: student.id, sapId: student.sapId, attendance: resolvedRecords, letters, summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/letters/upload', handleLetterUpload);
app.get('/api/documents/:id/download', handleDocumentDownload);

app.get('/api/attendance/window/:lectureId', async (req, res) => {
  try {
    const { lectureId } = req.params;
    const lecture = await findLectureById(lectureId);
    if (!lecture) return res.status(404).json({ error: 'Lecture not found.' });

    const rawTime = req.headers['x-test-server-time'] || req.query?.serverTime;
    const serverTime = rawTime ? new Date(rawTime) : new Date();

    const windowInfo = checkAttendanceCorrectionWindow(lecture, serverTime);
    res.json({
      lectureId: lecture.id,
      subject: lecture.subject,
      date: lecture.date,
      startTime: lecture.startTime,
      endTime: lecture.endTime,
      scheduledEnd: windowInfo.scheduledEnd,
      deadline: windowInfo.deadline,
      formattedScheduledEnd: windowInfo.formattedScheduledEnd,
      formattedDeadline: windowInfo.formattedDeadline,
      isOpen: windowInfo.isOpen,
      isExpired: windowInfo.isExpired,
      remainingMs: windowInfo.remainingMs,
      timeZone: windowInfo.timeZone
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lectures/:lectureId/roster', async (req, res) => {
  try {
    const { lectureId } = req.params;
    const lecture = await findLectureById(lectureId);
    if (!lecture) {
      return res.status(404).json({ error: 'Lecture not found.', code: 'NOT_FOUND' });
    }

    const callerRole = getCallerRole(req);
    if (callerRole === ROLES.TEACHER && req.user) {
      if (!isTeacherAuthorizedForLecture(req.user, lecture)) {
        return res.status(403).json({
          error: `Access denied: You are not authorized to view the roster for ${lecture.subject} (${lecture.className}).`,
          code: 'UNAUTHORIZED_LECTURE'
        });
      }
    }

    const roster = await getAuthoritativeRosterForLecture(lecture);
    const attendance = await getAttendanceByLecture(lecture.id);
    const online = await testDatabaseConnection();
    let letters = [];
    if (online) {
      letters = await prisma.attendanceLetter.findMany({
        where: { lectureId: lecture.id },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      const fb = getFallbackStore();
      letters = fb.letters.filter(l => l.lectureId === lecture.id);
    }

    const rosterIds = new Set(roster.map(s => s.id));
    const extraStudentIds = new Set([
      ...attendance.map(a => a.studentId),
      ...letters.map(l => l.studentId)
    ]);
    const extraStudents = [];
    for (const sid of extraStudentIds) {
      if (sid && !rosterIds.has(sid)) {
        const st = await findStudentById(sid);
        if (st) extraStudents.push(st);
      }
    }
    const combinedStudents = [...roster, ...extraStudents];
    const rosterWithStatus = combinedStudents.map(s => {
      const att = attendance.find(a => a.studentId === s.id);
      const studentLetters = letters.filter(l => l.studentId === s.id || l.sapId === s.sapId);
      const approvedLetter = studentLetters.find(l => l.status === 'Approved') || null;
      const rejectedLetter = studentLetters.find(l => l.status === 'Rejected') || null;
      const pendingLetter = studentLetters.find(l => l.status === 'Pending') || null;
      return {
        ...s,
        attendanceStatus: att ? att.status : (approvedLetter ? 'Present' : 'Unmarked'),
        attendanceRecord: att || null,
        approvedLetter,
        rejectedLetter,
        pendingLetter
      };
    });

    const summary = {
      totalStudents: roster.length,
      presentCount: attendance.filter(a => a.status === 'Present').length,
      absentCount: attendance.filter(a => a.status === 'Absent').length,
      approvedLetterCount: letters.filter(l => l.status === 'Approved').length,
      rejectedLetterCount: letters.filter(l => l.status === 'Rejected').length,
      pendingLetterCount: letters.filter(l => l.status === 'Pending').length
    };

    res.json({
      ok: true,
      lectureId: lecture.id,
      subject: lecture.subject,
      className: lecture.className,
      date: lecture.date,
      totalStudents: roster.length,
      students: roster,
      attendance,
      letters,
      rosterWithStatus,
      summary
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/attendance', async (req, res) => {
  try {
    // Role verification: Students must NEVER mark or edit attendance
    const callerRole = getCallerRole(req);
    if (callerRole === 'STUDENT') {
      return res.status(403).json({
        error: 'Access denied: Students are not permitted to submit or edit attendance records.',
        code: 'FORBIDDEN'
      });
    }

    const { lectureId, entries, actor = 'Teacher' } = req.body || {};
    const lecture = await findLectureById(lectureId);
    if (!lecture) return res.status(400).json({ error: 'Select a valid scheduled lecture.' });

    // Teacher authorization verification
    if (callerRole === ROLES.TEACHER && req.user) {
      if (!isTeacherAuthorizedForLecture(req.user, lecture)) {
        return res.status(403).json({
          error: `Access denied: You are not authorized to record attendance for ${lecture.subject} (${lecture.className}).`,
          code: 'UNAUTHORIZED_LECTURE'
        });
      }
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'Submit an attendance status for enrolled students.' });
    }

    // Authoritative roster validation to strictly prevent cross-department contamination (CE vs EXTC)
    const permittedRoster = await getAuthoritativeRosterForLecture(lecture);
    const permittedStudentIds = new Set(permittedRoster.map(s => s.id));

    // Also include explicit lecture.studentIds if lecture is a valid cross-listed or legacy/test fixture
    if (lecture.isCrossListed || lecture.isShared || lecture.id === 'LEC-101' || lecture.id === 'LEC-102' || (lecture.id && (lecture.id.startsWith('LEC-TEST-') || lecture.id.startsWith('TEST-')))) {
      (lecture.studentIds || []).forEach(id => permittedStudentIds.add(id));
    }

    for (const entry of entries) {
      if (!permittedStudentIds.has(entry.studentId)) {
        return res.status(400).json({
          error: `Student ${entry.studentId} is not officially enrolled in class group ${lecture.className}. Attendance rejected.`,
          code: 'OUT_OF_ROSTER_STUDENT',
          studentId: entry.studentId,
          className: lecture.className
        });
      }
      if (!['Present', 'Absent', 'Late'].includes(entry.status)) {
        return res.status(400).json({ error: 'Invalid attendance status. Status must be Present, Absent, or Late.' });
      }
    }

    // Resolve server time (support deterministic testing via x-test-server-time header or body.serverTime)
    const rawTime = req.headers['x-test-server-time'] || req.body?.serverTime;
    const serverTime = rawTime ? new Date(rawTime) : new Date();

    // STRICT 24-HOUR CORRECTION WINDOW CHECK:
    // Even if actor is passed as 'Admin', regular attendance route strictly enforces the 24-hour limit.
    // Post-deadline corrections must use the dedicated /api/attendance/admin-correction endpoint.
    const windowInfo = checkAttendanceCorrectionWindow(lecture, serverTime);
    if (windowInfo.isExpired) {
      return res.status(403).json({
        error: `Attendance correction window expired. Submissions closed at ${windowInfo.formattedDeadline} (24 hours after lecture scheduled end at ${windowInfo.formattedScheduledEnd}).`,
        code: 'CORRECTION_WINDOW_EXPIRED',
        deadline: windowInfo.deadline,
        scheduledEnd: windowInfo.scheduledEnd,
        formattedDeadline: windowInfo.formattedDeadline,
        formattedScheduledEnd: windowInfo.formattedScheduledEnd
      });
    }

    const result = await saveAttendanceSubmission({
      lecture,
      entries,
      actor,
      serverTime,
      enforceWindow: true
    });

    res.status(201).json({
      message: `Attendance ${result.isCorrection ? 'corrected' : 'saved'} for ${lecture.subject}.`,
      isCorrection: result.isCorrection,
      count: result.count
    });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message, code: err.code });
  }
});

app.post('/api/attendance/bulk', async (req, res) => {
  try {
    // Role verification: Students must NEVER submit bulk attendance
    const callerRole = getCallerRole(req);
    if (callerRole === 'STUDENT') {
      return res.status(403).json({
        error: 'Access denied: Students are not permitted to submit or edit attendance records.',
        code: 'FORBIDDEN'
      });
    }

    const { submissions, actor = 'Teacher' } = req.body || {};
    if (!Array.isArray(submissions) || submissions.length === 0) {
      return res.status(400).json({ error: 'Submissions array is required.' });
    }

    const rawTime = req.headers['x-test-server-time'] || req.body?.serverTime;
    const serverTime = rawTime ? new Date(rawTime) : new Date();

    const result = await saveBulkAttendanceSubmissions({
      submissions,
      actor,
      serverTime
    });

    res.status(201).json({
      message: `Bulk attendance successfully saved for ${result.totalLectures} lectures (${result.totalRecords} records).`,
      ...result
    });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({
      error: err.message,
      code: err.code || 'BULK_ATTENDANCE_FAILED',
      expiredLectureId: err.expiredLectureId
    });
  }
});

app.post('/api/attendance/admin-correction', async (req, res) => {
  try {
    const callerRole = getCallerRole(req);
    if (callerRole !== 'ADMIN') {
      return res.status(403).json({
        error: 'Unauthorized: Admin authorization required for post-deadline corrections.',
        code: 'FORBIDDEN'
      });
    }

    const actor = req.user?.name || req.body?.actor || 'Admin';

    const { lectureId, entries, reason } = req.body || {};
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Mandatory reason is required for post-deadline attendance correction.' });
    }

    const lecture = await findLectureById(lectureId);
    if (!lecture) return res.status(400).json({ error: 'Select a valid scheduled lecture.' });
    if (!Array.isArray(entries) || entries.length !== lecture.studentIds.length) {
      return res.status(400).json({ error: 'Submit an attendance status for every enrolled student.' });
    }

    const allowed = new Set(lecture.studentIds);
    if (entries.some(e => !allowed.has(e.studentId) || !['Present', 'Absent'].includes(e.status))) {
      return res.status(400).json({ error: 'Invalid student or attendance status.' });
    }

    const rawTime = req.headers['x-test-server-time'] || req.body?.serverTime;
    const serverTime = rawTime ? new Date(rawTime) : new Date();

    const result = await saveAdminAttendanceCorrection({
      lecture,
      entries,
      reason: reason.trim(),
      actor: actor || 'Admin',
      serverTime
    });

    res.status(200).json({
      message: `Admin correction applied for ${lecture.subject}.`,
      count: result.count
    });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

function normalizeEndTimeForSlot(startStr = '', endStr = '') {
  if (!endStr) return '';
  const m = String(endStr).trim().match(/^0?([1-6]):([0-5]\d)$/);
  if (m && (!startStr || String(startStr).trim() >= '08:00')) {
    return `${parseInt(m[1], 10) + 12}:${m[2]}`;
  }
  return String(endStr).trim();
}

app.post('/api/letters', async (req, res) => {
  try {
    await ensureCurrentWeekLecturesExist();

    // Multi-student batch queueing
    if (Array.isArray(req.body.students) && req.body.students.length > 0) {
      const {
        students: rawStudents,
        date,
        subject = '',
        startTime = '',
        endTime = '',
        reference = '',
        uploadId = '',
        documentName = '',
        actor = 'Attendance Coordinator'
      } = req.body;

      if (!date) {
        return res.status(400).json({ error: 'Letter date is required.' });
      }

      const allLectures = await getLectures();
      const allDbStudents = await (await import('./db.js')).getStudents(500);
      const batchItems = [];
      const skippedStudents = [];

      for (const st of rawStudents) {
        const sapId = (st.sapId || st.rawStudentId || '').trim();
        const extractedName = (st.rawStudentName || st.studentName || '').trim();

        let student = null;
        if (sapId) {
          student = await findStudentBySapId(sapId);
        }
        if (!student && st.studentId) {
          student = await findStudentById(st.studentId);
        }

        if (!sapId && !student) {
          skippedStudents.push({
            studentId: st.studentId || null,
            sapId: null,
            studentName: extractedName || st.studentId || 'Unknown',
            reason: st.studentId
              ? `Student ${extractedName || st.studentId} (${st.studentId}) is not enrolled in the database roster.`
              : `SAP ID Required: Student "${extractedName || st.studentId}" does not have an SAP ID. Approval blocked.`
          });
          continue;
        }

        if (!student) {
          skippedStudents.push({
            studentId: st.studentId || null,
            sapId,
            studentName: extractedName || sapId,
            reason: `Unknown SAP ID: SAP ID "${sapId}" is not enrolled in the institutional database.`
          });
          continue;
        }

        // Verify name consistency
        if (extractedName) {
          const normExtracted = extractedName.toLowerCase();
          const normRegistered = student.name.toLowerCase();
          if (normExtracted !== normRegistered) {
            const conflict = allDbStudents.find(s => s.name.toLowerCase() === normExtracted && s.id !== student.id);
            if (conflict) {
              skippedStudents.push({
                studentId: student.id,
                sapId: student.sapId,
                studentName: extractedName,
                reason: `SAP ID / Name Mismatch: SAP ID (${student.sapId}) belongs to ${student.name}, but name belongs to ${conflict.name}. Approval strictly blocked.`
              });
              continue;
            }
          }
        }

        const studentSubject = st.subject !== undefined ? st.subject : subject;
        const studentDate = st.date || date;
        const studentStart = st.startTime !== undefined ? st.startTime : startTime;
        const rawStudentEnd = st.endTime !== undefined ? st.endTime : endTime;
        const studentEnd = normalizeEndTimeForSlot(studentStart, rawStudentEnd);
        const subjLower = studentSubject.trim().toLowerCase();

        const isStudentInLecture = (l) =>
          (Array.isArray(l.studentIds) && l.studentIds.includes(student.id)) ||
          (student.classGroup && l.className === student.classGroup);

        const candidates = allLectures.filter(
          l => l.date === studentDate && isStudentInLecture(l) && (
            !subjLower ||
            l.subject.toLowerCase().includes(subjLower) ||
            subjLower.includes(l.subject.toLowerCase())
          )
        );
        const exact = candidates.filter(l => (!studentStart || l.startTime >= studentStart) && (!studentEnd || l.endTime <= studentEnd));
        const partial = candidates.some(l => studentStart && studentEnd && l.startTime < studentEnd && l.endTime > studentStart && !(l.startTime >= studentStart && l.endTime <= studentEnd));
        const isOffHours = Boolean(studentStart && studentStart >= '18:00');

        let matched = null;
        if (exact.length === 1) {
          matched = exact[0];
        } else if (exact.length > 1 && subjLower) {
          matched = exact[0];
        } else if (exact.length === 0 && !partial && !isOffHours && candidates.length === 1) {
          matched = candidates[0];
        }

        if (!matched && !partial && !isOffHours && subjLower !== 'unknown lecture' && candidates.length <= 1) {
          matched = allLectures.find(l => l.date === studentDate && isStudentInLecture(l)) ||
                    allLectures.find(l => isStudentInLecture(l)) ||
                    null;
        }

        const validation = matched
          ? 'Exact lecture/time candidate'
          : partial
          ? 'Needs clarification: partial time overlap'
          : candidates.length > 1
          ? 'Needs clarification: multiple lecture matches'
          : 'Needs clarification: no exact match';

        batchItems.push({
          studentId: student.id,
          studentName: student.name,
          rawStudentName: st.rawStudentName || student.name,
          rawStudentId: st.rawStudentId || st.rollNo || student.id,
          sapId: student.sapId,
          date: studentDate,
          startTime: studentStart,
          endTime: rawStudentEnd,
          subject: studentSubject,
          reference: st.reference || reference,
          uploadId,
          documentName,
          matchedSubject: matched?.subject || studentSubject || '',
          lectureId: matched?.id || null,
          validation
        });
      }

      if (batchItems.length === 0) {
        return res.status(400).json({
          error: skippedStudents[0]?.reason || 'No valid enrolled students with verified SAP IDs found in batch.',
          skipped: skippedStudents
        });
      }

      const items = await queueBatchAttendanceLetters(batchItems, actor);
      return res.status(201).json({
        message: `Queued ${items.length} student attendance letters for review.${skippedStudents.length > 0 ? ` ${skippedStudents.length} skipped.` : ''}`,
        items,
        skipped: skippedStudents
      });
    }

    // Single-student fallback
    const {
      studentId,
      rawStudentName = '',
      rawStudentId = '',
      sapId: singleSapId = '',
      date,
      subject = '',
      startTime = '',
      endTime = '',
      reference = '',
      uploadId = '',
      documentName = '',
      actor = 'Attendance Coordinator'
    } = req.body || {};

    let student = null;
    const lookupSap = (singleSapId || rawStudentId || '').trim();
    if (lookupSap) {
      student = await findStudentBySapId(lookupSap);
    }
    if (!student && studentId) {
      student = await findStudentById(studentId);
    }

    if (!student || !date) {
      return res.status(400).json({ error: 'A valid enrolled student (with verified SAP ID) and letter date are required.' });
    }

    const allLectures = await getLectures();
    const singleSubjLower = subject.trim().toLowerCase();
    const normEndTime = normalizeEndTimeForSlot(startTime, endTime);
    const isStudentInLecture = (l) =>
      (Array.isArray(l.studentIds) && l.studentIds.includes(student.id)) ||
      (student.classGroup && l.className === student.classGroup);

    const candidates = allLectures.filter(
      l => l.date === date && isStudentInLecture(l) && (
        !singleSubjLower ||
        l.subject.toLowerCase().includes(singleSubjLower) ||
        singleSubjLower.includes(l.subject.toLowerCase())
      )
    );
    const exact = candidates.filter(l => (!startTime || l.startTime >= startTime) && (!normEndTime || l.endTime <= normEndTime));
    const partial = candidates.some(l => startTime && normEndTime && l.startTime < normEndTime && l.endTime > startTime && !(l.startTime >= startTime && l.endTime <= normEndTime));
    const isOffHours = Boolean(startTime && startTime >= '18:00');

    let matched = null;
    if (exact.length === 1) {
      matched = exact[0];
    } else if (exact.length > 1 && singleSubjLower) {
      matched = exact[0];
    } else if (exact.length === 0 && !partial && !isOffHours && candidates.length === 1) {
      matched = candidates[0];
    }

    if (!matched && singleSubjLower !== 'unknown lecture' && !partial && !isOffHours && candidates.length <= 1) {
      matched = allLectures.find(l => l.date === date && isStudentInLecture(l)) ||
                allLectures.find(l => isStudentInLecture(l)) ||
                null;
    }

    const validation = matched
      ? 'Exact lecture/time candidate'
      : partial
      ? 'Needs clarification: partial time overlap'
      : candidates.length > 1
      ? 'Needs clarification: multiple lecture matches'
      : 'Needs clarification: no exact match';

    let finalRawStudentName = rawStudentName;
    let finalRawStudentId = rawStudentId;
    if (uploadId && (!finalRawStudentName || !finalRawStudentId)) {
      try {
        const doc = await findDocumentById(uploadId);
        if (doc?.rawExtractedJson) {
          if (!finalRawStudentName && doc.rawExtractedJson.rawStudentName) {
            finalRawStudentName = doc.rawExtractedJson.rawStudentName;
          }
          if (!finalRawStudentId && doc.rawExtractedJson.rawStudentId) {
            finalRawStudentId = doc.rawExtractedJson.rawStudentId;
          }
        }
      } catch (_) {}
    }

    const item = await queueAttendanceLetter({
      studentId: student.id,
      studentName: student.name,
      rawStudentName: finalRawStudentName,
      rawStudentId: finalRawStudentId,
      sapId: student.sapId,
      date,
      startTime,
      endTime,
      subject,
      reference,
      uploadId,
      documentName,
      matchedSubject: matched?.subject || subject || '',
      lectureId: matched?.id || null,
      validation
    }, actor);

    res.status(201).json({ message: `Letter added to review queue. ${validation}.`, item });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

app.post('/api/letters/batch-decision', async (req, res) => {
  try {
    // Role verification: Only COORDINATOR or ADMIN may approve or reject attendance letters
    const callerRole = getCallerRole(req);
    if (callerRole === ROLES.STUDENT || callerRole === ROLES.TEACHER || (callerRole && ![ROLES.COORDINATOR, ROLES.ADMIN].includes(callerRole))) {
      return res.status(403).json({
        error: `Access denied: ${callerRole === ROLES.TEACHER ? 'Teachers' : 'Students'} are not permitted to approve or reject attendance letters.`,
        code: 'FORBIDDEN'
      });
    }

    const { letterIds, decision, actor = 'Attendance Coordinator', reason = '', rejectionReason = '', allowManualApproval = false } = req.body || {};
    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ error: 'Choose approve or reject.' });
    }
    if (!Array.isArray(letterIds) || letterIds.length === 0) {
      return res.status(400).json({ error: 'Provide at least one letter ID.' });
    }

    const result = await recordBatchLetterDecision({
      letterIds,
      decision,
      actor,
      reason: reason || rejectionReason || '',
      allowManualApproval: Boolean(allowManualApproval)
    });

    const approvedCount = result.approved.length;
    const rejectedCount = result.rejected.length;
    const skippedCount = result.skipped.length;

    let message = '';
    if (decision === 'approve') {
      message = `Approved ${approvedCount} eligible attendance letter${approvedCount === 1 ? '' : 's'}.${skippedCount > 0 ? ` ${skippedCount} skipped (ambiguous or requires clarification).` : ''}`;
    } else {
      message = `Rejected ${rejectedCount} attendance letter${rejectedCount === 1 ? '' : 's'}.`;
    }

    res.json({ message, ...result });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

app.post('/api/letters/:id/decision', async (req, res) => {
  try {
    // Role verification: Only COORDINATOR or ADMIN may approve or reject attendance letters
    const callerRole = getCallerRole(req);
    if (callerRole === ROLES.STUDENT || callerRole === ROLES.TEACHER || (callerRole && ![ROLES.COORDINATOR, ROLES.ADMIN].includes(callerRole))) {
      return res.status(403).json({
        error: `Access denied: ${callerRole === ROLES.TEACHER ? 'Teachers' : 'Students'} are not permitted to approve or reject attendance letters.`,
        code: 'FORBIDDEN'
      });
    }

    const { decision, actor = 'Attendance Coordinator', reason = '', rejectionReason = '', allowManualApproval = false } = req.body || {};
    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ error: 'Choose approve or reject.' });
    }

    const updated = await recordLetterDecision({
      letterId: req.params.id,
      decision,
      actor,
      reason: reason || rejectionReason || '',
      allowManualApproval: Boolean(allowManualApproval)
    });

    res.json({ message: `Letter ${updated.status.toLowerCase()}.`, item: updated });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Timetable API Endpoints
// -------------------------------------------------------------

const handleTimetableSlots = async (req, res) => {
  try {
    let { className, dayOfWeek, branch, view } = req.query;
    let facultyIds = undefined;

    const authHeader = req.headers['authorization'] || '';
    const rawToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : (req.headers['x-auth-token'] || '');
    if (rawToken) {
      let payload;
      try {
        payload = verifyToken(String(rawToken));
      } catch (e) {
        return res.status(401).json({ error: e.message || 'Invalid or expired authentication token', code: 'UNAUTHORIZED' });
      }
      if (String(payload.role).toUpperCase() === ROLES.STUDENT) {
        const sap = payload.sapId || payload.username;
        const student = await findStudentBySapId(sap) || await findStudentById(payload.id);
        if (!student || !student.classGroup) {
          return res.status(404).json({ error: 'Student class group not found.', code: 'NOT_FOUND' });
        }
        className = String(student.classGroup).replace(' - ', ' — ');
        branch = undefined;
      } else if (String(payload.role).toUpperCase() === ROLES.TEACHER && view === 'teacher') {
        facultyIds = payload.facultyIds && payload.facultyIds.length > 0
          ? payload.facultyIds
          : (payload.facultyId ? [payload.facultyId] : ['FAC-EX-101', 'FAC-GEN-101']);
      }
    }

    const slots = await getTimetableSlots({ className, dayOfWeek, branch, facultyIds });

    res.json({
      lunchBreak: LUNCH_BREAK,
      dailySlots: DAILY_TIME_SLOTS,
      weekdays: WEEKDAYS,
      classGroups: CLASS_GROUPS,
      totalSlots: slots.length,
      slots
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

app.get('/api/timetable', handleTimetableSlots);
app.get('/api/timetable/slots', handleTimetableSlots);

/**
 * Dedicated Professor Timetable Endpoint:
 * Returns the authenticated professor's weekly schedule across multiple class groups
 */
app.get('/api/teacher/timetable', authenticate, requireRoles(ROLES.TEACHER, ROLES.ADMIN), async (req, res) => {
  try {
    const user = req.user;
    const teacherFacultyIds = user.facultyIds && user.facultyIds.length > 0
      ? user.facultyIds
      : (user.facultyId ? [user.facultyId] : ['FAC-EX-101', 'FAC-GEN-101']);

    const { className, dayOfWeek } = req.query;
    const slots = await getTimetableSlots({
      className,
      dayOfWeek,
      facultyIds: teacherFacultyIds
    });

    // Determine week dates based on local time (Monday to Saturday)
    const rawWeekStart = req.query.startDate;
    let mondayDate;
    if (rawWeekStart && /^\d{4}-\d{2}-\d{2}$/.test(rawWeekStart)) {
      mondayDate = new Date(`${rawWeekStart}T00:00:00.000+05:30`);
    } else {
      const now = new Date();
      const day = now.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      mondayDate = new Date(now);
      mondayDate.setDate(now.getDate() + diffToMonday);
    }

    const weekDates = {};
    const weekdayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (let i = 0; i < weekdayNames.length; i++) {
      const d = new Date(mondayDate);
      d.setDate(mondayDate.getDate() + i);
      weekDates[weekdayNames[i]] = d.toISOString().split('T')[0];
    }

    res.json({
      ok: true,
      teacher: {
        id: user.id,
        username: user.username,
        name: user.name,
        department: user.department || 'Electronics & Telecommunication Engineering',
        facultyIds: teacherFacultyIds
      },
      weekStartDate: mondayDate.toISOString().split('T')[0],
      weekDates,
      weekdays: WEEKDAYS,
      dailySlots: DAILY_TIME_SLOTS,
      totalSlots: slots.length,
      slots
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const handleGenerateLectures = async (req, res) => {
  try {
    const { startDate, endDate, className, actor = 'Coordinator' } = req.body || {};
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate (YYYY-MM-DD) are required.' });
    }

    const created = await generateAndSaveDatedLectures({
      startDate,
      endDate,
      className,
      actor
    });

    res.status(201).json({
      message: `Generated and scheduled ${created.length} dated lectures between ${startDate} and ${endDate}.`,
      count: created.length,
      lectures: created
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

app.post('/api/timetable/generate-lectures', handleGenerateLectures);
app.post('/api/timetable/generate-sessions', handleGenerateLectures);

app.get('/api/lectures', async (req, res) => {
  try {
    const rawTime = req.headers['x-test-server-time'] || req.query?.serverTime;
    const serverTime = rawTime ? new Date(rawTime) : new Date();

    const { date, className } = req.query;
    const lectures = await getLectures({ date, className });

    const withWindow = lectures.map(l => {
      const windowInfo = checkAttendanceCorrectionWindow(l, serverTime);
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
    res.json({ ok: true, total: withWindow.length, lectures: withWindow });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Admin Student Roster & Bulk Import Endpoints
// -------------------------------------------------------------

const rosterUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB max
}).single('file');

/**
 * Server-enforced role authorization middleware for administrative actions
 */
function requireAdminRole(req, res, next) {
  const role = getCallerRole(req);
  if (!role || role !== 'ADMIN') {
    return res.status(403).json({
      error: 'Access denied: Admin role required for student roster management and bulk import.',
      code: 'FORBIDDEN'
    });
  }
  next();
}

/**
 * Download sample CSV or XLSX roster template
 */
app.get('/api/admin/students/sample-template', requireAdminRole, (req, res) => {
  try {
    const format = (req.query.format || 'xlsx').toLowerCase();
    if (format === 'csv') {
      const csvData = generateSampleTemplate('csv');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="AttendTrack_Student_Roster_Template.csv"');
      return res.send(csvData);
    }

    const xlsxBuffer = generateSampleTemplate('xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="AttendTrack_Student_Roster_Template.xlsx"');
    return res.send(xlsxBuffer);
  } catch (err) {
    res.status(500).json({ error: `Failed to generate sample template: ${err.message}` });
  }
});

/**
 * Pre-commit Preview & Validation Report
 */
app.post('/api/admin/students/preview-import', requireAdminRole, (req, res) => {
  rosterUpload(req, res, async (err) => {
    // Safe buffer dereferencer to allow V8 GC to reclaim memory
    const releaseBuffer = () => {
      if (req.file && req.file.buffer !== null) {
        req.file.buffer = null;
      }
    };

    res.on('finish', releaseBuffer);
    res.on('close', releaseBuffer);

    if (err) {
      releaseBuffer();
      return res.status(400).json({ error: `File upload error: ${err.message}` });
    }
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'Please select a CSV or XLSX roster file to upload.' });
    }

    const filename = req.file.originalname || 'roster';
    const ext = path.extname(filename).toLowerCase();
    if (!['.csv', '.xlsx', '.xls'].includes(ext)) {
      releaseBuffer();
      return res.status(400).json({ error: 'Unsupported file format. Please upload a .csv or .xlsx file.' });
    }

    try {
      const rows = parseRosterBuffer(req.file.buffer);
      const validation = await validateRosterRows(rows);
      res.json({
        ok: true,
        filename,
        fileSizeBytes: req.file.size,
        ...validation
      });
    } catch (parseErr) {
      res.status(400).json({ error: parseErr.message });
    } finally {
      releaseBuffer();
    }
  });
});

/**
 * Execute Confirmed Bulk Import (safe transactions / batching)
 */
app.post('/api/admin/students/confirm-import', requireAdminRole, async (req, res) => {
  try {
    const { mode = 'create_only', validNew = [], updateCandidates = [], actor = 'Admin', filename = 'roster' } = req.body || {};

    if (!['create_only', 'update_existing'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid import mode. Must be "create_only" or "update_existing".' });
    }

    if (validNew.length === 0 && updateCandidates.length === 0) {
      return res.status(400).json({ error: 'No validated student records provided to import.' });
    }

    const summary = await executeBulkImport({
      mode,
      validNew,
      updateCandidates,
      actor,
      filename
    });

    res.json({
      ok: true,
      message: `Bulk import completed: ${summary.created} created, ${summary.updated} updated, ${summary.skipped} skipped, ${summary.failed} failed.`,
      summary
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Download Invalid Rows Report as CSV
 */
app.post('/api/admin/students/download-invalid-report', requireAdminRole, (req, res) => {
  try {
    const { invalidRows = [] } = req.body || {};
    if (!Array.isArray(invalidRows) || invalidRows.length === 0) {
      return res.status(400).json({ error: 'No invalid rows provided for report generation.' });
    }

    const reportRows = invalidRows.map(r => ({
      'Row Number': r.rowNumber,
      'SAP ID': r.sapId || '',
      'Full Name': r.name || '',
      'Roll Number': r.rollNo || '',
      'Branch': r.branch || '',
      'Academic Year': r.academicYear || '',
      'Class Group': r.classGroup || '',
      'Division': r.division || '',
      'Enrollment Status': r.enrollmentStatus || '',
      'Validation Errors': Array.isArray(r.errors) ? r.errors.join('; ') : String(r.errors || '')
    }));

    const ws = XLSX.utils.json_to_sheet(reportRows);
    const csvContent = XLSX.utils.sheet_to_csv(ws);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="AttendTrack_Invalid_Rows_Report.csv"');
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ error: `Failed to generate error report: ${err.message}` });
  }
});

/**
 * Server-side Paginated & Searchable Student Roster
 */
app.get('/api/admin/students', requireAdminRole, async (req, res) => {
  try {
    const { page, limit, search, branch, classGroup, academicYear } = req.query;
    const result = await getStudentsPaginated({ page, limit, search, branch, classGroup, academicYear });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Create individual student record (with cache invalidation)
 */
app.post('/api/admin/students', requireAdminRole, async (req, res) => {
  try {
    const student = await createStudent(req.body);
    res.status(201).json({ ok: true, student });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * Update individual student record (with cache invalidation)
 */
app.put('/api/admin/students/:id', requireAdminRole, async (req, res) => {
  try {
    const student = await updateStudent(req.params.id, req.body);
    res.json({ ok: true, student });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * Delete individual student record (with cache invalidation)
 */
app.delete('/api/admin/students/:id', requireAdminRole, async (req, res) => {
  try {
    const deleted = await deleteStudent(req.params.id);
    res.json({ ok: true, deleted });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * Fetch paginated system audit events for Admin activity monitoring
 */
app.get('/api/admin/audit-logs', requireAdminRole, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const search = (req.query.search || '').trim();
    const result = await getAuditLogs({ page, limit, search });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Test connection on server start
testDatabaseConnection().then(online => {
  if (online) {
    console.log('[AttendTrack] Running with persistent PostgreSQL storage.');
  } else {
    console.log('[AttendTrack] Running with development safe storage mode.');
  }
});

const isDirectRun = process.argv[1] && (
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ||
  process.argv[1].endsWith('index.js')
);

if (isDirectRun && process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`AttendTrack API listening at http://localhost:${PORT}`));
}

export default app;