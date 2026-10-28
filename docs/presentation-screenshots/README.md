# AttendTrack — Presentation Screenshots Catalog (Gamma AI)

This folder contains genuine, high-resolution (3200×2000 @ 2× Retina) screenshots captured directly from the live AttendTrack application and verified test runner. These individual PNG files are formatted for direct upload into **Gamma AI** for the 5-slide academic presentation: **Requirements, Design, Implementation, Testing, and Deployment**.

---

## Slide-by-Slide Mapping Table

| Slide # | Slide Topic | Screenshot File | Feature / Component Demonstrated | Role / Context |
| :---: | :--- | :--- | :--- | :--- |
| **Slide 1** | **Requirements & Scope** | `01-login.png` | Complete institutional login screen with SVKM & DJSCE crest, role pills, and security entry gate. | Unauthenticated |
| **Slide 1** | **Requirements & Scope** | `05-student-portal.png` | Statutory Attendance Compliance Monitor enforcing Mumbai University's 75% threshold with live percentage and attendance log. | Student (`60001240001`) |
| **Slide 2** | **System Architecture & Design** | `02-admin-dashboard.png` | Central administrative dashboard, student management database, department cohort filtering, and persistent audit trail. | Administrator (`admin`) |
| **Slide 2** | **System Architecture & Design** | `06-timetable-view.png` | Weekly master timetable matrix spanning Monday–Saturday (08:00–18:00), 9 lecture slots, and room allocations. | Faculty / Academic View |
| **Slide 3** | **Implementation & Workflows** | `03-teacher-attendance.png` | Live lecture attendance marking with Present/Absent/Late segmented controls, class roster, and 24-hour deadline rule. | Teacher (`teacher.extc`) |
| **Slide 3** | **Implementation & Workflows** | `04-coordinator-approval.png` | Attendance Queue & Records showing Pending duty-leave requests, Approve / Reject action controls, and status filtering. | Coordinator (`coordinator.extc`) |
| **Slide 3** | **Implementation & Workflows** | `07-single-student-letter.png` | Single-student duty-leave workflow (Workflow 02) showing letter application history, medical attachments, and reviewer decisions. | Student (`60001240001`) |
| **Slide 3** | **Implementation & Workflows** | `08-multi-student-letter.png` | Multi-student letter intake (Workflow 03) featuring DOCX table parsing, candidate student extraction, and authoritative SAP ID matching. | Coordinator (`coordinator.extc`) |
| **Slide 4** | **Testing & Data Integrity** | `09-testing-evidence.png` | Genuine test execution evidence showing 100% pass rate (23/23 tests, 0 failures) across coordinator sync, strict SAP validation, and RBAC. | Automated Test Runner |
| **Slide 5** | **Deployment & Infrastructure** | `10-deployed-website.png` | Live production application running on Vercel at `https://attendtrack.vercel.app/` with responsive institutional interface. | Cloud Deployment |

---

## Detailed Screenshot Specifications

### 1. `01-login.png`
- **Slide:** **Slide 1 — Requirements & Scope**
- **Resolution:** 3200 × 2000 pixels (PNG, ~1.6 MB)
- **What It Demonstrates:**
  - Official SVKM’s Dwarkadas J. Sanghvi College of Engineering header with dual crests and NAAC 'A' grade affiliation.
  - Role-based authentication entry point requiring 11-digit SAP ID or username and institutional password.
  - Institutional motto banner (*LEARN • BUILD • CONTRIBUTE*) and clean institutional styling.

### 2. `05-student-portal.png`
- **Slide:** **Slide 1 — Requirements & Scope**
- **Resolution:** 3200 × 2000 pixels (PNG, ~367 KB)
- **What It Demonstrates:**
  - Statutory Attendance Compliance Monitor calculating attendance against the mandatory 75.0% threshold.
  - Four key metric cards: Cumulative Attendance %, Lectures Attended, Recorded Absences, and Approved Exemptions.
  - Lecture-by-lecture academic log showing date, time interval, course name, and attendance status badges.

