import { useState } from 'react';

const API = 'http://localhost:4000/api';

export default function LoginPage({ onLoginSuccess, isPostgresConnected, isPreloading }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmedId = identifier.trim();
    const trimmedPass = password.trim();

    if (!trimmedId) {
      setError('Please enter your 11-digit SAP ID or username.');
      return;
    }
    if (!trimmedPass) {
      setError('Please enter your account password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: trimmedId,
          password: trimmedPass
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || 'Authentication failed. Please verify your credentials.');
        setLoading(false);
        return;
      }

      onLoginSuccess(data.user, data.token);
    } catch (err) {
      setError('Cannot connect to authentication server. Please ensure the backend is running.');
      setLoading(false);
    }
  }

  return (
    <div className="figma-frame-2">
      {/* 53207b2c-fbb7-4f83-8ddb-fe74c9d2f273: Full Frame Canvas Background */}
      <div className="frame2-bg-layer" aria-hidden="true" />

      {/* =========================================================================
          image 2: Institutional Top Header (120px)
          ========================================================================= */}
      <header className="frame2-header-institution">
        <div className="frame2-logo-col-left" title="Shri Vile Parle Kelavani Mandal">
          <img
            src="/djsce_svkm_logo.png"
            alt="SVKM Emblem"
            className="frame2-svkm-logo"
          />
        </div>

        <div className="frame2-header-center">
          <span className="frame2-trust-name">SHRI VILE PARLE KELAVANI MANDAL'S</span>
          <h1 className="frame2-college-name">DWARKADAS J. SANGHVI COLLEGE OF ENGINEERING</h1>
          <div className="frame2-sub-affiliation">
            <span>Autonomous College Affiliated to the University of Mumbai</span>
            <span className="frame2-gold-bullet">◆</span>
            <span style={{ color: '#d97706', fontWeight: '600' }}>NAAC 'A' Grade</span>
          </div>
        </div>

        <div className="frame2-logo-col-right" title="Dwarkadas J. Sanghvi College of Engineering">
          <img
            src="/djsce_crest.png"
            alt="DJSCE Crest"
            className="frame2-crest-logo"
          />
        </div>
      </header>

      {/* =========================================================================
          Rectangle 1: Navy Navigation Bar (Solid Blue Bar, #093664)
          ========================================================================= */}
      <nav className="frame2-nav-bar" aria-hidden="true" />

      {/* =========================================================================
          Stage Canvas with background illustration
          ========================================================================= */}
      <div className="frame2-stage">
        {/* =======================================================================
            Rectangle 3: Center Login Card (523px width, #FFFFFF, rounded 19px)
            ======================================================================= */}
        <div className={`frame2-card ${isPreloading ? 'preloading-hidden' : ''}`}>
          <div className="frame2-card-head">
            <div className="frame2-card-welcome">WELCOME TO</div>
            <h2 className="frame2-card-title">AttendTrack</h2>
            
            {/* Line 2: 150px wide, 2.5px solid #FEBC1A */}
            <div className="frame2-card-line2"></div>

            <p className="frame2-card-sub1">Official Attendance & Exception Management Portal</p>
            <p className="frame2-card-sub2">DJSCE</p>
          </div>

          {/* Error Notification */}
          {error && (
            <div className="frame2-error-banner" role="alert">
              <span>{error}</span>
              <button type="button" className="frame2-error-close" onClick={() => setError('')}>✕</button>
            </div>
          )}

          {/* Form Fields */}
          <form onSubmit={handleSubmit} className="frame2-form">
            <div className="frame2-input-group">
              <label className="frame2-input-label" htmlFor="frame2-user-input">
                SAP ID / Username
              </label>
              <div className="frame2-input-box">
                <span className="frame2-input-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </span>
                <input
                  id="frame2-user-input"
                  type="text"
                  className="frame2-input"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="Enter your SAP ID or username"
                  autoComplete="username"
                  autoFocus
                  disabled={loading}
                />
              </div>
            </div>

            <div className="frame2-input-group">
              <label className="frame2-input-label" htmlFor="frame2-pass-input">
                Password
              </label>
              <div className="frame2-input-box">
                <span className="frame2-input-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </span>
                <input
                  id="frame2-pass-input"
                  type={showPassword ? 'text' : 'password'}
                  className="frame2-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="frame2-toggle-pw"
                  onClick={() => setShowPassword(prev => !prev)}
                  tabIndex="-1"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div className="frame2-forgot-row">
              <span className="frame2-forgot-link" onClick={() => setError('Password reset requests are processed by the College Registrar or Attendance Coordinator.')}>
                Forgot password?
              </span>
            </div>

            {/* Group 5 & Rectangle 4: Log In Button */}
            <button
              type="submit"
              className="frame2-btn-login"
              disabled={loading}
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>Log In →</>
              )}
            </button>
          </form>

          {/* Group 6: Access determined notice */}
          <div className="frame2-permission-notice">
            <span className="frame2-notice-line"></span>
            <span className="frame2-notice-text">Access is determined by your account permissions</span>
            <span className="frame2-notice-line"></span>
          </div>
        </div>

        {/* =======================================================================
            Group 1: Right Motto (LEARN - BUILD - CONTRIBUTE) per Figma Frame 2
            ======================================================================= */}
        <div className="frame2-motto-group">
          <div className="frame2-motto-word">LEARN</div>
          <div className="frame2-motto-word">BUILD</div>
          <div className="frame2-motto-word">CONTRIBUTE</div>
        </div>
      </div>

      {/* =========================================================================
          Rectangle 2: Bottom Navy Footer Bar (74px, #093664)
          ========================================================================= */}
      <footer className="frame2-footer">
        <div className="frame2-footer-line1">
          Shri Vile Parle Kelavani Mandal's | Dwarkadas J. Sanghvi College of Engineering
        </div>
        <div className="frame2-footer-line2">
          Autonomous College Affiliated to the University of Mumbai
        </div>
      </footer>
    </div>
  );
}
