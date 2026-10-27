import React from 'react';

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

/**
 * RoleSkeletonDashboard
 *
 * Polished, role-specific skeleton preloader displayed immediately after login
 * while the authenticated dashboard data is genuinely loading from backend APIs.
 *
 * Supported Roles:
 * - 'Student'
 * - 'Teacher'
 * - 'Attendance Coordinator'
 * - 'Admin'
 */
export default function RoleSkeletonDashboard({ role = 'Teacher', user, error, onRetry, onLogout }) {
  const normRole = (role || '').toLowerCase();
  const isStudent = normRole.includes('student');
  const isTeacher = normRole.includes('teacher');
  const isCoordinator = normRole.includes('coordinator');
  const isAdmin = normRole.includes('admin');

  const userDisplayName = user?.name || user?.username || (isStudent ? 'Sneha Shah' : isTeacher ? 'Prof. Sharma' : isCoordinator ? 'Attendance Coordinator (EXTC)' : 'College Administration');
  const userInitials = (user?.name || user?.username || (isStudent ? 'SS' : isTeacher ? 'PS' : isCoordinator ? 'AC' : 'CA'))
    .split(' ')
    .filter(Boolean)
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="skeleton-portal-shell" role="status" aria-busy="true" aria-label="Loading dashboard data">
      {/* Official DJSCE Institutional Header Banner (Authentic College Branding) */}
      <header className="djsce-brand-header">
        <div className="djsce-brand-inner">
          <div className="djsce-crest-side" title="Shri Vile Parle Kelavani Mandal (SVKM)">
            <img src="/djsce_svkm_logo.png" alt="SVKM Emblem" className="djsce-svkm-img" />
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
            <img src="/djsce_crest.png" alt="DJSCE College Crest" className="djsce-crest-img" />
          </div>
        </div>
      </header>

      {/* Role-Specific Navy Navigation Top Bar (Pixel-identical to actual portals to eliminate layout and profile shift) */}
      {isCoordinator ? (
        <nav className="coord-topbar-nav" aria-label="Coordinator Navigation Header">
          <div className="coord-topbar-spacer" />

          <div className="coord-topbar-actions">
            {/* Notification Bell */}
            <div className="coord-notif-wrapper">
              <button
                type="button"
                className="coord-icon-btn coord-bell-btn"
                title="Notifications"
                aria-label="Coordinator Notifications"
              >
                <IconNotifications size={20} />
                <span className="coord-notif-badge">3</span>
              </button>
            </div>

            {/* User Profile Capsule (ss3 part matching exactly) */}
            <div className="coord-profile-wrapper">
              <div className="coord-user-capsule" style={{ cursor: 'default' }}>
                <span className="coord-avatar-circle">AC</span>
                <span className="coord-user-label">Attendance Coordinator (EXTC)</span>
                <span className="coord-chevron-down">⌵</span>
              </div>
            </div>

            {/* Logout Action Button */}
            {onLogout && (
              <button
                type="button"
                className="coord-topbar-logout-btn"
                onClick={onLogout}
                title="Sign out of AttendTrack"
              >
                <IconLogout size={16} />
                <span>Logout</span>
              </button>
            )}
          </div>
        </nav>
      ) : isTeacher ? (
        <nav className="teacher-topbar-nav" aria-label="Teacher Portal Header">
          <div className="teacher-topbar-brand">
            <span className="teacher-brand-title">AttendTrack</span>
          </div>

          <div className="teacher-topbar-actions">
            <button type="button" className="teacher-notification-btn" title="Notifications">
              <IconNotifications size={20} />
              <span className="teacher-notif-badge">3</span>
            </button>

            <div className="teacher-profile-wrapper">
              <div className="teacher-user-profile-btn" style={{ cursor: 'default' }}>
                <div className="teacher-avatar-circle">{userInitials || 'PS'}</div>
                <div className="teacher-user-info-text">
                  <span className="teacher-user-fullname">{userDisplayName}</span>
                  <span className="teacher-user-dept">{user?.department || 'EXTC Department'}</span>
                </div>
                <span className="teacher-user-chevron">▼</span>
              </div>
            </div>

            {onLogout && (
              <button
                type="button"
                className="coord-topbar-logout-btn"
                onClick={onLogout}
                title="Sign out of AttendTrack"
                style={{ marginLeft: '12px' }}
              >
                <IconLogout size={16} />
                <span>Logout</span>
              </button>
            )}
          </div>
        </nav>
      ) : isStudent ? (
        <nav className="student-topbar-nav">
          <div className="student-topbar-brand" aria-hidden="true" />

          <div className="student-topbar-actions">
            <button type="button" className="student-notification-btn" title="Notifications">
              <IconNotifications size={20} />
              <span className="student-notif-badge">3</span>
            </button>

            <div style={{ position: 'relative' }}>
              <div className="student-user-profile-btn" style={{ cursor: 'default' }}>
                <div className="student-avatar-am">{userInitials || 'SS'}</div>
                <div className="student-user-info-text">
                  <span className="student-user-fullname">{userDisplayName}</span>
                  <span className="student-user-branch-sem">{user?.branch ? `${user.branch} — Year 3 / A` : 'EXTC — Year 3 / A'}</span>
                </div>
                <span className="student-user-chevron">▼</span>
              </div>
            </div>

            {onLogout && (
              <button
                type="button"
                className="coord-topbar-logout-btn"
                onClick={onLogout}
                title="Sign out of AttendTrack"
                style={{ marginLeft: '12px' }}
              >
                <IconLogout size={16} />
                <span>Logout</span>
              </button>
            )}
          </div>
        </nav>
      ) : (
        <nav className="admin-topbar-nav" aria-label="Admin Navigation Header">
          <div className="admin-topbar-brand-spacer" />

          <div className="admin-topbar-actions">
            <div className="admin-notif-wrapper">
              <button type="button" className="admin-notif-btn" title="Notifications">
                <IconNotifications size={20} />
                <span className="admin-notif-badge">3</span>
              </button>
            </div>

            <div className="admin-profile-wrapper">
              <div className="admin-user-btn" style={{ cursor: 'default' }}>
                <div className="admin-avatar-circle">CA</div>
                <div className="admin-user-info-text">
                  <span className="admin-user-fullname">{userDisplayName}</span>
                  <span className="admin-user-role">Admin</span>
                </div>
                <span className="admin-user-chevron">▼</span>
              </div>
            </div>

            {onLogout && (
              <button
                type="button"
                className="coord-topbar-logout-btn"
                onClick={onLogout}
                title="Sign out of AttendTrack"
                style={{ marginLeft: '12px' }}
              >
                <IconLogout size={16} />
                <span>Logout</span>
              </button>
            )}
          </div>
        </nav>
      )}

      {/* Error / Offline Alert Banner with Retry Option */}
      {error && (
        <div className="skeleton-error-banner" role="alert">
          <div className="skeleton-error-content">
            <span className="skeleton-error-icon">⚠️</span>
            <div className="skeleton-error-text">
              <strong>Unable to load dashboard data:</strong> {error}
            </div>
          </div>
          {onRetry && (
            <button type="button" className="skeleton-retry-btn" onClick={onRetry}>
              Retry Loading
            </button>
          )}
        </div>
      )}

      {/* Role-Specific Dashboard Skeleton Body */}
      {isStudent && <StudentSkeletonLayout />}
      {isTeacher && <TeacherSkeletonLayout />}
      {isCoordinator && <CoordinatorSkeletonLayout />}
      {isAdmin && <AdminSkeletonLayout />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. STUDENT SKELETON LAYOUT
// ---------------------------------------------------------------------------
function StudentSkeletonLayout() {
  return (
    <div className="skeleton-layout-container">
      {/* Student Sidebar (6 nav items) */}
      <aside className="skeleton-sidebar student-side" aria-hidden="true">
        <div className="skeleton-nav-item active">
          <span className="skeleton-circle" style={{ width: '18px', height: '18px' }} />
          <span className="skeleton-text" style={{ width: '90px', height: '14px' }} />
        </div>
        <div className="skeleton-nav-item">
          <span className="skeleton-circle" style={{ width: '18px', height: '18px' }} />
          <span className="skeleton-text" style={{ width: '110px', height: '14px' }} />
        </div>
        <div className="skeleton-nav-item">
          <span className="skeleton-circle" style={{ width: '18px', height: '18px' }} />
          <span className="skeleton-text" style={{ width: '80px', height: '14px' }} />
        </div>
        <div className="skeleton-nav-item">
          <span className="skeleton-circle" style={{ width: '18px', height: '18px' }} />
          <span className="skeleton-text" style={{ width: '115px', height: '14px' }} />
        </div>
        <div className="skeleton-nav-item">
          <span className="skeleton-circle" style={{ width: '18px', height: '18px' }} />
          <span className="skeleton-text" style={{ width: '95px', height: '14px' }} />
        </div>
        <div className="skeleton-sidebar-spacer" />
        <div className="skeleton-nav-item logout">
          <span className="skeleton-circle" style={{ width: '18px', height: '18px' }} />
          <span className="skeleton-text" style={{ width: '70px', height: '14px' }} />
        </div>
      </aside>

      {/* Main Student Workspace */}
      <main className="skeleton-main-content">
        {/* Welcome Greeting & Student Profile Info Card */}
        <div className="skeleton-card student-greeting-skeleton">
          <div className="skeleton-text" style={{ width: '130px', height: '12px', marginBottom: '8px' }} />
          <div className="skeleton-text" style={{ width: '280px', height: '24px', marginBottom: '10px' }} />
          <div className="skeleton-text" style={{ width: '360px', height: '14px', marginBottom: '16px' }} />

          <div className="skeleton-student-badges-row">
            <span className="skeleton-pill" style={{ width: '130px', height: '26px' }} />
            <span className="skeleton-pill" style={{ width: '110px', height: '26px' }} />
            <span className="skeleton-pill" style={{ width: '90px', height: '26px' }} />
            <span className="skeleton-pill" style={{ width: '140px', height: '26px' }} />
          </div>
        </div>

        {/* 4 Attendance & Progress Summary Cards */}
        <div className="skeleton-cards-grid four-col">
          <div className="skeleton-card stat-card">
            <div className="skeleton-circle" style={{ width: '42px', height: '42px', marginBottom: '12px' }} />
            <div className="skeleton-text" style={{ width: '60px', height: '28px', marginBottom: '6px' }} />
            <div className="skeleton-text" style={{ width: '120px', height: '13px' }} />
          </div>
          <div className="skeleton-card stat-card">
            <div className="skeleton-circle" style={{ width: '42px', height: '42px', marginBottom: '12px' }} />
            <div className="skeleton-text" style={{ width: '50px', height: '28px', marginBottom: '6px' }} />
            <div className="skeleton-text" style={{ width: '110px', height: '13px' }} />
          </div>
          <div className="skeleton-card stat-card">
            <div className="skeleton-circle" style={{ width: '42px', height: '42px', marginBottom: '12px' }} />
            <div className="skeleton-text" style={{ width: '45px', height: '28px', marginBottom: '6px' }} />
            <div className="skeleton-text" style={{ width: '100px', height: '13px' }} />
          </div>
          <div className="skeleton-card stat-card">
            <div className="skeleton-circle" style={{ width: '42px', height: '42px', marginBottom: '12px' }} />
            <div className="skeleton-text" style={{ width: '55px', height: '28px', marginBottom: '6px' }} />
            <div className="skeleton-text" style={{ width: '130px', height: '13px' }} />
          </div>
        </div>

        {/* Two Column Grid: Subject Attendance on Left, Timetable & Letters on Right */}
        <div className="skeleton-two-col-grid">
          {/* Left: Subject-wise Attendance Cards */}
          <div className="skeleton-card">
            <div className="skeleton-card-header">
              <div className="skeleton-text" style={{ width: '180px', height: '18px' }} />
              <div className="skeleton-pill" style={{ width: '80px', height: '22px' }} />
            </div>
            <div className="skeleton-subject-list">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="skeleton-subject-row">
                  <div className="skeleton-subject-info">
                    <div className="skeleton-text" style={{ width: '180px', height: '15px', marginBottom: '6px' }} />
                    <div className="skeleton-text" style={{ width: '120px', height: '12px' }} />
                  </div>
                  <div className="skeleton-progress-wrap">
                    <div className="skeleton-box" style={{ width: '140px', height: '8px', borderRadius: '4px' }} />
                    <div className="skeleton-text" style={{ width: '40px', height: '14px', marginLeft: '12px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Timetable Preview & Letter Status */}
          <div className="skeleton-right-stack">
            <div className="skeleton-card">
              <div className="skeleton-card-header">
                <div className="skeleton-text" style={{ width: '150px', height: '18px' }} />
                <div className="skeleton-pill" style={{ width: '90px', height: '20px' }} />
              </div>
              <div className="skeleton-timetable-preview">
                {[1, 2, 3].map(i => (
                  <div key={i} className="skeleton-timetable-slot">
                    <div className="skeleton-text" style={{ width: '70px', height: '13px' }} />
                    <div className="skeleton-text" style={{ width: '160px', height: '15px' }} />
                    <div className="skeleton-pill" style={{ width: '60px', height: '20px' }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="skeleton-card">
              <div className="skeleton-card-header">
                <div className="skeleton-text" style={{ width: '170px', height: '18px' }} />
                <div className="skeleton-pill" style={{ width: '70px', height: '20px' }} />
              </div>
              <div className="skeleton-notif-preview">
                {[1, 2].map(i => (
                  <div key={i} className="skeleton-notif-row">
                    <div className="skeleton-circle" style={{ width: '32px', height: '32px', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div className="skeleton-text" style={{ width: '80%', height: '14px', marginBottom: '6px' }} />
                      <div className="skeleton-text" style={{ width: '50%', height: '12px' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. TEACHER SKELETON LAYOUT
// ---------------------------------------------------------------------------
function TeacherSkeletonLayout() {
  return (
    <div className="skeleton-layout-container">
      {/* Teacher Sidebar */}
      <aside className="skeleton-sidebar teacher-side" aria-hidden="true">
        <div className="skeleton-nav-item">
          <span className="skeleton-circle" style={{ width: '18px', height: '18px' }} />
          <span className="skeleton-text" style={{ width: '90px', height: '14px' }} />
        </div>
        <div className="skeleton-nav-item active">
          <span className="skeleton-circle" style={{ width: '18px', height: '18px' }} />
          <span className="skeleton-text" style={{ width: '120px', height: '14px' }} />
        </div>
        <div className="skeleton-nav-item">
          <span className="skeleton-circle" style={{ width: '18px', height: '18px' }} />
          <span className="skeleton-text" style={{ width: '100px', height: '14px' }} />
        </div>
        <div className="skeleton-nav-item">
          <span className="skeleton-circle" style={{ width: '18px', height: '18px' }} />
          <span className="skeleton-text" style={{ width: '110px', height: '14px' }} />
        </div>
        <div className="skeleton-nav-item">
          <span className="skeleton-circle" style={{ width: '18px', height: '18px' }} />
          <span className="skeleton-text" style={{ width: '95px', height: '14px' }} />
        </div>
        <div className="skeleton-sidebar-spacer" />
        <div className="skeleton-nav-item logout">
          <span className="skeleton-circle" style={{ width: '18px', height: '18px' }} />
          <span className="skeleton-text" style={{ width: '70px', height: '14px' }} />
        </div>
      </aside>

      {/* Main Teacher Workspace */}
      <main className="skeleton-main-content">
        {/* Workspace Title & Date Badge */}
        <div className="skeleton-header-row">
          <div>
            <div className="skeleton-text" style={{ width: '220px', height: '26px', marginBottom: '6px' }} />
            <div className="skeleton-text" style={{ width: '320px', height: '14px' }} />
          </div>
          <div className="skeleton-pill" style={{ width: '180px', height: '36px' }} />
        </div>

        {/* 3 Metric Cards */}
        <div className="skeleton-cards-grid three-col">
          <div className="skeleton-card stat-card">
            <div className="skeleton-circle" style={{ width: '40px', height: '40px', marginBottom: '10px' }} />
            <div className="skeleton-text" style={{ width: '40px', height: '26px', marginBottom: '6px' }} />
            <div className="skeleton-text" style={{ width: '140px', height: '13px' }} />
          </div>
          <div className="skeleton-card stat-card">
            <div className="skeleton-circle" style={{ width: '40px', height: '40px', marginBottom: '10px' }} />
            <div className="skeleton-text" style={{ width: '50px', height: '26px', marginBottom: '6px' }} />
            <div className="skeleton-text" style={{ width: '160px', height: '13px' }} />
          </div>
          <div className="skeleton-card stat-card">
            <div className="skeleton-circle" style={{ width: '40px', height: '40px', marginBottom: '10px' }} />
            <div className="skeleton-text" style={{ width: '40px', height: '26px', marginBottom: '6px' }} />
            <div className="skeleton-text" style={{ width: '150px', height: '13px' }} />
          </div>
        </div>

        {/* Two Column Layout: Take Attendance Card on Left, Today Schedule on Right */}
        <div className="skeleton-two-col-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 320px' }}>
          {/* Active Lecture & Attendance Roster */}
          <div className="skeleton-card">
            <div className="skeleton-card-header">
              <div>
                <div className="skeleton-text" style={{ width: '200px', height: '20px', marginBottom: '6px' }} />
                <div className="skeleton-text" style={{ width: '280px', height: '13px' }} />
              </div>
              <div className="skeleton-pill" style={{ width: '110px', height: '28px' }} />
            </div>

            {/* Quick Filter Pill Buttons */}
            <div className="skeleton-filter-pills-row">
              <span className="skeleton-pill" style={{ width: '100px', height: '30px' }} />
              <span className="skeleton-pill" style={{ width: '110px', height: '30px' }} />
              <span className="skeleton-pill" style={{ width: '120px', height: '30px' }} />
            </div>

            {/* Student Roster Table Skeleton */}
            <div className="skeleton-table-wrap">
              <div className="skeleton-table-header-row">
                <div className="skeleton-text" style={{ width: '40px', height: '14px' }} />
                <div className="skeleton-text" style={{ width: '140px', height: '14px' }} />
                <div className="skeleton-text" style={{ width: '110px', height: '14px' }} />
                <div className="skeleton-text" style={{ width: '150px', height: '14px', marginLeft: 'auto' }} />
              </div>

              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="skeleton-table-data-row">
                  <div className="skeleton-text" style={{ width: '30px', height: '14px' }} />
                  <div>
                    <div className="skeleton-text" style={{ width: '130px', height: '14px', marginBottom: '4px' }} />
                    <div className="skeleton-text" style={{ width: '80px', height: '11px' }} />
                  </div>
                  <div className="skeleton-text" style={{ width: '100px', height: '13px' }} />
                  <div className="skeleton-status-pill-group" style={{ marginLeft: 'auto' }}>
                    <span className="skeleton-pill" style={{ width: '55px', height: '24px' }} />
                    <span className="skeleton-pill" style={{ width: '55px', height: '24px' }} />
                    <span className="skeleton-pill" style={{ width: '50px', height: '24px' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons Footer */}
            <div className="skeleton-action-bar">
              <div className="skeleton-btn" style={{ width: '140px', height: '36px' }} />
              <div className="skeleton-btn" style={{ width: '100px', height: '36px', marginLeft: '12px' }} />
            </div>
          </div>

          {/* Right Schedule Stack */}
          <div className="skeleton-right-stack">
            <div className="skeleton-card">
              <div className="skeleton-card-header">
                <div className="skeleton-text" style={{ width: '160px', height: '18px' }} />
              </div>
              <div className="skeleton-schedule-items">
                {[1, 2, 3].map(i => (
                  <div key={i} className="skeleton-schedule-slot">
                    <div className="skeleton-text" style={{ width: '90px', height: '13px', marginBottom: '6px' }} />
                    <div className="skeleton-text" style={{ width: '180px', height: '15px', marginBottom: '4px' }} />
                    <div className="skeleton-text" style={{ width: '120px', height: '12px' }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. COORDINATOR SKELETON LAYOUT
// ---------------------------------------------------------------------------
function CoordinatorSkeletonLayout() {
  return (
    <div className="skeleton-layout-container">
      {/* Coordinator Sidebar (7 items) */}
      <aside className="skeleton-sidebar coord-side" aria-hidden="true">
        <div className="skeleton-nav-item active">
          <span className="skeleton-circle" style={{ width: '18px', height: '18px' }} />
          <span className="skeleton-text" style={{ width: '90px', height: '14px' }} />
        </div>
        <div className="skeleton-nav-item">
          <span className="skeleton-circle" style={{ width: '18px', height: '18px' }} />
          <span className="skeleton-text" style={{ width: '120px', height: '14px' }} />
        </div>
        <div className="skeleton-nav-item">
          <span className="skeleton-circle" style={{ width: '18px', height: '18px' }} />
          <span className="skeleton-text" style={{ width: '125px', height: '14px' }} />
        </div>
        <div className="skeleton-nav-item">
          <span className="skeleton-circle" style={{ width: '18px', height: '18px' }} />
          <span className="skeleton-text" style={{ width: '75px', height: '14px' }} />
        </div>
        <div className="skeleton-nav-item">
          <span className="skeleton-circle" style={{ width: '18px', height: '18px' }} />
          <span className="skeleton-text" style={{ width: '85px', height: '14px' }} />
        </div>
        <div className="skeleton-nav-item">
          <span className="skeleton-circle" style={{ width: '18px', height: '18px' }} />
          <span className="skeleton-text" style={{ width: '95px', height: '14px' }} />
        </div>
        <div className="skeleton-sidebar-spacer" />
        <div className="skeleton-nav-item logout">
          <span className="skeleton-circle" style={{ width: '18px', height: '18px' }} />
          <span className="skeleton-text" style={{ width: '70px', height: '14px' }} />
        </div>
      </aside>

      {/* Main Coordinator Content */}
      <main className="skeleton-main-content">
        {/* Header */}
        <div className="skeleton-header-row">
          <div>
            <div className="skeleton-text" style={{ width: '270px', height: '26px', marginBottom: '6px' }} />
            <div className="skeleton-text" style={{ width: '380px', height: '14px' }} />
          </div>
          <div className="skeleton-pill" style={{ width: '190px', height: '36px' }} />
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="skeleton-cards-grid four-col">
          <div className="skeleton-card stat-card">
            <div className="skeleton-circle" style={{ width: '40px', height: '40px', marginBottom: '10px' }} />
            <div className="skeleton-text" style={{ width: '45px', height: '26px', marginBottom: '6px' }} />
            <div className="skeleton-text" style={{ width: '110px', height: '13px' }} />
          </div>
          <div className="skeleton-card stat-card">
            <div className="skeleton-circle" style={{ width: '40px', height: '40px', marginBottom: '10px' }} />
            <div className="skeleton-text" style={{ width: '45px', height: '26px', marginBottom: '6px' }} />
            <div className="skeleton-text" style={{ width: '115px', height: '13px' }} />
          </div>
          <div className="skeleton-card stat-card">
            <div className="skeleton-circle" style={{ width: '40px', height: '40px', marginBottom: '10px' }} />
            <div className="skeleton-text" style={{ width: '45px', height: '26px', marginBottom: '6px' }} />
            <div className="skeleton-text" style={{ width: '120px', height: '13px' }} />
          </div>
          <div className="skeleton-card stat-card">
            <div className="skeleton-circle" style={{ width: '40px', height: '40px', marginBottom: '10px' }} />
            <div className="skeleton-text" style={{ width: '45px', height: '26px', marginBottom: '6px' }} />
            <div className="skeleton-text" style={{ width: '100px', height: '13px' }} />
          </div>
        </div>

        {/* Workflow Navigation Tabs */}
        <div className="skeleton-workflow-tabs-row">
          <div className="skeleton-pill active" style={{ width: '180px', height: '38px' }} />
          <div className="skeleton-pill" style={{ width: '210px', height: '38px' }} />
          <div className="skeleton-pill" style={{ width: '140px', height: '38px' }} />
        </div>

        {/* Two-Column Grid: Left Intake & Queue, Right Quick Actions & Activity */}
        <div className="skeleton-two-col-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 280px' }}>
          <div className="skeleton-left-stack">
            {/* Document Intake Box */}
            <div className="skeleton-card">
              <div className="skeleton-card-header">
                <div className="skeleton-text" style={{ width: '220px', height: '18px' }} />
                <div className="skeleton-pill" style={{ width: '130px', height: '22px' }} />
              </div>
              <div className="skeleton-box" style={{ width: '100%', height: '80px', borderRadius: '8px', marginBottom: '12px' }} />
              <div className="skeleton-text" style={{ width: '280px', height: '12px' }} />
            </div>

            {/* Attendance Queue & Records Table */}
            <div className="skeleton-card">
              <div className="skeleton-card-header">
                <div className="skeleton-text" style={{ width: '210px', height: '18px' }} />
              </div>

              {/* Filter Pills and Search Row */}
              <div className="skeleton-queue-filter-row">
                <div className="skeleton-pills-wrap">
                  <span className="skeleton-pill" style={{ width: '60px', height: '28px' }} />
                  <span className="skeleton-pill" style={{ width: '85px', height: '28px' }} />
                  <span className="skeleton-pill" style={{ width: '90px', height: '28px' }} />
                  <span className="skeleton-pill" style={{ width: '85px', height: '28px' }} />
                </div>
                <div className="skeleton-box" style={{ width: '200px', height: '30px', borderRadius: '6px' }} />
              </div>

              {/* Queue Table Rows */}
              <div className="skeleton-table-wrap">
                <div className="skeleton-table-header-row">
                  <div className="skeleton-text" style={{ width: '30px', height: '13px' }} />
                  <div className="skeleton-text" style={{ width: '110px', height: '13px' }} />
                  <div className="skeleton-text" style={{ width: '100px', height: '13px' }} />
                  <div className="skeleton-text" style={{ width: '110px', height: '13px' }} />
                  <div className="skeleton-text" style={{ width: '120px', height: '13px' }} />
                  <div className="skeleton-text" style={{ width: '70px', height: '13px' }} />
                  <div className="skeleton-text" style={{ width: '110px', height: '13px', marginLeft: 'auto' }} />
                </div>

                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="skeleton-table-data-row">
                    <div className="skeleton-text" style={{ width: '20px', height: '13px' }} />
                    <div>
                      <div className="skeleton-text" style={{ width: '110px', height: '14px', marginBottom: '3px' }} />
                      <div className="skeleton-text" style={{ width: '70px', height: '11px' }} />
                    </div>
                    <div>
                      <div className="skeleton-text" style={{ width: '80px', height: '13px', marginBottom: '3px' }} />
                      <div className="skeleton-text" style={{ width: '70px', height: '11px' }} />
                    </div>
                    <div className="skeleton-text" style={{ width: '110px', height: '13px' }} />
                    <div className="skeleton-text" style={{ width: '120px', height: '13px' }} />
                    <div className="skeleton-pill" style={{ width: '65px', height: '22px' }} />
                    <div className="skeleton-action-pair" style={{ marginLeft: 'auto' }}>
                      <span className="skeleton-pill" style={{ width: '55px', height: '26px' }} />
                      <span className="skeleton-pill" style={{ width: '50px', height: '26px' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Quick Actions & Recent Activity */}
          <div className="skeleton-right-stack">
            <div className="skeleton-card">
              <div className="skeleton-card-header">
                <div className="skeleton-text" style={{ width: '120px', height: '16px' }} />
              </div>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="skeleton-action-row">
                  <div className="skeleton-circle" style={{ width: '28px', height: '28px' }} />
                  <div className="skeleton-text" style={{ width: '130px', height: '13px' }} />
                </div>
              ))}
            </div>

            <div className="skeleton-card">
              <div className="skeleton-card-header">
                <div className="skeleton-text" style={{ width: '120px', height: '16px' }} />
              </div>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="skeleton-activity-item">
                  <div className="skeleton-circle" style={{ width: '28px', height: '28px', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton-text" style={{ width: '80%', height: '13px', marginBottom: '4px' }} />
                    <div className="skeleton-text" style={{ width: '40%', height: '11px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. ADMIN SKELETON LAYOUT
// ---------------------------------------------------------------------------
function AdminSkeletonLayout() {
  return (
    <div className="skeleton-layout-container">
      {/* Admin Sidebar */}
      <aside className="skeleton-sidebar admin-side" aria-hidden="true">
        <div className="skeleton-nav-item active">
          <span className="skeleton-circle" style={{ width: '18px', height: '18px' }} />
          <span className="skeleton-text" style={{ width: '100px', height: '14px' }} />
        </div>
        <div className="skeleton-nav-item">
          <span className="skeleton-circle" style={{ width: '18px', height: '18px' }} />
          <span className="skeleton-text" style={{ width: '135px', height: '14px' }} />
        </div>
        <div className="skeleton-nav-item">
          <span className="skeleton-circle" style={{ width: '18px', height: '18px' }} />
          <span className="skeleton-text" style={{ width: '130px', height: '14px' }} />
        </div>
        <div className="skeleton-nav-item">
          <span className="skeleton-circle" style={{ width: '18px', height: '18px' }} />
          <span className="skeleton-text" style={{ width: '85px', height: '14px' }} />
        </div>
        <div className="skeleton-nav-item">
          <span className="skeleton-circle" style={{ width: '18px', height: '18px' }} />
          <span className="skeleton-text" style={{ width: '95px', height: '14px' }} />
        </div>
        <div className="skeleton-sidebar-spacer" />
        <div className="skeleton-nav-item logout">
          <span className="skeleton-circle" style={{ width: '18px', height: '18px' }} />
          <span className="skeleton-text" style={{ width: '70px', height: '14px' }} />
        </div>
      </aside>

      {/* Main Admin Content */}
      <main className="skeleton-main-content">
        {/* Top Quick Actions Panel */}
        <div className="skeleton-card" style={{ marginBottom: '18px' }}>
          <div className="skeleton-card-header">
            <div className="skeleton-text" style={{ width: '160px', height: '16px' }} />
          </div>
          <div className="skeleton-action-chips-row">
            <span className="skeleton-pill" style={{ width: '140px', height: '34px' }} />
            <span className="skeleton-pill" style={{ width: '160px', height: '34px' }} />
            <span className="skeleton-pill" style={{ width: '180px', height: '34px' }} />
            <span className="skeleton-pill" style={{ width: '140px', height: '34px' }} />
          </div>
        </div>

        {/* Admin Header */}
        <div className="skeleton-header-row">
          <div>
            <div className="skeleton-text" style={{ width: '260px', height: '26px', marginBottom: '6px' }} />
            <div className="skeleton-text" style={{ width: '380px', height: '14px' }} />
          </div>
          <div className="skeleton-pill" style={{ width: '180px', height: '36px' }} />
        </div>

        {/* 4 Metric Cards */}
        <div className="skeleton-cards-grid four-col">
          <div className="skeleton-card stat-card">
            <div className="skeleton-circle" style={{ width: '40px', height: '40px', marginBottom: '10px' }} />
            <div className="skeleton-text" style={{ width: '50px', height: '26px', marginBottom: '6px' }} />
            <div className="skeleton-text" style={{ width: '130px', height: '13px' }} />
          </div>
          <div className="skeleton-card stat-card">
            <div className="skeleton-circle" style={{ width: '40px', height: '40px', marginBottom: '10px' }} />
            <div className="skeleton-text" style={{ width: '50px', height: '26px', marginBottom: '6px' }} />
            <div className="skeleton-text" style={{ width: '140px', height: '13px' }} />
          </div>
          <div className="skeleton-card stat-card">
            <div className="skeleton-circle" style={{ width: '40px', height: '40px', marginBottom: '10px' }} />
            <div className="skeleton-text" style={{ width: '50px', height: '26px', marginBottom: '6px' }} />
            <div className="skeleton-text" style={{ width: '130px', height: '13px' }} />
          </div>
          <div className="skeleton-card stat-card">
            <div className="skeleton-circle" style={{ width: '40px', height: '40px', marginBottom: '10px' }} />
            <div className="skeleton-text" style={{ width: '50px', height: '26px', marginBottom: '6px' }} />
            <div className="skeleton-text" style={{ width: '120px', height: '13px' }} />
          </div>
        </div>

        {/* Student Roster Table Card */}
        <div className="skeleton-card">
          <div className="skeleton-card-header">
            <div>
              <div className="skeleton-text" style={{ width: '220px', height: '18px', marginBottom: '6px' }} />
              <div className="skeleton-text" style={{ width: '320px', height: '13px' }} />
            </div>
            <div className="skeleton-action-pair">
              <span className="skeleton-pill" style={{ width: '120px', height: '32px' }} />
              <span className="skeleton-pill" style={{ width: '110px', height: '32px' }} />
            </div>
          </div>

          <div className="skeleton-table-wrap">
            <div className="skeleton-table-header-row">
              <div className="skeleton-text" style={{ width: '100px', height: '14px' }} />
              <div className="skeleton-text" style={{ width: '150px', height: '14px' }} />
              <div className="skeleton-text" style={{ width: '80px', height: '14px' }} />
              <div className="skeleton-text" style={{ width: '120px', height: '14px' }} />
              <div className="skeleton-text" style={{ width: '90px', height: '14px' }} />
              <div className="skeleton-text" style={{ width: '80px', height: '14px', marginLeft: 'auto' }} />
            </div>

            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="skeleton-table-data-row">
                <div className="skeleton-text" style={{ width: '90px', height: '14px' }} />
                <div className="skeleton-text" style={{ width: '140px', height: '14px' }} />
                <div className="skeleton-text" style={{ width: '70px', height: '14px' }} />
                <div className="skeleton-text" style={{ width: '110px', height: '14px' }} />
                <div className="skeleton-pill" style={{ width: '70px', height: '22px' }} />
                <div className="skeleton-pill" style={{ width: '60px', height: '26px', marginLeft: 'auto' }} />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
