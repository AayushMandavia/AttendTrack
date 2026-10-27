/**
 * DEPRECATED / LEGACY TEST FIXTURE ONLY
 *
 * NOTE: This module contains static fixture fixtures retained solely for backwards
 * compatibility with early unit tests (e.g., upload-and-extraction.test.js).
 *
 * It is NOT the authoritative application state. Authoritative data for students,
 * lectures, attendance, letters, and audit events is strictly persisted in PostgreSQL
 * via Prisma ORM and accessed through server/src/db.js.
 */

export const students = Object.freeze([
  { id: 'STU-001', name: 'Riya Shah' },
  { id: 'STU-002', name: 'Arjun Mehta' },
  { id: 'STU-003', name: 'Sara Khan' },
  { id: 'STU-004', name: 'Dev Patel' }
]);

export const lectures = Object.freeze([
  { id: 'LEC-101', subject: 'Database Systems', className: 'EXTC — Year 3 / A', date: '2026-10-14', startTime: '10:00', endTime: '11:00', studentIds: students.map(s => s.id) },
  { id: 'LEC-102', subject: 'Computer Networks', className: 'EXTC — Year 3 / A', date: '2026-10-14', startTime: '11:00', endTime: '12:00', studentIds: students.map(s => s.id) },
  { id: 'LEC-103', subject: 'Signals & Systems', className: 'EXTC — Year 3 / A', date: '2026-10-15', startTime: '09:00', endTime: '10:00', studentIds: students.map(s => s.id) }
]);

// Deprecated empty structures kept read-only to prevent mutable global state
export const attendance = Object.freeze([]);
export const letters = Object.freeze([]);
export const logs = Object.freeze([]);

export function log(action, details, actor = 'System') {
  console.info(`[Audit-Log: ${actor}] ${action} - ${details}`);
}