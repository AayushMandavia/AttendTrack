# 🎓 AttendTrack — Enterprise Academic Attendance & Exception Management Platform

<p align="center">
  <a href="https://attendtrack.vercel.app/" target="_blank" rel="noopener noreferrer">
    <img src="client/public/djsce_crest.png#gh-light-mode-only" alt="DJSCE Crest" width="140" />
    <img src="client/public/djsce_crest_dark.png#gh-dark-mode-only" alt="DJSCE Crest" width="140" />
  </a>
</p>

<p align="center">
  <b>Dwarkadas J. Sanghvi College of Engineering (DJSCE)</b><br>
  <i>Autonomous College Affiliated to the University of Mumbai · NAAC 'A' Grade</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-v20+-339933?style=flat&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/React-v18-61DAFB?style=flat&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Vite-v6-646CFF?style=flat&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/PostgreSQL-v15-4169E1?style=flat&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat&logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/OCR-Tesseract.js-FF6F00?style=flat" alt="OCR" />
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License" />
</p>

<p align="center">
  <a href="https://attendtrack.vercel.app/" target="_blank" rel="noopener noreferrer">
    <img src="https://img.shields.io/badge/🌐%20Live%20Demo-https%3A%2F%2Fattendtrack.vercel.app-0070f3?style=for-the-badge&logo=vercel&logoColor=white" alt="AttendTrack Official Live Demo" />
  </a>
</p>

---

## 🌟 Overview

