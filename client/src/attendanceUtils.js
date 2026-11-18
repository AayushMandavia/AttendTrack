/**
 * Attendance & Lecture Real-Time Utilities
 *
 * Implements real-time lecture matching and institutional 6:00 PM late cutoff rules
 * in the college timezone (Asia/Kolkata).
 */

export const COLLEGE_TIMEZONE = 'Asia/Kolkata';
export const UNMARKED_LATE_HOURS = 1;
export const LATE_CUTOFF_TIME = '18:00';

export function getLocalDateStr(date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: COLLEGE_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(date);
  } catch (e) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

export function getLocalTimeStr(date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: COLLEGE_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return formatter.format(date);
  } catch (e) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
}

/**
 * Checks whether the clock has reached or passed 6:00 PM (18:00 IST) on the lecture's date.
 * If lectureDate is today and time is >= 18:00, or lectureDate was in the past, returns true.
 */
export function isLateCutoffReached(lectureDate, now = new Date()) {
  if (!lectureDate) return false;
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: COLLEGE_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    const getVal = type => parts.find(p => p.type === type)?.value;
    const istDate = `${getVal('year')}-${getVal('month')}-${getVal('day')}`;
    const istHour = parseInt(getVal('hour'), 10);

    // If lecture date was before today, 6:00 PM on that date is in the past
    if (lectureDate < istDate) return true;
    // If lecture date is in the future, 6:00 PM has not arrived
    if (lectureDate > istDate) return false;
    // Today: check if hour >= 18 (6:00 PM)
    return istHour >= 18;
  } catch (e) {
    const [y, m, d] = lectureDate.split('-').map(Number);
    const cutoff = new Date(y, m - 1, d, 18, 0, 0);
    return now.getTime() >= cutoff.getTime();
  }
}

/**
 * Checks whether 1 hour has elapsed after a lecture's scheduled end time.
 */
export function isUnmarkedLateWindowPassed(lecture, now = new Date()) {
  if (!lecture || !lecture.date) return false;
  const todayStr = getLocalDateStr(now);
  const currentTimeStr = getLocalTimeStr(now);

  if (lecture.date < todayStr) return true;
  if (lecture.date > todayStr) return false;

  const endTimeStr = lecture.endTime || lecture.startTime || '00:00';
  const [endH, endM = 0] = endTimeStr.split(':').map(Number);
  const lateCutoffH = endH + UNMARKED_LATE_HOURS;
  const lateCutoffTimeStr = `${String(lateCutoffH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

  return currentTimeStr >= lateCutoffTimeStr;
}

/**
 * Resolves attendance status according to the institutional rules:
 * - If marked: preserves 'Present' / 'Absent'; converts 'Late' to 'Absent' after 6:00 PM.
 * - If unmarked: becomes 'Late' 1 hour after lecture end; becomes 'Absent' after 6:00 PM.
 */
export function resolveAttendanceStatusForSession(lecture, existingStatus = null, now = new Date()) {
  const isPast6PM = isLateCutoffReached(lecture?.date, now);

  if (existingStatus) {
    if (existingStatus === 'Late') {
      return isPast6PM ? 'Absent' : 'Late';
    }
    return existingStatus;
  }

  if (lecture && isUnmarkedLateWindowPassed(lecture, now)) {
    return isPast6PM ? 'Absent' : 'Late';
  }

  return 'Scheduled';
}

/**
 * Resolves the real-time active lecture matching the current clock time.
 * Prioritizes today's lecture currently in session (e.g. 17:00-18:00 when time is 17:00).
 */
export function resolveRealTimeLecture(lectures = [], preferredFacultyIds = null, now = new Date()) {
  if (!Array.isArray(lectures) || lectures.length === 0) return null;
  const todayStr = getLocalDateStr(now);
  const currentTimeStr = getLocalTimeStr(now);

  let pool = lectures;
  if (Array.isArray(preferredFacultyIds) && preferredFacultyIds.length > 0) {
    const teacherPool = lectures.filter(l => l.facultyId && preferredFacultyIds.includes(l.facultyId));
    if (teacherPool.length > 0) pool = teacherPool;
  }

  const todayLectures = pool.filter(l => l.date === todayStr);

  if (todayLectures.length > 0) {
    // 1. Lecture in session right now
    const inProgress = todayLectures.find(l => l.startTime <= currentTimeStr && currentTimeStr < l.endTime);
    if (inProgress) return inProgress;

    // 2. Upcoming lecture today starting next
    const upcoming = todayLectures
      .filter(l => l.startTime > currentTimeStr)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
    if (upcoming) return upcoming;

    // 3. Concluded lecture earlier today
    const justEnded = todayLectures
      .filter(l => l.endTime <= currentTimeStr)
      .sort((a, b) => b.endTime.localeCompare(a.endTime))[0];
    if (justEnded) return justEnded;

    return todayLectures[0];
  }

  // Fallback to all today's lectures
  const allToday = lectures.filter(l => l.date === todayStr);
  if (allToday.length > 0) {
    const inProgress = allToday.find(l => l.startTime <= currentTimeStr && currentTimeStr < l.endTime);
    if (inProgress) return inProgress;
    const upcoming = allToday.filter(l => l.startTime > currentTimeStr).sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
    if (upcoming) return upcoming;
    const justEnded = allToday.filter(l => l.endTime <= currentTimeStr).sort((a, b) => b.endTime.localeCompare(a.endTime))[0];
    if (justEnded) return justEnded;
    return allToday[0];
  }

  // Nearest future date in chronological order
  const future = lectures.filter(l => l.date > todayStr).sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  if (future.length > 0) return future[0];

  return lectures[0] || null;
}

