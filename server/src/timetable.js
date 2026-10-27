/**
 * AttendTrack Recurring Timetable Specification
 * College Hours: 08:00 AM to 06:00 PM
 * Working Days: Monday through Saturday (6 days)
 * Daily Slots: 9 lecture slots of exactly 1 hour each
 * Lunch Break: 13:00 to 14:00 (excluded from lecture scheduling)
 * 
 * 54 Slots per class group per week
 */

export const LUNCH_BREAK = {
  startTime: '13:00',
  endTime: '14:00',
  description: 'College Lunch Break'
};

export const DAILY_TIME_SLOTS = [
  { slotNumber: 1, startTime: '08:00', endTime: '09:00' },
  { slotNumber: 2, startTime: '09:00', endTime: '10:00' },
  { slotNumber: 3, startTime: '10:00', endTime: '11:00' },
  { slotNumber: 4, startTime: '11:00', endTime: '12:00' },
  { slotNumber: 5, startTime: '12:00', endTime: '13:00' },
  // Lunch Break: 13:00 - 14:00 (Excluded)
  { slotNumber: 6, startTime: '14:00', endTime: '15:00' },
  { slotNumber: 7, startTime: '15:00', endTime: '16:00' },
  { slotNumber: 8, startTime: '16:00', endTime: '17:00' },
  { slotNumber: 9, startTime: '17:00', endTime: '18:00' }
];

export const WEEKDAYS = [
  { name: 'Monday', index: 1 },
  { name: 'Tuesday', index: 2 },
  { name: 'Wednesday', index: 3 },
  { name: 'Thursday', index: 4 },
  { name: 'Friday', index: 5 },
  { name: 'Saturday', index: 6 }
];

export const CLASS_GROUPS = [
  { className: 'CE — Year 3 / A', branch: 'Computer Engineering', code: 'CE' },
  { className: 'IT — Year 3 / A', branch: 'Information Technology', code: 'IT' },
  { className: 'EXTC — Year 3 / A', branch: 'EXTC', code: 'EXTC' },
  { className: 'EE — Year 3 / A', branch: 'Electrical Engineering', code: 'EE' },
  { className: 'ME — Year 3 / A', branch: 'Mechanical Engineering', code: 'ME' }
];

// Department curriculum subjects & faculty allocations
export const CURRICULUM = {
  CE: {
    subjects: [
      { name: 'Database Systems', facultyId: 'FAC-CE-101', facultyName: 'Prof. Animesh Sen', room: 'Lab 301' },
      { name: 'Computer Networks', facultyId: 'FAC-CE-102', facultyName: 'Dr. Radhika Rao', room: 'Room 302' },
      { name: 'Operating Systems', facultyId: 'FAC-CE-103', facultyName: 'Prof. Vishal Patil', room: 'Lab 303' },
      { name: 'Computer Organization', facultyId: 'FAC-CE-104', facultyName: 'Dr. Sunita Deshmukh', room: 'Room 304' },
      { name: 'Programming Languages', facultyId: 'FAC-CE-105', facultyName: 'Prof. Manish Gupta', room: 'Lab 305' },
      { name: 'Applied Mathematics', facultyId: 'FAC-GEN-101', facultyName: 'Dr. K. R. Sharma', room: 'Auditorium A' }
    ]
  },
  IT: {
    subjects: [
      { name: 'Web Engineering', facultyId: 'FAC-IT-101', facultyName: 'Prof. S. N. Roy', room: 'IT Lab 1' },
      { name: 'Cloud Computing', facultyId: 'FAC-IT-102', facultyName: 'Dr. Arvind Joshi', room: 'Room 401' },
      { name: 'Information Security', facultyId: 'FAC-IT-103', facultyName: 'Prof. Preeti Nair', room: 'Room 402' },
      { name: 'Software Engineering', facultyId: 'FAC-IT-104', facultyName: 'Dr. R. K. Verma', room: 'Room 403' },
      { name: 'Data Mining & BI', facultyId: 'FAC-IT-105', facultyName: 'Prof. Hemant Shah', room: 'IT Lab 2' },
      { name: 'Applied Mathematics', facultyId: 'FAC-GEN-102', facultyName: 'Dr. Anita Pillai', room: 'Auditorium B' }
    ]
  },
  EXTC: {
    subjects: [
      { name: 'Signals & Systems', facultyId: 'FAC-EX-101', facultyName: 'Prof. Sharma', room: 'EXTC Lab 1' },
      { name: 'Digital Communication', facultyId: 'FAC-EX-102', facultyName: 'Prof. N. K. Wagle', room: 'Room 201' },
      { name: 'Microcontrollers & Embedded', facultyId: 'FAC-EX-103', facultyName: 'Dr. M. S. Godse', room: 'EXTC Lab 2' },
      { name: 'Electromagnetic Fields', facultyId: 'FAC-EX-104', facultyName: 'Prof. R. T. Chawla', room: 'Room 202' },
      { name: 'Analog Circuit Design', facultyId: 'FAC-EX-105', facultyName: 'Dr. Kavita Kulkarni', room: 'EXTC Lab 3' },
      { name: 'Applied Mathematics', facultyId: 'FAC-GEN-103', facultyName: 'Prof. Sanjay Bhatt', room: 'Auditorium C' }
    ]
  },
  EE: {
    subjects: [
      { name: 'Power Systems', facultyId: 'FAC-EE-101', facultyName: 'Dr. H. V. Prasad', room: 'EE Lab 1' },
      { name: 'Control Systems', facultyId: 'FAC-EE-102', facultyName: 'Prof. Smita More', room: 'Room 101' },
      { name: 'Electrical Machines', facultyId: 'FAC-EE-103', facultyName: 'Dr. B. K. Tripathi', room: 'EE Machinery Lab' },
      { name: 'Power Electronics', facultyId: 'FAC-EE-104', facultyName: 'Prof. Anand Nadkarni', room: 'EE Lab 2' },
      { name: 'Renewable Energy Systems', facultyId: 'FAC-EE-105', facultyName: 'Dr. G. K. Menon', room: 'Room 102' },
      { name: 'Applied Mathematics', facultyId: 'FAC-GEN-104', facultyName: 'Dr. P. K. Bannerjee', room: 'Room 103' }
    ]
  },
  ME: {
    subjects: [
      { name: 'Thermodynamics', facultyId: 'FAC-ME-101', facultyName: 'Dr. S. K. Mahajan', room: 'ME Lecture Hall' },
      { name: 'Fluid Mechanics', facultyId: 'FAC-ME-102', facultyName: 'Prof. Alok Ranade', room: 'Fluid Lab' },
      { name: 'Strength of Materials', facultyId: 'FAC-ME-103', facultyName: 'Dr. Nitin Sawant', room: 'SOM Lab' },
      { name: 'Kinematics of Machinery', facultyId: 'FAC-ME-104', facultyName: 'Prof. D. K. Shirke', room: 'Room 501' },
      { name: 'Manufacturing Processes', facultyId: 'FAC-ME-105', facultyName: 'Dr. Jayant Gokhale', room: 'Workshop 1' },
      { name: 'Applied Mathematics', facultyId: 'FAC-GEN-105', facultyName: 'Prof. Reema Sen', room: 'Room 502' }
    ]
  }
};