> 🚀 **Official Live Application**: [https://attendtrack.vercel.app/](https://attendtrack.vercel.app/)

**AttendTrack** is a mission-critical, enterprise-grade attendance and exception management system architected specifically for collegiate institutions. Built with high-fidelity institutional branding, strict role-based access control, cryptographic HMAC-SHA256 sessions, automated OCR multi-student permission letter parsing, and tamper-evident audit logging.

It guarantees institutional integrity through automated rules like the **server-enforced 24-hour attendance marking window**, conservative OCR matching, private S3/local object storage, and full-featured portals for **Administrators**, **Department Attendance Coordinators**, **Faculty Teachers**, and **Enrolled Students**.

---

## ✨ Key Features

### 🏛️ Authentic Institutional Experience
- **Ultra-HD Transparent College Crest**: Custom vector-clean 950×861px transparent crest with dynamic light sweep shimmer animation on initial launch.
- **1.5s Role-Specific Skeleton Preloaders**: Instant visual layout preservation with shimmer placeholders matching each portal's exact geometry, preventing layout shift or UI flickering during asynchronous data fetches.
- **Institutional Topbar & Navigation**: DJSCE branding, NAAC 'A' grade credential strip, live date capsules, notification badges, and authenticated profile dropdowns with role-based routing.

### 👥 4 Specialized Role Portals
1. **👑 College Administration**:
   - Master student roster management (live directory, CSV/XLSX bulk preview, pre-commit validation).
   - Recurring master timetable scheduling (Monday–Saturday, 9 slots/day, break handling).
   - Post-deadline attendance correction workflow with mandatory justification and audit logging.
   - Comprehensive compliance audit logs across all users.

2. **📋 Attendance Coordinator (EXTC / Branch)**:
   - Official permission letter intake supporting PDF, DOCX, JPG, and PNG.
   - Bounded-queue OCR extraction detecting student names, 11-digit SAP IDs, and missed lecture slots.
   - Ambiguity protection: prevents approval of overlapping or uncertain student letters.
   - Batch approval/rejection with immediate PostgreSQL attendance status updating.
   - Live roster verification badge (`PostgreSQL Connected`).

3. **👨‍🏫 Faculty / Teacher Portal**:
   - Class-wise lecture selection and live student rosters.
   - **Enforced 24-Hour Marking Window**: Strict server-side validation preventing backdated edits past 24 hours.
   - Real-time attendance counters (`Present`, `Absent`, `Defaulter` tracking).

4. **🎓 Student Self-Service Portal**:
   - Personal attendance breakdown by subject with percentage indicators and progress bars.
   - Weekly timetable schedule and upcoming class preview.
   - Status tracking of submitted medical leave and event exception letters.
   - Strict student privacy boundary: queries for any other student's data return `403 STUDENT_PRIVACY_VIOLATION`.

---

## 🔒 Security & Architecture

```
   ┌────────────────────────────────────────────────────────┐
   │                  AttendTrack Client                    │
   │           (React 18 + Vite · Design Tokens)            │
   └───────────────────────────┬────────────────────────────┘
                               │
                      Authorization Bearer
                   (HMAC-SHA256 Signed Token)
                               │
   ┌───────────────────────────▼────────────────────────────┐
   │                  Express API Server                    │
   │   - 4-Role Middleware Authorization                    │
   │   - 24-Hour Edit Window Server Enforcement             │
   │   - Magic-Byte MIME Validation (PDF / Images / DOCX)   │
   │   - Tesseract.js Worker Queue (Bounded Memory)         │
   │   - Rate-Limited Token Revocation Blocklist            │
   └───────────────┬────────────────────────┬───────────────┘
                   │                        │
       Private Object Storage      PostgreSQL Database
       (Local / S3 Bucket)         (Prisma Client ORM)
       Zero Public URL Access      Strict FK Relations
```

- **Zero Public Document URLs**: Uploaded medical and event excuse letters are stored privately in encrypted object storage (`storage/private_files` or S3) and streamed strictly via authenticated endpoints with `X-Content-Type-Options: nosniff`.
- **HMAC-SHA256 Stateless Tokens**: Cryptographically signed tokens with configurable TTL and instantaneous revocation blocklists.
- **Permanent Audit Trail**: All mutations (attendance submission, overrides, letter decisions) write immutable audit records with timestamps and actor details.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js** v18+ (Node.js 20 recommended)
- **PostgreSQL** v14+ (Local service or Docker container)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/AayushMandavia/AttendTrack.git
cd AttendTrack

# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### 3. Environment Configuration
Create `server/.env` based on `server/.env.example`:
```env
# Database Connection
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/attendtrack?schema=public"

# Document Storage: 'local' (development fallback) or 's3' (cloud storage)
STORAGE_PROVIDER=local
STORAGE_LOCAL_DIR=./storage/private_files

# Application Settings
PORT=4000
AUTH_SECRET="attendtrack-hmac-sha256-auth-secret-key-2026"
MAX_FILE_SIZE_BYTES=10485760
```

### 4. Database Setup & Seeding
```bash
cd server
# Generate Prisma Client & Run Migrations
npx prisma generate
npx prisma migrate deploy

# Seed Recurring Timetable and Demo Roster
node prisma/seed-timetable.js
node prisma/seed-synthetic-50.js
```

### 5. Launch the Application
In separate terminals:

```bash
# Terminal 1: Backend API (Port 4000)
cd server
npm run dev

# Terminal 2: Frontend Web App (Port 5173)
cd client
npm run dev
```

Visit **`http://localhost:5173`** to access AttendTrack.

---

## 🧪 Testing & Verification

AttendTrack includes a comprehensive automated test suite covering authentication, role boundaries, the 24-hour edit restriction, and OCR parsing:

```bash
cd server
npm test
```

Test suite coverage:
- `authentication-and-roles.test.js`: Token issuance, invalidation, role-based route guard checks.
- `attendance-24h-rule.test.js`: Server-side rejection of attendance submissions past 24-hour deadline.
- `strict-sap-verification.test.js`: 11-digit numeric SAP ID format preservation.
- `workflow03-multi-student-extraction-regression.test.js`: Tabular student list parsing from uploaded letters.
- `cache-invalidation-and-buffer-cleanup.test.js`: Upload buffer release and memory bounds.

Frontend production bundle verification:
```bash
cd client
npm run build
```

---

## 📁 Repository Structure

```
AttendTrack/
├── client/                     # Frontend Application (React + Vite)
│   ├── public/                 # Static branding assets & SVG icons
│   │   └── djsce_crest.png     # Ultra-HD transparent college crest
│   └── src/
│       ├── AdminPortalView.jsx       # Administrator management dashboard
│       ├── CoordinatorPortalView.jsx # Attendance coordinator review portal
│       ├── TeacherPortalView.jsx     # Teacher attendance marking view
│       ├── StudentPortalView.jsx     # Student self-service dashboard
│       ├── LoginPage.jsx             # Institutional login experience
│       ├── RoleSkeletonDashboard.jsx # 1.5s post-login skeleton loader
│       ├── TransparentPreloader.jsx  # Initial website launch animation
│       └── styles.css                # CSS design system & tokens
├── server/                     # Backend API Server (Node.js + Express)
│   ├── prisma/                 # PostgreSQL schema, migrations & seed scripts
│   ├── src/
│   │   ├── auth.js             # Authentication, token generation, role guards
│   │   ├── db.js               # Prisma client database access layer
│   │   ├── ocr.js              # Tesseract.js OCR extraction engine
│   │   ├── storage.js          # Private file storage abstraction (Local/S3)
│   │   └── index.js            # Express routes and server endpoints
│   └── test/                   # Automated backend regression test suites
├── docs/                       # Architecture specifications & API contracts
│   └── API_CONTRACT.md         # Authoritative REST API contract
├── CURRENT_STATUS.md           # Implementation status and release notes
└── README.md                   # Project documentation
```

---

## 📜 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

<p align="center">
  <b>AttendTrack</b> — Developed for Dwarkadas J. Sanghvi College of Engineering.
</p>
