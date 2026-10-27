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

| # | Student ID | Student Name | Branch / Department | Roll No | SAP ID (Username) | Default Password | Class Group |
|---|---|---|---|---|---|---|---|
| 1 | `STU-001` | **Riya Shah** | Computer Engineering | 24CE01 | `60001240001` | `DemoStudentA#DJSCE2026!Secure` | CE — Year 3 / A |
| 2 | `STU-002` | **Arjun Mehta** | Computer Engineering | 24CE02 | `60001240002` | `DemoStudentB#DJSCE2026!Secure` | CE — Year 3 / A |
| 3 | `STU-003` | **Sara Khan** | Computer Engineering | 24CE03 | `60001240003` | `Student@60001240003` | CE — Year 3 / A |
| 4 | `STU-004` | **Dev Patel** | Computer Engineering | 24CE04 | `60001240004` | `Student@60001240004` | CE — Year 3 / A |
| 5 | `STU-005` | **Ananya Deshmukh** | Computer Engineering | 24CE05 | `60001240005` | `Student@60001240005` | CE — Year 3 / A |
| 6 | `STU-006` | **Rohan Kulkarni** | Computer Engineering | 24CE06 | `60001240006` | `Student@60001240006` | CE — Year 3 / A |
| 7 | `STU-007` | **Pooja Iyer** | Computer Engineering | 24CE07 | `60001240007` | `Student@60001240007` | CE — Year 3 / A |
| 8 | `STU-008` | **Aditya Varma** | Computer Engineering | 24CE08 | `60001240008` | `Student@60001240008` | CE — Year 3 / A |
| 9 | `STU-009` | **Neha Chawla** | Computer Engineering | 24CE09 | `60001240009` | `Student@60001240009` | CE — Year 3 / A |
| 10 | `STU-010` | **Kunal Joshi** | Computer Engineering | 24CE10 | `60001240010` | `Student@60001240010` | CE — Year 3 / A |
| 11 | `STU-011` | **Tanvi Nair** | Computer Engineering | 24CE11 | `60001240011` | `Student@60001240011` | CE — Year 3 / A |
| 12 | `STU-012` | **Siddharth Jain** | Computer Engineering | 24CE12 | `60001240012` | `Student@60001240012` | CE — Year 3 / A |
| 13 | `STU-013` | **Sneha Bansal** | Information Technology | 24IT01 | `60001240013` | `Student@60001240013` | IT — Year 3 / A |
| 14 | `STU-014` | **Varun Somani** | Information Technology | 24IT02 | `60001240014` | `Student@60001240014` | IT — Year 3 / A |
| 15 | `STU-015` | **Ishita Roy** | Information Technology | 24IT03 | `60001240015` | `Student@60001240015` | IT — Year 3 / A |
| 16 | `STU-016` | **Gaurav Singhania** | Information Technology | 24IT04 | `60001240016` | `Student@60001240016` | IT — Year 3 / A |
| 17 | `STU-017` | **Meera Menon** | Information Technology | 24IT05 | `60001240017` | `Student@60001240017` | IT — Year 3 / A |
| 18 | `STU-018` | **Yash Saxena** | Information Technology | 24IT06 | `60001240018` | `Student@60001240018` | IT — Year 3 / A |
| 19 | `STU-019` | **Rashi Agarwal** | Information Technology | 24IT07 | `60001240019` | `Student@60001240019` | IT — Year 3 / A |
| 20 | `STU-020` | **Pranav Bhatia** | Information Technology | 24IT08 | `60001240020` | `Student@60001240020` | IT — Year 3 / A |
| 21 | `STU-021` | **Divya Pillai** | Information Technology | 24IT09 | `60001240021` | `Student@60001240021` | IT — Year 3 / A |
| 22 | `STU-022` | **Harsh Vardhan** | Information Technology | 24IT10 | `60001240022` | `Student@60001240022` | IT — Year 3 / A |
| 23 | `STU-023` | **Kavya Sen** | EXTC | 24EX01 | `60001240023` | `Student@60001240023` | EXTC — Year 3 / A |
| 24 | `STU-024` | **Manish Reddy** | EXTC | 24EX02 | `60001240024` | `Student@60001240024` | EXTC — Year 3 / A |
| 25 | `STU-025` | **Shreya Hegde** | EXTC | 24EX03 | `60001240025` | `Student@60001240025` | EXTC — Year 3 / A |
| 26 | `STU-026` | **Nikhil Rane** | EXTC | 24EX04 | `60001240026` | `Student@60001240026` | EXTC — Year 3 / A |
| 27 | `STU-027` | **Ankita Ghosh** | EXTC | 24EX05 | `60001240027` | `Student@60001240027` | EXTC — Year 3 / A |
| 28 | `STU-028` | **Karthik Raman** | EXTC | 24EX06 | `60001240028` | `Student@60001240028` | EXTC — Year 3 / A |
| 29 | `STU-029` | **Zoya Merchant** | EXTC | 24EX07 | `60001240029` | `Student@60001240029` | EXTC — Year 3 / A |
| 30 | `STU-030` | **Deepak Chopra** | EXTC | 24EX08 | `60001240030` | `Student@60001240030` | EXTC — Year 3 / A |
| 31 | `STU-031` | **Komal Shirke** | EXTC | 24EX09 | `60001240031` | `Student@60001240031` | EXTC — Year 3 / A |
| 32 | `STU-032` | **Amitabh Sen** | EXTC | 24EX10 | `60001240032` | `Student@60001240032` | EXTC — Year 3 / A |
| 33 | `STU-033` | **Preeti Salunkhe** | Electrical Engineering | 24EE01 | `60001240033` | `Student@60001240033` | EE — Year 3 / A |
| 34 | `STU-034` | **Abhishek Tripathi** | Electrical Engineering | 24EE02 | `60001240034` | `Student@60001240034` | EE — Year 3 / A |
| 35 | `STU-035` | **Bhavna Chauhan** | Electrical Engineering | 24EE03 | `60001240035` | `Student@60001240035` | EE — Year 3 / A |
| 36 | `STU-036` | **Chetan Wagle** | Electrical Engineering | 24EE04 | `60001240036` | `Student@60001240036` | EE — Year 3 / A |
| 37 | `STU-037` | **Farhan Sayed** | Electrical Engineering | 24EE05 | `60001240037` | `Student@60001240037` | EE — Year 3 / A |
| 38 | `STU-038` | **Gayatri Puranik** | Electrical Engineering | 24EE06 | `60001240038` | `Student@60001240038` | EE — Year 3 / A |
| 39 | `STU-039` | **Jatin Oberoi** | Electrical Engineering | 24EE07 | `60001240039` | `Student@60001240039` | EE — Year 3 / A |
| 40 | `STU-040` | **Kiran More** | Electrical Engineering | 24EE08 | `60001240040` | `Student@60001240040` | EE — Year 3 / A |
| 41 | `STU-041` | **Lavanya Sridhar** | Electrical Engineering | 24EE09 | `60001240041` | `Student@60001240041` | EE — Year 3 / A |
| 42 | `STU-042` | **Omkar Sawant** | Mechanical Engineering | 24ME01 | `60001240042` | `Student@60001240042` | ME — Year 3 / A |
| 43 | `STU-043` | **Pallavi Nadkarni** | Mechanical Engineering | 24ME02 | `60001240043` | `Student@60001240043` | ME — Year 3 / A |
| 44 | `STU-044` | **Rahul Sengupta** | Mechanical Engineering | 24ME03 | `60001240044` | `Student@60001240044` | ME — Year 3 / A |
| 45 | `STU-045` | **Swati Shinde** | Mechanical Engineering | 24ME04 | `60001240045` | `Student@60001240045` | ME — Year 3 / A |
| 46 | `STU-046` | **Tushar Jadhav** | Mechanical Engineering | 24ME05 | `60001240046` | `Student@60001240046` | ME — Year 3 / A |
| 47 | `STU-047` | **Urvashi Kaul** | Mechanical Engineering | 24ME06 | `60001240047` | `Student@60001240047` | ME — Year 3 / A |
| 48 | `STU-048` | **Vivek Gokhale** | Mechanical Engineering | 24ME07 | `60001240048` | `Student@60001240048` | ME — Year 3 / A |
| 49 | `STU-049` | **Aakash Mhatre** | Mechanical Engineering | 24ME08 | `60001240049` | `Student@60001240049` | ME — Year 3 / A |
| 50 | `STU-050` | **Mugdha Godbole** | Mechanical Engineering | 24ME09 | `60001240050` | `Student@60001240050` | ME — Year 3 / A |

