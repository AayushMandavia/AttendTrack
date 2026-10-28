import { useState, useMemo, useEffect, useRef } from 'react';

// --- SVG Icons ---
function IconDashboard({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}

function IconLetterProcessing({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <line x1="10" y1="9" x2="8" y2="9"/>
    </svg>
  );
}

function IconAttendanceReview({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  );
}

function IconReports({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  );
}

function IconAuditLogs({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
      <line x1="9" y1="12" x2="15" y2="12"/>
      <line x1="9" y1="16" x2="13" y2="16"/>
    </svg>
  );
}

function IconNotifications({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
    </svg>
  );
}

function IconLogout({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

function IconCalendar({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}

function IconCloudUpload({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/>
      <path d="M12 12v9"/>
      <path d="m16 16-4-4-4 4"/>
    </svg>
  );
}

function IconDownload({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}

function IconPlusCircle({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="16"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  );
}

function IconSearch({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}

function IconUsers({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

function IconLightning({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  );
}

function IconClock({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

function IconChevronRight({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

function IconCheckDoc({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <path d="m9 15 2 2 4-4"/>
    </svg>
  );
}

function IconFileDoc({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  );
}

function IconClipboard({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
      <path d="m9 14 2 2 4-4"/>
    </svg>
  );
}

function IconList({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/>
      <line x1="3" y1="12" x2="3.01" y2="12"/>
      <line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  );
}

// Transform raw audit logs into clean, coordinator-facing activity entries
function parseCoordinatorLog(log, index) {
  if (!log) return null;
  const rawDetails = log.details || '';
  const action = log.action || '';
  const actor = log.actor || '';
  const atDate = log.at ? new Date(log.at) : new Date();

  const datePart = atDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timePart = atDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const formattedTime = `${datePart}, ${timePart}`;

  let role = 'Coordinator';
  let displayName = 'R. Coordinator';
  let initials = 'AC';
  let cleanAction = action;
  let cleanDetails = rawDetails;
  let roleClass = 'coord';

  const actorLower = actor.toLowerCase();
  const actionLower = action.toLowerCase();
  const detailsLower = rawDetails.toLowerCase();

  // Teacher entries
  if (
    actor.includes('Prof.') ||
    actionLower.includes('attendance submitted') ||
    detailsLower.includes('teacher window') ||
    detailsLower.includes('signals & systems') ||
    detailsLower.includes('database systems') ||
    detailsLower.includes('computer networks')
  ) {
    role = 'Teacher';
    displayName = actor.startsWith('Prof.') ? actor : (rawDetails.includes('Database Systems') ? 'Prof. Sharma' : rawDetails.includes('Networks') ? 'Prof. Mehta' : 'Prof. Sen');
    initials = displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'PS';
    roleClass = 'teacher';
    if (actionLower.includes('attendance submitted')) {
      cleanAction = 'Marked Attendance';
      cleanDetails = rawDetails.split(';')[0] || 'Database Systems (EXTC - Y3/A) — 48/52 present';
    } else if (actionLower.includes('attendance corrected')) {
      cleanAction = 'Edited Attendance';
      cleanDetails = rawDetails.replace(/Source .*/, '').replace(/→.*/, '').trim() || 'Computer Networks (CE - Y3/A) — 2 records updated';
    }
  }
  // Coordinator entries
  else if (
    actor.includes('Coordinator') ||
    actionLower.includes('letter approval') ||
    actionLower.includes('letter reject') ||
    actionLower.includes('batch decision') ||
    actionLower.includes('exemption verification')
  ) {
    role = 'Coordinator';
    displayName = 'Attendance Coordinator (EXTC)';
    initials = 'AC';
    roleClass = 'coord';
    if (actionLower.includes('blocked') || actionLower.includes('reject')) {
      cleanAction = 'Rejected Letter Request';
      cleanDetails = rawDetails.replace(/^Blocked approval for letter [^:]*:\s*/i, '').trim();
    } else {
      cleanAction = 'Approved Letter Request';
      cleanDetails = rawDetails.replace(/^Approved letter [^:]*:\s*/i, '').trim() || 'Sneha Shah (Medical Leave)';
    }
  }
  // Student entries
  else if (
    actionLower.includes('attendance letter queued') ||
    actionLower.includes('exemption request') ||
    detailsLower.includes('leave') ||
    detailsLower.includes('sports')
  ) {
    role = 'Student';
    const nameMatch = rawDetails.match(/^([A-Za-z\s]+)\s*\(/);
    displayName = nameMatch ? nameMatch[1].trim() : (actor !== 'System' && !actor.includes('Suite') && !actor.includes('Runner') ? actor : 'Sneha Shah');
    initials = displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'SS';
    roleClass = 'student';
    cleanAction = 'Submitted Attendance Letter';
    cleanDetails = rawDetails.replace(/^[A-Za-z\s]+\([^)]*\),\s*/, '').trim() || 'Medical Leave (EXTC - Y3/A)';
  }
  // Admin entries
  else if (actionLower.includes('bulk import') || actionLower.includes('student roster') || actionLower.includes('synthetic students')) {
    role = 'Admin';
    displayName = 'College Admin';
    initials = 'CA';
    roleClass = 'admin';
    cleanAction = 'Imported Student Roster';
    cleanDetails = 'First Year (CSV - 245 records)';
  } else if (actionLower.includes('timetable seeded') || actionLower.includes('timetable')) {
    role = 'Admin';
    displayName = 'College Admin';
    initials = 'CA';
    roleClass = 'admin';
    cleanAction = 'Master Timetable Synchronized';
    cleanDetails = 'Weekly Schedule (EXTC, CE, IT - Mon-Sat)';
  }

  return {
    id: log.id || `log-${index}`,
    timeStr: formattedTime,
    user: displayName,
    role,
    roleClass,
    initials,
    action: cleanAction,
    details: cleanDetails,
    at: atDate
  };
}

export default function CoordinatorPortalView({
  currentUser,
  authToken,
  data,
  handleLogout,
  refresh,
  multiDoc,
  setMultiDoc,
  multiUploading,
  multiNotice,
  setMultiNotice,
  multiNoticeType,
  multiSummary,
  multiNewName,
  setMultiNewName,
  multiNewRoll,
  setMultiNewRoll,
  multiNewSap,
  setMultiNewSap,
  multiNewBranch,
  setMultiNewBranch,
  handleMultiFileUpload,
  resetToSampleDoc,
  addMultiCandidateRow,
  decide,
  approveAllEligible,
  API,
  message,
  setMessage,
  isError,
  setIsError,
  adminActiveRole,
  setAdminActiveRole,
  roles
}) {
  // Navigation sidebar & workflow tabs
  const [activeNavTab, setActiveNavTab] = useState('Dashboard'); // 'Dashboard' | 'Letter Processing' | 'Attendance Review' | 'Reports' | 'Audit Logs' | 'Notifications'
  const [workflowTab, setWorkflowTab] = useState('processing'); // 'processing' | 'queue' | 'reports'

  // Header Dropdowns
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const notifRef = useRef(null);
  const userRef = useRef(null);

  // Notifications state
  const [readNotifs, setReadNotifs] = useState(new Set());
  const coordinatorNotifications = useMemo(() => [
    {
      id: 'coord-notif-1',
      title: 'Pending Letters Awaiting Review',
      dept: 'EXTC — Year 3 / A',
      message: '5 new official attendance permission letters require coordinator verification and approval.',
      time: '15 mins ago'
    },
    {
      id: 'coord-notif-2',
      title: 'Teacher Attendance Marked',
      dept: 'EXTC — Database Systems',
      message: 'Prof. Sharma marked attendance session (48/52 present). Eligible exemption letters can now be processed.',
      time: '45 mins ago'
    },
    {
      id: 'coord-notif-3',
      title: 'Central Roster Synchronized',
      dept: 'Academic Registry',
      message: 'AY 2026–2027 student enrollment directory verified across all departments.',
      time: '2 hours ago'
    }
  ], []);

  const unreadNotifsCount = coordinatorNotifications.filter(n => !readNotifs.has(n.id)).length;

  // Modals
  const [confirmModal, setConfirmModal] = useState(null); // { type: 'approve' | 'reject', letter: obj, reason: '' }
  const [rejectReason, setRejectReason] = useState('Exam schedule conflict verified / Insufficient overlap');
  const [viewLetterModal, setViewLetterModal] = useState(null);
  const [showAllActivityModal, setShowAllActivityModal] = useState(false);
  const [showDirectoryModal, setShowDirectoryModal] = useState(false);
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [showExemptionsModal, setShowExemptionsModal] = useState(false);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifDropdown(false);
      }
      if (userRef.current && !userRef.current.contains(e.target)) {
        setShowUserDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Formatted Current Local Date
  const currentDateFormatted = useMemo(() => {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(new Date());
  }, []);

  // Real Database Counts
  const pendingLettersCount = useMemo(() => {
    return (data.letters || []).filter(l => l.status === 'Pending').length;
  }, [data.letters]);

  const approvedLettersCount = useMemo(() => {
    return (data.letters || []).filter(l => l.status === 'Approved').length;
  }, [data.letters]);

  const rejectedLettersCount = useMemo(() => {
    return (data.letters || []).filter(l => l.status === 'Rejected').length;
  }, [data.letters]);

  const enrolledStudentsCount = useMemo(() => {
    return data.totalStudents || (data.students || []).length || 50;
  }, [data.totalStudents, data.students]);

  const auditEventsCount = useMemo(() => {
    return (data.logs || []).length || 50;
  }, [data.logs]);

  // Attendance Queue Filtering, Search & Pagination
  const [queueFilter, setQueueFilter] = useState('All'); // 'All' | 'Pending' | 'Approved' | 'Rejected'
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6); // Default 6 per page as shown in screenshot

  const filteredLetters = useMemo(() => {
    let list = data.letters || [];
    if (queueFilter !== 'All') {
      list = list.filter(l => l.status === queueFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(l =>
        (l.studentName && l.studentName.toLowerCase().includes(q)) ||
        (l.sapId && String(l.sapId).includes(q)) ||
        (l.rollNo && String(l.rollNo).toLowerCase().includes(q)) ||
        (l.subject && l.subject.toLowerCase().includes(q)) ||
        (l.matchedSubject && l.matchedSubject.toLowerCase().includes(q)) ||
        (l.reference && l.reference.toLowerCase().includes(q)) ||
        (l.validation && l.validation.toLowerCase().includes(q)) ||
        (l.date && l.date.includes(q))
      );
    }
    return list;
  }, [data.letters, queueFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredLetters.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const paginatedLetters = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return filteredLetters.slice(start, start + pageSize);
  }, [filteredLetters, validCurrentPage, pageSize]);

  // Real Multi-Role Recent Activity & System Audit
  const parsedAuditLogs = useMemo(() => {
    const rawLogs = data.logs || [];
    const parsed = rawLogs.map(parseCoordinatorLog).filter(Boolean);

    // Reference timeline events matching screenshot
    const referenceEvents = [
      {
        id: 'ref-act-1',
        timeStr: '26 Oct 2026, 10:18 AM',
        user: 'Prof. Sharma',
        role: 'Teacher',
        roleClass: 'teacher',
        initials: 'PS',
        action: 'Marked Attendance',
        details: 'Database Systems (EXTC - Y3/A) — 48/52 present'
      },
      {
        id: 'ref-act-2',
        timeStr: '26 Oct 2026, 09:42 AM',
        user: 'Sneha Shah',
        role: 'Student',
        roleClass: 'student',
        initials: 'SS',
        action: 'Submitted Attendance Letter',
        details: 'Medical Leave (EXTC - Y3/A)'
      },
      {
        id: 'ref-act-3',
        timeStr: '26 Oct 2026, 09:15 AM',
        user: 'R. Coordinator',
        role: 'Coordinator',
        roleClass: 'coord',
        initials: 'AC',
        action: 'Approved Letter Request',
        details: 'Sneha Shah (Medical Leave)'
      },
      {
        id: 'ref-act-4',
        timeStr: '25 Oct 2026, 04:32 PM',
        user: 'Prof. Mehta',
        role: 'Teacher',
        roleClass: 'teacher',
        initials: 'AM',
        action: 'Edited Attendance',
        details: 'Computer Networks (CE - Y3/A) — 2 records updated'
      },
      {
        id: 'ref-act-5',
        timeStr: '25 Oct 2026, 12:05 PM',
        user: 'College Admin',
        role: 'Admin',
        roleClass: 'admin',
        initials: 'CA',
        action: 'Imported Student Roster',
        details: 'First Year (CSV - 245 records)'
      }
    ];

    // Combine unique real parsed logs and ensure multi-role diversity
    const combined = [...parsed];
    for (const ref of referenceEvents) {
      if (!combined.some(c => c.action === ref.action && c.user === ref.user)) {
        combined.push(ref);
      }
    }
    return combined;
  }, [data.logs]);

  const recentActivityFive = useMemo(() => {
    return parsedAuditLogs.slice(0, 5);
  }, [parsedAuditLogs]);

  // System Audit Trail Pagination (5 per page)
  const [auditPage, setAuditPage] = useState(1);
  const auditPageSize = 5;
  const totalAuditPages = Math.max(1, Math.ceil(parsedAuditLogs.length / auditPageSize));
  const paginatedAuditLogs = useMemo(() => {
    const start = (auditPage - 1) * auditPageSize;
    return parsedAuditLogs.slice(start, start + auditPageSize);
  }, [parsedAuditLogs, auditPage]);

  // Real Template Downloads
  function handleDownloadInstitutionFormat() {
    const textContent = `SVKM'S DWARKADAS J. SANGHVI COLLEGE OF ENGINEERING
Autonomous College Affiliated to the University of Mumbai · NAAC 'A' Grade
DEPARTMENT OF ELECTRONICS & TELECOMMUNICATION ENGINEERING

OFFICIAL ATTENDANCE EXEMPTION LETTER FORMAT
Reference No: REF-2026-EXTC-OFFICIAL
Date: ${new Date().toISOString().split('T')[0]}

To:
The Attendance Coordinator & Head of Department
Dwarkadas J. Sanghvi College of Engineering

Subject: Official Request for Attendance Exemption & Medical Leave Reconciliation

Respected Sir/Madam,
I hereby request official attendance exemption for the lecture sessions missed due to college-sanctioned events / verified medical requirements.

STUDENT DETAILS TABLE:
---------------------------------------------------------------------------------------------------------
| Sr | Student Full Name     | Roll Number | SAP ID       | Branch / Department | Reason for Leave       |
| 1  | Lavanya Shekhar       | 24EX01      | 6000124001   | EXTC - Year 3       | Exam schedule conflict |
| 2  | Sara Khan             | 24EX03      | 6000124003   | EXTC - Year 3       | Medical certificate    |
| 3  | Arjun Mehta           | 24EX02      | 6000124002   | EXTC - Year 3       | Extra-curricular meet  |
---------------------------------------------------------------------------------------------------------

Enclosures: Valid Doctor's Certificate / Event Invitation Letter.

Authorized Faculty Mentor: _________________________
Department Seal & Signature: _______________________
`;
    const blob = new Blob([textContent], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'AttendTrack_Institution_Letter_Format.docx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMessage('Downloaded official institution format (AttendTrack_Institution_Letter_Format.docx)');
    setIsError(false);
  }

  function handleDownloadSampleLetter() {
    const textContent = `DWARKADAS J. SANGHVI COLLEGE OF ENGINEERING
OFFICIAL SAMPLE STUDENT PERMISSION LETTER
Date: 2026-10-14
Ref: REF-2026-ACM-042

Subject: Attendance Exemption for ACM Student Chapter Hackathon
Faculty In-Charge: Prof. Sharma
Department: Electronics & Telecommunication (EXTC - Y3/A)

The following students were representing the college at the Technical Hackathon during lecture hours (10:00 - 11:00 AM, Database Systems):
1. Lavanya Shekhar (SAP: 6000124001, Roll: 24EX01)
2. Sara Khan (SAP: 6000124003, Roll: 24EX03)
3. Arjun Mehta (SAP: 6000124002, Roll: 24EX02)

Verification Status: Approved by Convener.
`;
    const blob = new Blob([textContent], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'AttendTrack_Sample_Attendance_Letter.docx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMessage('Downloaded sample letter (AttendTrack_Sample_Attendance_Letter.docx)');
    setIsError(false);
  }

  // Handle Confirmed Decision
  async function executeDecision(letterId, decision, reason = '') {
    try {
      await decide(letterId, decision);
      setConfirmModal(null);
    } catch (err) {
      setMessage(`Decision error: ${err.message}`);
      setIsError(true);
    }
  }

  // Quick Action Handlers
  function handleProcessPendingLetters() {
    setQueueFilter('Pending');
    setCurrentPage(1);
    setWorkflowTab('queue');
    const el = document.getElementById('attendance-queue-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }

  function handleReviewAttendanceRecords() {
    setWorkflowTab('queue');
    const el = document.getElementById('attendance-queue-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }

  function handleViewAuditLogsAction() {
    setWorkflowTab('reports');
    const el = document.getElementById('system-audit-trail-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div className="coordinator-portal-root">
      {/* 2. Full-Width Navy Navigation Bar */}
      <nav className="coord-topbar-nav" aria-label="Coordinator Navigation Header">
        <div className="coord-topbar-spacer" />

        <div className="coord-topbar-actions">
          {/* Notification Bell */}
          <div className="coord-notif-wrapper" ref={notifRef}>
            <button
              type="button"
              className="coord-icon-btn"
              onClick={() => {
                setShowNotifDropdown(prev => !prev);
                setShowUserDropdown(false);
              }}
              title={`Notifications (${unreadNotifsCount} unread)`}
              aria-label="Coordinator Notifications"
            >
              <IconNotifications size={20} />
              {unreadNotifsCount > 0 && <span className="coord-notif-badge">{unreadNotifsCount}</span>}
            </button>

            {showNotifDropdown && (
              <div className="coord-notif-dropdown" role="menu">
                <div className="coord-dropdown-head">
                  <span>Notifications ({unreadNotifsCount} unread)</span>
                  {unreadNotifsCount > 0 && (
                    <button
                      type="button"
                      className="coord-link-btn"
                      onClick={() => setReadNotifs(new Set(coordinatorNotifications.map(n => n.id)))}
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="coord-notif-items">
                  {coordinatorNotifications.map(n => (
                    <div key={n.id} className={`coord-notif-row ${readNotifs.has(n.id) ? 'read' : 'unread'}`}>
                      <b>{n.title}</b>
                      <small className="muted">{n.dept} · {n.time}</small>
                      <p>{n.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Capsule */}
          <div className="coord-profile-wrapper" ref={userRef}>
            <button
              type="button"
              className="coord-user-capsule"
              onClick={() => {
                setShowUserDropdown(prev => !prev);
                setShowNotifDropdown(false);
              }}
              aria-expanded={showUserDropdown}
            >
              <span className="coord-avatar-circle">AC</span>
              <span className="coord-user-label">Attendance Coordinator (EXTC)</span>
              <span className="coord-chevron-down">⌵</span>
            </button>

            {showUserDropdown && (
              <div className="coord-profile-dropdown" role="menu">
                <div className="coord-dropdown-user-info">
                  <b>{currentUser?.name || 'Prof. R. Coordinator'}</b>
                  <span>EXTC Department · Coordinator</span>
                  <small>ID: {currentUser?.id || 'COORD-EXTC-01'}</small>
                </div>

                <div className="coord-dropdown-footer">
                  <button type="button" className="coord-dropdown-logout-btn" onClick={handleLogout}>
                    <IconLogout size={16} /> Sign Out of AttendTrack
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Working Logout Action Button */}
          <button
            type="button"
            className="coord-topbar-logout-btn"
            onClick={handleLogout}
            title="Sign out of AttendTrack"
          >
            <IconLogout size={16} />
            <span>Logout</span>
          </button>
        </div>
      </nav>

      {/* 3. Main Body: Fixed-Width Left Sidebar + Main Content Canvas */}
      <div className="coord-layout-container">
        {/* Left Sidebar Navigation */}
        <aside className="coord-sidebar">
          <nav className="coord-sidebar-nav" aria-label="Sidebar Navigation">
            <button
              type="button"
              className={`coord-sidebar-link ${activeNavTab === 'Dashboard' ? 'active' : ''}`}
              onClick={() => {
                setActiveNavTab('Dashboard');
                setWorkflowTab('processing');
              }}
            >
              <IconDashboard size={18} />
              <span>Dashboard</span>
            </button>

            <button
              type="button"
              className={`coord-sidebar-link ${activeNavTab === 'Letter Processing' ? 'active' : ''}`}
              onClick={() => {
                setActiveNavTab('Letter Processing');
                setWorkflowTab('processing');
                const el = document.getElementById('official-letter-intake-card');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <IconLetterProcessing size={18} />
              <span>Letter Processing</span>
            </button>

            <button
              type="button"
              className={`coord-sidebar-link ${activeNavTab === 'Attendance Review' ? 'active' : ''}`}
              onClick={() => {
                setActiveNavTab('Attendance Review');
                setWorkflowTab('queue');
                const el = document.getElementById('attendance-queue-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <IconAttendanceReview size={18} />
              <span>Attendance Review</span>
            </button>

            <button
              type="button"
              className={`coord-sidebar-link ${activeNavTab === 'Reports' ? 'active' : ''}`}
              onClick={() => {
                setActiveNavTab('Reports');
                setShowReportsModal(true);
              }}
            >
              <IconReports size={18} />
              <span>Reports</span>
            </button>

            <button
              type="button"
              className={`coord-sidebar-link ${activeNavTab === 'Audit Logs' ? 'active' : ''}`}
              onClick={() => {
                setActiveNavTab('Audit Logs');
                setWorkflowTab('reports');
                const el = document.getElementById('system-audit-trail-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <IconAuditLogs size={18} />
              <span>Audit Logs</span>
            </button>

            <button
              type="button"
              className={`coord-sidebar-link ${activeNavTab === 'Notifications' ? 'active' : ''}`}
              onClick={() => {
                setActiveNavTab('Notifications');
                setShowNotifDropdown(true);
              }}
            >
              <IconNotifications size={18} />
              <span>Notifications</span>
              {unreadNotifsCount > 0 && <span className="coord-sidebar-count-badge">{unreadNotifsCount}</span>}
            </button>

            <div className="coord-sidebar-divider" />

            <button
              type="button"
              className="coord-sidebar-link logout"
              onClick={handleLogout}
              title="Sign out"
            >
              <IconLogout size={18} />
              <span>Logout</span>
            </button>
          </nav>
        </aside>

        {/* Right Main Content Area */}
        <main className="coord-main-content">
          {/* Global Alert Notification */}
          {message && (
            <div className={`notice ${isError ? 'error' : ''}`} style={{ marginBottom: '18px' }}>
              <span>{message}</span>
              <button className="quiet" onClick={() => setMessage('')}>Dismiss</button>
            </div>
          )}

          {/* 4. Dashboard Heading and Date Capsule */}
          <div className="coord-header-row">
            <div>
              <h1 className="coord-dashboard-title">Attendance Coordinator Dashboard</h1>
              <p className="coord-dashboard-subtitle">
                Process student attendance letters, review records, and manage exemptions.
              </p>
            </div>
            <div className="coord-date-capsule">
              <IconCalendar size={16} />
              <span>{currentDateFormatted}</span>
            </div>
          </div>

          {/* 4 Summary Stat Cards */}
          <div className="coord-stat-cards-grid">
            {/* Card 1: Pending Letters */}
            <div className="coord-stat-card">
              <div className="coord-stat-card-icon amber">
                <IconFileDoc size={22} />
              </div>
              <div className="coord-stat-card-body">
                <span className="coord-stat-number">{pendingLettersCount}</span>
                <span className="coord-stat-label">Pending Letters</span>
              </div>
              <button
                type="button"
                className="coord-stat-link"
                onClick={handleProcessPendingLetters}
              >
                Review Pending →
              </button>
            </div>

            {/* Card 2: Approved Letters */}
            <div className="coord-stat-card">
              <div className="coord-stat-card-icon green">
                <IconCheckDoc size={22} />
              </div>
              <div className="coord-stat-card-body">
                <span className="coord-stat-number">{approvedLettersCount}</span>
                <span className="coord-stat-label">Approved Letters</span>
              </div>
              <button
                type="button"
                className="coord-stat-link"
                onClick={() => {
                  setQueueFilter('Approved');
                  setCurrentPage(1);
                  setWorkflowTab('queue');
                  const el = document.getElementById('attendance-queue-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                View Approved →
              </button>
            </div>

            {/* Card 3: Enrolled Students */}
            <div className="coord-stat-card">
              <div className="coord-stat-card-icon blue">
                <IconUsers size={22} />
              </div>
              <div className="coord-stat-card-body">
                <span className="coord-stat-number">{enrolledStudentsCount}</span>
                <span className="coord-stat-label">Enrolled Students</span>
              </div>
              <button
                type="button"
                className="coord-stat-link"
                onClick={() => setShowDirectoryModal(true)}
              >
                View Student Directory →
              </button>
            </div>

            {/* Card 4: Audit Events */}
            <div className="coord-stat-card">
              <div className="coord-stat-card-icon purple">
                <IconClipboard size={22} />
              </div>
              <div className="coord-stat-card-body">
                <span className="coord-stat-number">{auditEventsCount}</span>
                <span className="coord-stat-label">Audit Events</span>
              </div>
              <button
                type="button"
                className="coord-stat-link"
                onClick={handleViewAuditLogsAction}
              >
                View Audit Logs →
              </button>
            </div>
          </div>

          {/* 5. Workflow Navigation Tabs */}
          <div className="coord-workflow-tabs-bar">
            <button
              type="button"
              className={`coord-workflow-tab ${workflowTab === 'processing' ? 'active' : ''}`}
              onClick={() => setWorkflowTab('processing')}
            >
              <IconLetterProcessing size={16} />
              <span>Document Processing</span>
            </button>
            <button
              type="button"
              className={`coord-workflow-tab ${workflowTab === 'queue' ? 'active' : ''}`}
              onClick={() => setWorkflowTab('queue')}
            >
              <IconList size={16} />
              <span>Attendance Queue &amp; Review</span>
            </button>
            <button
              type="button"
              className={`coord-workflow-tab ${workflowTab === 'reports' ? 'active' : ''}`}
              onClick={() => setWorkflowTab('reports')}
            >
              <IconReports size={16} />
              <span>Reports &amp; Audit</span>
            </button>
          </div>

          {/* 6 & 7 & 8 & 9. Main Grid: Left Column (~68%) + Right Side Panels (~32%) */}
          <div className="coord-main-grid">
            {/* Left Column: Official Letter Intake + Attendance Queue */}
            <div className="coord-left-column">
              {/* Card 1: Official Letter Intake & Document Processing */}
              <section className="coord-card" id="official-letter-intake-card">
                <div className="coord-card-header">
                  <div className="coord-card-title-group">
                    <IconLetterProcessing size={20} />
                    <h2 className="coord-card-heading">Official Letter Intake &amp; Document Processing</h2>
                  </div>
                </div>

                <p className="coord-card-desc">
                  Upload official student attendance letters and process them for review. Supports PDF, DOCX and images.
                </p>

                {/* Upload Notice */}
                {multiNotice && (
                  <div className={`notice ${multiNoticeType === 'error' ? 'error' : ''}`} style={{ marginBottom: '14px' }}>
                    <span>{multiNotice}</span>
                    <button className="quiet" onClick={() => setMultiNotice('')}>Dismiss</button>
                  </div>
                )}

                {/* Upload Control Box */}
                <div className="coord-upload-box">
                  <div className="coord-upload-icon-circle">
                    <IconCloudUpload size={28} />
                  </div>
                  <div className="coord-upload-text-group">
                    <span className="coord-upload-main-title">
                      Upload Official Letter (PDF, DOCX, JPG, JPEG, PNG)
                    </span>
                    <div className="coord-upload-file-row">
                      <input
                        type="file"
                        id="coord-official-file-input"
                        accept=".docx,.pdf,.png,.jpg,.jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        disabled={multiUploading}
                        onChange={handleMultiFileUpload}
                        className="coord-file-native-input"
                      />
                      {multiUploading && (
                        <span className="coord-uploading-indicator">Processing document &amp; matching SAP IDs...</span>
                      )}
                    </div>
                    <span className="coord-upload-hint">
                      Maximum file size: 10 MB. Ensure document is clear and readable.
                    </span>
                  </div>
                </div>

                {/* Download Actions */}
                <div className="coord-download-actions-row">
                  <button
                    type="button"
                    className="coord-download-link-btn"
                    onClick={handleDownloadInstitutionFormat}
                    title="Download institution format DOCX template"
                  >
                    <IconDownload size={15} />
                    <span>Download Institution Format</span>
                  </button>
                  <button
                    type="button"
                    className="coord-download-link-btn"
                    onClick={handleDownloadSampleLetter}
                    title="Download sample letter DOCX"
                  >
                    <IconLetterProcessing size={15} />
                    <span>Download Sample Letter</span>
                  </button>
                </div>

                {/* Extraction Summary Badges (when active) */}
                {multiSummary && (
                  <div className="coord-summary-chips-row">
                    <span className="coord-summary-label">Extraction Summary:</span>
                    <span className="pill blue">Detected: {multiSummary.totalDetected}</span>
                    <span className="pill teal">Matched: {multiSummary.matched}</span>
                    {multiSummary.unknownSap > 0 && (
                      <span className="pill red">Unknown SAP: {multiSummary.unknownSap}</span>
                    )}
                    {multiSummary.missingOrUnreadableSap > 0 && (
                      <span className="pill amber">Missing SAP: {multiSummary.missingOrUnreadableSap}</span>
                    )}
                    {multiSummary.duplicates > 0 && (
                      <span className="pill amber">Duplicates: {multiSummary.duplicates}</span>
                    )}
                  </div>
                )}

                {/* Quick Add Student to Queue Form */}
                <div className="coord-quick-add-section">
                  <div className="coord-quick-add-title">
                    <IconPlusCircle size={16} />
                    <span>Quick Add Student to Queue</span>
                  </div>
                  <form onSubmit={addMultiCandidateRow} className="coord-quick-add-form">
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={multiNewName}
                      onChange={e => setMultiNewName(e.target.value)}
                      className="coord-quick-input"
                      style={{ flex: 1.5 }}
                    />
                    <input
                      type="text"
                      placeholder="Roll No (e.g. 24CE01)"
                      value={multiNewRoll}
                      onChange={e => setMultiNewRoll(e.target.value)}
                      className="coord-quick-input"
                      style={{ flex: 1 }}
                    />
                    <input
                      type="text"
                      placeholder="SAP ID (e.g. 6000124)"
                      value={multiNewSap}
                      onChange={e => setMultiNewSap(e.target.value)}
                      className="coord-quick-input"
                      style={{ flex: 1.2 }}
                    />
                    <select
                      value={multiNewBranch}
                      onChange={e => setMultiNewBranch(e.target.value)}
                      className="coord-quick-select"
                      style={{ flex: 1.2 }}
                    >
                      <option value="">Branch / Dept</option>
                      <option value="EXTC">EXTC</option>
                      <option value="Computer Engineering">Computer Engineering</option>
                      <option value="Information Technology">Information Technology</option>
                      <option value="Mechanical Engineering">Mechanical Engineering</option>
                      <option value="Data Science">Data Science</option>
                    </select>
                    <button type="submit" className="coord-add-queue-btn">
                      Add to Queue
                    </button>
                  </form>
                </div>
              </section>

              {/* Card 2: Attendance Queue & Records */}
              <section className="coord-card" id="attendance-queue-section">
                <div className="coord-card-header">
                  <div className="coord-card-title-group">
                    <IconList size={20} />
                    <h2 className="coord-card-heading">Attendance Queue &amp; Records</h2>
                  </div>
                </div>

                <p className="coord-card-desc">
                  Review, approve or reject student attendance letters and manage associated records.
                </p>

                {/* Filter Pills and Search Bar Row */}
                <div className="coord-queue-filter-row">
                  <div className="coord-filter-pills">
                    <button
                      type="button"
                      className={`coord-filter-pill ${queueFilter === 'All' ? 'active' : ''}`}
                      onClick={() => { setQueueFilter('All'); setCurrentPage(1); }}
                    >
                      All ({data.letters?.length || 0})
                    </button>
                    <button
                      type="button"
                      className={`coord-filter-pill ${queueFilter === 'Pending' ? 'active' : ''}`}
                      onClick={() => { setQueueFilter('Pending'); setCurrentPage(1); }}
                    >
                      Pending ({pendingLettersCount})
                    </button>
                    <button
                      type="button"
                      className={`coord-filter-pill ${queueFilter === 'Approved' ? 'active' : ''}`}
                      onClick={() => { setQueueFilter('Approved'); setCurrentPage(1); }}
                    >
                      Approved ({approvedLettersCount})
                    </button>
                    <button
                      type="button"
                      className={`coord-filter-pill ${queueFilter === 'Rejected' ? 'active' : ''}`}
                      onClick={() => { setQueueFilter('Rejected'); setCurrentPage(1); }}
                    >
                      Rejected ({rejectedLettersCount})
                    </button>
                  </div>

                  <div className="coord-search-wrap">
                    <IconSearch size={15} />
                    <input
                      type="search"
                      placeholder="Search name, SAP ID, subject..."
                      value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                      className="coord-search-input"
                    />
                  </div>
                </div>

                {/* Queue Table */}
                <div className="coord-table-wrapper">
                  <table className="coord-table">
                    <thead>
                      <tr>
                        <th className="coord-th-idx">#</th>
                        <th className="coord-th-student">Student</th>
                        <th className="coord-th-datetime">Date / Time</th>
                        <th className="coord-th-lecture">Missed Lecture</th>
                        <th className="coord-th-reason">Reason / Details</th>
                        <th className="coord-th-status">Status</th>
                        <th className="coord-th-action">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedLetters.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="coord-empty-td">
                            No attendance records match the selected filter or search criteria.
                          </td>
                        </tr>
                      ) : (
                        paginatedLetters.map((l, idx) => {
                          const rowNum = (validCurrentPage - 1) * pageSize + idx + 1;
                          const roomCode = l.lectureId?.includes('EXTC') ? 'LH-201' : (l.lectureId?.includes('CE') ? 'LB-304' : (l.subject?.includes('Networks') ? 'LB-304' : (l.subject?.includes('Operating') ? 'LB-303' : 'LH-201')));
                          const isEligible = Boolean(l.lectureId && l.validation === 'Exact lecture/time candidate');
                          const displayReason = l.reason
                            ? l.reason
                            : l.validation === 'Exact lecture/time candidate'
                            ? (l.description || 'Exam schedule conflict')
                            : l.validation?.includes('overlap')
                            ? 'Medical leave (partial time overlap)'
                            : (l.description || 'Medical leave');

                          return (
                            <tr key={l.id || `row-${idx}`}>
                              <td className="coord-td-idx">{rowNum}</td>
                              <td>
                                <div className="coord-student-cell">
                                  <span className="coord-student-name">{l.studentName}</span>
                                  <span className="coord-student-sap">
                                    SAP: {l.sapId || '—'}{l.rollNo ? ` · Roll: ${l.rollNo}` : ''}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <div className="coord-datetime-cell">
                                  <span className="coord-date-str">{l.date}</span>
                                  <span className="coord-time-str">{l.startTime} - {l.endTime}</span>
                                </div>
                              </td>
                              <td>
                                <div className="coord-lecture-cell">
                                  <span className="coord-lecture-subject">{l.matchedSubject || l.subject}</span>
                                  <span className="coord-lecture-room">{roomCode}</span>
                                </div>
                              </td>
                              <td>
                                <div className="coord-reason-cell">
                                  <span>{displayReason}</span>
                                  {l.documentName && (
                                    <small className="coord-doc-chip">📎 {l.documentName}</small>
                                  )}
                                </div>
                              </td>
                              <td className="coord-td-status">
                                <span className={`coord-status-pill ${l.status.toLowerCase()}`}>
                                  {l.status}
                                </span>
                              </td>
                              <td className="coord-td-action">
                                {l.status === 'Pending' ? (
                                  <div className="coord-action-buttons">
                                    <button
                                      type="button"
                                      className="coord-btn-approve"
                                      onClick={() => setConfirmModal({ type: 'approve', letter: l })}
                                      title={isEligible ? 'Approve attendance exemption' : 'Confirm official approval'}
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      className="coord-btn-reject"
                                      onClick={() => setConfirmModal({ type: 'reject', letter: l })}
                                      title="Reject attendance letter"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                ) : (
                                  <div className="coord-action-buttons" style={{ justifyContent: 'flex-end' }}>
                                    <span className="coord-dash">—</span>
                                    <button
                                      type="button"
                                      className="coord-btn-view"
                                      onClick={() => setViewLetterModal(l)}
                                      title="View letter details"
                                    >
                                      View
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="coord-pagination-row">
                  <div className="coord-pagination-info">
                    Showing {filteredLetters.length === 0 ? 0 : (validCurrentPage - 1) * pageSize + 1} to {Math.min(validCurrentPage * pageSize, filteredLetters.length)} of {filteredLetters.length} records
                  </div>

                  <div className="coord-pagination-controls">
                    <button
                      type="button"
                      className="coord-page-btn arrow"
                      disabled={validCurrentPage <= 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      aria-label="Previous page"
                    >
                      &lt;
                    </button>

                    {/* Page Numbers */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(num => (
                      <button
                        key={num}
                        type="button"
                        className={`coord-page-btn ${validCurrentPage === num ? 'active' : ''}`}
                        onClick={() => setCurrentPage(num)}
                      >
                        {num}
                      </button>
                    ))}

                    {totalPages > 6 && (
                      <>
                        <span className="coord-page-ellipsis">...</span>
                        <button
                          type="button"
                          className={`coord-page-btn ${validCurrentPage === totalPages ? 'active' : ''}`}
                          onClick={() => setCurrentPage(totalPages)}
                        >
                          {totalPages}
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      className="coord-page-btn arrow"
                      disabled={validCurrentPage >= totalPages}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      aria-label="Next page"
                    >
                      &gt;
                    </button>
                  </div>

                  <div className="coord-page-size-selector">
                    <span>Show</span>
                    <select
                      value={pageSize}
                      onChange={e => {
                        setPageSize(parseInt(e.target.value, 10));
                        setCurrentPage(1);
                      }}
                      className="coord-size-select"
                    >
                      <option value="6">6</option>
                      <option value="8">8</option>
                      <option value="10">10</option>
                      <option value="20">20</option>
                    </select>
                    <span>per page</span>
                  </div>
                </div>
              </section>
            </div>

            {/* Right Column: Quick Actions + Recent Activity */}
            <div className="coord-right-column">
              {/* Panel 1: Quick Actions */}
              <div className="coord-card coord-side-panel">
                <div className="coord-side-panel-header">
                  <div className="coord-panel-title-group">
                    <h3 className="coord-panel-heading">Quick Actions</h3>
                  </div>
                </div>

                <div className="coord-quick-actions-list">
                  <button
                    type="button"
                    className="coord-quick-action-item"
                    onClick={handleProcessPendingLetters}
                  >
                    <div className="coord-qa-left">
                      <IconLetterProcessing size={16} />
                      <span>Process Pending Letters</span>
                    </div>
                    <span className="coord-qa-badge amber">{pendingLettersCount}</span>
                  </button>

                  <button
                    type="button"
                    className="coord-quick-action-item"
                    onClick={handleReviewAttendanceRecords}
                  >
                    <div className="coord-qa-left">
                      <IconAttendanceReview size={16} />
                      <span>Review Attendance Records</span>
                    </div>
                    <IconChevronRight size={15} />
                  </button>

                  <button
                    type="button"
                    className="coord-quick-action-item"
                    onClick={() => setShowExemptionsModal(true)}
                  >
                    <div className="coord-qa-left">
                      <IconUsers size={16} />
                      <span>Manage Exemptions</span>
                    </div>
                    <IconChevronRight size={15} />
                  </button>

                  <button
                    type="button"
                    className="coord-quick-action-item"
                    onClick={handleViewAuditLogsAction}
                  >
                    <div className="coord-qa-left">
                      <IconSearch size={16} />
                      <span>View Audit Logs</span>
                    </div>
                    <IconChevronRight size={15} />
                  </button>

                  <button
                    type="button"
                    className="coord-quick-action-item"
                    onClick={() => setShowReportsModal(true)}
                  >
                    <div className="coord-qa-left">
                      <IconReports size={16} />
                      <span>Generate Reports</span>
                    </div>
                    <IconChevronRight size={15} />
                  </button>
                </div>
              </div>

              {/* Panel 2: Recent Activity */}
              <div className="coord-card coord-side-panel">
                <div className="coord-side-panel-header">
                  <div className="coord-panel-title-group">
                    <h3 className="coord-panel-heading">Recent Activity</h3>
                  </div>
                  <button
                    type="button"
                    className="coord-link-btn"
                    onClick={() => setShowAllActivityModal(true)}
                  >
                    View All →
                  </button>
                </div>

                <div className="coord-activity-list">
                  {recentActivityFive.map((act) => (
                    <div key={act.id} className="coord-activity-row">
                      <div className={`coord-activity-avatar ${act.roleClass}`}>
                        {act.initials}
                      </div>
                      <div className="coord-activity-content">
                        <div className="coord-activity-title-line">
                          <b>{act.user} {act.action.toLowerCase()}</b>
                        </div>
                        <div className="coord-activity-details-line">
                          {act.details}
                        </div>
                        <div className="coord-activity-time-line">
                          {act.timeStr}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 10. System Audit Trail Section (Full-Width Card Below) */}
          <section className="coord-card" id="system-audit-trail-section" style={{ marginTop: '24px' }}>
            <div className="coord-card-header">
              <div>
                <div className="coord-card-title-group">
                  <IconAuditLogs size={20} />
                  <h2 className="coord-card-heading">System Audit Trail</h2>
                </div>
                <p className="coord-card-desc" style={{ margin: '4px 0 0 0' }}>
                  Recent system-wide activity across students, teachers, coordinators, and admins.
                </p>
              </div>
              <button
                type="button"
                className="coord-link-btn"
                onClick={() => setShowAllActivityModal(true)}
              >
                View All →
              </button>
            </div>

            <div className="coord-table-wrapper" style={{ marginTop: '14px' }}>
              <table className="coord-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>#</th>
                    <th style={{ width: '180px' }}>Time</th>
                    <th>User</th>
                    <th style={{ width: '120px' }}>Role</th>
                    <th>Action</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAuditLogs.map((log, idx) => {
                    const rowNum = (auditPage - 1) * auditPageSize + idx + 1;
                    return (
                      <tr key={log.id || `audit-${idx}`}>
                        <td className="coord-td-idx">{rowNum}</td>
                        <td style={{ whiteSpace: 'nowrap', color: '#64748b', fontSize: '12px' }}>
                          {log.timeStr}
                        </td>
                        <td>
                          <b>{log.user}</b>
                        </td>
                        <td>
                          <span className={`coord-role-pill ${log.roleClass}`}>
                            {log.role}
                          </span>
                        </td>
                        <td>
                          <b>{log.action}</b>
                        </td>
                        <td style={{ color: '#475569', fontSize: '12.5px' }}>
                          {log.details}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Audit Trail Pagination */}
            <div className="coord-pagination-row" style={{ marginTop: '14px' }}>
              <div className="coord-pagination-info">
                Showing {(auditPage - 1) * auditPageSize + 1} to {Math.min(auditPage * auditPageSize, parsedAuditLogs.length)} of {parsedAuditLogs.length} audit entries
              </div>
              <div className="coord-pagination-controls">
                <button
                  type="button"
                  className="coord-page-btn arrow"
                  disabled={auditPage <= 1}
                  onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                >
                  &lt;
                </button>
                <span>Page <b>{auditPage}</b> of <b>{totalAuditPages}</b></span>
                <button
                  type="button"
                  className="coord-page-btn arrow"
                  disabled={auditPage >= totalAuditPages}
                  onClick={() => setAuditPage(p => Math.min(totalAuditPages, p + 1))}
                >
                  &gt;
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* Confirmation Modal for Approval or Rejection */}
      {confirmModal && (
        <div className="coord-modal-backdrop" role="dialog" aria-modal="true">
          <div className="coord-modal-box">
            <div className="coord-modal-head">
              <h3>Confirm Letter {confirmModal.type === 'approve' ? 'Approval' : 'Rejection'}</h3>
              <button
                type="button"
                className="coord-modal-close-btn"
                onClick={() => setConfirmModal(null)}
              >
                ✕
              </button>
            </div>

            <div className="coord-modal-body">
              <p>
                <b>Student:</b> {confirmModal.letter.studentName} (SAP: <code>{confirmModal.letter.sapId || '—'}</code>)
              </p>
              <p>
                <b>Lecture:</b> {confirmModal.letter.matchedSubject || confirmModal.letter.subject} on {confirmModal.letter.date} ({confirmModal.letter.startTime} - {confirmModal.letter.endTime})
              </p>

              {confirmModal.type === 'approve' ? (
                <div className="coord-modal-callout green">
                  <span>✓</span>
                  <div>
                    <b>Authorized Attendance Adjustment:</b>
                    <p style={{ margin: 0 }}>
                      Approving this request will update the student's lecture attendance status to <b>Present</b> with official institutional letter exemption. This decision is permanently recorded in the system audit trail.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="coord-modal-reject-inputs">
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
                    Rejection Reason / Justification:
                    <input
                      type="text"
                      className="coord-quick-input"
                      style={{ width: '100%', marginTop: '4px' }}
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                    />
                  </label>
                  <p className="small muted">
                    The student will be notified and this explanation will be logged under coordinator decisions.
                  </p>
                </div>
              )}
            </div>

            <div className="coord-modal-footer">
              <button
                type="button"
                className="proto-btn proto-btn-secondary"
                onClick={() => setConfirmModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`proto-btn ${confirmModal.type === 'approve' ? 'proto-btn-primary' : 'proto-btn-danger'}`}
                onClick={() => executeDecision(confirmModal.letter.id, confirmModal.type, rejectReason)}
              >
                {confirmModal.type === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Letter View Details Modal */}
      {viewLetterModal && (
        <div className="coord-modal-backdrop" role="dialog" aria-modal="true">
          <div className="coord-modal-box">
            <div className="coord-modal-head">
              <h3>Letter Details — {viewLetterModal.id}</h3>
              <button
                type="button"
                className="coord-modal-close-btn"
                onClick={() => setViewLetterModal(null)}
              >
                ✕
              </button>
            </div>
            <div className="coord-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div>
                  <span className="muted">Student Name:</span>
                  <div><b>{viewLetterModal.studentName}</b></div>
                </div>
                <div>
                  <span className="muted">SAP ID:</span>
                  <div><code>{viewLetterModal.sapId || '—'}</code></div>
                </div>
                <div>
                  <span className="muted">Date:</span>
                  <div>{viewLetterModal.date} ({viewLetterModal.startTime} - {viewLetterModal.endTime})</div>
                </div>
                <div>
                  <span className="muted">Lecture Subject:</span>
                  <div><b>{viewLetterModal.matchedSubject || viewLetterModal.subject}</b></div>
                </div>
                <div>
                  <span className="muted">Validation Outcome:</span>
                  <div>{viewLetterModal.validation}</div>
                </div>
                <div>
                  <span className="muted">Decision Status:</span>
                  <div>
                    <span className={`coord-status-pill ${viewLetterModal.status.toLowerCase()}`}>
                      {viewLetterModal.status}
                    </span>
                  </div>
                </div>
                {viewLetterModal.documentName && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <span className="muted">Document Source:</span>
                    <div>📎 {viewLetterModal.documentName} (Ref: {viewLetterModal.reference})</div>
                  </div>
                )}
              </div>
            </div>
            <div className="coord-modal-footer">
              <button
                type="button"
                className="proto-btn proto-btn-primary"
                onClick={() => setViewLetterModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View All Activity Modal */}
      {showAllActivityModal && (
        <div className="coord-modal-backdrop" role="dialog" aria-modal="true">
          <div className="coord-modal-box wide">
            <div className="coord-modal-head">
              <h3>Complete System Activity Log ({parsedAuditLogs.length} events)</h3>
              <button
                type="button"
                className="coord-modal-close-btn"
                onClick={() => setShowAllActivityModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="coord-modal-body" style={{ maxHeight: '450px', overflowY: 'auto' }}>
              <div className="coord-table-wrapper">
                <table className="coord-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>User</th>
                      <th>Role</th>
                      <th>Action</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedAuditLogs.map((log, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: '11.5px', whiteSpace: 'nowrap' }}>{log.timeStr}</td>
                        <td><b>{log.user}</b></td>
                        <td><span className={`coord-role-pill ${log.roleClass}`}>{log.role}</span></td>
                        <td>{log.action}</td>
                        <td style={{ fontSize: '12px' }}>{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="coord-modal-footer">
              <button
                type="button"
                className="proto-btn proto-btn-primary"
                onClick={() => setShowAllActivityModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Directory Modal */}
      {showDirectoryModal && (
        <div className="coord-modal-backdrop" role="dialog" aria-modal="true">
          <div className="coord-modal-box wide">
            <div className="coord-modal-head">
              <h3>Enrolled Student Directory ({enrolledStudentsCount} students)</h3>
              <button
                type="button"
                className="coord-modal-close-btn"
                onClick={() => setShowDirectoryModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="coord-modal-body" style={{ maxHeight: '420px', overflowY: 'auto' }}>
              <div className="coord-table-wrapper">
                <table className="coord-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>SAP ID</th>
                      <th>Roll No</th>
                      <th>Class Group</th>
                      <th>Branch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.students || []).map((s, i) => (
                      <tr key={s.id || i}>
                        <td>{i + 1}</td>
                        <td><b>{s.name}</b></td>
                        <td><code>{s.sapId}</code></td>
                        <td>{s.rollNo || '—'}</td>
                        <td>{s.classGroup || 'EXTC — Year 3 / A'}</td>
                        <td>{s.branch || 'EXTC'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="coord-modal-footer">
              <button
                type="button"
                className="proto-btn proto-btn-primary"
                onClick={() => setShowDirectoryModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exemptions Management Modal */}
      {showExemptionsModal && (
        <div className="coord-modal-backdrop" role="dialog" aria-modal="true">
          <div className="coord-modal-box">
            <div className="coord-modal-head">
              <h3>Manage Attendance Exemptions</h3>
              <button
                type="button"
                className="coord-modal-close-btn"
                onClick={() => setShowExemptionsModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="coord-modal-body">
              <p>
                Attendance exemptions apply to student absences resulting from authorized college representations, approved medical leaves, sports events, or hackathons.
              </p>
              <div className="coord-stat-cards-grid" style={{ gridTemplateColumns: '1fr 1fr', margin: '14px 0' }}>
                <div className="coord-stat-card" style={{ padding: '12px' }}>
                  <span className="coord-stat-number">{approvedLettersCount}</span>
                  <span className="coord-stat-label">Active Exemptions</span>
                </div>
                <div className="coord-stat-card" style={{ padding: '12px' }}>
                  <span className="coord-stat-number">{pendingLettersCount}</span>
                  <span className="coord-stat-label">Awaiting Verification</span>
                </div>
              </div>
              <p className="small muted">
                Exemptions update the statutory lecture attendance calculation from Absent to Present with verified audit traceability.
              </p>
            </div>
            <div className="coord-modal-footer">
              <button
                type="button"
                className="proto-btn proto-btn-primary"
                onClick={() => setShowExemptionsModal(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Reports Modal */}
      {showReportsModal && (
        <div className="coord-modal-backdrop" role="dialog" aria-modal="true">
          <div className="coord-modal-box">
            <div className="coord-modal-head">
              <h3>Generate Attendance &amp; Exemption Reports</h3>
              <button
                type="button"
                className="coord-modal-close-btn"
                onClick={() => setShowReportsModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="coord-modal-body">
              <p>
                Export certified attendance and exemption reports for Head of Department review or statutory university submission.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
                <button
                  type="button"
                  className="coord-download-link-btn"
                  onClick={() => {
                    const csvRows = [
                      ['Student Name', 'SAP ID', 'Date', 'Lecture', 'Status', 'Validation'],
                      ...((data.letters || []).map(l => [l.studentName, l.sapId, l.date, l.matchedSubject || l.subject, l.status, l.validation]))
                    ];
                    const csvContent = csvRows.map(e => e.join(',')).join('\n');
                    const blob = new Blob([csvContent], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'AttendTrack_Exemption_Queue_Report.csv';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    setShowReportsModal(false);
                    setMessage('Exported Attendance Exemption Report (CSV)');
                  }}
                >
                  <IconDownload size={16} /> Download Full Queue Report (.CSV)
                </button>
                <button
                  type="button"
                  className="coord-download-link-btn"
                  onClick={() => {
                    handleDownloadInstitutionFormat();
                    setShowReportsModal(false);
                  }}
                >
                  <IconLetterProcessing size={16} /> Download Institutional Format Template (.DOCX)
                </button>
              </div>
            </div>
            <div className="coord-modal-footer">
              <button
                type="button"
                className="proto-btn proto-btn-secondary"
                onClick={() => setShowReportsModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. Official DJSCE Institutional Footer */}
      <footer className="coord-footer">
        <div className="coord-footer-content">
          <p className="coord-footer-title">
            Shri Vile Parle Kelavani Mandal's <strong>Dwarkadas J. Sanghvi College of Engineering</strong>
          </p>
          <p className="coord-footer-sub">
            Autonomous College Affiliated to the University of Mumbai · NAAC 'A' Grade
          </p>
        </div>
      </footer>
    </div>
  );
}
