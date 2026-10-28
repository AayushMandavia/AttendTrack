# AttendTrack · Enrolled Student Accounts & Login Credentials Directory

**Institution:** Shri Vile Parle Kelavani Mandal's Dwarkadas J. Sanghvi College of Engineering (Autonomous College Affiliated to the University of Mumbai)
**System:** AttendTrack Attendance & Exemption Management System
**Document Classification:** Official Testing & Verification Directory
**Total Database Records:** 50 Enrolled Students (Database Verified)
**Authentication Standard:** Authoritative 11-digit SAP ID with HMAC-SHA256 Signed Bearer Tokens

---

## 1. Institutional Student Authentication Standard

In the AttendTrack ERP system, every student account is bound to their authoritative **11-digit Permanent SAP ID** stored in PostgreSQL.

### Student Credential Formulas:

1. **Username / Identifier:** Student's 11-digit SAP ID (e.g. `60001240001`).
2. **Individual Formula Password:** `Student@<SAPID>` (e.g., `Student@60001240001`, `Student@60001240002`).
3. **Master College Password:** `Student@DJSCE2026!` (Accepted for all enrolled students).
4. **Dedicated Testing Passwords:**
   - **Student A (Riya Shah · SAP: 60001240001):** `DemoStudentA#DJSCE2026!Secure`
   - **Student B (Arjun Mehta · SAP: 60001240002):** `DemoStudentB#DJSCE2026!Secure`

### Login URL & Instructions:

- **Login Portal:** `http://localhost:5173/`
- **Tab Selection:** Select the **Student** tab.
- **Auto-Fill Quick Selector:** Open the "CREDENTIAL DIRECTORY & TESTING" drawer and pick any student from the dropdown to automatically populate their SAP ID and password.

---

## 2. Complete Student Login Directory (50 Database Accounts)

| #  | Student ID  | Student Name               | Branch / Department    | Roll No | SAP ID (Username) | Default Password                  | Class Group      |
| -- | ----------- | -------------------------- | ---------------------- | ------- | ----------------- | --------------------------------- | ---------------- |
| 1  | `STU-001` | **Riya Shah**        | Computer Engineering   | 24CE01  | `60001240001`   | `DemoStudentA#DJSCE2026!Secure` | CE — Year 3 / A |
| 2  | `STU-002` | **Arjun Mehta**      | Computer Engineering   | 24CE02  | `60001240002`   | `DemoStudentB#DJSCE2026!Secure` | CE — Year 3 / A |
| 3  | `STU-003` | **Sara Khan**        | Computer Engineering   | 24CE03  | `60001240003`   | `Student@60001240003`           | CE — Year 3 / A |
| 4  | `STU-004` | **Dev Patel**        | Computer Engineering   | 24CE04  | `60001240004`   | `Student@60001240004`           | CE — Year 3 / A |
| 5  | `STU-005` | **Ananya Deshmukh**  | Computer Engineering   | 24CE05  | `60001240005`   | `Student@60001240005`           | CE — Year 3 / A |
| 6  | `STU-006` | **Rohan Kulkarni**   | Computer Engineering   | 24CE06  | `60001240006`   | `Student@60001240006`           | CE — Year 3 / A |
| 7  | `STU-007` | **Pooja Iyer**       | Computer Engineering   | 24CE07  | `60001240007`   | `Student@60001240007`           | CE — Year 3 / A |
| 8  | `STU-008` | **Aditya Varma**     | Computer Engineering   | 24CE08  | `60001240008`   | `Student@60001240008`           | CE — Year 3 / A |
| 9  | `STU-009` | **Neha Chawla**      | Computer Engineering   | 24CE09  | `60001240009`   | `Student@60001240009`           | CE — Year 3 / A |
| 10 | `STU-010` | **Kunal Joshi**      | Computer Engineering   | 24CE10  | `60001240010`   | `Student@60001240010`           | CE — Year 3 / A |
| 11 | `STU-011` | **Tanvi Nair**       | Computer Engineering   | 24CE11  | `60001240011`   | `Student@60001240011`           | CE — Year 3 / A |
| 12 | `STU-012` | **Siddharth Jain**   | Computer Engineering   | 24CE12  | `60001240012`   | `Student@60001240012`           | CE — Year 3 / A |
| 13 | `STU-013` | **Sneha Bansal**     | Information Technology | 24IT01  | `60001240013`   | `Student@60001240013`           | IT — Year 3 / A |
| 14 | `STU-014` | **Varun Somani**     | Information Technology | 24IT02  | `60001240014`   | `Student@60001240014`           | IT — Year 3 / A |
| 15 | `STU-015` | **Ishita Roy**       | Information Technology | 24IT03  | `60001240015`   | `Student@60001240015`           | IT — Year 3 / A |
| 16 | `STU-016` | **Gaurav Singhania** | Information Ters      |         |                   |                                   |                  |

|  |  |  |  |                       |
| - | - | - | - | --------------------- |
|  |  |  |  | **60001240050** |

---

## 4. Privacy & Access Control Safeguards

1. **Student Self-Access Only:** Each student can only view their own attendance records, lectures, and exemption letters.
2. **Access Rejection:** Any request to view another student's data returns HTTP 403 `STUDENT_PRIVACY_VIOLATION`.
3. **Audit Trail:** All authentication events and session tokens are validated against PostgreSQL.
