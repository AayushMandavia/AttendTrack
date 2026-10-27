import { useState, useEffect, useMemo } from 'react';

const API = 'http://localhost:4000/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const CLASS_GROUPS = [
  'CE — Year 3 / A',
  'CE — Year 3 / B',
  'IT — Year 3 / A',
  'EXTC — Year 3 / A',
  'EE — Year 3 / A',
  'MECH — Year 3 / A'
];

const TIME_SLOTS = [
  { slotNumber: 1, time: '08:00 – 09:00', start: '08:00', end: '09:00' },
  { slotNumber: 2, time: '09:00 – 10:00', start: '09:00', end: '10:00' },
  { slotNumber: 3, time: '10:00 – 11:00', start: '10:00', end: '11:00' },
  { slotNumber: 4, time: '11:00 – 12:00', start: '11:00', end: '12:00' },
  { slotNumber: 5, time: '12:00 – 13:00', start: '12:00', end: '13:00' },
  { isLunch: true, slotNumber: null, time: '13:00 – 14:00', label: 'College Lunch Break' },
  { slotNumber: 6, time: '14:00 – 15:00', start: '14:00', end: '15:00' },
  { slotNumber: 7, time: '15:00 – 16:00', start: '15:00', end: '16:00' },
  { slotNumber: 8, time: '16:00 – 17:00', start: '16:00', end: '17:00' },
  { slotNumber: 9, time: '17:00 – 18:00', start: '17:00', end: '18:00' }
];

function getSubjectColor(subject = '') {
  const s = subject.toLowerCase();
  if (s.includes('lab') || s.includes('practical') || s.includes('workshop')) {
    return { bg: '#FCE7F3', border: '#DB2777', text: '#9D174D', badge: 'Practical' };
  }
  if (s.includes('data') || s.includes('web') || s.includes('software')) {
    return { bg: '#E0F2FE', border: '#0284C7', text: '#0369A1', badge: 'Theory' };
  }
  if (s.includes('network') || s.includes('comm') || s.includes('tele')) {
    return { bg: '#FFEDD5', border: '#EA580C', text: '#C2410C', badge: 'Theory' };
  }
  if (s.includes('operat') || s.includes('vlsi') || s.includes('circ') || s.includes('control')) {
    return { bg: '#DCFCE7', border: '#16A34A', text: '#15803D', badge: 'Theory' };
  }
  if (s.includes('organ') || s.includes('embed') || s.includes('power') || (s.includes('machin') && !s.includes('learning'))) {
    return { bg: '#FEF9C3', border: '#CA8A04', text: '#A16207', badge: 'Theory' };
  }
  if (s.includes('learn') || s.includes('signal') || s.includes('ai') || s.includes('intel')) {
    return { bg: '#F3E8FF', border: '#9333EA', text: '#7E22CE', badge: 'Theory' };
  }
  if (s.includes('math') || s.includes('thermo') || s.includes('fluid')) {
    return { bg: '#CCFBF1', border: '#0D9488', text: '#0F766E', badge: 'Theory' };
  }
  return { bg: '#F1F5F9', border: '#64748B', text: '#334155', badge: 'Lecture' };
}