### 3. `02-admin-dashboard.png`
- **Slide:** **Slide 2 — System Architecture & Design**
- **Resolution:** 3200 × 2000 pixels (PNG, ~415 KB)
- **What It Demonstrates:**
  - Complete administrative system overview with total student counts and cohort breakdowns across branches (EXTC & CE).
  - Quick administrative actions: Add Student, Manage Timetable, Handle Corrections, and View Audit Logs.
  - Full institutional roster table with SAP ID, roll number, department, and academic year.

### 4. `06-timetable-view.png`
- **Slide:** **Slide 2 — System Architecture & Design**
- **Resolution:** 3200 × 2000 pixels (PNG, ~337 KB)
- **What It Demonstrates:**
  - Standardized college schedule from 08:00 to 18:00 across all six working days (Monday to Saturday).
  - Dedicated 13:00–14:00 institutional lunch break isolation.
  - Classroom allocations, subject tags, and faculty assignments across all cohorts.

### 5. `03-teacher-attendance.png`
- **Slide:** **Slide 3 — Implementation & Workflows**
- **Resolution:** 3200 × 2000 pixels (PNG, ~469 KB)
- **What It Demonstrates:**
  - Faculty lecture selector with real-time class roster.
  - Individual student attendance segmented controls (Present / Absent / Late).
  - Strict 24-hour editing deadline banner showing the exact time after which modifications are locked.

### 6. `04-coordinator-approval.png`
- **Slide:** **Slide 3 — Implementation & Workflows**
- **Resolution:** 3200 × 2000 pixels (PNG, ~331 KB)
- **What It Demonstrates:**
  - Official attendance letter review queue showing Pending (3), Approved (0), and Rejected (1) filters.
  - Table showing missed lecture dates, courses, reason / document attachments, and current status.
  - Interactive **Approve** and **Reject** action buttons enabling atomic attendance crediting.

### 7. `07-single-student-letter.png`
- **Slide:** **Slide 3 — Implementation & Workflows**
- **Resolution:** 3200 × 2000 pixels (PNG, ~185 KB)
- **What It Demonstrates:**
  - Single-student permission letter workflow (Workflow 02) within the Student Portal.
  - History of submitted duty-leave requests, document attachments (`.docx` / `.pdf`), and coordinator review states.
  - User privacy isolation: students only view their own authorized submissions.

### 8. `08-multi-student-letter.png`
- **Slide:** **Slide 3 — Implementation & Workflows**
- **Resolution:** 3200 × 2000 pixels (PNG, ~347 KB)
- **What It Demonstrates:**
  - Official Letter Intake & Document Processing interface (Workflow 03) for batch events.
  - Document parser supporting DOCX tables, OCR image extraction, and PDF uploads.
  - Extracted student candidate rows validated against authoritative 11-digit SAP IDs.

### 9. `09-testing-evidence.png`
- **Slide:** **Slide 4 — Testing & Data Integrity**
- **Resolution:** 3200 × 1900 pixels (PNG, ~371 KB)
- **What It Demonstrates:**
  - Authentic Node.js test execution report showing 100% pass rate: `tests 23, suites 3, pass 23, fail 0`.
  - Regression verification for coordinator decision sync across student and teacher portals.
  - Strict SAP ID validation tests verifying that mismatched, unknown, or ambiguous SAP IDs are blocked.

### 10. `10-deployed-website.png`
- **Slide:** **Slide 5 — Deployment & Infrastructure**
- **Resolution:** 3200 × 2000 pixels (PNG, ~2.1 MB)
- **What It Demonstrates:**
  - Live production website deployed on Vercel at `https://attendtrack.vercel.app/`.
  - Production-ready layout with HTTPS encryption, responsive canvas scaling, and zero broken assets.

---

## Instructions for Uploading to Gamma AI
1. In Gamma AI, create or edit your **5-slide presentation**.
2. For each slide, select the corresponding screenshot(s) from this folder (`docs/presentation-screenshots/`).
3. Because all images are high-resolution (3200px width), Gamma AI will render them sharp and legible without compression artifacts.

