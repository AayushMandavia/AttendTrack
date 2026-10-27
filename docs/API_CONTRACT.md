# AttendTrack Backend API Contract & Frontend Handoff Specification

This document provides the authoritative API contract, role-based access rules, request/response specifications, and system startup instructions for AttendTrack.

---

## 1. System Overview & Integration Standards

- **Backend Base URL:** `http://localhost:4000/api`
- **Frontend Development URL:** `http://localhost:5173`
- **Data Exchange Format:** `application/json` (UTF-8)
- **File Upload Format:** `multipart/form-data` (field name: `file`)
- **Default Timezone:** `Asia/Kolkata` (`+05:30`)
- **Institutional Identifier:** SAP ID (11-digit numeric string with preserved leading zeros)
- **Supported User Roles:**
  1. `ADMIN` — Institutional administration, roster management, timetable scheduling, late corrections, audit log review.
  2. `TEACHER` — Class lecture access, student roster retrieval, attendance marking within the 24-hour window, letter upload.
  3. `COORDINATOR` — Timetable scheduling, attendance letter review/decision, attendance taking.
  4. `STUDENT` — Read-only access strictly to personal attendance and associated letter records.

---

## 2. Authentication & Authorization Standard

### 2.1 Request Headers
- **Bearer Token (Primary/Production):** `Authorization: Bearer <token>`
- **Custom Token Header (Fallback):** `x-auth-token: <token>`
- **Development/Test Header (Legacy):** `x-user-role: Admin | Teacher | Coordinator | Student`

### 2.2 Standard Error Response Format
All error responses consistently return a descriptive JSON payload:
```json
{
  "error": "Human-readable error explanation",
  "code": "ERROR_CODE_ENUM",
  "requiredRoles": ["ADMIN"]
}
```