---

## 3. Departmental Distribution Summary

| Department | Cohort / Class Group | Roll Range | Total Students | SAP ID Range |
|---|---|---|---|---|
| Computer Engineering | `CE — Year 3 / A` | 24CE01 – 24CE12 | 12 | 60001240001 – 60001240012 |
| Information Technology | `IT — Year 3 / A` | 24IT01 – 24IT10 | 10 | 60001240013 – 60001240022 |
| Electronics & Telecommunication (EXTC) | `EXTC — Year 3 / A` | 24EX01 – 24EX10 | 10 | 60001240023 – 60001240032 |
| Electrical Engineering | `EE — Year 3 / A` | 24EE01 – 24EE09 | 9 | 60001240033 – 60001240041 |
| Mechanical Engineering | `ME — Year 3 / A` | 24ME01 – 24ME09 | 9 | 60001240042 – 60001240050 |
| **Total Enrolled** | **5 Engineering Departments** | — | **50** | **60001240001 – 60001240050** |

---

## 4. Privacy & Access Control Safeguards
1. **Student Self-Access Only:** Each student can only view their own attendance records, lectures, and exemption letters.
2. **Access Rejection:** Any request to view another student's data returns HTTP 403 `STUDENT_PRIVACY_VIOLATION`.
3. **Audit Trail:** All authentication events and session tokens are validated against PostgreSQL.
