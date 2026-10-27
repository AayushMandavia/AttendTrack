import { useState, useEffect, useRef } from 'react';

const API = 'http://localhost:4000/api';

export default function AdminRosterSection({ onRosterUpdated, authToken, openCreateTrigger, onResetCreateTrigger }) {
  // Helper to attach authoritative Bearer token while retaining fallback x-user-role
  const authHeaders = (extra = {}) => ({
    ...extra,
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    'x-user-role': 'Admin'
  });

  // Upload and Validation State
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [validationReport, setValidationReport] = useState(null);
  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'updates' | 'invalid'
  const [importMode, setImportMode] = useState('create_only'); // 'create_only' | 'update_existing'
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [notice, setNotice] = useState({ text: '', type: 'info' });

  // Paginated Roster State
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 6, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [classGroupFilter, setClassGroupFilter] = useState('');
  const [loadingRoster, setLoadingRoster] = useState(false);

  // Individual Student Management State
  const [studentModal, setStudentModal] = useState({
    isOpen: false,
    mode: 'create', // 'create' | 'edit'
    id: '',
    sapId: '',
    name: '',
    rollNo: '',
    branch: 'Computer Engineering',
    academicYear: 'Third Year',
    classGroup: 'CE — Year 3 / A',
    division: 'A',
    enrollmentStatus: 'Enrolled'
  });
  const [savingStudent, setSavingStudent] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deletingStudent, setDeletingStudent] = useState(false);

  const fileInputRef = useRef(null);

  function openCreateModal() {
    setStudentModal({
      isOpen: true,
      mode: 'create',
      id: '',
      sapId: '',
      name: '',
      rollNo: '',
      branch: 'Computer Engineering',
      academicYear: 'Third Year',
      classGroup: 'CE — Year 3 / A',
      division: 'A',
      enrollmentStatus: 'Enrolled'
    });
  }

  function openEditModal(st) {
    setStudentModal({
      isOpen: true,
      mode: 'edit',
      id: st.id,
      sapId: st.sapId,
      name: st.name,
      rollNo: st.rollNo || '',
      branch: st.branch || 'Computer Engineering',
      academicYear: st.academicYear || 'Third Year',
      classGroup: st.classGroup || 'CE — Year 3 / A',
      division: st.division || 'A',
      enrollmentStatus: st.enrollmentStatus || 'Enrolled'
    });
  }

  async function handleSaveStudent(e) {
    e.preventDefault();
    if (!studentModal.sapId.trim() || !studentModal.name.trim()) {
      setNotice({ text: 'SAP ID and Full Name are required.', type: 'error' });
      return;
    }
    setSavingStudent(true);
    try {
      const payload = {
        sapId: studentModal.sapId.trim(),
        name: studentModal.name.trim(),
        rollNo: studentModal.rollNo.trim() || null,
        branch: studentModal.branch,
        academicYear: studentModal.academicYear,
        classGroup: studentModal.classGroup,
        division: studentModal.division,
        enrollmentStatus: studentModal.enrollmentStatus
      };

      const url = studentModal.mode === 'create'
        ? `${API}/admin/students`
        : `${API}/admin/students/${studentModal.id || studentModal.sapId}`;

      const method = studentModal.mode === 'create' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: authHeaders({
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save student record');
      }

      setNotice({
        text: `Student ${payload.name} (${payload.sapId}) successfully ${studentModal.mode === 'create' ? 'created' : 'updated'}.`,
        type: 'success'
      });
      setStudentModal(p => ({ ...p, isOpen: false }));
      if (onResetCreateTrigger) onResetCreateTrigger();
      await fetchRoster();
      if (onRosterUpdated) onRosterUpdated();
    } catch (err) {
      setNotice({ text: err.message, type: 'error' });
    } finally {
      setSavingStudent(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteConfirm) return;
    setDeletingStudent(true);
    try {
      const res = await fetch(`${API}/admin/students/${deleteConfirm.id || deleteConfirm.sapId}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete student');
      }

      setNotice({
        text: `Student ${deleteConfirm.name} (${deleteConfirm.sapId}) removed successfully.`,
        type: 'success'
      });
      setDeleteConfirm(null);
      await fetchRoster();
      if (onRosterUpdated) onRosterUpdated();
    } catch (err) {
      setNotice({ text: err.message, type: 'error' });
    } finally {
      setDeletingStudent(false);
    }
  }

  const lastTriggerRef = useRef(openCreateTrigger || 0);

  useEffect(() => {
    if (openCreateTrigger && openCreateTrigger > lastTriggerRef.current) {
      lastTriggerRef.current = openCreateTrigger;
      openCreateModal();
      if (onResetCreateTrigger) onResetCreateTrigger();
    } else if (!openCreateTrigger) {
      lastTriggerRef.current = 0;
    }
  }, [openCreateTrigger, onResetCreateTrigger]);

  // Load paginated students from server
  async function fetchRoster(page = pagination.page, limit = pagination.limit) {
    setLoadingRoster(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit)
      });
      if (search.trim()) params.append('search', search.trim());
      if (branchFilter) params.append('branch', branchFilter);
      if (yearFilter) params.append('academicYear', yearFilter);
      if (classGroupFilter) params.append('classGroup', classGroupFilter);

      const res = await fetch(`${API}/admin/students?${params.toString()}`, {
        headers: authHeaders()
      });
      const data = await res.json();
      if (res.ok && data.students) {
        setStudents(data.students);
        setPagination(data.pagination);
      } else {
        setNotice({ text: data.error || 'Failed to fetch student roster', type: 'error' });
      }
    } catch (err) {
      setNotice({ text: `Network error loading roster: ${err.message}`, type: 'error' });
    } finally {
      setLoadingRoster(false);
    }
  }

  useEffect(() => {
    fetchRoster(1, pagination.limit);
  }, [search, branchFilter, yearFilter, classGroupFilter]);

  // Handle template downloads
  async function downloadTemplate(format = 'xlsx') {
    try {
      const res = await fetch(`${API}/admin/students/sample-template?format=${format}`, {
        headers: authHeaders()
      });
      if (!res.ok) throw new Error('Could not download sample template');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AttendTrack_Student_Roster_Template.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setNotice({ text: `Template download failed: ${err.message}`, type: 'error' });
    }
  }

  // Handle file selection
  function handleFileChange(e) {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setValidationReport(null);
      setImportResult(null);
      setNotice({ text: '', type: 'info' });
    }
  }

  // Submit file for Pre-Commit Validation
  async function handleValidateUpload(e) {
    e.preventDefault();
    if (!file) {
      setNotice({ text: 'Please select a CSV or XLSX file first.', type: 'error' });
      return;
    }

    setAnalyzing(true);
    setValidationReport(null);
    setNotice({ text: 'Parsing spreadsheet and performing pre-commit validation...', type: 'info' });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API}/admin/students/preview-import`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to validate roster file');
      }

      setValidationReport(data);
      if (data.invalidCount > 0) {
        setActiveTab('invalid');
        setNotice({
          text: `Validation report ready: ${data.validNewCount} new students, ${data.updateCandidatesCount} updates, and ${data.invalidCount} invalid rows requiring review.`,
          type: 'error'
        });
      } else {
        setActiveTab(data.validNewCount > 0 ? 'new' : 'updates');
        setNotice({
          text: `Validation successful! ${data.validNewCount} new students and ${data.updateCandidatesCount} existing records ready to import.`,
          type: 'info'
        });
      }
    } catch (err) {
      setNotice({ text: `Validation failed: ${err.message}`, type: 'error' });
    } finally {
      setAnalyzing(false);
    }
  }

  // Download invalid rows report as CSV
  async function downloadInvalidReport() {
    if (!validationReport?.invalid || validationReport.invalid.length === 0) return;
    try {
      const res = await fetch(`${API}/admin/students/download-invalid-report`, {
        method: 'POST',
        headers: authHeaders({
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({ invalidRows: validationReport.invalid })
      });
      if (!res.ok) throw new Error('Could not generate invalid rows report');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AttendTrack_Invalid_Rows_Report_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setNotice({ text: `Failed to download report: ${err.message}`, type: 'error' });
    }
  }

  // Execute Confirmed Import
  async function executeImport() {
    if (!validationReport) return;
    setImporting(true);
    setShowConfirmModal(false);

    try {
      const res = await fetch(`${API}/admin/students/confirm-import`, {
        method: 'POST',
        headers: authHeaders({
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({
          mode: importMode,
          validNew: validationReport.validNew || [],
          updateCandidates: validationReport.updateCandidates || [],
          actor: 'Admin',
          filename: validationReport.filename || file?.name || 'roster'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Bulk import execution failed');
      }

      setImportResult(data.summary);
      setNotice({
        text: `Bulk import completed! Created: ${data.summary.created}, Updated: ${data.summary.updated}, Skipped: ${data.summary.skipped}, Failed: ${data.summary.failed}.`,
        type: 'info'
      });

      // Clear uploaded file and validation
      setFile(null);
      setValidationReport(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Refresh student roster
      fetchRoster(1, pagination.limit);
      if (onRosterUpdated) onRosterUpdated();
    } catch (err) {
      setNotice({ text: `Import execution failed: ${err.message}`, type: 'error' });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={{ marginTop: '24px' }}>
      {/* Notice Banner */}
      {notice.text && (
        <div className={`notice ${notice.type === 'error' ? 'error' : ''}`}>
          <span>{notice.text}</span>
          <button className="quiet" onClick={() => setNotice({ text: '', type: 'info' })}>Dismiss</button>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && validationReport && (
        <div className="confirm-modal-overlay">
          <div className="confirm-modal">
            <h3>Confirm Roster Import to PostgreSQL</h3>
            <p>
              You are about to import student records from <b>{validationReport.filename}</b>.
            </p>
            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '12px', lineHeight: 1.6 }}>
              <div>Mode: <b>{importMode === 'create_only' ? 'Add new students only' : 'Update existing students matched by SAP ID'}</b></div>
              <div>New students to insert: <b style={{ color: '#16a34a' }}>{validationReport.validNewCount}</b></div>
              {importMode === 'update_existing' ? (
                <div>Existing students to update: <b style={{ color: '#d97706' }}>{validationReport.updateCandidatesCount}</b></div>
              ) : (
                <div>Existing students to skip (protected): <b style={{ color: '#2563eb' }}>{validationReport.updateCandidatesCount + validationReport.identicalCount}</b></div>
              )}
              {validationReport.invalidCount > 0 && (
                <div style={{ color: '#dc2626' }}>Invalid rows skipped: <b>{validationReport.invalidCount}</b></div>
              )}
            </div>
            <p className="small muted">
              🔒 <b>Safeguard:</b> This operation uses safe transactional batches. Existing attendance, timetable, document, and audit records will never be deleted.
            </p>
            <div className="confirm-modal-actions">
              <button className="small-btn secondary" onClick={() => setShowConfirmModal(false)}>
                Cancel
              </button>
              <button className="small-btn proto-btn-primary" onClick={executeImport}>
                Proceed & Save to PostgreSQL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WORKFLOW 04: Admin Student Roster & Bulk Import Card */}
      <section className="admin-section-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
              Official College Student Roster — Bulk Import
            </h3>
          </div>
          <span style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '4px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600 }}>
            Admin Privileged
          </span>
        </div>

        <p style={{ margin: '0 0 14px', color: '#64748b', fontSize: '12.5px' }}>
          Import or update the official college roster for First, Second, Third, and Fourth Year. Supports CSV and XLSX spreadsheets.
        </p>

        {/* Template Downloads & Upload Box */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="admin-download-btn"
            onClick={() => downloadTemplate('xlsx')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download XLSX Sample Template
          </button>
          <button
            type="button"
            className="admin-download-btn"
            onClick={() => downloadTemplate('csv')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download CSV Sample Template
          </button>
        </div>

        {/* Upload form matching screenshot dropzone */}
        <form onSubmit={handleValidateUpload} className="admin-roster-upload-box">
          <div className="admin-roster-upload-inner">
            <div className="admin-roster-upload-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9333ea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <line x1="10" y1="9" x2="8" y2="9"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>
                Upload student roster spreadsheet (CSV, XLSX — max 25 MB)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  disabled={analyzing || importing}
                  onChange={handleFileChange}
                  style={{ fontSize: '12px' }}
                />
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                Supported formats: CSV, XLSX (.xlsx). Maximum file size: 25 MB.
              </div>
            </div>
            <button
              type="submit"
              disabled={!file || analyzing || importing}
              className="admin-preview-btn"
            >
              {analyzing ? 'Validating...' : 'Preview & Validate Roster'}
            </button>
          </div>
        </form>

        {/* Validation Report and Preview */}
        {validationReport && (
          <div style={{ marginTop: '18px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <h4 style={{ margin: 0, fontSize: '15px', color: '#0f172a' }}>
                Pre-Commit Validation Report: {validationReport.filename}
              </h4>
              <span className="pill gray">{validationReport.totalRows} Total Rows Analyzed</span>
            </div>

            {/* Summary Metrics */}
            <div className="report-grid">
              <div className="report-card green">
                <span className="small muted">Valid New Students</span>
                <b style={{ color: '#16a34a' }}>{validationReport.validNewCount}</b>
              </div>
              <div className="report-card amber">
                <span className="small muted">Update Candidates</span>
                <b style={{ color: '#d97706' }}>{validationReport.updateCandidatesCount}</b>
              </div>
              <div className="report-card blue">
                <span className="small muted">Already Up to Date</span>
                <b style={{ color: '#2563eb' }}>{validationReport.identicalCount}</b>
              </div>
              <div className="report-card red">
                <span className="small muted">Invalid / Rejected Rows</span>
                <b style={{ color: '#dc2626' }}>{validationReport.invalidCount}</b>
              </div>
            </div>

            {/* Import Mode Selector */}
            <div className="import-mode-selector">
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155' }}>
                Select Import Operation Mode:
              </span>
              <div className="mode-options">
                <label className="mode-option">
                  <input
                    type="radio"
                    name="importMode"
                    value="create_only"
                    checked={importMode === 'create_only'}
                    onChange={() => setImportMode('create_only')}
                  />
                  <span>
                    <b>Add new students only</b> (Safely skip existing SAP IDs without overwriting)
                  </span>
                </label>
                <label className="mode-option">
                  <input
                    type="radio"
                    name="importMode"
                    value="update_existing"
                    checked={importMode === 'update_existing'}
                    onChange={() => setImportMode('update_existing')}
                  />
                  <span>
                    <b>Update existing students matched by SAP ID</b> (Apply proposed changes to existing records)
                  </span>
                </label>
              </div>
            </div>

            {/* Tab navigation */}
            <div className="tab-nav">
              <button
                type="button"
                className={`tab-btn ${activeTab === 'new' ? 'active' : ''}`}
                onClick={() => setActiveTab('new')}
              >
                Valid New Students ({validationReport.validNewCount})
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'updates' ? 'active' : ''}`}
                onClick={() => setActiveTab('updates')}
              >
                Update Candidates & Diffs ({validationReport.updateCandidatesCount})
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'invalid' ? 'active' : ''}`}
                onClick={() => setActiveTab('invalid')}
              >
                Invalid Rows ({validationReport.invalidCount})
              </button>
            </div>

            {/* Tab 1: Valid New Students */}
            {activeTab === 'new' && (
              <div>
                {validationReport.validNew.length === 0 ? (
                  <p className="muted small">No new student SAP IDs detected in this spreadsheet.</p>
                ) : (
                  <div className="table-wrap" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Row #</th>
                          <th>SAP ID</th>
                          <th>Full Name</th>
                          <th>Roll No</th>
                          <th>Branch</th>
                          <th>Academic Year</th>
                          <th>Class Group</th>
                          <th>Division</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validationReport.validNew.slice(0, 50).map((s, idx) => (
                          <tr key={idx}>
                            <td>{s.rowNumber}</td>
                            <td><b>{s.sapId}</b></td>
                            <td>{s.name}</td>
                            <td>{s.rollNo || '—'}</td>
                            <td>{s.branch || '—'}</td>
                            <td>{s.academicYear || '—'}</td>
                            <td>{s.classGroup || '—'}</td>
                            <td>{s.division || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {validationReport.validNew.length > 50 && (
                      <p className="small muted" style={{ textAlign: 'center', margin: '8px 0' }}>
                        Showing first 50 of {validationReport.validNew.length} new students in preview.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Update Candidates & Diffs */}
            {activeTab === 'updates' && (
              <div>
                {validationReport.updateCandidates.length === 0 ? (
                  <p className="muted small">No existing student records with modified values were found.</p>
                ) : (
                  <div className="table-wrap" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Row #</th>
                          <th>SAP ID</th>
                          <th>Target Student</th>
                          <th>Proposed Attribute Changes (Diff)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validationReport.updateCandidates.slice(0, 50).map((cand, idx) => (
                          <tr key={idx}>
                            <td>{cand.rowNumber}</td>
                            <td><b>{cand.sapId}</b></td>
                            <td>{cand.existingRecord.name} ({cand.existingRecord.rollNo || 'No roll'})</td>
                            <td>
                              <div className="diff-cell">
                                {cand.diffs.map((d, dIdx) => (
                                  <div key={dIdx}>
                                    <b>{d.field}: </b>
                                    <span className="diff-old">{d.current}</span>
                                    <span> → </span>
                                    <span className="diff-new">{d.proposed}</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Invalid Rows */}
            {activeTab === 'invalid' && (
              <div>
                {validationReport.invalid.length === 0 ? (
                  <p className="muted small" style={{ color: '#16a34a' }}>
                    ✓ Perfect! No invalid rows found in uploaded file.
                  </p>
                ) : (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className="small" style={{ color: '#dc2626' }}>
                        {validationReport.invalidCount} rows failed validation and will not be imported.
                      </span>
                      <button
                        type="button"
                        className="small-btn secondary"
                        onClick={downloadInvalidReport}
                      >
                        📥 Download Invalid Rows Report (CSV)
                      </button>
                    </div>
                    <div className="table-wrap" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Row #</th>
                            <th>Extracted SAP ID</th>
                            <th>Full Name</th>
                            <th>Validation Errors & Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {validationReport.invalid.map((inv, idx) => (
                            <tr key={idx} style={{ background: '#fef2f233' }}>
                              <td><b>{inv.rowNumber}</b></td>
                              <td>{inv.sapId || <span style={{ color: '#dc2626' }}>Missing</span>}</td>
                              <td>{inv.name || <span style={{ color: '#dc2626' }}>Missing</span>}</td>
                              <td>
                                {inv.errors.map((err, eIdx) => (
                                  <span key={eIdx} className="error-tag">{err}</span>
                                ))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
              <button
                type="button"
                className="small-btn secondary"
                onClick={() => {
                  setValidationReport(null);
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                Discard & Reset
              </button>
              <button
                type="button"
                className="bulk-action-btn"
                style={{ background: '#16a34a' }}
                disabled={validationReport.validNewCount === 0 && (importMode !== 'update_existing' || validationReport.updateCandidatesCount === 0)}
                onClick={() => setShowConfirmModal(true)}
              >
                Proceed to Save ({importMode === 'create_only' ? `${validationReport.validNewCount} New` : `${validationReport.validNewCount} New + ${validationReport.updateCandidatesCount} Updates`})
              </button>
            </div>
          </div>
        )}

        {/* Post-Import Execution Result Banner */}
        {importResult && (
          <div style={{ marginTop: '16px', padding: '14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 6px', color: '#166534', fontSize: '13px' }}>
              ✓ Bulk Import Execution Summary (Saved to PostgreSQL)
            </h4>
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', flexWrap: 'wrap' }}>
              <span>Created: <b style={{ color: '#16a34a' }}>{importResult.created}</b></span>
              <span>Updated: <b style={{ color: '#d97706' }}>{importResult.updated}</b></span>
              <span>Skipped: <b style={{ color: '#2563eb' }}>{importResult.skipped}</b></span>
              <span>Failed: <b style={{ color: '#dc2626' }}>{importResult.failed}</b></span>
              <span>Duration: <b>{importResult.durationMs}ms</b></span>
            </div>
          </div>
        )}
      </section>

      {/* Institutional Student Roster Table (Server-side Paginated & Searchable) */}
      <section className="admin-section-card" id="student-directory-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
              Enrolled Student Directory
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', padding: '4px 12px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600 }}>
              {pagination.total} Enrolled Students
            </span>
            <button
              type="button"
              className="admin-add-student-btn"
              onClick={openCreateModal}
            >
              + Add Student
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="admin-roster-filter-bar">
          <div className="admin-roster-search-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search by SAP ID, Full Name, or Roll Number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="admin-roster-search-input"
            />
          </div>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="admin-roster-select"
          >
            <option value="">All Branches</option>
            <option value="Computer Engineering">Computer Engineering</option>
            <option value="Information Technology">Information Technology</option>
            <option value="EXTC">EXTC</option>
            <option value="Electrical Engineering">Electrical Engineering</option>
            <option value="Mechanical Engineering">Mechanical Engineering</option>
          </select>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="admin-roster-select"
          >
            <option value="">All Academic Years</option>
            <option value="First Year">First Year</option>
            <option value="Second Year">Second Year</option>
            <option value="Third Year">Third Year</option>
            <option value="Fourth Year">Fourth Year</option>
          </select>
          <select
            value={classGroupFilter}
            onChange={(e) => setClassGroupFilter(e.target.value)}
            className="admin-roster-select"
          >
            <option value="">All Class Groups</option>
            <option value="CE — Year 3 / A">CE — Year 3 / A</option>
            <option value="EXTC — Year 3 / A">EXTC — Year 3 / A</option>
            <option value="IT — Year 3 / A">IT — Year 3 / A</option>
            <option value="FE — Common / A">FE — Common / A</option>
            <option value="MECH — Year 3 / A">MECH — Year 3 / A</option>
          </select>
          {(search || branchFilter || yearFilter || classGroupFilter) && (
            <button
              type="button"
              className="small-btn secondary"
              onClick={() => { setSearch(''); setBranchFilter(''); setYearFilter(''); setClassGroupFilter(''); }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Paginated Student Table */}
        <div className="admin-table-container">
          {loadingRoster ? (
            <p className="muted small" style={{ padding: '24px 0', textAlign: 'center' }}>
              Loading student roster from PostgreSQL...
            </p>
          ) : students.length === 0 ? (
            <p className="muted small" style={{ padding: '24px 0', textAlign: 'center' }}>
              No students match the selected search or filter criteria.
            </p>
          ) : (
            <table className="admin-roster-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>SAP ID</th>
                  <th>Full Name</th>
                  <th>Roll Number</th>
                  <th>Branch / Dept</th>
                  <th>Academic Year</th>
                  <th>Class Group</th>
                  <th>Division</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((st, idx) => (
                  <tr key={st.id || st.sapId}>
                    <td style={{ color: '#64748b', fontSize: '11px' }}>{(pagination.page - 1) * pagination.limit + idx + 1}</td>
                    <td><b>{st.sapId}</b></td>
                    <td style={{ fontWeight: 500 }}>{st.name}</td>
                    <td>{st.rollNo || '—'}</td>
                    <td>{st.branch || '—'}</td>
                    <td>{st.academicYear || '—'}</td>
                    <td>{st.classGroup || '—'}</td>
                    <td>{st.division || '—'}</td>
                    <td>
                      <span className="admin-status-pill enrolled">
                        {st.enrollmentStatus || 'Enrolled'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="admin-table-btn edit"
                        onClick={() => openEditModal(st)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="admin-table-btn delete"
                        onClick={() => setDeleteConfirm(st)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Bar */}
        <div className="admin-pagination-bar">
          <div className="admin-pagination-showing">
            Showing {students.length === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} students
          </div>
          <div className="admin-pagination-controls">
            <button
              type="button"
              className="admin-page-nav-btn"
              disabled={pagination.page <= 1}
              onClick={() => fetchRoster(pagination.page - 1, pagination.limit)}
              title="Previous Page"
            >
              &lt;
            </button>
            {(() => {
              const pages = [];
              const total = pagination.totalPages;
              const current = pagination.page;
              for (let i = 1; i <= total; i++) {
                if (i === 1 || i === total || (i >= current - 1 && i <= current + 1) || (current <= 3 && i <= 5) || (current >= total - 2 && i >= total - 4)) {
                  if (pages.length > 0 && i - pages[pages.length - 1] > 1) {
                    pages.push('...');
                  }
                  pages.push(i);
                }
              }
              return pages.map((p, idx) =>
                p === '...' ? (
                  <span key={`dots-${idx}`} className="admin-page-ellipsis">...</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={`admin-page-btn ${p === pagination.page ? 'active' : ''}`}
                    onClick={() => fetchRoster(p, pagination.limit)}
                  >
                    {p}
                  </button>
                )
              );
            })()}
            <button
              type="button"
              className="admin-page-nav-btn"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchRoster(pagination.page + 1, pagination.limit)}
              title="Next Page"
            >
              &gt;
            </button>
          </div>
          <div className="admin-pagination-size">
            <span>Show</span>
            <select
              value={pagination.limit}
              onChange={(e) => fetchRoster(1, parseInt(e.target.value, 10))}
              className="admin-page-size-select"
            >
              <option value="6">6</option>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
            <span>per page</span>
          </div>
        </div>
      </section>

      {/* Add / Edit Individual Student Modal */}
      {studentModal.isOpen && (
        <div className="confirm-modal-overlay">
          <div className="confirm-modal" style={{ maxWidth: '480px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '16px' }}>
              {studentModal.mode === 'create' ? '➕ Add Individual Student' : '✏ Edit Student Record'}
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#64748b' }}>
              {studentModal.mode === 'create'
                ? 'Create a verified student record directly in PostgreSQL. Cache will be updated automatically.'
                : `Update official institutional record for SAP ID ${studentModal.sapId}.`}
            </p>

            <form onSubmit={handleSaveStudent}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <label style={{ margin: 0, fontSize: '11.5px', fontWeight: 600 }}>
                  SAP ID <span style={{ color: '#ef4444' }}>*</span>
                  <input
                    type="text"
                    required
                    disabled={studentModal.mode === 'edit'}
                    placeholder="e.g. 60001240099"
                    value={studentModal.sapId}
                    onChange={e => setStudentModal(p => ({ ...p, sapId: e.target.value }))}
                    style={{ width: '100%', marginTop: '4px', padding: '6px 8px', fontSize: '12px' }}
                  />
                </label>
                <label style={{ margin: 0, fontSize: '11.5px', fontWeight: 600 }}>
                  Roll Number
                  <input
                    type="text"
                    placeholder="e.g. 24CE99"
                    value={studentModal.rollNo}
                    onChange={e => setStudentModal(p => ({ ...p, rollNo: e.target.value }))}
                    style={{ width: '100%', marginTop: '4px', padding: '6px 8px', fontSize: '12px' }}
                  />
                </label>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ margin: 0, fontSize: '11.5px', fontWeight: 600 }}>
                  Full Name <span style={{ color: '#ef4444' }}>*</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sameer Kulkarni"
                    value={studentModal.name}
                    onChange={e => setStudentModal(p => ({ ...p, name: e.target.value }))}
                    style={{ width: '100%', marginTop: '4px', padding: '6px 8px', fontSize: '12px' }}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <label style={{ margin: 0, fontSize: '11.5px', fontWeight: 600 }}>
                  Branch / Department
                  <select
                    value={studentModal.branch}
                    onChange={e => setStudentModal(p => ({ ...p, branch: e.target.value }))}
                    style={{ width: '100%', marginTop: '4px', padding: '6px 8px', fontSize: '12px' }}
                  >
                    <option value="Computer Engineering">Computer Engineering</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="EXTC">EXTC</option>
                    <option value="Electrical Engineering">Electrical Engineering</option>
                    <option value="Mechanical Engineering">Mechanical Engineering</option>
                  </select>
                </label>
                <label style={{ margin: 0, fontSize: '11.5px', fontWeight: 600 }}>
                  Academic Year
                  <select
                    value={studentModal.academicYear}
                    onChange={e => setStudentModal(p => ({ ...p, academicYear: e.target.value }))}
                    style={{ width: '100%', marginTop: '4px', padding: '6px 8px', fontSize: '12px' }}
                  >
                    <option value="First Year">First Year</option>
                    <option value="Second Year">Second Year</option>
                    <option value="Third Year">Third Year</option>
                    <option value="Fourth Year">Fourth Year</option>
                  </select>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <label style={{ margin: 0, fontSize: '11.5px', fontWeight: 600 }}>
                  Class Group
                  <input
                    type="text"
                    placeholder="e.g. CE — Year 3 / A"
                    value={studentModal.classGroup}
                    onChange={e => setStudentModal(p => ({ ...p, classGroup: e.target.value }))}
                    style={{ width: '100%', marginTop: '4px', padding: '6px 8px', fontSize: '12px' }}
                  />
                </label>
                <label style={{ margin: 0, fontSize: '11.5px', fontWeight: 600 }}>
                  Enrollment Status
                  <select
                    value={studentModal.enrollmentStatus}
                    onChange={e => setStudentModal(p => ({ ...p, enrollmentStatus: e.target.value }))}
                    style={{ width: '100%', marginTop: '4px', padding: '6px 8px', fontSize: '12px' }}
                  >
                    <option value="Enrolled">Enrolled</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Graduated">Graduated</option>
                  </select>
                </label>
              </div>

              <div className="confirm-modal-actions">
                <button
                  type="button"
                  className="small-btn secondary"
                  onClick={() => {
                    setStudentModal(p => ({ ...p, isOpen: false }));
                    if (onResetCreateTrigger) onResetCreateTrigger();
                  }}
                  disabled={savingStudent}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="proto-btn proto-btn-primary"
                  disabled={savingStudent}
                >
                  {savingStudent ? 'Saving...' : (studentModal.mode === 'create' ? 'Create Student' : 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="confirm-modal-overlay">
          <div className="confirm-modal" style={{ maxWidth: '420px' }}>
            <h3 style={{ margin: '0 0 10px', color: '#dc2626', fontSize: '15px' }}>
              Confirm Student Deletion
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: '#334155' }}>
              Are you sure you want to permanently delete <b>{deleteConfirm.name}</b> (SAP ID: <code>{deleteConfirm.sapId}</code>)?
            </p>
            <p style={{ margin: '0 0 18px', fontSize: '11px', color: '#94a3b8' }}>
              This will remove the student from PostgreSQL and invalidate active caches. Attendance records linked to this SAP ID may become unreferenced.
            </p>
            <div className="confirm-modal-actions">
              <button
                type="button"
                className="small-btn secondary"
                onClick={() => setDeleteConfirm(null)}
                disabled={deletingStudent}
              >
                Cancel
              </button>
              <button
                type="button"
                className="proto-btn proto-btn-reject"
                onClick={handleConfirmDelete}
                disabled={deletingStudent}
              >
                {deletingStudent ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
