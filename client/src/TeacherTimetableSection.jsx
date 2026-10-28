import { useState, useEffect, useMemo } from 'react';

const API = import.meta.env.VITE_API_BASE_URL || '/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TIME_SLOTS = [
  { slotNumber: 1, time: '08:00 – 09:00', start: '08:00', end: '09:00' },
  { slotNumber: 2, time: '09:00 – 10:00', start: '09:00', end: '10:00' },
  { slotNumber: 3, time: '10:00 – 11:00', start: '10:00', end: '11:00' },
  { slotNumber: 4, time: '11:00 – 12:00', start: '11:00', end: '12:00' },
  { slotNumber: 5, time: '12:00 – 13:00', start: '12:00', end: '13:00' },
  { isLunch: true, slotNumber: null, time: '13:00 – 14:00', label: 'Institutional Lunch Break' },
  { slotNumber: 6, time: '14:00 – 15:00', start: '14:00', end: '15:00' },
  { slotNumber: 7, time: '15:00 – 16:00', start: '15:00', end: '16:00' },
  { slotNumber: 8, time: '16:00 – 17:00', start: '16:00', end: '17:00' },
  { slotNumber: 9, time: '17:00 – 18:00', start: '17:00', end: '18:00' }
];

function getSubjectBadge(subject = '', className = '') {
  const s = subject.toLowerCase();
  const c = className.toLowerCase();
  
  let type = 'Theory';
  let isLab = false;
  if (s.includes('lab') || s.includes('practical') || s.includes('workshop')) {
    type = 'Lab / Practical';
    isLab = true;
  } else if (s.includes('tutorial') || s.includes('tut')) {
    type = 'Tutorial';
  } else {
    type = 'Theory';
  }

  // Class group color coding to easily distinguish multiple class cohorts
  let classBg = '#EFF6FF';
  let classBorder = '#3B82F6';
  let classText = '#1D4ED8';
  let classPillBg = '#DBEAFE';

  if (c.includes('extc')) {
    classBg = '#EEF2FF';
    classBorder = '#4F46E5';
    classText = '#4338CA';
    classPillBg = '#E0E7FF';
  } else if (c.includes('ce') || c.includes('computer')) {
    classBg = '#ECFDF5';
    classBorder = '#10B981';
    classText = '#047857';
    classPillBg = '#D1FAE5';
  } else if (c.includes('it')) {
    classBg = '#F0FDF4';
    classBorder = '#16A34A';
    classText = '#15803D';
    classPillBg = '#DCFCE7';
  } else if (c.includes('mech')) {
    classBg = '#FFFBEB';
    classBorder = '#D97706';
    classText = '#B45309';
    classPillBg = '#FEF3C7';
  }

  return {
    type,
    isLab,
    classBg,
    classBorder,
    classText,
    classPillBg
  };
}