export default function TimetableSection({ initialClass = 'CE — Year 3 / A', lockedClass = '', authToken = '' }) {
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'table'
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const normalizedLocked = (lockedClass || '').replace(' - ', ' — ');
  const [selectedClass, setSelectedClass] = useState(normalizedLocked || initialClass);
  const [selectedDay, setSelectedDay] = useState('All');
  const [weekOffset, setWeekOffset] = useState(0);
  const [error, setError] = useState('');

  // Keep selectedClass synchronized if initialClass changes
  useEffect(() => {
    if (normalizedLocked) {
      setSelectedClass(normalizedLocked);
    } else if (initialClass && CLASS_GROUPS.includes(initialClass)) {
      setSelectedClass(initialClass);
    }
  }, [initialClass, normalizedLocked]);

  async function fetchSlots() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (selectedClass) params.append('className', selectedClass);

      const res = await fetch(`${API}/timetable/slots?${params.toString()}`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
      const data = await res.json();
      if (res.ok && data.slots) {
        setSlots(data.slots);
      } else {
        setError(data.error || 'Failed to load timetable slots');
      }
    } catch (err) {
      setError(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSlots();
  }, [selectedClass]);

  // Compute dynamic weekday dates for the active week
  const weekDates = useMemo(() => {
    // Reference academic anchor: October 2026 week
    const now = new Date();
    const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;

    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMonday + (weekOffset * 7));

    const dates = [];
    for (let i = 0; i < 6; i++) {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + i);
      dates.push({
        dayName: DAYS[i],
        formattedDate: dayDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      });
    }

    const startDateStr = dates[0].formattedDate;
    const endDateStr = dates[5].formattedDate;
    const yearStr = monday.getFullYear();

    return {
      days: dates,
      rangeLabel: `${startDateStr} – ${endDateStr} ${yearStr}`
    };
  }, [weekOffset]);

  // Map slots for lightning-fast lookup: "Monday_1" -> slot
  const slotMap = useMemo(() => {
    const map = new Map();
    slots.forEach(slot => {
      if (slot.dayOfWeek && slot.slotNumber) {
        map.set(`${slot.dayOfWeek}_${slot.slotNumber}`, slot);
      }
    });
    return map;
  }, [slots]);

  return (
    <div className="timetable-container-card" id="student-timetable-wrapper">
      {/* Controls & Navigation Toolbar */}
      <div className="timetable-toolbar">
        {/* Segmented View Switcher: Calendar View / Table View */}
        <div className="timetable-view-toggle" role="tablist" aria-label="Timetable View Mode">
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

        {/* Center / Right controls */}
        <div className="timetable-filters-row">
          {/* Class Group Selector */}
          <div className="timetable-select-wrap">
            <span className="timetable-select-label">{normalizedLocked ? 'My Class:' : 'Cohort:'}</span>
            {normalizedLocked ? (
              <span className="timetable-select-control" style={{ display: 'inline-flex', alignItems: 'center', fontWeight: 600 }}>
                {normalizedLocked}
              </span>
            ) : (
              <select
                value={selectedClass}
                onChange={e => setSelectedClass(e.target.value)}
                className="timetable-select-control"
                aria-label="Select Academic Class Cohort"
              >
                {CLASS_GROUPS.map(cg => (
                  <option key={cg} value={cg}>{cg}</option>
                ))}
              </select>
            )}
          </div>

          {/* Week Selector (Only in Calendar View) */}
          {viewMode === 'calendar' && (
            <div className="timetable-week-navigator">
              <button
                type="button"
                className="timetable-nav-arrow"
                onClick={() => setWeekOffset(w => w - 1)}
                title="Previous Week"
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
              >
                ›
              </button>
              {weekOffset !== 0 && (
                <button
                  type="button"
                  className="timetable-today-btn"
                  onClick={() => setWeekOffset(0)}
                >
                  Today
                </button>
              )}
            </div>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            className="timetable-refresh-btn"
            onClick={fetchSlots}
            disabled={loading}
            title="Refresh Timetable from PostgreSQL"
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

      {/* =====================================================================
          VIEW 1: CALENDAR VIEW (Weekly 6-Day Interactive Time-Grid)
          ===================================================================== */}
      {viewMode === 'calendar' && (
        <div className="timetable-calendar-wrap">
          <div className="calendar-scroll-wrap">
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
                {TIME_SLOTS.map((slotDef, idx) => {
                  // Lunch Break row
                  if (slotDef.isLunch) {
                    return (
                      <tr key="lunch-break-row" className="tt-row-lunch">
                        <td className="tt-cell-time">
                          <span className="tt-time-label">{slotDef.time}</span>
                        </td>
                        <td colSpan={6} className="tt-cell-lunch-banner">
                          <div className="tt-lunch-content">
                            <span className="tt-lunch-icon">🍽️</span>
                            <span className="tt-lunch-title">Institutional Lunch Break</span>
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
                        const slot = slotMap.get(slotKey);

                        if (!slot) {
                          return (
                            <td key={slotKey} className="tt-cell-slot empty">
                              <div className="tt-empty-box">—</div>
                            </td>
                          );
                        }

                        const styleInfo = getSubjectColor(slot.subject);

                        return (
                          <td key={slotKey} className="tt-cell-slot occupied">
                            <div
                              className="tt-card"
                              style={{
                                backgroundColor: styleInfo.bg,
                                borderLeftColor: styleInfo.border
                              }}
                            >
                              <div className="tt-card-head">
                                <span className="tt-card-subject" style={{ color: '#092c4c' }}>
                                  {slot.subject}
                                </span>
                              </div>
                              <div className="tt-card-body">
                                <div className="tt-card-room">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                                    <circle cx="12" cy="10" r="3"/>
                                  </svg>
                                  <span>{slot.room || 'Room Assigned'}</span>
                                </div>
                                {slot.facultyName && (
                                  <div className="tt-card-faculty">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
                                      <circle cx="12" cy="7" r="4"/>
                                    </svg>
                                    <span>{slot.facultyName}</span>
                                  </div>
                                )}
                              </div>
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
            <span className="tt-legend-title">Subject Palette:</span>
            <span className="tt-legend-item"><span className="tt-legend-chip" style={{ background: '#0284C7' }}></span>Data &amp; Software</span>
            <span className="tt-legend-item"><span className="tt-legend-chip" style={{ background: '#EA580C' }}></span>Networks &amp; Telecom</span>
            <span className="tt-legend-item"><span className="tt-legend-chip" style={{ background: '#16A34A' }}></span>OS &amp; VLSI Design</span>
            <span className="tt-legend-item"><span className="tt-legend-chip" style={{ background: '#CA8A04' }}></span>Hardware &amp; Architecture</span>
            <span className="tt-legend-item"><span className="tt-legend-chip" style={{ background: '#9333EA' }}></span>AI &amp; Machine Learning</span>
            <span className="tt-legend-item"><span className="tt-legend-chip" style={{ background: '#DB2777' }}></span>Practicals &amp; Labs</span>
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW 2: TABLE VIEW (Standard Responsive ERP Directory)
          ===================================================================== */}
      {viewMode === 'table' && (
        <div className="timetable-table-view-section">
          {/* Day of Week filter bar */}
          <div className="timetable-day-tabs">
            <button
              type="button"
              className={`timetable-day-tab ${selectedDay === 'All' ? 'active' : ''}`}
              onClick={() => setSelectedDay('All')}
            >
              All Days ({slots.length})
            </button>
            {DAYS.map(d => {
              const count = slots.filter(s => s.dayOfWeek === d).length;
              return (
                <button
                  key={d}
                  type="button"
                  className={`timetable-day-tab ${selectedDay === d ? 'active' : ''}`}
                  onClick={() => setSelectedDay(d)}
                >
                  {d} ({count})
                </button>
              );
            })}
          </div>

          <div className="table-wrap">
            <table className="timetable-records-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Day</th>
                  <th style={{ width: '60px' }}>Slot</th>
                  <th style={{ width: '130px' }}>Time</th>
                  <th>Subject / Course</th>
                  <th>Faculty &amp; Department</th>
                  <th style={{ width: '110px' }}>Type</th>
                  <th style={{ width: '110px' }}>Room / Lab</th>
                  <th style={{ width: '130px' }}>Slot Code</th>
                </tr>
              </thead>
              <tbody>
                {slots
                  .filter(s => selectedDay === 'All' || s.dayOfWeek === selectedDay)
                  .sort((a, b) => {
                    const dayDiff = DAYS.indexOf(a.dayOfWeek) - DAYS.indexOf(b.dayOfWeek);
                    if (dayDiff !== 0) return dayDiff;
                    return (a.slotNumber || 0) - (b.slotNumber || 0);
                  })
                  .map(s => {
                    const isLab = (s.subject || '').toLowerCase().includes('lab');
                    return (
                      <tr key={s.id}>
                        <td><b>{s.dayOfWeek}</b></td>
                        <td><span className="pill gray" style={{ fontSize: '10px' }}>#{s.slotNumber}</span></td>
                        <td><code>{s.startTime} – {s.endTime}</code></td>
                        <td><b>{s.subject}</b></td>
                        <td>{s.facultyName || s.facultyId} <small className="muted">({s.branch || 'Engg'})</small></td>
                        <td>
                          <span className={`pill ${isLab ? 'amber' : 'teal'}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                            {isLab ? 'Laboratory' : 'Theory Lecture'}
                          </span>
                        </td>
                        <td><span className="pill blue" style={{ fontSize: '10px' }}>{s.room || 'Room Assigned'}</span></td>
                        <td><code>{s.id}</code></td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