Standard HTTP Status Codes:
- `200 OK` — Request succeeded.
- `201 Created` — Resource created / attendance saved.
- `400 Bad Request` — Input validation failed, malformed payload, or missing mandatory field.
- `401 Unauthorized` — Missing, invalid, expired, or revoked Bearer token.
- `403 Forbidden` — Valid identity, but role lacks privilege (or student attempting to access another student's record, or 24-hour edit deadline expired).
- `404 Not Found` — Requested entity (lecture, student, letter, document) does not exist.
- `409 Conflict` — Entity already exists (e.g. duplicate SAP ID).
- `429 Too Many Requests` — OCR worker queue saturated.
- `503 Service Unavailable` — PostgreSQL is disconnected; mutations safely halted to prevent silent data loss.

---

## 3. Comprehensive Endpoint Inventory

### A. Authentication & Session

#### `POST /api/auth/login`
- **Purpose:** Authenticate institutional user or student and issue signed HMAC-SHA256 bearer token.
- **Access:** Public
- **Status:** **VERIFIED**
- **Request Body:**
  ```json
  {
    "username": "admin",
    "password": "Admin@AttendTrack2026!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "ok": true,
    "message": "Authentication successful",
    "token": "eyJhbGciOi...<signature>",
    "user": {
      "id": "USR-ADMIN-01",
      "username": "admin",
      "name": "College Administration",
      "role": "ADMIN"
    }
  }
  ```
- **Errors:** `400 Bad Request`, `401 Unauthorized` (`AUTH_FAILED`).

#### `POST /api/auth/logout`
- **Purpose:** Invalidate bearer token and terminate session.
- **Access:** Authenticated users
- **Status:** **VERIFIED**
- **Response (200 OK):**
  ```json
  { "ok": true, "message": "Logged out successfully." }
  ```

#### `GET /api/auth/me`
- **Purpose:** Retrieve active authenticated user profile.
- **Access:** Authenticated users
- **Status:** **VERIFIED**
- **Response (200 OK):**
  ```json
  {
    "ok": true,
    "user": {
      "id": "USR-ADMIN-01",
      "username": "admin",
      "role": "ADMIN",
      "iat": 1729500000,
      "exp": 1729586400
    }
  }
  ```

---

### B. Student Management & Bulk Roster Import

#### `GET /api/admin/students`
- **Purpose:** Paginated, filtered, and searchable listing of all student records.
- **Access:** `ADMIN`
- **Status:** **VERIFIED**
- **Query Parameters:** `page` (default 1), `limit` (default 50), `search` (SAP ID/name/rollNo), `branch`, `classGroup`, `academicYear`
- **Response (200 OK):**
  ```json
  {
    "ok": true,
    "students": [
      {
        "id": "STU-001",
        "sapId": "60001240001",
        "name": "Aarav Sharma",
        "rollNo": "101",
        "branch": "EXTC",
        "academicYear": "Year 3",
        "classGroup": "EXTC — Year 3 / A",
        "division": "A",
        "enrollmentStatus": "Enrolled"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 50,
      "totalPages": 1
    }
  }
  ```

#### `POST /api/admin/students`
- **Purpose:** Create single student record with immediate student cache invalidation.
- **Access:** `ADMIN`
- **Status:** **VERIFIED**
- **Request Body:**
  ```json
  {
    "sapId": "60001240051",
    "name": "Devansh Mehta",
    "rollNo": "151",
    "branch": "EXTC",
    "academicYear": "Year 3",
    "classGroup": "EXTC — Year 3 / A"
  }
  ```
- **Response (201 Created):**
  ```json
  { "ok": true, "student": { "id": "STU-...", "sapId": "60001240051", ... } }
  ```

#### `PUT /api/admin/students/:id`
- **Purpose:** Update existing student record with targeted cache invalidation.
- **Access:** `ADMIN`
- **Status:** **VERIFIED**

#### `DELETE /api/admin/students/:id`
- **Purpose:** Delete student record and invalidate cache.
- **Access:** `ADMIN`
- **Status:** **VERIFIED**

#### `GET /api/admin/students/sample-template`
- **Purpose:** Download official roster CSV or XLSX template.
- **Access:** `ADMIN`
- **Status:** **VERIFIED**

#### `POST /api/admin/students/preview-import`
- **Purpose:** Upload roster CSV/XLSX, perform pre-commit row validation, and return duplicate/validation breakdown without writing to database.
- **Access:** `ADMIN`
- **Status:** **VERIFIED**
- **Payload:** `multipart/form-data` with `file`. Automatic upload buffer release on all error and completion exits.

#### `POST /api/admin/students/download-invalid-report`
- **Purpose:** Generate and download a downloadable CSV error report containing all invalid rows and failure reasons from a preview validation run.
- **Access:** `ADMIN`
- **Status:** **VERIFIED**
- **Request Body:**
  ```json
  {
    "invalidRows": [
      {
        "rowNumber": 4,
        "sapId": "",
        "name": "Missing Sap Student",
        "errors": ["SAP ID is required."]
      }
    ]
  }
  ```
- **Response (200 OK):** Attachment download `AttendTrack_Invalid_Rows_Report.csv`.

#### `POST /api/admin/students/confirm-import`
- **Purpose:** Commit validated roster batch to PostgreSQL within atomic transaction.
- **Access:** `ADMIN`
- **Status:** **VERIFIED** (in memory / disconnected); **BLOCKED** for live PostgreSQL persistence when port 5432 is offline.

---

### C. Student Portal (Self-Service)

#### `GET /api/student/me`
- **Purpose:** Retrieve logged-in student's personal details.
- **Access:** `STUDENT`
- **Status:** **VERIFIED**

#### `GET /api/student/attendance`
- **Purpose:** Retrieve logged-in student's attendance records across all lectures.
- **Access:** `STUDENT`
- **Status:** **VERIFIED**

#### `GET /api/student/letters`
- **Purpose:** Retrieve logged-in student's attendance letters and decision statuses.
- **Access:** `STUDENT`
- **Status:** **VERIFIED**

#### `GET /api/student/:sapId/attendance`
- **Purpose:** Retrieve attendance by SAP ID. Strictly enforces that students can only view their own record; queries for any other student's SAP ID return `403 Forbidden` (`STUDENT_PRIVACY_VIOLATION`).
- **Access:** `STUDENT` (self), `TEACHER`, `COORDINATOR`, `ADMIN`
- **Status:** **VERIFIED**

---

### D. Timetable & Lecture Sessions

#### `GET /api/timetable` (Alias: `GET /api/timetable/slots`)
- **Purpose:** Retrieve recurring Monday-to-Saturday master timetable definitions (54 slots/group/week, 9 slots/day, lunch break 13:00-14:00).
- **Access:** `ADMIN`, `TEACHER`, `COORDINATOR`
- **Status:** **VERIFIED**
- **Query Parameters:** `className` (optional), `dayOfWeek` (optional), `branch` (optional).

#### `POST /api/timetable/generate-lectures` (Alias: `POST /api/timetable/generate-sessions`)
- **Purpose:** Generate dated lecture sessions from recurring timetable for a given date range.
- **Access:** `ADMIN`, `COORDINATOR`
- **Status:** **VERIFIED**
- **Request Body:**
  ```json
  {
    "startDate": "2026-10-14",
    "endDate": "2026-10-21",
    "className": "EXTC — Year 3 / A",
    "actor": "Coordinator"
  }
  ```

#### `GET /api/lectures`
- **Purpose:** List scheduled dated lectures with real-time calculated 24h attendance window statuses.
- **Access:** `ADMIN`, `TEACHER`, `COORDINATOR`
- **Status:** **VERIFIED**
- **Query Parameters:** `serverTime` (optional, for deterministic testing)

#### `GET /api/attendance/window/:lectureId`
- **Purpose:** Calculate and return 24-hour correction window status for a dated lecture session.
- **Access:** Public / Authenticated
- **Status:** **VERIFIED**
- **Response (200 OK):**
  ```json
  {
    "lectureId": "LEC-101",
    "subject": "Database Systems",
    "date": "2026-10-14",
    "startTime": "10:00",
    "endTime": "11:00",
    "scheduledEnd": "2026-10-14T05:30:00.000Z",
    "deadline": "2026-10-15T05:30:00.000Z",
    "formattedScheduledEnd": "2026-10-14 11:00 IST",
    "formattedDeadline": "2026-10-15 11:00 IST",
    "isOpen": false,
    "isExpired": true,
    "remainingMs": 0,
    "timeZone": "Asia/Kolkata"
  }
  ```

---

### E. Regular Lecture Attendance & 24-Hour Edit Restriction

#### `POST /api/attendance`
- **Purpose:** Submit or correct attendance for a scheduled dated lecture session.
- **Access:** `TEACHER`, `COORDINATOR`, `ADMIN` (Students strictly forbidden with `403`).
- **Window Restriction:** Strictly enforced. If current server time is at or past the 24-hour deadline, returns `403 Forbidden` (`CORRECTION_WINDOW_EXPIRED`).
- **Status:** **VERIFIED**
- **Request Body:**
  ```json
  {
    "lectureId": "LEC-101",
    "entries": [
      { "studentId": "STU-001", "status": "Present" },
      { "studentId": "STU-002", "status": "Absent" }
    ],
    "actor": "Prof. Sharma"
  }
  ```

#### `POST /api/attendance/bulk`
- **Purpose:** Submit attendance for multiple lectures in a single batch.
- **Access:** `TEACHER`, `COORDINATOR`, `ADMIN`
- **Window Restriction:** Atomic. If any session in the batch is past its 24-hour deadline, the entire batch is rejected with `403 Forbidden` (`CORRECTION_WINDOW_EXPIRED`) with zero partial updates.
- **Status:** **VERIFIED**

#### `POST /api/attendance/admin-correction`
- **Purpose:** Explicit admin override for post-deadline attendance corrections.
- **Access:** Strictly `ADMIN` (`403 Forbidden` for other roles).
- **Mandatory Requirements:** Non-empty `reason` field is mandatory (`400 Bad Request` if omitted). Generates permanent audit event.
- **Status:** **VERIFIED**

---

### F. Document Upload, OCR & Attendance Letters

#### `POST /api/letters/upload`
- **Purpose:** Upload single or multi-student attendance letter (PDF, JPEG, PNG, DOCX).
- **Access:** `TEACHER`, `COORDINATOR`, `ADMIN`
- **Features:** Magic-byte MIME detection, OCR extraction (Tesseract.js bounded queue), table parsing, SAP ID matching.
- **Upload Limit:** 10 MB per file.
- **Status:** **VERIFIED**

#### `GET /api/documents/:id/download`
- **Purpose:** Securely stream original uploaded document file.
- **Access:** Authenticated staff
- **Status:** **VERIFIED**

#### `POST /api/letters`
- **Purpose:** Queue extracted student attendance letter(s) for coordinator review.
- **Access:** `COORDINATOR`, `ADMIN`
- **Status:** **VERIFIED**

#### `POST /api/letters/batch-decision`
- **Purpose:** Approve or reject queued attendance letters in batch.
- **Access:** `COORDINATOR`, `ADMIN` (Students forbidden with `403`).
- **Safeguards:** Unmatched, ambiguous, or SAP-conflicted records are safely skipped; only exact validated records update attendance to `Present`.
- **Status:** **VERIFIED**

#### `POST /api/letters/:id/decision`
- **Purpose:** Approve or reject an individual attendance letter.
- **Access:** `COORDINATOR`, `ADMIN` (Students forbidden with `403`).
- **Status:** **VERIFIED**
- **Request Body:**
  ```json
  {
    "decision": "approve",
    "actor": "Attendance Coordinator"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "message": "Letter approved.",
    "item": { "id": "LTR-001", "status": "Approved", ... }
  }
  ```

---

### G. System Health & Observability

#### `GET /api/dashboard`
- **Purpose:** Retrieve aggregate dashboard dataset: student count, recent students (up to 250), scheduled lectures with real-time 24h correction window status, attendance records, letters, and recent audit logs.
- **Access:** `ADMIN`, `TEACHER`, `COORDINATOR`
- **Status:** **VERIFIED**
- **Response (200 OK):**
  ```json
  {
    "students": [...],
    "lectures": [...],
    "attendance": [...],
    "letters": [...],
    "logs": [...]
  }
  ```

#### `GET /api/health`
- **Purpose:** Liveness and readiness probe reporting status of application, PostgreSQL connection, and storage provider.
- **Access:** Public / Monitoring
- **Status:** **VERIFIED**
- **Response (200 OK / 503 Service Unavailable):**
  ```json
  {
    "status": "healthy",
    "ok": true,
    "uptimeSeconds": 120,
    "timestamp": "2026-10-21T10:45:00.000Z",
    "isPostgresConnected": false,
    "services": {
      "application": "running",
      "database": {
        "status": "disconnected",
        "provider": "PostgreSQL (Prisma)",
        "authoritative": true
      },
      "storage": {
        "status": "available",
        "provider": "local"
      }
    },
    "memory": {
      "heapUsedMb": 58,
      "rssMb": 112
    }
  }
  ```

#### `GET /api/metrics`
- **Purpose:** Process memory (heap, RSS, external), HTTP request volume, latency, status code counts, and sanitized operational stats without leaking student PII.
- **Access:** `ADMIN` / Monitoring
- **Status:** **VERIFIED**

---

## 4. Startup & Execution Instructions

### 4.1 Prerequisites
1. **Node.js:** v18.0.0 or higher (v20+ recommended).
2. **PostgreSQL:** v14 or v15 running locally on port 5432.
3. **Environment Variables:** Defined in `server/.env`:
   ```bash
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/attendtrack?schema=public"
   PORT=4000
   STORAGE_PROVIDER=local
   STORAGE_LOCAL_DIR=./storage/private_files
   MAX_FILE_SIZE_BYTES=10485760
   AUTH_SECRET="your-strong-production-hmac-sha256-key"
   ```

### 4.2 Database Startup Procedure
- If using native Windows service:
  ```powershell
  Start-Service postgresql-x64-15
  ```
- If using Docker Desktop / WSL:
  1. Launch **Docker Desktop** from the Windows Start Menu or Desktop (requires standard Windows user session).
  2. Wait for Docker engine to initialize and load the existing WSL2 volume (`docker_data.vhdx`).
  3. Start the existing PostgreSQL container safely without recreating or resetting volumes:
     ```powershell
     # Check existing container status
     docker ps -a --filter "name=postgres"
     
     # Start the existing container (preserves all data and migrations)
     docker start attendtrack-postgres
     ```
  4. **DO NOT** execute `prisma migrate reset`, `docker rm -v`, or run a fresh container that overwrites existing data volumes.
- Verify connectivity:
  ```powershell
  Test-NetConnection -ComputerName localhost -Port 5432
  ```

### 4.3 Prisma Client Generation & Migration
From the `server` directory:
```powershell
# Generate Prisma client
npx prisma generate

# Apply existing migrations safely (non-destructive)
npx prisma migrate deploy

# Seed initial timetable and synthetic roster (if initializing fresh database)
node prisma/seed-timetable.js
node prisma/seed-synthetic-50.js
```

### 4.4 Running Backend Server
```powershell
cd server
npm start
# Server listens at http://localhost:4000
```

### 4.5 Running Frontend Client
```powershell
cd client
npm run dev
# Vite client runs at http://localhost:5173
```

### 4.6 Running Automated Test Suites
```powershell
cd server

# Run core authentication & four-role security tests
node --test test/authentication-and-roles.test.js

# Run strict 24-hour attendance deadline tests
node --test test/attendance-24h-rule.test.js

# Run cache invalidation and upload buffer cleanup regression tests
node --test test/cache-invalidation-and-buffer-cleanup.test.js

# Run strict SAP verification & multi-student OCR regression tests
node --test test/strict-sap-verification.test.js
node --test test/workflow03-multi-student-extraction-regression.test.js
node --test test/upload-and-extraction.test.js
node --test test/production-readiness.test.js
```
