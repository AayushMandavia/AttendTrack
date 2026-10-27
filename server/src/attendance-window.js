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
