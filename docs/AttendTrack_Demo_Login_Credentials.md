# AttendTrack · Institutional Demo Login Credentials & Role Verification Guide

**Institution:** SVKM's Dwarkadas J. Sanghvi College of Engineering (Autonomous College Affiliated to the University of Mumbai)
**System:** AttendTrack — Official Attendance & Exemption Management Portal
**Date:** October 23, 2026
**Document Classification:** Official Demonstration & Presentation Guide
**Status:** All Listed Demo Accounts Verified (100% Operational)

---

## 1. Overview & Verification Summary

This document provides the authoritative, pre-verified login credentials required to demonstrate each AttendTrack user role during academic evaluation, project review, and live institutional presentations.

Every account listed in this document has been verified against the active PostgreSQL database, cryptographic token authentication engine, and strict role-based access control (RBAC) authorization layer.

> [!NOTE]
>
> - **Login Page URL:** `http://localhost:5173/` (Local Frontend Dev & Production Server)
> - **API Base URL:** `http://localhost:4000/api` (Local Backend Service)
> - **Session Security:** Bearer tokens are signed via HMAC-SHA256 (`HS256`) with a 24-hour expiration window.
> - **Student Privacy:** Individual student accounts are bound to authoritative 11-digit SAP IDs. Cross-student record access is strictly forbidden and cryptographically blocked.

---

## 2. Table 1: Login Credentials

| Sr. No. | Role                    | Demo Username / SAP ID        | Password                                  | Account Designation                         | Login Status |
| :-----: | :---------------------- | :---------------------------- | :---------------------------------------- | :------------------------------------------ | :----------: |
|  **1**  | **Admin**               | `admin`                       | `Admin@AttendTrack2026!`                  | College Administration                      | **Verified** |
|  **2**  | **Teacher**             | `teacher.extc`                | `Teacher@AttendTrack2026!`                | Prof. Sharma (EXTC Faculty)                 | **Verified** |
|  **3**  | **Coordinator**         | `coordinator.extc`            | `Coordinator@AttendTrack2026!`            | Attendance Coordinator (EXTC)               | **Verified** |
|  **4**  | **Student A**           | `60001240001`                 | `DemoStudentA#DJSCE2026!Secure`           | DEMO ONLY · Riya Shah (CE)                  | **Verified** |
|  **5**  | **Student B**           | `60001240002`                 | `DemoStudentB#DJSCE2026!Secure`           | DEMO ONLY · Arjun Mehta (CE)                | **Verified** |
|  **6**  | **All Students (1–50)** | `60001240001` – `60001240050` | `Student@<SAPID>` or `Student@DJSCE2026!` | Full Database Roster (50 Enrolled Students) | **Verified** |