export default function TeacherTimetableSection({ authToken = '', currentUser = null }) {
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'table'
  const [slots, setSlots] = useState([]);
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState('All');
  const [weekOffset, setWeekOffset] = useState(0);
  const [error, setError] = useState('');

  // Calculate Monday date for current weekOffset
  const mondayDate = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const m = new Date(now);
    m.setDate(now.getDate() + distanceToMonday + (weekOffset * 7));
    return m;
  }, [weekOffset]);

  const startDateStr = useMemo(() => {
    return mondayDate.toISOString().split('T')[0];
  }, [mondayDate]);

  // Weekday dates for headings: Mon-Sat
  const weekDates = useMemo(() => {
    const dates = [];
    for (let i = 0; i < 6; i++) {
      const dayDate = new Date(mondayDate);
      dayDate.setDate(mondayDate.getDate() + i);
      dates.push({
        dayName: DAYS[i],
        formattedDate: dayDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        isoDate: dayDate.toISOString().split('T')[0]
      });
    }

    const startDateLabel = dates[0].formattedDate;
    const endDateLabel = dates[5].formattedDate;
    const yearStr = mondayDate.getFullYear();

    return {
      days: dates,
      rangeLabel: `${startDateLabel} – ${endDateLabel} ${yearStr}`
    };
  }, [mondayDate]);

  async function fetchProfessorTimetable() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (startDateStr) params.append('startDate', startDateStr);

      const token = authToken || localStorage.getItem('token') || localStorage.getItem('authToken') || '';
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        headers['x-user-role'] = 'TEACHER';
      }

      const res = await fetch(`${API}/teacher/timetable?${params.toString()}`, {
        headers
      });
      const contentType = res.headers.get('content-type') || '';
      let data = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text.length < 200 ? text : `Server returned non-JSON response (HTTP ${res.status})`);
      }

      if (res.ok && data.slots) {
        setSlots(data.slots);
        if (data.teacher) setTeacherInfo(data.teacher);
      } else {
        setError(data.error || 'Failed to load professor timetable');
      }
    } catch (err) {
      setError(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProfessorTimetable();
  }, [startDateStr, authToken]);

  // Group slots by `${dayOfWeek}_${slotNumber}` to gracefully handle overlaps
  const slotMap = useMemo(() => {
    const map = new Map();
    slots.forEach(slot => {
      if (slot.dayOfWeek && slot.slotNumber) {
        const key = `${slot.dayOfWeek}_${slot.slotNumber}`;
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key).push(slot);
      }
    });
    return map;
  }, [slots]);

  // Distinct class groups taught by this professor
  const distinctClasses = useMemo(() => {
    const set = new Set();
    slots.forEach(s => {
      if (s.className) set.add(s.className);
    });
    return Array.from(set);
  }, [slots]);

  // Filtered slots for table view
  const tableSlots = useMemo(() => {
    let list = [...slots];
    if (selectedDay !== 'All') {
      list = list.filter(s => s.dayOfWeek === selectedDay);
    }
    // Sort by day index, then slotNumber
    list.sort((a, b) => {
      const dayA = DAYS.indexOf(a.dayOfWeek);
      const dayB = DAYS.indexOf(b.dayOfWeek);
      if (dayA !== dayB) return dayA - dayB;
      return (a.slotNumber || 0) - (b.slotNumber || 0);
    });
    return list;
  }, [slots, selectedDay]);

  return (
    <div className="teacher-timetable-container" id="professor-timetable-wrapper">
      {/* Top Banner / Toolbar */}
      <div className="timetable-toolbar">
        {/* View Mode Toggle: Calendar View / Table View */}
        <div className="timetable-view-toggle" role="tablist" aria-label="Professor Timetable View Mode">
          <button
            type="button"
            className={`timetable-toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`}
            onClick={() => setViewMode('calendar')}
            role="tab"
            aria-selected={viewMode === 'calendar'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
              <line x1="16" x2="16" y1="2" y2="6"/>
              <line x1="8" x2="8" y1="2" y2="6"/>
              <line x1="3" x2="21" y1="10" y2="10"/>
            </svg>
            <span>Calendar View</span>
          </button>
          <button
            type="button"
            className={`timetable-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => setViewMode('table')}
            role="tab"
            aria-selected={viewMode === 'table'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" x2="21" y1="6" y2="6"/>
              <line x1="8" x2="21" y1="12" y2="12"/>
              <line x1="8" x2="21" y1="18" y2="18"/>
              <line x1="3" x2="3.01" y1="6" y2="6"/>
              <line x1="3" x2="3.01" y1="12" y2="12"/>
              <line x1="3" x2="3.01" y1="18" y2="18"/>
            </svg>
            <span>Table View</span>
          </button>
        </div>

        {/* Multi-Class Legend and Week Navigator */}
        <div className="timetable-filters-row">
          {/* Week Selector */}
          <div className="timetable-week-navigator">
            <button
              type="button"
              className="timetable-nav-arrow"
              onClick={() => setWeekOffset(w => w - 1)}
              title="Previous Week"
              aria-label="Previous Week"
            >
              ‹
            </button>
            <div className="timetable-week-display">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                <line x1="16" x2="16" y1="2" y2="6"/>
                <line x1="8" x2="8" y1="2" y2="6"/>
                <line x1="3" x2="21" y1="10" y2="10"/>
              </svg>
              <span>{weekOffset === 0 ? `This Week (${weekDates.rangeLabel})` : weekDates.rangeLabel}</span>
            </div>
            <button
              type="button"
              className="timetable-nav-arrow"
              onClick={() => setWeekOffset(w => w + 1)}
              title="Next Week"
              aria-label="Next Week"
            >
              ›
            </button>
            {weekOffset !== 0 && (
              <button
                type="button"
                className="timetable-today-btn"
                onClick={() => setWeekOffset(0)}
              >
                Current Week
              </button>
            )}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            className="timetable-refresh-btn"
            onClick={fetchProfessorTimetable}
            disabled={loading}
            title="Refresh Timetable from Server"
          >
            {loading ? 'Refreshing…' : '↻'}
          </button>
        </div>
      </div>

      {error && (
        <div className="notice error" style={{ margin: '14px 0' }}>
          <span>{error}</span>
        </div>
      )}

      {/* Empty State when Professor has no assigned lectures */}
      {!loading && slots.length === 0 && (
        <div className="teacher-timetable-empty-card">
          <div className="empty-icon-circle">📅</div>
          <h3 className="empty-title">No Timetable Slots Assigned</h3>
          <p className="empty-desc">
            You do not have any active teaching lecture slots scheduled in the timetable for this period.
            Please consult your department timetable coordinator if you believe this is an error.
          </p>
        </div>
      )}

      {/* =====================================================================
          VIEW 1: CALENDAR VIEW (Weekly 6-Day Interactive Time-Grid)
          ===================================================================== */}
      {viewMode === 'calendar' && (
        <div className="timetable-calendar-wrap">
          <div className="calendar-scroll-wrap" tabIndex="0" aria-label="Weekly Timetable Scroll Area">
            <table className="timetable-calendar-grid">
              <thead>
                <tr>
                  <th className="tt-col-time">Time</th>
                  {weekDates.days.map(d => (
                    <th key={d.dayName} className="tt-col-day">
                      <div className="tt-day-header">
                        <span className="tt-day-name">{d.dayName}</span>
                        <span className="tt-day-date">{d.formattedDate}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map(slotDef => {
                  // Institutional Lunch Break row
                  if (slotDef.isLunch) {
                    return (
                      <tr key="lunch-break-row" className="tt-row-lunch">
                        <td className="tt-cell-time">
                          <span className="tt-time-label">{slotDef.time}</span>
                        </td>
                        <td colSpan={6} className="tt-cell-lunch-banner">
                          <div className="tt-lunch-content">
                            <span className="tt-lunch-icon">🍽️</span>
                            <span className="tt-lunch-title">College Lunch Break</span>
                            <span className="tt-lunch-sub">(13:00 – 14:00 · Academic Recess)</span>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={`slot-row-${slotDef.slotNumber}`}>
                      <td className="tt-cell-time">
                        <span className="tt-time-label">{slotDef.time}</span>
                      </td>
                      {DAYS.map(day => {
                        const slotKey = `${day}_${slotDef.slotNumber}`;
                        const matchingSlots = slotMap.get(slotKey) || [];

                        if (matchingSlots.length === 0) {
                          return (
                            <td key={slotKey} className="tt-cell-slot empty">
                              <div className="tt-empty-box" title="Free Slot">—</div>
                            </td>
                          );
                        }

                        // Check if multiple assignments exist (overlapping)
                        const isOverlapping = matchingSlots.length > 1;

                        return (
                          <td key={slotKey} className="tt-cell-slot occupied">
                            <div className={`tt-slots-stack ${isOverlapping ? 'overlapping-stack' : ''}`}>
                              {isOverlapping && (
                                <div className="tt-overlap-tag">
                                  ⚠️ Overlapping ({matchingSlots.length})
                                </div>
                              )}
                              {matchingSlots.map((slot, sIdx) => {
                                const badgeInfo = getSubjectBadge(slot.subject, slot.className);
                                return (
                                  <div
                                    key={slot.id || `${slotKey}_${sIdx}`}
                                    className="tt-card professor-slot-card"
                                  >
                                    <div className="tt-card-head">
                                      <span className="tt-card-subject" title={slot.subject}>
                                        {slot.subject}
                                      </span>
                                      <span
                                        className="tt-card-type-pill"
                                        style={{
                                          color: badgeInfo.classText,
                                          backgroundColor: badgeInfo.classPillBg
                                        }}
                                      >
                                        {badgeInfo.type}
                                      </span>
                                    </div>

                                    <div className="tt-card-cohort-badge" style={{ color: badgeInfo.classText }}>
                                      <b>{slot.className}</b>
                                    </div>

                                    <div className="tt-card-body">
                                      <div className="tt-card-room">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                                          <circle cx="12" cy="10" r="3"/>
                                        </svg>
                                        <span>{slot.room || 'Room Assigned'}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="tt-calendar-footer-legend">
            <span className="tt-legend-title">Cohort Indicators:</span>
            {distinctClasses.map(c => {
              const b = getSubjectBadge('', c);
              return (
                <span key={c} className="tt-legend-item">
                  <span className="tt-legend-chip" style={{ background: b.classBorder }}></span>
                  {c}
                </span>
              );
            })}
            <span className="tt-legend-item">
              <span className="tt-legend-chip" style={{ background: '#CBD5E1' }}></span>
              Free Slot
            </span>
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW 2: TABLE VIEW (Chronological Teaching Schedule)
          ===================================================================== */}
      {viewMode === 'table' && (
        <div className="timetable-table-view-wrap">
          {/* Day Filter Chips */}
          <div className="timetable-day-filter-chips">
            <span className="filter-label">Filter Day:</span>
            {['All', ...DAYS].map(day => (
              <button
                key={day}
                type="button"
                className={`day-chip-btn ${selectedDay === day ? 'active' : ''}`}
                onClick={() => setSelectedDay(day)}
              >
                {day}
              </button>
            ))}
          </div>

          <div className="timetable-table-container">
            <table className="timetable-data-table" aria-label="Professor Timetable Schedule">
              <thead>
                <tr>
                  <th>Day &amp; Date</th>
                  <th>Time Slot</th>
                  <th>Subject</th>
                  <th>Class Cohort</th>
                  <th>Room / Venue</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {tableSlots.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="table-empty-row">
                      No teaching lectures scheduled for {selectedDay === 'All' ? 'this week' : selectedDay}.
                    </td>
                  </tr>
                ) : (
                  tableSlots.map(slot => {
                    const badge = getSubjectBadge(slot.subject, slot.className);
                    const dayDate = weekDates.days.find(d => d.dayName === slot.dayOfWeek)?.formattedDate || '';
                    return (
                      <tr key={slot.id || `${slot.dayOfWeek}_${slot.slotNumber}_${slot.className}`}>
                        <td>
                          <b>{slot.dayOfWeek}</b>
                          {dayDate && <span className="table-sub-date"> ({dayDate})</span>}
                        </td>
                        <td>
                          <code>{slot.startTime} – {slot.endTime}</code>
                        </td>
                        <td>
                          <span className="table-subject-name">{slot.subject}</span>
                        </td>
                        <td>
                          <span
                            className="table-class-pill"
                            style={{
                              backgroundColor: badge.classPillBg,
                              borderColor: badge.classBorder,
                              color: badge.classText
                            }}
                          >
                            {slot.className}
                          </span>
                        </td>
                        <td>
                          <span>📍 {slot.room || 'TBD'}</span>
                        </td>
                        <td>
                          <span className="table-type-pill">{badge.type}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
