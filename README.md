# 🎓 AttendTrack — Academic Attendance & Exception Management

<p align="center">
  <a href="https://attendtrack.vercel.app/" target="_blank" rel="noopener noreferrer">
    <img src="client/public/djsce_crest.png" alt="DJSCE Crest" width="140" />
  </a>
</p>

<p align="center">
  <b>Dwarkadas J. Sanghvi College of Engineering (DJSCE)</b><br>
  <i>Autonomous College Affiliated to the University of Mumbai · NAAC 'A' Grade</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-v20+-339933?style=for-the-badge&logo=node.js&logoColor=white&labelColor=0f172a" alt="Node.js" />
  <img src="https://img.shields.io/badge/React-v18-087ea4?style=for-the-badge&logo=react&logoColor=61DAFB&labelColor=0f172a" alt="React" />
  <img src="https://img.shields.io/badge/Vite-v6-646CFF?style=for-the-badge&logo=vite&logoColor=white&labelColor=0f172a" alt="Vite" />
  <img src="https://img.shields.io/badge/PostgreSQL-v15-336791?style=for-the-badge&logo=postgresql&logoColor=white&labelColor=0f172a" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma&logoColor=white&labelColor=0f172a" alt="Prisma" />
  <img src="https://img.shields.io/badge/OCR-Tesseract.js-d97706?style=for-the-badge&labelColor=0f172a" alt="OCR" />
  <img src="https://img.shields.io/badge/License-MIT-0f766e?style=for-the-badge&labelColor=0f172a" alt="License" />
</p>

<p align="center">
  <a href="https://attendtrack.vercel.app/" target="_blank" rel="noopener noreferrer">
    <img src="https://img.shields.io/badge/Live%20Portal-attendtrack.vercel.app-087b70?style=for-the-badge&logo=vercel&logoColor=white&labelColor=092c4c" alt="AttendTrack Live Application" />
  </a>
</p>

---

## 🌟 Overview

