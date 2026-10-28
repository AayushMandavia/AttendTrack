import { useEffect, useState, useMemo } from 'react';
import AdminRosterSection from './AdminRosterSection.jsx';
import TimetableSection from './TimetableSection.jsx';
import LoginPage from './LoginPage.jsx';
import StudentPortalView from './StudentPortalView.jsx';
import TeacherPortalView from './TeacherPortalView.jsx';
import AdminPortalView from './AdminPortalView.jsx';
import CoordinatorPortalView from './CoordinatorPortalView.jsx';
import TransparentPreloader from './TransparentPreloader.jsx';
import RoleSkeletonDashboard from './RoleSkeletonDashboard.jsx';

const API = import.meta.env.VITE_API_BASE_URL || '/api';
const roles = ['Teacher', 'Attendance Coordinator', 'Student', 'Admin'];

// Standard document reference template for multi-student letter workflow
const DEFAULT_MULTI_DOC = {
  uploadId: '',
  documentName: 'AttendTrack_Attendance_Permission_Template.docx',
  reference: 'REF-2026-ACM-042',
  date: '2026-10-14',
  subject: 'Database Systems',
  startTime: '10:00',
  endTime: '11:00',
  description: 'Official attendance permission letter with student table'
};

export default function App() {
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('attendtrack_token') || '');
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('attendtrack_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Track animated college crest preloader on initial website launch (ONLY before login page)
  const [showSessionPreloader, setShowSessionPreloader] = useState(() => {
    // If user is already authenticated in localStorage, NEVER show the logo preloader on load/reload
    if (localStorage.getItem('attendtrack_token')) return false;
    // If already completed in this browser session, do not show again
    if (sessionStorage.getItem('attendtrack_crest_preloader_seen')) return false;
    return true;
  });

  function getNormalizedRole(user) {
    if (!user) return 'Teacher';
    const r = (user.role || '').toUpperCase();
    if (r === 'ADMIN') return 'Admin';
    if (r === 'COORDINATOR') return 'Attendance Coordinator';
    if (r === 'STUDENT') return 'Student';
    return 'Teacher';
  }

  const [adminActiveRole, setAdminActiveRole] = useState('Admin');
  // Authoritative role: backend determines the role; non-admins cannot switch away from their authorized portal
  const role = currentUser
    ? (currentUser.role === 'ADMIN' ? adminActiveRole : getNormalizedRole(currentUser))
    : '';

  const [adminView, setAdminView] = useState('roster'); // 'roster' | 'attendance' | 'timetable' | 'correction'
  const [data, setData] = useState({ lectures: [], students: [], totalStudents: 0, attendance: [], letters: [], logs: [] });
  const [lectureId, setLectureId] = useState('');
  const [statuses, setStatuses] = useState({});
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [studentViewId, setStudentViewId] = useState('');

  // Dedicated Student Portal Safe Data
  const [studentPersonalData, setStudentPersonalData] = useState({ profile: null, attendance: [], letters: [] });

  const [adminCorrectionLectureId, setAdminCorrectionLectureId] = useState('');
  const [adminCorrectionReason, setAdminCorrectionReason] = useState('');
  const [adminCorrectionStatuses, setAdminCorrectionStatuses] = useState({});
  const [adminCorrectionSubmitting, setAdminCorrectionSubmitting] = useState(false);

  // Official Attendance Letter Ingestion State
  const [multiDoc, setMultiDoc] = useState(DEFAULT_MULTI_DOC);
  const [multiUploading, setMultiUploading] = useState(false);
  const [multiNotice, setMultiNotice] = useState('');
  const [multiNoticeType, setMultiNoticeType] = useState('info'); // 'info' | 'success' | 'error'
  const [multiSummary, setMultiSummary] = useState(null);
  const [multiNewName, setMultiNewName] = useState('');
  const [multiNewRoll, setMultiNewRoll] = useState('');
  const [multiNewSap, setMultiNewSap] = useState('');
  const [multiNewBranch, setMultiNewBranch] = useState('');

  // Coordinator Attendance Queue Pagination & Filtering (max 5-8 records at a time)
  const [queuePage, setQueuePage] = useState(1);
  const [queuePageSize, setQueuePageSize] = useState(8);
  const [queueStatusFilter, setQueueStatusFilter] = useState('all'); // 'all' | 'Pending' | 'Approved' | 'Rejected'
  const [queueSearch, setQueueSearch] = useState('');

  // Student Portal: Letters Pagination & Filter state (max 5-8 records per page)
  const [studentLetterPage, setStudentLetterPage] = useState(1);
  const [studentLetterPageSize, setStudentLetterPageSize] = useState(6);
  const [studentLetterStatusFilter, setStudentLetterStatusFilter] = useState('all');

  // Student Portal: Lectures Pagination & Filter state
  const [studentLecturePage, setStudentLecturePage] = useState(1);
  const [studentLecturePageSize, setStudentLecturePageSize] = useState(6);
  const [studentLectureFilter, setStudentLectureFilter] = useState('all');

  // Authenticated Role-Based Skeleton Dashboard state
  const [dashboardLoading, setDashboardLoading] = useState(() => Boolean(localStorage.getItem('attendtrack_token')));
  const [dashboardError, setDashboardError] = useState(null);

  async function handleLogout() {
    if (authToken) {
      try {
        await fetch(`${API}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          }
        });
      } catch (_) {}
    }
    setAuthToken('');
    setCurrentUser(null);
    setShowSessionPreloader(false);
    setDashboardLoading(false);
    setDashboardError(null);
    setStudentPersonalData({ profile: null, attendance: [], letters: [] });
    localStorage.removeItem('attendtrack_token');
    localStorage.removeItem('attendtrack_user');
    setMessage('You have been signed out.');
    setIsError(false);
  }

  // Load authenticated dashboard with 2.5s skeleton preloader duration
  async function loadAuthenticatedDashboard(token, user) {
    const tokenToUse = token || authToken;
    const userToUse = user || currentUser;
    if (!tokenToUse) {
      setDashboardLoading(false);
      return;
    }
    setDashboardLoading(true);
    setDashboardError(null);
    const start = Date.now();
    try {
      const promises = [refresh(tokenToUse)];
      if (userToUse?.role === 'STUDENT') {
        promises.push(refreshStudentData(tokenToUse, userToUse));
      }
      await Promise.all(promises);
      const elapsed = Date.now() - start;
      const TARGET_SKELETON_MS = 1500; // 1.5 seconds
      if (elapsed < TARGET_SKELETON_MS) {
        await new Promise(r => setTimeout(r, TARGET_SKELETON_MS - elapsed));
      }
      setDashboardLoading(false);
    } catch (err) {
      if (err?.message !== 'Session expired') {
        setDashboardError(err?.message || 'Could not connect to AttendTrack server.');
      }
    }
  }

  function handleLoginSuccess(user, token) {
    sessionStorage.setItem('attendtrack_crest_preloader_seen', 'true');
    setShowSessionPreloader(false);
    setAuthToken(token);
    setCurrentUser(user);
    localStorage.setItem('attendtrack_token', token);
    localStorage.setItem('attendtrack_user', JSON.stringify(user));
    if (user.role === 'ADMIN') {
      setAdminActiveRole('Admin');
    }
    setMessage(`Welcome, ${user.name || user.username}! Signed in as ${user.role}.`);
    setIsError(false);
    loadAuthenticatedDashboard(token, user);
  }

  // Verify session on mount and when token changes
  useEffect(() => {
    if (authToken) {
      fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
        .then(res => {
          if (res.ok) return res.json();
          throw new Error('Session expired');
        })
        .then(d => {
          if (d.ok && d.user) {
            setCurrentUser(d.user);
            localStorage.setItem('attendtrack_user', JSON.stringify(d.user));
            loadAuthenticatedDashboard(authToken, d.user);
          } else {
            handleLogout();
          }
        })
        .catch(() => {
          handleLogout();
        });
    } else {
      setDashboardLoading(false);
    }
  }, [authToken]);

  // Load dedicated student-safe personal data if student is logged in
  async function refreshStudentData(overrideToken, overrideUser) {
    const token = overrideToken || authToken;
    const user = overrideUser || currentUser;
    if (!token || user?.role !== 'STUDENT') return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [pRes, aRes, lRes] = await Promise.all([
        fetch(`${API}/student/me`, { headers }),
        fetch(`${API}/student/attendance`, { headers }),
        fetch(`${API}/student/letters`, { headers })
      ]);
      if (pRes.status === 401 || aRes.status === 401 || lRes.status === 401) {
        handleLogout();
        throw new Error('Session expired');
      }
      const profileData = await pRes.json().catch(() => ({}));
      const attData = await aRes.json().catch(() => ({}));
      const letData = await lRes.json().catch(() => ({}));
      setStudentPersonalData({
        profile: profileData.student || null,
        attendance: attData.attendance || [],
        letters: letData.letters || []
      });
    } catch (err) {
      if (err?.message === 'Session expired') throw err;
    }
  }

  async function refresh(overrideToken) {
    const token = overrideToken !== undefined ? overrideToken : authToken;
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const r = await fetch(`${API}/dashboard`, { headers });
      if (r.status === 401 && token) {
        handleLogout();
        throw new Error('Session expired');
      }
      if (!r.ok) {
        throw new Error(`Failed to load dashboard (${r.status})`);
      }
      const d = await r.json();
      setData(d);
      if (d.isPostgresConnected === false && d.databaseWarning) {
        console.warn(`[AttendTrack] ${d.databaseWarning}`);
        setMessage(prev => (prev && prev.includes('PostgreSQL is disconnected') ? '' : prev));
      } else if (d.isPostgresConnected === true) {
        setMessage(prev => (prev && prev.includes('PostgreSQL is disconnected') ? '' : prev));
        setIsError(false);
      }
      if (!lectureId && d.lectures[0]) setLectureId(d.lectures[0].id);
      if (!adminCorrectionLectureId && d.lectures[0]) setAdminCorrectionLectureId(d.lectures[0].id);
      if (!studentViewId && d.students[0]) setStudentViewId(d.students[0].id);
      return d;
    } catch (err) {
      if (err?.message === 'Session expired') throw err;
      setMessage('API not connected. Start the server on port 4000.');
      setIsError(true);
      throw err;
    }
  }

  useEffect(() => {
    if (!authToken || dashboardLoading) return;
    refresh();
    if (currentUser?.role === 'STUDENT') {
      refreshStudentData();
    }
    const interval = setInterval(() => {
      refresh();
      if (currentUser?.role === 'STUDENT') {
        refreshStudentData();
      }
    }, 10000);
    const onFocus = () => {
      refresh();
      if (currentUser?.role === 'STUDENT') {
        refreshStudentData();
      }
    };
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [authToken, currentUser, dashboardLoading]);

  const currentLecture = data.lectures.find(x => x.id === lectureId);
  const roster = data.students.filter(s => currentLecture?.studentIds.includes(s.id));
  const submittedForCurrentLecture = data.attendance.filter(a => a.lectureId === currentLecture?.id && a.submitted);
  const isLectureAlreadySubmitted = submittedForCurrentLecture.length > 0;
  const windowInfo = currentLecture?.correctionWindow || {};
  const isCorrectionExpired = windowInfo.isExpired ?? false;
  const isCorrectionOpen = windowInfo.isOpen ?? true;

  // Regular lecture attendance submission / correction (Teacher)
  async function submitAttendance() {
    if (isCorrectionExpired) {
      setMessage(`Attendance correction window expired for ${currentLecture?.subject}. Submissions closed at ${windowInfo.formattedDeadline}.`);
      setIsError(true);
      return;
    }
    const entries = roster.map(s => {
      const prior = submittedForCurrentLecture.find(a => a.studentId === s.id);
      return {
        studentId: s.id,
        status: statuses[s.id] || prior?.status || 'Present'
      };
    });
    try {
      const r = await fetch(`${API}/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({ lectureId, entries, actor: 'Teacher' })
      });
      const result = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMessage(result.error || `Attendance submission failed (HTTP ${r.status}).`);
        setIsError(true);
      } else {
        setMessage(result.message || 'Attendance saved.');
        setIsError(false);
        refresh();
      }
    } catch (err) {
      setMessage(`Network error: ${err.message}`);
      setIsError(true);
    }
  }

  // Admin post-deadline correction
  async function submitAdminCorrection() {
    if (!adminCorrectionReason.trim()) {
      setMessage('Mandatory reason is required for post-deadline attendance correction.');
      setIsError(true);
      return;
    }
    const targetLec = data.lectures.find(l => l.id === (adminCorrectionLectureId || data.lectures[0]?.id));
    if (!targetLec) return;
    const targetRoster = data.students.filter(s => targetLec.studentIds.includes(s.id));
    const prior = data.attendance.filter(a => a.lectureId === targetLec.id);

    const entries = targetRoster.map(s => ({
      studentId: s.id,
      status: adminCorrectionStatuses[s.id] || prior.find(a => a.studentId === s.id)?.status || 'Present'
    }));

    setAdminCorrectionSubmitting(true);
    try {
      const r = await fetch(`${API}/attendance/admin-correction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'Admin',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          lectureId: targetLec.id,
          entries,
          reason: adminCorrectionReason.trim(),
          actor: 'Admin'
        })
      });
      const result = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMessage(result.error || `Admin correction failed (HTTP ${r.status}).`);
        setIsError(true);
      } else {
        setMessage(result.message || 'Admin post-deadline attendance correction applied successfully.');
        setIsError(false);
        setAdminCorrectionReason('');
        refresh();
      }
    } catch (err) {
      setMessage(`Network error: ${err.message}`);
      setIsError(true);
    } finally {
      setAdminCorrectionSubmitting(false);
    }
  }

  // Document letter upload handler (Single or multi-student: Word, PDF, JPEG, PNG)
  async function handleMultiFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setMultiUploading(true);
    setMultiNotice('');
    try {
      const fd = new FormData();
      fd.append('document', file);

      const r = await fetch(`${API}/letters/upload`, {
        method: 'POST',
        headers: {
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: fd
      });
      const result = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMultiNotice(result.error || `Upload failed with status HTTP ${r.status}.`);
        setMultiNoticeType('error');
        return;
      }

      const { uploadId, originalName, fileTypeName, extractionMethod, summary, extraction } = result;
      const ext = extraction?.extracted || {};
      const rawExtractedStudents = ext.students || [];

      setMultiDoc(prev => ({
        ...prev,
        uploadId: uploadId || prev.uploadId,
        documentName: originalName || prev.documentName,
        reference: ext.reference || prev.reference,
        date: ext.date || prev.date,
        subject: ext.subject || prev.subject,
        startTime: ext.startTime || prev.startTime,
        endTime: ext.endTime || prev.endTime,
        fileTypeName: fileTypeName || prev.fileTypeName,
        extractionMethod: extractionMethod || prev.extractionMethod
      }));
      setMultiSummary(summary || null);

      if (rawExtractedStudents.length > 0) {
        // Match against current institutional student roster
        const eligibleStudents = [];
        rawExtractedStudents.forEach(cand => {
          const sap = (cand.sapId || '').trim();
          const found = data.students.find(s => s.sapId && s.sapId.trim() === sap) || (cand.studentId ? data.students.find(s => s.id === cand.studentId) : null);
          if (found) {
            eligibleStudents.push({
              studentId: found.id,
              studentName: found.name,
              rawStudentName: cand.rawStudentName || cand.studentName || found.name,
              rawStudentId: cand.rawStudentId || cand.rollNo || found.sapId,
              rollNo: cand.rollNo || found.rollNo || '',
              sapId: found.sapId,
              branch: cand.branch || '',
              reference: ext.reference || 'OFFICIAL-DOC'
            });
          }
        });

        if (eligibleStudents.length > 0) {
          try {
            const payload = {
              uploadId: uploadId || undefined,
              documentName: originalName || undefined,
              date: ext.date || '2026-10-14',
              subject: ext.subject || 'Artificial Intelligence',
              startTime: ext.startTime || '10:00',
              endTime: ext.endTime || '11:00',
              reference: ext.reference || 'OFFICIAL-DOC',
              actor: role,
              students: eligibleStudents
            };
            const postRes = await fetch(`${API}/letters`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
              },
              body: JSON.stringify(payload)
            });
            const postData = await postRes.json().catch(() => ({}));
            if (postRes.ok) {
              const queuedCount = postData.items?.length || eligibleStudents.length;
              const skippedCount = rawExtractedStudents.length - eligibleStudents.length;
              setMultiNotice(
                `Document "${originalName}" parsed: ${queuedCount} verified student(s) automatically queued into the Review Queue below.${skippedCount > 0 ? ` (${skippedCount} student(s) with unverified SAP IDs skipped for review).` : ''}`
              );
              setMultiNoticeType('success');
              refresh();
            } else {
              setMultiNotice(postData.error || `Parsed entries, but queueing returned HTTP ${postRes.status}.`);
              setMultiNoticeType('error');
            }
          } catch (err) {
            setMultiNotice(`Auto-queue network error: ${err.message}`);
            setMultiNoticeType('error');
          }
        } else {
          setMultiNotice(`Document "${originalName}" parsed (${rawExtractedStudents.length} entries detected), but no candidates matched enrolled student SAP IDs.`);
          setMultiNoticeType('error');
        }
      } else {
        setMultiNotice(`Uploaded "${originalName}", but no student entries were detected. Please check document content or add rows manually.`);
        setMultiNoticeType('error');
      }
    } catch (err) {
      setMultiNotice(`Upload failed: ${err.message}`);
      setMultiNoticeType('error');
    } finally {
      setMultiUploading(false);
    }
  }

  async function decide(id, decision) {
    try {
      const r = await fetch(`${API}/letters/${id}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({ decision, actor: role })
      });
      const result = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMessage(result.error || `Decision failed (HTTP ${r.status}).`);
        setIsError(true);
      } else {
        setMessage(result.message || `Letter ${decision}d.`);
        setIsError(false);
        refresh();
      }
    } catch (err) {
      setMessage(`Network error: ${err.message}`);
      setIsError(true);
    }
  }

  async function approveAllEligible() {
    const eligible = data.letters.filter(l => l.status === 'Pending');
    if (eligible.length === 0) return;

    try {
      const r = await fetch(`${API}/letters/batch-decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          letterIds: eligible.map(l => l.id),
          decision: 'approve',
          actor: role
        })
      });
      const result = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMessage(result.error || `Batch approval failed (HTTP ${r.status}).`);
        setIsError(true);
      } else {
        setMessage(`Approved ${result.approved.length} eligible letters. Attendance records updated to Present.`);
        setIsError(false);
        refresh();
      }
    } catch (err) {
      setMessage(`Batch approval error: ${err.message}`);
      setIsError(true);
    }
  }

  async function addMultiCandidateRow(e) {
    e.preventDefault();
    const name = multiNewName.trim();
    if (!name) {
      setMultiNotice('Please enter student name.');
      setMultiNoticeType('error');
      return;
    }
    const roll = multiNewRoll.trim();
    const sap = multiNewSap.trim();
    const branch = multiNewBranch.trim();

    if (!sap) {
      setMultiNotice('SAP ID is required to verify and queue a student.');
      setMultiNoticeType('error');
      return;
    }

    const foundBySap = data.students.find(s => s.sapId && s.sapId.trim() === sap);
    if (!foundBySap) {
      setMultiNotice(`Unknown SAP ID: "${sap}" is not registered in institutional roster.`);
      setMultiNoticeType('error');
      return;
    }

    try {
      const payload = {
        uploadId: multiDoc.uploadId || undefined,
        documentName: multiDoc.documentName || 'Manual Entry',
        date: multiDoc.date || '2026-10-14',
        subject: multiDoc.subject || 'Artificial Intelligence',
        startTime: multiDoc.startTime || '10:00',
        endTime: multiDoc.endTime || '11:00',
        reference: multiDoc.reference || 'REF-MANUAL',
        actor: role,
        students: [{
          studentId: foundBySap.id,
          studentName: foundBySap.name,
          rawStudentName: name,
          rawStudentId: roll || sap,
          rollNo: roll || foundBySap.rollNo || '',
          sapId: foundBySap.sapId,
          branch: branch || 'Computer Engineering',
          reference: multiDoc.reference || 'REF-MANUAL'
        }]
      };

      const r = await fetch(`${API}/letters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify(payload)
      });
      const res = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMultiNotice(res.error || `Failed to queue student: HTTP ${r.status}`);
        setMultiNoticeType('error');
      } else {
        setMultiNotice(`Successfully added "${foundBySap.name}" (SAP: ${foundBySap.sapId}) directly to the Review Queue below.`);
        setMultiNoticeType('success');
        setMultiNewName('');
        setMultiNewRoll('');
        setMultiNewSap('');
        setMultiNewBranch('');
        refresh();
      }
    } catch (err) {
      setMultiNotice(`Network error: ${err.message}`);
      setMultiNoticeType('error');
    }
  }

  function resetToSampleDoc() {
    setMultiDoc(DEFAULT_MULTI_DOC);
    setMultiSummary({
      totalDetected: 5,
      matched: 3,
      unknownSap: 1,
      missingOrUnreadableSap: 1,
      nameMismatches: 0,
      duplicates: 0,
      needsReview: 0
    });
    setMultiNotice('Loaded template reference: AttendTrack_Attendance_Permission_Template.docx. Records are in the Review Queue below.');
    setMultiNoticeType('info');
    refresh();
  }

  // Counts for UI summary
  const eligibleReviewCount = data.letters.filter(l => l.status === 'Pending' && l.lectureId && l.validation === 'Exact lecture/time candidate').length;

  // Student portal data resolution
  const isStudent = currentUser?.role === 'STUDENT';
  const currentStudent = isStudent
    ? (studentPersonalData.profile || currentUser)
    : (data.students.find(s => s.id === (studentViewId || data.students[0]?.id)) || data.students[0]);

  const studentAttendanceRecords = isStudent
    ? studentPersonalData.attendance
    : (currentStudent ? data.attendance.filter(a => a.studentId === currentStudent.id || a.sapId === currentStudent.sapId) : []);

  const studentLetters = isStudent
    ? studentPersonalData.letters
    : (currentStudent ? data.letters.filter(l => l.studentId === currentStudent.id || l.sapId === currentStudent.sapId) : []);

  const studentEnrolledLectures = currentStudent
    ? data.lectures.filter(l => l.studentIds?.includes(currentStudent.id) || (currentStudent.classGroup && l.className === currentStudent.classGroup))
    : [];

  const studentTotalLectures = Math.max(studentEnrolledLectures.length, studentAttendanceRecords.length);
  const studentPresentCount = studentAttendanceRecords.filter(a => a.status === 'Present').length;
  const studentAbsentCount = studentAttendanceRecords.filter(a => a.status === 'Absent').length;
  const studentApprovedLetters = studentLetters.filter(l => l.status === 'Approved');
  const studentAttendancePct = studentTotalLectures > 0
    ? ((studentPresentCount / studentTotalLectures) * 100).toFixed(1)
    : '100.0';

  // Student Portal: Filtered & Paginated Letters (max 5-8 records per page)
  const filteredStudentLetters = useMemo(() => {
    let list = studentLetters || [];
    if (studentLetterStatusFilter !== 'all') {
      list = list.filter(l => l.status === studentLetterStatusFilter);
    }
    return list;
  }, [studentLetters, studentLetterStatusFilter]);

  const totalStudentLetterPages = Math.max(1, Math.ceil(filteredStudentLetters.length / studentLetterPageSize));
  const currentStudentLetterPage = Math.min(studentLetterPage, totalStudentLetterPages);
  const paginatedStudentLetters = filteredStudentLetters.slice(
    (currentStudentLetterPage - 1) * studentLetterPageSize,
    currentStudentLetterPage * studentLetterPageSize
  );

  // Student Portal: Filtered & Paginated Lectures
  const filteredStudentLectures = useMemo(() => {
    let list = studentEnrolledLectures || [];
    if (studentLectureFilter !== 'all') {
      list = list.filter(lec => {
        const record = studentAttendanceRecords.find(a => a.lectureId === lec.id);
        const status = record?.status || 'Scheduled';
        return status === studentLectureFilter;
      });
    }
    return list;
  }, [studentEnrolledLectures, studentAttendanceRecords, studentLectureFilter]);

  const totalStudentLecturePages = Math.max(1, Math.ceil(filteredStudentLectures.length / studentLecturePageSize));
  const currentStudentLecturePage = Math.min(studentLecturePage, totalStudentLecturePages);
  const paginatedStudentLectures = filteredStudentLectures.slice(
    (currentStudentLecturePage - 1) * studentLecturePageSize,
    currentStudentLecturePage * studentLecturePageSize
  );

  // Teacher lecture records
  const teacherLectures = data.lectures;
  const submittedLecturesCount = new Set(data.attendance.filter(a => a.submitted).map(a => a.lectureId)).size;

  // Coordinator Review Queue Filtering & Pagination (max 5-8 records at a time)
  const filteredQueueLetters = useMemo(() => {
    let list = data.letters || [];
    if (queueStatusFilter !== 'all') {
      list = list.filter(l => l.status === queueStatusFilter);
    }
    if (queueSearch.trim()) {
      const q = queueSearch.toLowerCase().trim();
      list = list.filter(l =>
        (l.studentName && l.studentName.toLowerCase().includes(q)) ||
        (l.sapId && String(l.sapId).includes(q)) ||
        (l.rollNo && String(l.rollNo).toLowerCase().includes(q)) ||
        (l.subject && l.subject.toLowerCase().includes(q)) ||
        (l.matchedSubject && l.matchedSubject.toLowerCase().includes(q)) ||
        (l.reference && l.reference.toLowerCase().includes(q)) ||
        (l.documentName && l.documentName.toLowerCase().includes(q)) ||
        (l.date && l.date.includes(q))
      );
    }
    return list;
  }, [data.letters, queueStatusFilter, queueSearch]);

  const totalQueuePages = Math.max(1, Math.ceil(filteredQueueLetters.length / queuePageSize));
  const currentQueuePage = Math.min(queuePage, totalQueuePages);
  const paginatedQueueLetters = filteredQueueLetters.slice(
    (currentQueuePage - 1) * queuePageSize,
    currentQueuePage * queuePageSize
  );

  // Frame 2: Standalone Official Login Experience
  if (!currentUser || !authToken) {
    return (
      <>
        {showSessionPreloader && (
          <TransparentPreloader
            onComplete={() => {
              sessionStorage.setItem('attendtrack_crest_preloader_seen', 'true');
              setShowSessionPreloader(false);
            }}
          />
        )}
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          isPostgresConnected={data.isPostgresConnected}
          isPreloading={showSessionPreloader}
        />
      </>
    );
  }

  // Frame 3: Role-Based Skeleton Dashboard Preloader (Immediately after login while data loads)
  if (dashboardLoading) {
    return (
      <RoleSkeletonDashboard
        role={role || getNormalizedRole(currentUser)}
        user={currentUser}
        error={dashboardError}
        onRetry={() => loadAuthenticatedDashboard(authToken, currentUser)}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="app-shell">
      {/* Official DJSCE Institutional Header Banner */}
      <header className="djsce-brand-header">
        <div className="djsce-brand-inner">
          <div className="djsce-crest-side" title="Shri Vile Parle Kelavani Mandal (SVKM)">
            <img
              src="/djsce_svkm_logo.png"
              alt="SVKM Emblem"
              className="djsce-svkm-img"
            />
          </div>
          <div className="djsce-center-identity">
            <span className="djsce-trust-title">Shri Vile Parle Kelavani Mandal's</span>
            <h2 className="djsce-college-title">DWARKADAS J. SANGHVI COLLEGE OF ENGINEERING</h2>
            <div className="djsce-accreditation-line">
              <span className="djsce-sub-item">Autonomous College Affiliated to the University of Mumbai</span>
              <span className="djsce-sub-dot">◆</span>
              <span className="djsce-sub-badge gold">NAAC 'A' Grade</span>
            </div>
          </div>
          <div className="djsce-crest-side" title="Dwarkadas J. Sanghvi College of Engineering">
            <img
              src="/djsce_crest.png"
              alt="DJSCE College Crest"
              className="djsce-crest-img"
            />
          </div>
        </div>
      </header>

      {/* Role-Adaptive Layout: Student gets dedicated SS1 experience */}
      {role === 'Student' ? (
        <StudentPortalView
          currentUser={currentUser}
          currentStudent={currentStudent}
          isStudent={isStudent}
          studentAttendanceRecords={studentAttendanceRecords}
          studentLetters={studentLetters}
          studentEnrolledLectures={studentEnrolledLectures}
          studentTotalLectures={studentTotalLectures}
          studentPresentCount={studentPresentCount}
          studentAbsentCount={studentAbsentCount}
          studentAttendancePct={studentAttendancePct}
          studentApprovedLetters={studentApprovedLetters}
          filteredStudentLetters={filteredStudentLetters}
          paginatedStudentLetters={paginatedStudentLetters}
          totalStudentLetterPages={totalStudentLetterPages}
          currentStudentLetterPage={currentStudentLetterPage}
          setStudentLetterPage={setStudentLetterPage}
          studentLetterPageSize={studentLetterPageSize}
          setStudentLetterPageSize={setStudentLetterPageSize}
          studentLetterStatusFilter={studentLetterStatusFilter}
          setStudentLetterStatusFilter={setStudentLetterStatusFilter}
          filteredStudentLectures={filteredStudentLectures}
          paginatedStudentLectures={paginatedStudentLectures}
          totalStudentLecturePages={totalStudentLecturePages}
          currentStudentLecturePage={currentStudentLecturePage}
          setStudentLecturePage={setStudentLecturePage}
          studentLecturePageSize={studentLecturePageSize}
          setStudentLecturePageSize={setStudentLecturePageSize}
          studentLectureFilter={studentLectureFilter}
          setStudentLectureFilter={setStudentLectureFilter}
          data={data}
          handleLogout={handleLogout}
          refresh={refresh}
          refreshStudentData={refreshStudentData}
          authToken={authToken}
          API={API}
          setMessage={setMessage}
          setIsError={setIsError}
          adminActiveRole={adminActiveRole}
          setAdminActiveRole={setAdminActiveRole}
          roles={roles}
        />
      ) : role === 'Teacher' ? (
        <TeacherPortalView
          currentUser={currentUser}
          authToken={authToken}
          data={data}
          lectureId={lectureId}
          setLectureId={setLectureId}
          statuses={statuses}
          setStatuses={setStatuses}
          submitAttendance={submitAttendance}
          handleLogout={handleLogout}
          refresh={refresh}
          setMessage={setMessage}
          setIsError={setIsError}
          message={message}
          isError={isError}
          adminActiveRole={adminActiveRole}
          setAdminActiveRole={setAdminActiveRole}
          roles={roles}
        />
      ) : role === 'Admin' ? (
        <AdminPortalView
          currentUser={currentUser}
          authToken={authToken}
          data={data}
          handleLogout={handleLogout}
          refresh={refresh}
          adminActiveRole={adminActiveRole}
          setAdminActiveRole={setAdminActiveRole}
          roles={roles}
          API={API}
          adminCorrectionLectureId={adminCorrectionLectureId}
          setAdminCorrectionLectureId={setAdminCorrectionLectureId}
          adminCorrectionReason={adminCorrectionReason}
          setAdminCorrectionReason={setAdminCorrectionReason}
          adminCorrectionStatuses={adminCorrectionStatuses}
          setAdminCorrectionStatuses={setAdminCorrectionStatuses}
          submitAdminCorrection={submitAdminCorrection}
          adminCorrectionSubmitting={adminCorrectionSubmitting}
          message={message}
          isError={isError}
          setMessage={setMessage}
          setIsError={setIsError}
        />
      ) : role === 'Attendance Coordinator' ? (
        <CoordinatorPortalView
          currentUser={currentUser}
          authToken={authToken}
          data={data}
          handleLogout={handleLogout}
          refresh={refresh}
          multiDoc={multiDoc}
          setMultiDoc={setMultiDoc}
          multiUploading={multiUploading}
          multiNotice={multiNotice}
          setMultiNotice={setMultiNotice}
          multiNoticeType={multiNoticeType}
          multiSummary={multiSummary}
          multiNewName={multiNewName}
          setMultiNewName={setMultiNewName}
          multiNewRoll={multiNewRoll}
          setMultiNewRoll={setMultiNewRoll}
          multiNewSap={multiNewSap}
          setMultiNewSap={setMultiNewSap}
          multiNewBranch={multiNewBranch}
          setMultiNewBranch={setMultiNewBranch}
          handleMultiFileUpload={handleMultiFileUpload}
          resetToSampleDoc={resetToSampleDoc}
          addMultiCandidateRow={addMultiCandidateRow}
          decide={decide}
          approveAllEligible={approveAllEligible}
          API={API}
          message={message}
          setMessage={setMessage}
          isError={isError}
          setIsError={setIsError}
          adminActiveRole={adminActiveRole}
          setAdminActiveRole={setAdminActiveRole}
          roles={roles}
        />
      ) : (
        <>
          {/* Main AttendTrack Navigation Bar */}
          <nav className="topbar">
        <div className="topbar-identity">
          <div className="eyebrow">DJSCE · ATTENDANCE & EXEMPTION PORTAL</div>
          <h1>AttendTrack</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {data.isPostgresConnected ? (
            <span className="badge-live" title="Authoritative PostgreSQL (port 5432) connected">● PostgreSQL Connected</span>
          ) : (
            <span className="badge-docx" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' }} title="PostgreSQL disconnected. Showing fallback store.">⚠ Fallback Mode (DB Disconnected)</span>
          )}

          {currentUser ? (
            <div className="topbar-user-badge">
              <span className="user-avatar-circle">
                {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : currentUser.role.charAt(0)}
              </span>
              <span className="user-name">{currentUser.name || currentUser.username}</span>
              <span className={`pill ${currentUser.role === 'ADMIN' ? 'red' : currentUser.role === 'COORDINATOR' ? 'amber' : currentUser.role === 'TEACHER' ? 'blue' : 'teal'}`}>
                {currentUser.role}
              </span>
              {currentUser.sapId && (
                <span className="small muted" style={{ color: '#dbeafe' }}>SAP: <code>{currentUser.sapId}</code></span>
              )}

              <button
                type="button"
                className="topbar-logout-btn"
                onClick={handleLogout}
                title="Sign out of AttendTrack"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <span className="pill gray">Institutional Login</span>
          )}
        </div>
      </nav>

      <main>
        {message && (
          <div className={`notice ${isError ? 'error' : ''}`}>
            <span>{message}</span>
            <button className="quiet" onClick={() => setMessage('')}>Dismiss</button>
          </div>
        )}

        {/* Dynamic Welcome Section tailored to Active Role */}
        <section className="welcome">
          <div>
            <p className="eyebrow">{role.toUpperCase()} PORTAL</p>
            <h2>Attendance, with a verified institutional audit trail.</h2>
            <p>
              {role === 'Teacher' && 'Conduct regular lecture attendance for your assigned classes and enrolled cohorts.'}
              {role === 'Attendance Coordinator' && 'Process official student attendance letters and approve verified lecture exemptions.'}
              {role === 'Student' && 'Review your personal class attendance records and approved official letter exemptions.'}
              {role === 'Admin' && 'Manage student rosters, bulk imports, and review system-wide audit traceability.'}
            </p>
          </div>
          <div className="stats">
            {role === 'Teacher' && (
              <>
                <div><b>{roster.length}</b><span>Class Roster</span></div>
                <div><b>{teacherLectures.length}</b><span>Lectures</span></div>
                <div><b>{submittedLecturesCount}</b><span>Submitted</span></div>
                <div><b>{data.logs.length}</b><span>Audit events</span></div>
              </>
            )}
            {role === 'Attendance Coordinator' && (
              <>
                <div><b>{data.letters.filter(l => l.status === 'Pending').length}</b><span>Pending letters</span></div>
                <div><b>{data.letters.filter(l => l.status === 'Approved').length}</b><span>Approved letters</span></div>
                <div><b>{data.totalStudents || data.students.length}</b><span>Enrolled</span></div>
                <div><b>{data.logs.length}</b><span>Audit events</span></div>
              </>
            )}
            {role === 'Student' && (
              <>
                <div><b>{studentAttendancePct}%</b><span>Attendance</span></div>
                <div><b>{studentPresentCount}</b><span>Present</span></div>
                <div><b>{studentAbsentCount}</b><span>Absent</span></div>
                <div><b>{studentApprovedLetters.length}</b><span>Approved letters</span></div>
              </>
            )}
            {role === 'Admin' && (
              <>
                <div><b>{data.totalStudents || data.students.length}</b><span>Enrolled</span></div>
                <div><b>{data.lectures.length}</b><span>Lectures</span></div>
                <div><b>{data.letters.length}</b><span>Total letters</span></div>
                <div><b>{data.logs.length}</b><span>Audit events</span></div>
              </>
            )}
          </div>
        </section>

        {message && (
          <div className={`notice ${isError ? 'error' : ''}`}>
            <span>{message}</span>
            <button className="quiet" onClick={() => setMessage('')}>Dismiss</button>
          </div>
        )}

        {/* ------------------------------------------------------------------------- */}
        {/* ROLE 1: TEACHER WORKFLOW (Regular Lecture Attendance)                      */}
        {/* ------------------------------------------------------------------------- */}
        {role === 'Teacher' && (
          <>
            <section className="card wide">
              <div className="section-head">
                <div>
                  <p className="eyebrow">LECTURE ATTENDANCE</p>
                  <h3>Regular lecture attendance</h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="pill blue">Teacher</span>
                  {isCorrectionExpired ? (
                    <span className="pill red" id="window-status-badge">
                      🔒 Correction Window Expired
                    </span>
                  ) : (
                    <span className="pill teal" id="window-status-badge">
                      ⏱ Correction Window Open
                    </span>
                  )}
                  {isLectureAlreadySubmitted && (
                    <span className="pill teal">✓ Attendance Submitted ({submittedForCurrentLecture.length} students)</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '14px' }}>
                <label style={{ margin: 0 }}>
                  Scheduled lecture
                  <select
                    value={lectureId}
                    onChange={e => {
                      setLectureId(e.target.value);
                      setStatuses({});
                    }}
                  >
                    {data.lectures.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.subject} · {l.date} · {l.startTime}–{l.endTime} ({l.className}) {l.correctionWindow?.isExpired ? '🔒 [Locked]' : '⏱ [Open]'}
                      </option>
                    ))}
                  </select>
                </label>
                {currentLecture && (
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <span className="small muted">Class Group: <b>{currentLecture.className}</b></span>
                    <span className="small muted">Lecture ID: <code>{currentLecture.id}</code></span>
                  </div>
                )}
              </div>

              {/* Window Status Banner */}
              <div
                className="notice"
                style={{
                  background: isCorrectionExpired ? '#fef2f2' : '#f0fdf4',
                  borderColor: isCorrectionExpired ? '#fecaca' : '#bbf7d0',
                  color: isCorrectionExpired ? '#991b1b' : '#166534',
                  marginBottom: '14px'
                }}
              >
                {isCorrectionExpired ? (
                  <span>
                    🔒 <b>24-Hour Attendance Correction Window Expired:</b> This lecture ended at <b>{windowInfo.formattedScheduledEnd}</b>. Changes closed strictly 24 hours later at <b>{windowInfo.formattedDeadline}</b>. Attendance is now permanently locked for teachers. For official corrections, an authorized College Administrator can perform an administrative correction with mandatory audit rationale.
                  </span>
                ) : (
                  <span>
                    ⏱ <b>24-Hour Correction Window Active:</b> Teachers may mark or correct attendance until <b>{windowInfo.formattedDeadline}</b> (24 hours after lecture scheduled end at {windowInfo.formattedScheduledEnd}).
                  </span>
                )}
              </div>

              <div className="roster">
                {roster.map(s => {
                  const existingRecord = submittedForCurrentLecture.find(a => a.studentId === s.id);
                  const currentStatus = statuses[s.id] || existingRecord?.status || 'Present';

                  return (
                    <div className="student-row" key={s.id}>
                      <div>
                        <b>{s.name}</b>
                        <span>SAP ID: <code>{s.sapId}</code>{s.rollNo ? ` · Roll: ${s.rollNo}` : ''} · {s.branch || 'Computer Engineering'}</span>
                      </div>
                      <select
                        value={currentStatus}
                        disabled={isCorrectionExpired}
                        onChange={e => setStatuses(p => ({ ...p, [s.id]: e.target.value }))}
                        style={{ width: '110px', opacity: isCorrectionExpired ? 0.7 : 1 }}
                      >
                        <option value="Present">Present</option>
                        <option value="Absent">Absent</option>
                      </select>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={submitAttendance}
                  disabled={!currentLecture || !roster.length || isCorrectionExpired}
                  className="proto-btn proto-btn-primary"
                  style={{
                    padding: '10px 18px',
                    opacity: isCorrectionExpired ? 0.6 : 1,
                    cursor: isCorrectionExpired ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isCorrectionExpired
                    ? '🔒 Correction Window Expired (Attendance Locked)'
                    : (isLectureAlreadySubmitted ? '✓ Update / Correct Lecture Attendance' : 'Submit lecture attendance to PostgreSQL')}
                </button>
                <span className="small muted">
                  Enrolled student cohort: {roster.length} students
                </span>
              </div>
            </section>

            <section className="card wide">
              <div className="section-head">
                <div>
                  <p className="eyebrow">TEACHER AUDIT</p>
                  <h3>Recent lecture attendance activity</h3>
                </div>
              </div>
              <div className="log-list">
                {data.logs.slice(0, 6).map(log => (
                  <div className="log-row" key={log.id}>
                    <span className="log-dot"></span>
                    <div>
                      <b>{log.action}</b>
                      <p>{log.details}</p>
                    </div>
                    <time>{new Date(log.at).toLocaleString()}</time>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ------------------------------------------------------------------------- */}
        {/* ROLE 2: ATTENDANCE COORDINATOR WORKFLOW                                    */}
        {/* (Primary Unified Official Attendance Letter Processing & Verification)      */}
        {/* ------------------------------------------------------------------------- */}
        {role === 'Attendance Coordinator' && (
          <>
            <section className="card wide proto-card" id="multi-student-workflow">
              <div className="section-head">
                <div>
                  <p className="eyebrow">OFFICIAL LETTER INTAKE & INGESTION</p>
                  <h3>Document Processing & Automated Queue Intake</h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge-live">PostgreSQL Connected</span>
                  <span className="badge-docx">{multiDoc.extractionMethod || 'Document Extraction Engine'}</span>
                  <span className="pill teal">{multiDoc.fileTypeName || 'Attendance Document'}</span>
                </div>
              </div>

              {/* Document Upload Bar */}
              <div className="multi-upload-bar">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontWeight: 600, fontSize: '11.5px' }}>
                  <span>📄 Upload Official Letter (.docx, .pdf, .jpg, .png):</span>
                  <input
                    type="file"
                    accept=".docx,.pdf,.png,.jpg,.jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="multi-file-input"
                    disabled={multiUploading}
                    onChange={handleMultiFileUpload}
                  />
                </label>
                {multiUploading && <span className="small muted">Extracting & queueing verified entries...</span>}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="proto-btn proto-btn-secondary"
                    onClick={resetToSampleDoc}
                    title="Load standard permission letter template reference"
                  >
                    Load Sample Template
                  </button>
                </div>
              </div>

              {multiNotice && (
                <div className={`notice ${multiNoticeType === 'error' ? 'error' : ''}`} style={{ marginBottom: '14px' }}>
                  <span>{multiNotice}</span>
                  <button className="quiet" onClick={() => setMultiNotice('')}>Dismiss</button>
                </div>
              )}

              {/* Shared Document Reference */}
              <div className="proto-doc-ref">
                <div className="proto-doc-header">
                  <div className="proto-doc-title">
                    <span>📎 Active Document Reference:</span>
                    <code>{multiDoc.documentName}</code>
                    {multiDoc.uploadId && <small style={{ color: '#0369a1', marginLeft: '6px' }}>[ID: {multiDoc.uploadId}]</small>}
                  </div>
                  <div className="proto-doc-chips">
                    <span className="proto-chip">Ref: {multiDoc.reference}</span>
                    <span className="proto-chip">Date: {multiDoc.date}</span>
                    <span className="proto-chip">Lecture: {multiDoc.subject}</span>
                    <span className="proto-chip">Time: {multiDoc.startTime}–{multiDoc.endTime}</span>
                  </div>
                </div>
                <p className="proto-doc-desc">
                  Extracted students are linked directly to this official document record in PostgreSQL via <code>uploadId</code>, preserving archive integrity with private storage.
                </p>
              </div>

              {/* Extraction Summary Badges */}
              {multiSummary && (
                <div className="proto-summary-chips" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '0 0 12px 0', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '12px' }}>📊 Extraction Summary:</span>
                  <span className="pill blue" title="Total student candidates detected in document">Detected: {multiSummary.totalDetected}</span>
                  <span className="pill teal" title="Students matched to enrolled PostgreSQL roster">Matched: {multiSummary.matched}</span>
                  {multiSummary.unknownSap > 0 && (
                    <span className="pill red" title="SAP IDs not found in institutional database">Unknown SAP: {multiSummary.unknownSap}</span>
                  )}
                  {multiSummary.missingOrUnreadableSap > 0 && (
                    <span className="pill amber" title="Entries with missing or unreadable SAP IDs">Missing/Unreadable: {multiSummary.missingOrUnreadableSap}</span>
                  )}
                  {multiSummary.nameMismatches > 0 && (
                    <span className="pill amber" title="SAP ID belongs to a different student">Name Mismatches: {multiSummary.nameMismatches}</span>
                  )}
                  {multiSummary.duplicates > 0 && (
                    <span className="pill amber" title="Duplicate student rows in document">Duplicates: {multiSummary.duplicates}</span>
                  )}
                  {multiSummary.needsReview > 0 && (
                    <span className="pill gray" title="Rows requiring manual verification">Needs Review: {multiSummary.needsReview}</span>
                  )}
                </div>
              )}

              {/* Quick Add Student Candidate Form */}
              <div className="proto-toolbar" style={{ marginTop: '6px' }}>
                <form onSubmit={addMultiCandidateRow} className="proto-add-form" style={{ flexWrap: 'wrap' }}>
                  <b>+ Quick Add Student Candidate to Queue:</b>
                  <input
                    type="text"
                    placeholder="Full name"
                    value={multiNewName}
                    onChange={e => setMultiNewName(e.target.value)}
                    style={{ width: '140px' }}
                  />
                  <input
                    type="text"
                    placeholder="Roll No (e.g. 24CS01)"
                    value={multiNewRoll}
                    onChange={e => setMultiNewRoll(e.target.value)}
                    style={{ width: '110px' }}
                  />
                  <input
                    type="text"
                    placeholder="SAP ID (e.g. 6000124...)"
                    value={multiNewSap}
                    onChange={e => setMultiNewSap(e.target.value)}
                    style={{ width: '130px' }}
                  />
                  <input
                    type="text"
                    placeholder="Branch / Dept"
                    value={multiNewBranch}
                    onChange={e => setMultiNewBranch(e.target.value)}
                    style={{ width: '120px' }}
                  />
                  <button type="submit" className="proto-btn proto-btn-primary">Queue Student</button>
                </form>
              </div>
            </section>

            {/* Coordinator Review Queue & Logs */}
            <section className="card wide">
              <div className="section-head">
                <div>
                  <p className="eyebrow">COORDINATOR REVIEW QUEUE</p>
                  <h3>Attendance queue & records</h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="pill amber">{data.letters.filter(l => l.status === 'Pending').length} pending</span>
                  {eligibleReviewCount > 0 && (
                    <button
                      className="bulk-action-btn"
                      onClick={approveAllEligible}
                      title={`Bulk approve ${eligibleReviewCount} letters with exact lecture and time matches`}
                    >
                      Approve {eligibleReviewCount} eligible
                    </button>
                  )}
                </div>
              </div>

              {/* Status Filters and Search Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 10px', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={`small-btn ${queueStatusFilter === 'all' ? '' : 'secondary'}`}
                    style={{ padding: '4px 10px', fontSize: '12px' }}
                    onClick={() => { setQueueStatusFilter('all'); setQueuePage(1); }}
                  >
                    All ({data.letters.length})
                  </button>
                  <button
                    type="button"
                    className={`small-btn ${queueStatusFilter === 'Pending' ? '' : 'secondary'}`}
                    style={{ padding: '4px 10px', fontSize: '12px' }}
                    onClick={() => { setQueueStatusFilter('Pending'); setQueuePage(1); }}
                  >
                    Pending ({data.letters.filter(l => l.status === 'Pending').length})
                  </button>
                  <button
                    type="button"
                    className={`small-btn ${queueStatusFilter === 'Approved' ? '' : 'secondary'}`}
                    style={{ padding: '4px 10px', fontSize: '12px' }}
                    onClick={() => { setQueueStatusFilter('Approved'); setQueuePage(1); }}
                  >
                    Approved ({data.letters.filter(l => l.status === 'Approved').length})
                  </button>
                  <button
                    type="button"
                    className={`small-btn ${queueStatusFilter === 'Rejected' ? '' : 'secondary'}`}
                    style={{ padding: '4px 10px', fontSize: '12px' }}
                    onClick={() => { setQueueStatusFilter('Rejected'); setQueuePage(1); }}
                  >
                    Rejected ({data.letters.filter(l => l.status === 'Rejected').length})
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="search"
                    placeholder="Search name, SAP ID, subject..."
                    value={queueSearch}
                    onChange={(e) => { setQueueSearch(e.target.value); setQueuePage(1); }}
                    style={{ fontSize: '12px', padding: '5px 10px', width: '220px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              {data.letters.length === 0 ? (
                <p className="muted">No letters in the queue yet.</p>
              ) : filteredQueueLetters.length === 0 ? (
                <p className="muted" style={{ padding: '16px 0' }}>No records match the current filter or search query.</p>
              ) : (
                <>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Date / time</th>
                          <th>Matched lecture</th>
                          <th>Validation</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedQueueLetters.map(l => {
                          const isApprovable = Boolean(l.lectureId && l.validation === 'Exact lecture/time candidate');
                          return (
                            <tr key={l.id}>
                              <td>
                                <b>{l.studentName}</b>
                                <small>SAP: {l.sapId || '—'}{l.rollNo ? ` · Roll: ${l.rollNo}` : ''}</small>
                                {l.rawStudentName && l.rawStudentName !== l.studentName && (
                                  <small className="raw-tag">Extracted: "{l.rawStudentName}"{l.sapId ? ` [SAP: ${l.sapId}]` : ''}</small>
                                )}
                                {l.documentName && <small style={{ color: '#087b70' }}>📎 {l.documentName}</small>}
                              </td>
                              <td>{l.date}<small>{l.startTime}–{l.endTime}</small></td>
                              <td>{l.matchedSubject || 'No exact match'}<small>{l.lectureId || 'Manual review required'}</small></td>
                              <td>{l.validation}</td>
                              <td><span className={`pill ${l.status === 'Pending' ? 'amber' : l.status === 'Approved' ? 'teal' : 'gray'}`}>{l.status}</span></td>
                              <td>
                                {l.status === 'Pending' ? (
                                  <div className="action-cell">
                                    <div className="actions">
                                      <button
                                        className="small-btn"
                                        disabled={!isApprovable}
                                        title={isApprovable ? 'Approve attendance correction' : 'Resolve matching issues before approval.'}
                                        onClick={() => decide(l.id, 'approve')}
                                      >
                                        Approve
                                      </button>
                                      <button className="small-btn secondary" onClick={() => decide(l.id, 'reject')}>
                                        Reject
                                      </button>
                                    </div>
                                    {!isApprovable && (
                                      <span className="action-hint">Resolve matching issues before approval.</span>
                                    )}
                                  </div>
                                ) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Bar */}
                  <div className="pagination-bar" style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                    <span>
                      Showing {filteredQueueLetters.length === 0 ? 0 : (currentQueuePage - 1) * queuePageSize + 1}–{Math.min(currentQueuePage * queuePageSize, filteredQueueLetters.length)} of {filteredQueueLetters.length} records
                      {data.letters.length !== filteredQueueLetters.length && ` (filtered from ${data.letters.length} total)`}
                    </span>
                    <div className="pagination-buttons">
                      <button
                        type="button"
                        className="small-btn secondary"
                        disabled={currentQueuePage <= 1}
                        onClick={() => setQueuePage(p => Math.max(1, p - 1))}
                      >
                        Previous
                      </button>
                      <span>
                        Page <b>{currentQueuePage}</b> of <b>{totalQueuePages}</b>
                      </span>
                      <button
                        type="button"
                        className="small-btn secondary"
                        disabled={currentQueuePage >= totalQueuePages}
                        onClick={() => setQueuePage(p => Math.min(totalQueuePages, p + 1))}
                      >
                        Next
                      </button>
                      <select
                        style={{ width: '90px', padding: '4px 6px', fontSize: '11px', marginLeft: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                        value={queuePageSize}
                        onChange={(e) => {
                          setQueuePageSize(parseInt(e.target.value, 10));
                          setQueuePage(1);
                        }}
                        title="Records per page (max 5-8 records at a time)"
                      >
                        <option value="5">5 / page</option>
                        <option value="6">6 / page</option>
                        <option value="7">7 / page</option>
                        <option value="8">8 / page</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
            </section>

            <section className="card wide">
              <div className="section-head">
                <div>
                  <p className="eyebrow">TRACEABILITY</p>
                  <h3>Recent audit log</h3>
                </div>
              </div>
              <div className="log-list">
                {data.logs.slice(0, 8).map(log => (
                  <div className="log-row" key={log.id}>
                    <span className="log-dot"></span>
                    <div>
                      <b>{log.action}</b>
                      <p>{log.details}</p>
                    </div>
                    <time>{new Date(log.at).toLocaleString()}</time>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ------------------------------------------------------------------------- */}
        {/* ROLE 3: STUDENT WORKFLOW (Handled by StudentPortalView in SS1 Layout)     */}
        {/* ------------------------------------------------------------------------- */}
        {/* Student portal is rendered via StudentPortalView in SS1 layout */}

        {/* ------------------------------------------------------------------------- */}
        {/* ROLE 4: ADMIN WORKFLOW (Roster Bulk Import & System Overview)               */}
        {/* ------------------------------------------------------------------------- */}
        {role === 'Admin' && (
          <>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #d7e4ee', paddingBottom: '12px' }}>
              <button
                type="button"
                className={`small-btn ${adminView === 'roster' ? 'proto-btn-primary' : 'secondary'}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setAdminView('roster')}
              >
                Student Roster & Import
              </button>
              <button
                type="button"
                className={`small-btn ${adminView === 'timetable' ? 'proto-btn-primary' : 'secondary'}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setAdminView('timetable')}
              >
                Master Timetable Schedule
              </button>
              <button
                type="button"
                className={`small-btn ${adminView === 'correction' ? 'proto-btn-primary' : 'secondary'}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setAdminView('correction')}
              >
                Post-Deadline Correction
              </button>
              <button
                type="button"
                className={`small-btn ${adminView === 'attendance' ? 'proto-btn-primary' : 'secondary'}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setAdminView('attendance')}
              >
                System Audit Trail & Log
              </button>
            </div>

            {adminView === 'roster' && (
              <AdminRosterSection onRosterUpdated={refresh} authToken={authToken} />
            )}

            {adminView === 'timetable' && (
              <TimetableSection />
            )}

            {adminView === 'correction' && (
              <section className="card wide">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">ADMINISTRATIVE OVERRIDE</p>
                    <h3>Post-Deadline Attendance Correction</h3>
                  </div>
                  <span className="pill amber">Authorized Admin Override</span>
                </div>

                <div className="proto-doc-ref" style={{ borderLeftColor: '#f59e0b', marginBottom: '18px' }}>
                  <p className="proto-doc-desc">
                    Official institutional administrative process: Authorized college administrators may mark or modify attendance for lectures where the teacher 24-hour correction window has expired. A valid justification/reason is <b>mandatory</b> and will be permanently recorded in the institutional audit log.
                  </p>
                </div>

                {(() => {
                  const targetLec = data.lectures.find(l => l.id === (adminCorrectionLectureId || data.lectures[0]?.id));
                  const targetRoster = data.students.filter(s => targetLec?.studentIds.includes(s.id));
                  const prior = data.attendance.filter(a => a.lectureId === targetLec?.id);
                  const winInfo = targetLec?.correctionWindow || {};

                  return (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <label style={{ margin: 0 }}>
                          Select lecture to correct:
                          <select
                            value={adminCorrectionLectureId || targetLec?.id || ''}
                            onChange={e => {
                              setAdminCorrectionLectureId(e.target.value);
                              setAdminCorrectionStatuses({});
                            }}
                          >
                            {data.lectures.map(l => (
                              <option key={l.id} value={l.id}>
                                {l.subject} · {l.date} · {l.startTime}–{l.endTime} ({l.className}) {l.correctionWindow?.isExpired ? '🔒 [Teacher Window Expired]' : '⏱ [Window Open]'}
                              </option>
                            ))}
                          </select>
                        </label>
                        {targetLec && (
                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <span className="small muted">Teacher Window: <b>{winInfo.isExpired ? '🔒 Expired' : '⏱ Open'}</b></span>
                            <span className="small muted">Deadline was: <code>{winInfo.formattedDeadline || '—'}</code></span>
                          </div>
                        )}
                      </div>

                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>
                          Mandatory Reason for Post-Deadline Correction <span style={{ color: '#ef4444' }}>*</span>
                          <input
                            type="text"
                            placeholder="e.g., Medical certificate verified by Head of Department / Technical issue during session"
                            value={adminCorrectionReason}
                            onChange={e => setAdminCorrectionReason(e.target.value)}
                            style={{ width: '100%', marginTop: '4px', padding: '8px 12px' }}
                          />
                        </label>
                        <span className="small muted">
                          This explanation will be recorded under action <code>Admin post-deadline attendance correction</code> in the system audit log.
                        </span>
                      </div>

                      <div className="roster" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                        {targetRoster.map(s => {
                          const existingRecord = prior.find(a => a.studentId === s.id);
                          const currentStatus = adminCorrectionStatuses[s.id] || existingRecord?.status || 'Present';

                          return (
                            <div className="student-row" key={s.id}>
                              <div>
                                <b>{s.name}</b>
                                <span>SAP ID: <code>{s.sapId}</code>{s.rollNo ? ` · Roll: ${s.rollNo}` : ''} · {s.branch || 'Computer Engineering'}</span>
                              </div>
                              <div className="attendance-segmented-control" role="group" aria-label={`Attendance for ${s.name}`}>
                                <button
                                  type="button"
                                  className={`segmented-btn present ${currentStatus === 'Present' ? 'selected' : ''}`}
                                  onClick={() => setAdminCorrectionStatuses(p => ({ ...p, [s.id]: 'Present' }))}
                                  aria-pressed={currentStatus === 'Present'}
                                  title="Mark Present"
                                >
                                  ✓ Present
                                </button>
                                <button
                                  type="button"
                                  className={`segmented-btn absent ${currentStatus === 'Absent' ? 'selected' : ''}`}
                                  onClick={() => setAdminCorrectionStatuses(p => ({ ...p, [s.id]: 'Absent' }))}
                                  aria-pressed={currentStatus === 'Absent'}
                                  title="Mark Absent"
                                >
                                  ✕ Absent
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (!adminCorrectionReason || !adminCorrectionReason.trim()) {
                              setMessage('Mandatory reason is required for post-deadline attendance correction.');
                              setIsError(true);
                              return;
                            }
                            submitAdminCorrection();
                          }}
                          disabled={adminCorrectionSubmitting || !targetLec}
                          className="admin-apply-correction-btn"
                        >
                          {adminCorrectionSubmitting ? 'Saving Correction...' : 'Apply Admin Post-Deadline Correction'}
                        </button>
                        <span className="small muted">
                          {targetRoster.length} students enrolled in this session
                        </span>
                      </div>
                    </>
                  );
                })()}
              </section>
            )}

            {adminView === 'attendance' && (
              <section className="card wide">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">SYSTEM TRACEABILITY</p>
                    <h3>Institutional Audit Log & System Status</h3>
                  </div>
                </div>
                <div className="log-list">
                  {data.logs.map(log => (
                    <div className="log-row" key={log.id}>
                      <span className="log-dot"></span>
                      <div>
                        <b>{log.action}</b>
                        <p>{log.details}</p>
                      </div>
                      <time>{new Date(log.at).toLocaleString()}</time>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
        </main>
        </>
      )}

      {/* Official DJSCE Institutional Footer */}
      {role !== 'Attendance Coordinator' && (
        <footer className="djsce-footer">
          <div className="djsce-footer-content">
            <p className="djsce-footer-college">
              Shri Vile Parle Kelavani Mandal's <strong>Dwarkadas J. Sanghvi College of Engineering</strong>
            </p>
            <p className="djsce-footer-meta">
              Autonomous College Affiliated to the University of Mumbai · NAAC Accredited 'A' Grade
            </p>
            <p className="djsce-footer-sub">
              AttendTrack — Official College Attendance &amp; Official Letter Processing System · Plot No.U-15, J.V.P.D. Scheme, Vile Parle (West), Mumbai 400 056.
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}