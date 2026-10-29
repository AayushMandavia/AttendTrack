import { useState, useEffect, useRef } from 'react';

export const DEMO_NOTICE_TITLE = "DEMO SYSTEM NOTICE";
export const DEMO_NOTICE_CONTENT = "AttendTrack is currently a demonstration prototype developed to showcase the college attendance management workflow. The official system of record is SAP. As SAP integration access is not currently available, this demo operates separately from SAP and does not represent official attendance records. SAP integration will be considered once the required access and authorization are provided.";

export function DemoNoticeModal({ isOpen, onClose }) {
  const modalRef = useRef(null);
  const closeBtnRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    // Focus close button for accessibility
    const timer = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="demo-notice-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="demo-notice-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-notice-title"
        aria-describedby="demo-notice-description"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="demo-notice-modal-header">
          <div className="demo-notice-modal-title-wrap">
            <span className="demo-notice-modal-icon-badge" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </span>
            <h2 id="demo-notice-title" className="demo-notice-modal-title">
              {DEMO_NOTICE_TITLE}
            </h2>
          </div>
          <button
            type="button"
            className="demo-notice-modal-close"
            onClick={onClose}
            aria-label="Close demo notice"
            ref={closeBtnRef}
          >
            &times;
          </button>
        </div>

        <div className="demo-notice-modal-body">
          <p id="demo-notice-description" className="demo-notice-modal-text">
            {DEMO_NOTICE_CONTENT}
          </p>
        </div>

        <div className="demo-notice-modal-footer">
          <button
            type="button"
            className="demo-notice-modal-btn"
            onClick={onClose}
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
}

export function DemoNoticeButton({ onClick, className = '' }) {
  return (
    <button
      type="button"
      className={`demo-notice-btn ${className}`.trim()}
      onClick={onClick}
      aria-haspopup="dialog"
      aria-label="Open Demo System Notice"
      title="View Demo System Notice"
    >
      <span className="demo-notice-btn-icon" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </span>
      <span className="demo-notice-btn-label">Demo Notice</span>
    </button>
  );
}

export default function DemoNotice({ className = '', style }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`demo-notice-container ${className}`.trim()} style={style}>
      <DemoNoticeButton onClick={() => setIsOpen(true)} />
      <DemoNoticeModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
}
