/**
 * AttendTrack 24-Hour Attendance Correction Window Enforcement
 *
 * Business Rule:
 * A teacher can mark or change attendance for a lecture only within
 * 24 hours of that lecture's scheduled end time.
 * After 24 hours have elapsed, the teacher must not be allowed to create,
 * edit, or change attendance for that lecture.
 */

export const COLLEGE_TIMEZONE = process.env.COLLEGE_TIMEZONE || 'Asia/Kolkata';
export const CORRECTION_WINDOW_HOURS = 24;
export const CORRECTION_WINDOW_MS = CORRECTION_WINDOW_HOURS * 60 * 60 * 1000;
export const LATE_CUTOFF_TIME = '18:00'; // 6:00 PM cutoff for Late attendance auto-conversion to Absent
export const UNMARKED_LATE_HOURS = 1; // Unmarked attendance becomes Late after 1 hour from scheduled end time

/**
 * Parses date ("YYYY-MM-DD") and time ("HH:MM") into an exact Date object
 * in the specified college timezone.
 */
export function parseLectureDateTime(dateStr, timeStr, timeZone = COLLEGE_TIMEZONE) {
  if (!dateStr) return null;
  const [rawH, rawM = '00'] = String(timeStr || '00:00').split(':');
  const h = rawH.padStart(2, '0');
  const m = rawM.padStart(2, '0');

  // Determine timezone offset string (e.g. "+05:30") for the target timezone
  const sample = new Date(`${dateStr}T12:00:00Z`);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset'
  });
  const parts = formatter.formatToParts(sample);
  const tzPart = parts.find(p => p.type === 'timeZoneName')?.value;
  let offset = '+00:00';
  if (tzPart && tzPart.startsWith('GMT')) {
    offset = tzPart.replace('GMT', '');
  }

  return new Date(`${dateStr}T${h}:${m}:00${offset}`);
}

/**
 * Resolves the scheduled end time of a lecture session.
 */
export function getLectureScheduledEndTime(lecture, timeZone = COLLEGE_TIMEZONE) {
  if (!lecture || !lecture.date) return null;
  const endTimeStr = lecture.endTime || lecture.startTime || '00:00';
  return parseLectureDateTime(lecture.date, endTimeStr, timeZone);
}

/**
 * Calculates the exact 24-hour correction deadline from the scheduled end time.
 */
export function getAttendanceCorrectionDeadline(lecture, timeZone = COLLEGE_TIMEZONE) {
  const endTime = getLectureScheduledEndTime(lecture, timeZone);
  if (!endTime || isNaN(endTime.getTime())) return null;
  return new Date(endTime.getTime() + CORRECTION_WINDOW_MS);
}

/**
 * Evaluates whether the 24-hour correction window is open or expired.
 * Strict Boundary: changes at or after the deadline are prohibited.
 */
export function checkAttendanceCorrectionWindow(lecture, currentTime = new Date(), timeZone = COLLEGE_TIMEZONE) {
  const now = currentTime instanceof Date ? currentTime : new Date(currentTime);
  const scheduledEnd = getLectureScheduledEndTime(lecture, timeZone);
  const deadline = getAttendanceCorrectionDeadline(lecture, timeZone);

  if (!scheduledEnd || !deadline || isNaN(scheduledEnd.getTime()) || isNaN(deadline.getTime())) {
    return {
      isValid: false,
      isOpen: false,
      isExpired: true,
      error: 'Invalid lecture date or end time.'
    };
  }

  const nowMs = now.getTime();
  const deadlineMs = deadline.getTime();

  // Exactly at or after the deadline: strictly prohibited
  const isExpired = nowMs >= deadlineMs;
  const isOpen = !isExpired;
  const remainingMs = Math.max(0, deadlineMs - nowMs);

  return {
    isValid: true,
    isOpen,
    isExpired,
    now,
    scheduledEnd,
    deadline,
    remainingMs,
    timeZone,
    formattedScheduledEnd: scheduledEnd.toLocaleString('en-IN', { timeZone, dateStyle: 'medium', timeStyle: 'short' }),
    formattedDeadline: deadline.toLocaleString('en-IN', { timeZone, dateStyle: 'medium', timeStyle: 'short' })
  };
}