/**
 * Generates the full 54-slot recurring timetable for a class group across Monday to Saturday.
 * Ensures:
 * - 9 slots/day (08:00 - 18:00)
 * - Excludes 13:00 - 14:00 lunch
 * - No simultaneous conflict for class or faculty
 */
export function generateWeeklyTimetableForClass(classGroup) {
  const slots = [];
  const curr = CURRICULUM[classGroup.code];
  if (!curr) return slots;

  const subjectList = curr.subjects;

  for (let dayIdx = 0; dayIdx < WEEKDAYS.length; dayIdx++) {
    const weekday = WEEKDAYS[dayIdx];

    for (let sIdx = 0; sIdx < DAILY_TIME_SLOTS.length; sIdx++) {
      const slotDef = DAILY_TIME_SLOTS[sIdx];
      // Deterministic rotation of subjects per day/slot to distribute curriculum evenly
      const subjIndex = (dayIdx * 3 + sIdx) % subjectList.length;
      const subj = subjectList[subjIndex];

      const slotId = `SLOT-${classGroup.code}-${weekday.name.slice(0, 3).toUpperCase()}-${slotDef.slotNumber}`;

      slots.push({
        id: slotId,
        dayOfWeek: weekday.name,
        dayIndex: weekday.index,
        slotNumber: slotDef.slotNumber,
        startTime: slotDef.startTime,
        endTime: slotDef.endTime,
        subject: subj.name,
        className: classGroup.className,
        branch: classGroup.branch,
        facultyId: subj.facultyId,
        facultyName: subj.facultyName,
        room: subj.room
      });
    }
  }

  return slots;
}

/**
 * Generates the master recurring timetable across all class groups (54 slots * 5 classes = 270 slots)
 */
export function generateMasterTimetable() {
  const allSlots = [];
  for (const cg of CLASS_GROUPS) {
    allSlots.push(...generateWeeklyTimetableForClass(cg));
  }
  return allSlots;
}

/**
 * Generates dated lecture instances from recurring timetable slots for a date range.
 * Excludes lunch break (13:00-14:00).
 * Excludes Sundays (rest day).
 * 
 * @param {Object} options
 * @param {string} options.startDate 'YYYY-MM-DD'
 * @param {string} options.endDate 'YYYY-MM-DD'
 * @param {string} [options.className] Filter by class group
 * @param {Object<string, string[]>} [options.studentIdsByClass] Map of className -> studentIds[]
 */
export function generateDatedLecturesFromTimetable({ startDate, endDate, className, studentIdsByClass = {} }) {
  const masterSlots = generateMasterTimetable();
  const filteredSlots = className ? masterSlots.filter(s => s.className === className) : masterSlots;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const datedLectures = [];

  const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = weekdayNames[d.getDay()];
    if (dayOfWeek === 'Sunday') continue; // Sunday is holiday

    const dateStr = d.toISOString().split('T')[0];
    const daySlots = filteredSlots.filter(s => s.dayOfWeek === dayOfWeek);

    for (const slot of daySlots) {
      const studentIds = studentIdsByClass[slot.className] || [];
      const code = slot.id.split('-')[1]; // e.g. EXTC
      const lectureId = `LEC-${dateStr.replace(/-/g, '')}-${code}-S${slot.slotNumber}`;

      datedLectures.push({
        id: lectureId,
        subject: slot.subject,
        className: slot.className,
        date: dateStr,
        startTime: slot.startTime,
        endTime: slot.endTime,
        studentIds,
        facultyId: slot.facultyId,
        timetableSlotId: slot.id,
        room: slot.room
      });
    }
  }

  return datedLectures;
}
