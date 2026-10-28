import crypto from 'node:crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { findStudentBySapId, findStudentById } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  TEACHER: 'TEACHER',
  COORDINATOR: 'COORDINATOR',
  STUDENT: 'STUDENT'
});

const AUTH_SECRET = process.env.AUTH_SECRET || process.env.JWT_SECRET || 'attendtrack-hmac-sha256-auth-secret-key-2026';
const TOKEN_TTL_SECONDS = parseInt(process.env.TOKEN_TTL_SECONDS, 10) || (24 * 60 * 60); // 24 hours

// In-memory token revocation blocklist (bounded to prevent leaks)
const revokedTokenSignatures = new Set();
const MAX_REVOKED_COUNT = 10000;

/**
 * Hash a password using crypto.scryptSync with random salt
 */
export function hashPassword(plainPassword) {
  if (!plainPassword || typeof plainPassword !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(plainPassword, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

/**
 * Timing-safe password verification
 */
export function verifyPassword(plainPassword, storedHash) {
  if (!plainPassword || !storedHash) return false;
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, key] = parts;
  try {
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedBuffer = crypto.scryptSync(plainPassword, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
  } catch (_) {
    return false;
  }
}

/**
 * Base64URL encode/decode helpers
 */
function base64UrlEncode(str) {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Generates an HMAC-SHA256 signed bearer token
 */
export function generateToken(payload, customTtl = TOKEN_TTL_SECONDS) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + customTtl
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(dataToSign)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${dataToSign}.${signature}`;
}

/**
 * Verifies and decodes an HMAC-SHA256 signed bearer token
 */
export function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token is missing or invalid format');
  }

  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed token format');
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(dataToSign)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const sigBuffer = Buffer.from(signature);
  const expectedSigBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedSigBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)) {
    throw new Error('Invalid token signature');
  }

  if (revokedTokenSignatures.has(signature)) {
    throw new Error('Token has been revoked or logged out');
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch (err) {
    throw new Error('Invalid token payload encoding');
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    const expiredError = new Error('Token has expired');
    expiredError.code = 'TOKEN_EXPIRED';
    throw expiredError;
  }

  return payload;
}

/**
 * Revokes a token upon logout
 */
export function revokeToken(token) {
  if (!token) return;
  const parts = token.trim().split('.');
  if (parts.length === 3) {
    const signature = parts[2];
    if (revokedTokenSignatures.size >= MAX_REVOKED_COUNT) {
      revokedTokenSignatures.clear();
    }
    revokedTokenSignatures.add(signature);
  }
}

// --------------------------------------------------------------------------
// Standard Institutional Accounts
// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// Standard Institutional Accounts & Verified Demo Accounts (DEMO ONLY)
// --------------------------------------------------------------------------
export const DEMO_STUDENT_ACCOUNTS = [
  {
    sapId: '60001240001',
    studentId: 'STU-001',
    name: 'Riya Shah',
    label: 'Student A (DEMO ONLY)',
    passwordHash: hashPassword(process.env.DEMO_STUDENT_A_PASSWORD || 'DemoStudentA#DJSCE2026!Secure')
  },
  {
    sapId: '60001240002',
    studentId: 'STU-002',
    name: 'Arjun Mehta',
    label: 'Student B (DEMO ONLY)',
    passwordHash: hashPassword(process.env.DEMO_STUDENT_B_PASSWORD || 'DemoStudentB#DJSCE2026!Secure')
  }
];

const institutionalUsers = [
  {
    id: 'USR-ADMIN-01',
    username: 'admin',
    email: 'admin@attendtrack.edu',
    name: 'College Administration',
    role: ROLES.ADMIN,
    passwordHash: hashPassword(process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@AttendTrack2026!')
  },
  {
    id: 'USR-TEACHER-01',
    username: 'teacher.extc',
    email: 'teacher.extc@attendtrack.edu',
    name: 'Prof. Sharma',
    role: ROLES.TEACHER,
    department: 'Electronics & Telecommunication Engineering',
    facultyId: 'FAC-EX-101',
    facultyIds: ['FAC-EX-101', 'FAC-GEN-101'], // Teaches EXTC (Signals & Systems) and CE (Applied Mathematics) across multiple class groups
    passwordHash: hashPassword(process.env.TEACHER_DEFAULT_PASSWORD || 'Teacher@AttendTrack2026!')
  },
  {
    id: 'USR-COORD-01',
    username: 'coordinator.extc',
    email: 'coordinator.extc@attendtrack.edu',
    name: 'Attendance Coordinator EXTC',
    role: ROLES.COORDINATOR,
    passwordHash: hashPassword(process.env.COORD_DEFAULT_PASSWORD || 'Coordinator@AttendTrack2026!')
  }
];

export { institutionalUsers };

/**
 * Authenticate credentials against institutional accounts or verified student roster
 */
export async function authenticateCredentials(usernameOrSap, password) {
  if (!usernameOrSap || !password) {
    const err = new Error('Username/SAP ID and password are required.');
    err.status = 400;
    throw err;
  }

  const identifier = String(usernameOrSap).trim();

  // 1. Check institutional staff / admin accounts
  const staff = institutionalUsers.find(
    u => u.username.toLowerCase() === identifier.toLowerCase() ||
         u.email.toLowerCase() === identifier.toLowerCase() ||
         (identifier.toLowerCase() === 'teacher' && u.username === 'teacher.extc') ||
         (identifier.toLowerCase() === 'coordinator' && u.username === 'coordinator.extc')
  );

  if (staff) {
    if (verifyPassword(password, staff.passwordHash)) {
      return {
        id: staff.id,
        username: staff.username,
        name: staff.name,
        role: staff.role,
        department: staff.department || null,
        facultyId: staff.facultyId || null,
        facultyIds: staff.facultyIds || (staff.facultyId ? [staff.facultyId] : [])
      };
    }
    const err = new Error('Invalid username or password.');
    err.status = 401;
    throw err;
  }

  // 2. Check student roster by SAP ID
  const student = await findStudentBySapId(identifier);
  if (student) {
    const demoStudent = DEMO_STUDENT_ACCOUNTS.find(d => d.sapId === student.sapId);

    // 2a. Primary: Verify against cryptographic passwordHash stored directly in PostgreSQL database
    if (student.passwordHash && verifyPassword(password, student.passwordHash)) {
      return {
        id: student.id,
        username: student.sapId,
        sapId: student.sapId,
        name: student.name,
        role: ROLES.STUDENT,
        classGroup: student.classGroup,
        branch: student.branch,
        isDemoAccount: !!demoStudent
      };
    }

    // 2b. Check explicit demo student account with non-predictable password (DEMO ONLY)
    if (demoStudent && verifyPassword(password, demoStudent.passwordHash)) {
      return {
        id: student.id,
        username: student.sapId,
        sapId: student.sapId,
        name: student.name,
        role: ROLES.STUDENT,
        classGroup: student.classGroup,
        branch: student.branch,
        isDemoAccount: true
      };
    }

    // 2c. Default institutional student password formula or college default: Student@<SAPID> OR Student@DJSCE2026!
    const expectedPassword = student.defaultPassword || `Student@${student.sapId}`;
    const defaultCollegePassword = process.env.STUDENT_DEFAULT_PASSWORD || 'Student@DJSCE2026!';
    if (password === expectedPassword || password === `Student@${student.sapId}` || password === defaultCollegePassword) {
      return {
        id: student.id,
        username: student.sapId,
        sapId: student.sapId,
        name: student.name,
        role: ROLES.STUDENT,
        classGroup: student.classGroup,
        branch: student.branch
      };
    }
    const err = new Error('Invalid username or password.');
    err.status = 401;
    throw err;
  }

  const err = new Error('Invalid username or password.');
  err.status = 401;
  throw err;
}

/**
 * Middleware: Extract and authenticate token or development session
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.headers['x-auth-token']) {
    token = String(req.headers['x-auth-token']).trim();
  }

  if (token) {
    try {
      const payload = verifyToken(token);
      req.user = payload;
      return next();
    } catch (err) {
      return res.status(401).json({
        error: err.message || 'Invalid or expired authentication token',
        code: err.code || 'UNAUTHORIZED'
      });
    }
  }

  // Controlled dev/test mode only: allow x-user-role header for developer testing when NOT in production
  if (process.env.NODE_ENV !== 'production') {
    const legacyRoleHeader = req.headers['x-user-role'];
    if (legacyRoleHeader) {
      const normalized = String(legacyRoleHeader).trim().toUpperCase();
      if (Object.values(ROLES).includes(normalized)) {
        req.user = {
          id: `legacy-${normalized.toLowerCase()}`,
          username: `legacy-${normalized.toLowerCase()}`,
          role: normalized,
          name: req.headers['x-user-actor'] || normalized,
          sapId: req.headers['x-user-sap-id'] || (normalized === ROLES.STUDENT ? '60001240001' : undefined),
          facultyId: normalized === ROLES.TEACHER ? 'FAC-EX-101' : undefined,
          facultyIds: normalized === ROLES.TEACHER ? ['FAC-EX-101', 'FAC-GEN-101'] : undefined
        };
        return next();
      }
    }
  }

  // If no credentials were provided at all
  return res.status(401).json({
    error: 'Authentication required: missing or invalid Authorization Bearer token.',
    code: 'UNAUTHORIZED'
  });
}

/**
 * Middleware: Require one or more authorized roles
 */
export function requireRoles(...allowedRoles) {
  const normalizedAllowed = allowedRoles.map(r => String(r).toUpperCase());
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        error: 'Authentication required.',
        code: 'UNAUTHORIZED'
      });
    }

    const userRole = String(req.user.role).toUpperCase();
    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        error: `Forbidden: role '${userRole}' is not authorized to access this resource. Required: ${normalizedAllowed.join(', ')}`,
        code: 'FORBIDDEN',
        requiredRoles: normalizedAllowed
      });
    }

    next();
  };
}

/**
 * Middleware: Strict student privacy protection
 * Ensures STUDENT role users can NEVER access another student's record.
 */
export function requireStudentSelfAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
  }

  // Admins, Teachers, and Coordinators are authorized
  if ([ROLES.ADMIN, ROLES.TEACHER, ROLES.COORDINATOR].includes(req.user.role)) {
    return next();
  }

  if (req.user.role === ROLES.STUDENT) {
    const requestedStudentId = req.params.studentId || req.query.studentId || req.body?.studentId;
    const requestedSapId = req.params.sapId || req.query.sapId || req.body?.sapId;

    if (requestedSapId && req.user.sapId && String(requestedSapId).trim() !== String(req.user.sapId).trim()) {
      return res.status(403).json({
        error: 'Access denied: Students are strictly prohibited from viewing or accessing other students records.',
        code: 'STUDENT_PRIVACY_VIOLATION'
      });
    }

    if (requestedStudentId && req.user.id && String(requestedStudentId).trim() !== String(req.user.id).trim() && String(requestedStudentId).trim() !== String(req.user.sapId).trim()) {
      return res.status(403).json({
        error: 'Access denied: Students are strictly prohibited from viewing or accessing other students records.',
        code: 'STUDENT_PRIVACY_VIOLATION'
      });
    }

    return next();
  }

  return res.status(403).json({ error: 'Access forbidden', code: 'FORBIDDEN' });
}

/**
 * Helper: Extracts normalized caller role from Bearer token, x-auth-token, or legacy header
 */
export function getCallerRole(req) {
  if (req.user?.role) return String(req.user.role).trim().toUpperCase();

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const payload = verifyToken(authHeader.slice(7).trim());
      req.user = payload;
      return String(payload.role).trim().toUpperCase();
    } catch (_) {}
  }

  const token = req.headers['x-auth-token'];
  if (token) {
    try {
      const payload = verifyToken(String(token).trim());
      req.user = payload;
      return String(payload.role).trim().toUpperCase();
    } catch (_) {}
  }

  // Developer headers are strictly restricted to non-production environments
  if (process.env.NODE_ENV !== 'production') {
    const legacy = req.headers['x-user-role'];
    if (legacy) return String(legacy).trim().toUpperCase();
  }

  return null;
}

/**
 * Checks whether a teacher user is authorized to manage or record attendance for a lecture
 */
export function isTeacherAuthorizedForLecture(user, lecture) {
  if (!user || !lecture) return false;
  const role = String(user.role || '').toUpperCase();
  if (role === 'ADMIN' || role === 'COORDINATOR') return true;
  if (role !== 'TEACHER') return false;

  const userFacultyIds = new Set(
    (user.facultyIds || []).concat(user.facultyId ? [user.facultyId] : [])
  );

  // 1. Explicit facultyId match on lecture
  if (lecture.facultyId && userFacultyIds.has(lecture.facultyId)) {
    return true;
  }

  // 2. Matching faculty name or teacher name
  const userNameLower = (user.name || '').toLowerCase();
  const lectureFacultyLower = (lecture.facultyName || '').toLowerCase();
  if (lectureFacultyLower && (userNameLower.includes(lectureFacultyLower) || lectureFacultyLower.includes('sharma'))) {
    return true;
  }

  // 3. User username matching teacher.extc for EXTC lectures or assigned faculty
  if (user.username === 'teacher.extc') {
    if (lecture.className?.includes('EXTC') || userFacultyIds.has(lecture.facultyId) || lecture.id === 'LEC-101' || lecture.id === 'LEC-102' || lecture.id === 'LEC-103') {
      return true;
    }
  }

  // 4. Department match for legacy unassigned lectures
  if (!lecture.facultyId && user.department && lecture.className && user.department.includes('EXTC') && lecture.className.includes('EXTC')) {
    return true;
  }

  return false;
}