/**
 * Calculates the exact 6:00 PM (18:00 IST) late attendance cutoff for a lecture.
 */
export function getLateAttendanceCutoff(lecture, timeZone = COLLEGE_TIMEZONE) {
  if (!lecture || !lecture.date) return null;
  return parseLectureDateTime(lecture.date, LATE_CUTOFF_TIME, timeZone);
}

/**
 * Evaluates whether the 6:00 PM (18:00) cutoff for late attendance has passed.
 * As soon as the clock reaches 6:00 PM on the lecture's date, this returns true.
 */
export function isLateCutoffPassed(lecture, currentTime = new Date(), timeZone = COLLEGE_TIMEZONE) {
  const cutoff = getLateAttendanceCutoff(lecture, timeZone);
  if (!cutoff || isNaN(cutoff.getTime())) return false;
  const now = currentTime instanceof Date ? currentTime : new Date(currentTime);
  return now.getTime() >= cutoff.getTime();
}

/**
 * Calculates the exact 1-hour post-lecture deadline when unmarked attendance becomes Late.
 */
export function getUnmarkedLateDeadline(lecture, timeZone = COLLEGE_TIMEZONE) {
  const endTime = getLectureScheduledEndTime(lecture, timeZone);
  if (!endTime || isNaN(endTime.getTime())) return null;
  return new Date(endTime.getTime() + (UNMARKED_LATE_HOURS * 60 * 60 * 1000));
}

/**
 * Evaluates whether 1 hour has elapsed since lecture scheduled end time without attendance being marked.
 */
export function isUnmarkedLateWindowPassed(lecture, currentTime = new Date(), timeZone = COLLEGE_TIMEZONE) {
  const deadline = getUnmarkedLateDeadline(lecture, timeZone);
  if (!deadline || isNaN(deadline.getTime())) return false;
  const now = currentTime instanceof Date ? currentTime : new Date(currentTime);
  return now.getTime() >= deadline.getTime();
}

/**
 * Resolves the institutional attendance status for a lecture session:
 * 1. If an explicit status exists (e.g. from teacher submission or approved letter):
 *    - 'Present': remains 'Present'.
 *    - 'Late': if 6:00 PM cutoff has passed, converts to 'Absent'; else remains 'Late'.
 *    - 'Absent': remains 'Absent'.
 * 2. If NO attendance was marked (unmarked/scheduled):
 *    - If 1 hour has elapsed after lecture end (isUnmarkedLateWindowPassed):
 *      - If 6:00 PM cutoff has passed: automatically 'Absent'.
 *      - Else: automatically 'Late'.
 *    - Otherwise: 'Scheduled'.
 */
export function resolveAttendanceStatusForSession(lecture, existingStatus = null, currentTime = new Date(), timeZone = COLLEGE_TIMEZONE) {
  const now = currentTime instanceof Date ? currentTime : new Date(currentTime);

  if (existingStatus) {
    if (existingStatus === 'Late') {
      return isLateCutoffPassed(lecture, now, timeZone) ? 'Absent' : 'Late';
    }
    return existingStatus;
  }

  // No explicit attendance record exists yet
  if (lecture && isUnmarkedLateWindowPassed(lecture, now, timeZone)) {
    if (isLateCutoffPassed(lecture, now, timeZone)) {
      return 'Absent';
    }
    return 'Late';
  }

  return 'Scheduled';
}

/**
 * Automatically converts any entry with status 'Late' to 'Absent' if the 6:00 PM cutoff has passed.
 */
export function resolveLateAttendanceEntries(lecture, entries, currentTime = new Date(), timeZone = COLLEGE_TIMEZONE) {
  if (!Array.isArray(entries)) return entries;
  const cutoffPassed = isLateCutoffPassed(lecture, currentTime, timeZone);
  if (!cutoffPassed) return entries;
  return entries.map(e => {
    if (e.status === 'Late') {
      return { ...e, status: 'Absent', autoConvertedFromLate: true };
    }
    return e;
  });
}