> **Note on All 50 Database Student Accounts:**
> In addition to Student A and Student B, **all 50 enrolled students in the database** (`STU-001` through `STU-050`) have active login credentials.
>
> - **Username:** Student's 11-digit SAP ID (e.g. `60001240003` for Sara Khan).
> - **Individual Formula Password:** `Student@<SAPID>` (e.g. `Student@60001240003`).
> - **Master College Password:** `Student@DJSCE2026!` (accepted for all students).
> - For a complete roster listing all 50 names, roll numbers, branches, SAP IDs, and passwords, see the [AttendTrack Complete Student Credentials Directory](file:///c:/Users/Aayush%20Mandavia/Desktop/Internship%20%202026%20-%202027/OJT%20Project%20AttendTrack/docs/AttendTrack_All_Students_Login_Credentials.md) (also available as `.docx`).

---

## 3. Table 2: Role Access and Demo Features

| Role            | Dashboard After Login                                                       | Features to Demonstrate                                                                                                                                                                                                                                                                                                                                                                  | Access Restrictions                                                                                                                                                                                                                                                           |
| :-------------- | :-------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin**       | `ADMIN PORTAL`• Roster Management• Timetable Schedule• Audit Traceability   | • View & filter 50+ student roster with pagination (8 per page)• Add/edit individual student profiles (Name, SAP ID, Roll, Branch)• Download CSV template & preview bulk CSV imports• Inspect 270 recurring weekly timetable slots (Mon–Sat)• Perform post-deadline attendance corrections with mandatory audit justification• Inspect system-wide audit traceability logs in PostgreSQL | • Admin operations are strictly restricted to authorized administrator roles.• Non-admin users cannot trigger administrative overrides or delete student records.                                                                                                             |
| **Teacher**     | `TEACHER PORTAL`• Lecture Attendance• Roster Marking                        | • Select scheduled classes assigned to faculty• View enrolled cohort roster with SAP IDs and names• Mark/modify individual student status (Present / Absent)• Submit attendance to PostgreSQL database• Inspect live 24-hour correction window timer countdown                                                                                                                           | • Restricted to assigned lectures and classes.• Cannot modify attendance after the 24-hour post-lecture deadline has elapsed.• Cannot access administrative roster configuration or coordinator approval queues.                                                              |
| **Coordinator** | `COORDINATOR PORTAL`• Official Letter Ingestion• Attendance Exemption Queue | • Upload official attendance letters (Word `.docx`, PDF, JPEG, PNG)• Automatic OCR and table extraction of student names & SAP IDs• Strict SAP ID verification against registered institutional roster• Paginated review queue (5–8 records per page with status filters)• Individual letter decision (Approve / Reject)• Batch approval for pre-validated exact match candidates        | • Cannot create or delete student accounts.• Cannot mark raw lecture attendance outside of authorized official letter exemptions.• Cannot bypass SAP ID validation when approving exemptions.                                                                                 |
| **Student**     | `STUDENT PORTAL`• Personal Attendance & Exemption Record                    | • View personal profile summary (SAP ID, Roll Number, Branch, Class Group)• Inspect authoritative overall attendance percentage (color-coded `<75%` alert)• Review personal class lectures & attendance log• Verify status of official attendance exemption letters (Approved / Pending / Rejected)• Inspect granted exemptions linked to official document references                   | • **Strict Privacy Isolation:** Student accounts can NEVER view or select another student's record.• Identity is derived solely from the cryptographically verified bearer token.• Attempting cross-student API access is rejected with `HTTP 403 STUDENT_PRIVACY_VIOLATION`. |

---

## 4. Table 3: Step-by-Step Demonstration Instructions

|  Step  | Action                                                                                                                          | Expected Result                                                                                      | Verification Checkpoint                                                                                                                                                                              |
| :----: | :------------------------------------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**  | Open `http://localhost:5173/` in the browser.                                                                                   | The DJSCE Institutional Login Screen appears with the SVKM crest, college emblem, and role tabs.     | Login screen renders cleanly with show/hide password toggle.                                                                                                                                         |
| **2**  | Select **Administrator** tab (or click Admin demo auto-fill). Enter `admin` / `Admin@AttendTrack2026!` and click **Sign in**.   | Admin Dashboard opens with topbar user capsule showing `College Administration (ADMIN)`.             | Verify Bulk Roster Import, Timetable Schedule View, Post-Deadline Correction, and Audit Log tabs.                                                                                                    |
| **3**  | Click **Sign Out ➔** in the topbar.                                                                                             | User session is immediately cleared and redirected to the Login Screen.                              | Verify token is revoked and subsequent requests require re-login.                                                                                                                                    |
| **4**  | Select **Teacher** tab (or click Teacher demo auto-fill). Enter `teacher.extc` / `march` and click **Sign in**.                 | Teacher Dashboard opens showing assigned lectures, class cohort roster, and 24-hour window status.   | Verify attendance marking controls and correction window status badge (`⏱ Open` or `🔒 Expired`).                                                                                                    |
| **5**  | Click **Sign Out ➔** in the topbar.                                                                                             | User session is cleared and redirected to the Login Screen.                                          | Verify clean return to login screen.                                                                                                                                                                 |
| **6**  | Select **Attendance Coordinator** tab. Enter `coordinator.extc` / `Coordinator@AttendTrack2026!` and click **Sign in**.         | Coordinator Dashboard opens showing Official Letter Ingestion and Attendance Queue.                  | Verify file upload zone and paginated Review Queue (max 5–8 items per page).                                                                                                                         |
| **7**  | Click **Sign Out ➔** in the topbar.                                                                                             | User session is cleared and redirected to the Login Screen.                                          | Verify clean return to login screen.                                                                                                                                                                 |
| **8**  | Select **Student** tab. Enter Student A's SAP ID `60001240001` and password `DemoStudentA#DJSCE2026!Secure`. Click **Sign in**. | Student Portal opens displaying **Riya Shah**'s personal attendance summary and enrolled lectures.   | • Topbar displays `Riya Shah` (STUDENT) · `SAP: 60001240001`.• Identity badge displays `🔒 Authoritative Student Identity: SAP 60001240001`.• No student selection dropdown exists.                  |
| **9**  | Click **Sign Out ➔** in the topbar.                                                                                             | User session is cleared and redirected to the Login Screen.                                          | Student A is logged out securely.                                                                                                                                                                    |
| **10** | Select **Student** tab. Enter Student B's SAP ID `60001240002` and password `DemoStudentB#DJSCE2026!Secure`. Click **Sign in**. | Student Portal opens displaying **Arjun Mehta**'s personal attendance summary and enrolled lectures. | • Topbar displays `Arjun Mehta` (STUDENT) · `SAP: 60001240002`.• Identity badge displays `🔒 Authoritative Student Identity: SAP 60001240002`.• Student B cannot see Student A's records or letters. |

---

## 5. Security & Isolation Safeguards

1. **Non-Predictable Passwords:**
   - Student demo accounts use high-entropy passwords (`DemoStudentA#DJSCE2026!Secure` and `DemoStudentB#DJSCE2026!Secure`) rather than predictable SAP-based credentials.
2. **Cryptographic Token Verification:**
   - All protected backend routes (`/api/student/me`, `/api/student/attendance`, `/api/student/letters`, `/api/attendance`, `/api/admin/*`) require a valid HMAC-SHA256 bearer token.
3. **Cross-Student Privacy Enforcement:**
   - Any attempt by an authenticated student to retrieve another student's attendance records (e.g., requesting `/api/student/60001240002/attendance` using Student A's token) is intercepted by the backend `requireStudentSelfAccess` middleware and rejected with:
     ```json
     {
       "error": "Access denied: Students are strictly prohibited from viewing or accessing other students records.",
       "code": "STUDENT_PRIVACY_VIOLATION"
     }
     ```
4. **Session Termination & Token Revocation:**
   - Clicking **Sign Out ➔** issues a `POST /api/auth/logout` request which records the token signature in the server's revocation blocklist, preventing token replay attacks.
5. **No Exposure of Infrastructure Secrets:**
   - Database credentials, Prisma connection strings, S3/AWS keys, and signing secrets remain securely isolated in server environment variables and are never committed to repository documentation.

---

_AttendTrack · Shri Vile Parle Kelavani Mandal's Dwarkadas J. Sanghvi College of Engineering · October 2026_