> 🚀 **Live Website**: [https://attendtrack.vercel.app/](https://attendtrack.vercel.app/)

**AttendTrack** is a college attendance and permission-letter management system built for DJSCE. It brings Administrators, Department Coordinators, Faculty Teachers, and Students onto one platform with real-time timetable sync, automated document parsing, and clear attendance rules.

---

## 🖼️ Platform Previews

<table>
  <tr>
    <td align="center" width="50%">
      <b>Institutional Login</b><br>
      <img src="docs/presentation-screenshots/01-login.png" alt="Login Page" width="100%" />
    </td>
    <td align="center" width="50%">
      <b>Admin Control Center</b><br>
      <img src="docs/presentation-screenshots/02-admin-dashboard.png" alt="Admin Dashboard" width="100%" />
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <b>Teacher Real-Time Attendance</b><br>
      <img src="docs/presentation-screenshots/03-teacher-attendance.png" alt="Teacher Attendance" width="100%" />
    </td>
    <td align="center" width="50%">
      <b>Coordinator Letter Auto-Approval</b><br>
      <img src="docs/presentation-screenshots/04-coordinator-approval.png" alt="Coordinator Approval" width="100%" />
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <b>Student Attendance &amp; 75% Tracker</b><br>
      <img src="docs/presentation-screenshots/05-student-portal.png" alt="Student Portal" width="100%" />
    </td>
    <td align="center" width="50%">
      <b>Weekly Master Timetable</b><br>
      <img src="docs/presentation-screenshots/06-timetable-view.png" alt="Timetable View" width="100%" />
    </td>
  </tr>
</table>

---

## 🔄 Core Workflows & Flowcharts

### 1. Real-Time Attendance, 1-Hour Late & 6:00 PM Absent Cutoff

```mermaid
flowchart LR
    A[Scheduled Lecture Ends] --> B{Attendance Marked?}
    B -- "Marked Present / Absent" --> C[Saved to Attendance Log]
    B -- "Marked Late" --> D{Before 6:00 PM IST?}
    D -- "Yes" --> E[Status: Late]
    D -- "No (After 6:00 PM)" --> F[Auto-Converted to Absent]
    B -- "Not Marked" --> G{1 Hour Elapsed?}
    G -- "Within 1 Hour" --> H[Status: Scheduled]
    G -- "After 1 Hour" --> D
```

- **Live Clock Sync**: Opening the Teacher portal automatically loads the lecture happening right now (e.g., opening at 17:00 loads the 17:00–18:00 lecture).
- **24-Hour Edit Window**: Teachers can mark or update attendance within 24 hours of a lecture's end time. After 24 hours, edits require Admin review with a mandatory reason.

---

### 2. Coordinator Letter Upload & Auto-Approval Pipeline

```mermaid
flowchart LR
    U["Upload Letter<br/>(PDF / DOCX / JPG / PNG)"] --> P["OCR & Document Parser<br/>(Tesseract.js / Mammoth)"]
    P --> V{"Match 11-Digit SAP ID<br/>& Lecture Slot"}
    V -- "Verified Match" --> A["Auto-Approved Immediately"]
    A --> M["Attendance Marked Present<br/>(Exempted)"]
    V -- "Unmatched / Ambiguous" --> Q["Flagged in Review Queue"]
```

- **Zero Manual Clicking**: Uploading a valid permission letter (single or multi-student) automatically approves verified students and marks their attendance as **Present**.

---

### 3. System Architecture

```mermaid
flowchart TB
    Client["React 18 + Vite Frontend<br/>(Admin · Coordinator · Teacher · Student)"] -->|Bearer Token HMAC-SHA256| API["Express.js API Server"]
    API --> Auth["4-Role RBAC & Privacy Guards"]
    API --> Rules["24h Window & 6:00 PM Cutoff Engine"]
    API --> Queue["Bounded OCR / DOCX Extraction Queue"]
    API --> DB[("PostgreSQL + Prisma ORM")]
    API --> Store[("Private File Storage (Local / S3)")]
```

---

## 👥 Role Portals at a Glance

| Portal | Key Capabilities |
| :--- | :--- |
| **👑 Admin** | Master student roster (CSV/XLSX bulk import with validation), weekly timetable scheduling, post-24h attendance corrections, and full audit logs. |
| **📋 Coordinator** | Upload single/multi-student permission letters (PDF, DOCX, PNG, JPG) with automatic SAP ID matching, instant approval, and attendance exemption updates. |
| **👨‍🏫 Teacher** | Real-time lecture selection synced to the current clock, live student roster, 1-click `Present` / `Absent` / `Late` marking, and 24-hour edit window. |
| **🎓 Student** | Attendance dashboard with today's lectures pinned on top, 75% requirement progress tracker, weekly timetable, and leave/exemption letter status. |

---

## 🚀 Local Setup Guide

### 1. Prerequisites
- **Node.js** v18+ (Node.js 20 recommended)
- **PostgreSQL** v14+ (or built-in local fallback store for quick testing)

### 2. Install Dependencies
```bash
git clone https://github.com/AayushMandavia/AttendTrack.git
cd AttendTrack

# Backend
cd server && npm install

# Frontend
cd ../client && npm install
```

### 3. Environment Setup
Create `server/.env` based on `server/.env.example`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/attendtrack?schema=public"
STORAGE_PROVIDER=local
STORAGE_LOCAL_DIR=./storage/private_files
PORT=4000
AUTH_SECRET="attendtrack-hmac-sha256-auth-secret-key-2026"
MAX_FILE_SIZE_BYTES=10485760
```

### 4. Database Setup & Seed
```bash
cd server
npx prisma generate
npx prisma migrate deploy
node prisma/seed-timetable.js
node prisma/seed-synthetic-50.js
```

### 5. Run Locally
```bash
# Terminal 1: Backend API (Port 4000)
cd server && npm run dev

# Terminal 2: Frontend App (Port 5173)
cd client && npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## 🧪 Testing & Verification

```bash
# Run backend test suites (auth, 24h rule, 6pm cutoff, unmarked late rule, SAP verification, OCR)
cd server && npm test

# Build frontend production bundle
cd client && npm run build
```

---

## 📁 Project Structure

```
AttendTrack/
├── client/                     # React 18 + Vite Frontend
│   ├── public/                 # DJSCE Logos & Crests
│   └── src/
│       ├── AdminPortalView.jsx       # Admin dashboard & roster tools
│       ├── CoordinatorPortalView.jsx # Letter upload & exemption management
│       ├── TeacherPortalView.jsx     # Real-time attendance marking
│       ├── StudentPortalView.jsx     # Student attendance & 75% tracker
│       ├── attendanceUtils.js        # Live clock, 1h late & 6pm cutoff helpers
│       └── LoginPage.jsx             # Institutional login view
├── server/                     # Node.js + Express Backend
│   ├── prisma/                 # Database schema, migrations & seeds
│   ├── src/
│   │   ├── attendance-window.js# 24h edit window, 1h late & 6pm cutoff rules
│   │   ├── auth.js             # HMAC-SHA256 tokens & role middleware
│   │   ├── db.js               # Prisma & fallback persistence layer
│   │   ├── ocr.js              # Tesseract.js OCR & DOCX parser
│   │   └── index.js            # REST API routes
│   └── test/                   # Automated test suites
├── docs/                       # Specs, API contracts & screenshots
└── README.md
```

---

## 📜 License

Licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

<p align="center">
  <b>AttendTrack</b> — Built for Dwarkadas J. Sanghvi College of Engineering.
</p>
