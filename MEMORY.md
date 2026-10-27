# AttendTrack Project Memory

## 1. Project Overview

AttendTrack is a college attendance management system for Dwarkadas J. Sanghvi College of Engineering (DJSCE).

The application supports four roles:
- ADMIN
- TEACHER
- COORDINATOR
- STUDENT

Primary goal: maintain a reliable, secure attendance and exception-management workflow while providing role-specific interfaces.

## 2. Technology Stack

Expected architecture:
- Frontend: React 18 + Vite
- Backend: Node.js + Express
- Database: PostgreSQL
- ORM: Prisma

Expected directories:
- `client/`: frontend
- `server/`: backend
- `docs/`: project documentation

Verify the actual repository structure before changing files.

## 3. Core Business Rules

### Student identity
- SAP ID is the authoritative student identifier.
- Store and handle SAP IDs as strings.
- SAP ID must be unique and validated.
- Roll number is not a unique identifier.
- Never match or authorize a student using their name alone.
- Preserve existing student records and institutional identifiers.

### Roles and access control
- ADMIN: authorized roster management, reports, audits, and permitted corrections.
- TEACHER: manage attendance only for authorized lectures and students.
- COORDINATOR: authorized attendance and letter-review workflows according to configured permissions.
- STUDENT: view only their own authorized data and submit their own supporting documents.

Always inspect existing authorization middleware and routes before changing role permissions.

### Attendance editing deadline
- Teachers may edit attendance only within 24 hours after the scheduled lecture ends.
- Enforce the deadline on the server, not just in the UI.
- After the deadline, use the existing authorized correction and approval process.
- Do not bypass the deadline to make tests or UI actions work.

### Timetable
- The recurring timetable is distinct from dated lecture sessions.
- Use the actual timetable, assigned class groups, lecture dates, times, and rooms from the database.
- Do not invent lecture sessions or replace live data with visual mockup values.

### Supporting letters and exceptions
- Students can submit supporting documents for review.
- Supported intended formats: PDF, DOCX, JPG/JPEG, PNG. Verify actual parser and upload support.
- Extract document fields where possible, including SAP ID, reason, and relevant dates.
- OCR or extraction failure must not automatically approve a request.
- Unmatched or ambiguous student identifiers require manual review.
- Coordinator approval must precede any attendance changes resulting from a letter.
- Apply exceptions only to authorized, eligible lecture sessions.
- Preserve decision history and audit records.

## 4. UI and Design Direction

- Maintain consistent DJSCE / AttendTrack institutional branding.
- Primary visual style: navy blue, white, pale blue-gray backgrounds, restrained borders and shadows.
- Use consistent shared headers, navigation, sidebars, typography, spacing, and responsive layouts.
- Student pages should show only student-relevant functions.
- Teacher pages should prioritize taking attendance, authorized timetable access, letter workflows, and relevant activity.
- Coordinator pages should prioritize review queues and approval decisions.
- Admin pages should retain authorized management and reporting controls.
- Visual reference screenshots are design references, not sources of real application data.
- Never hardcode example names, attendance counts, dates, or statuses from screenshots.

## 5. Performance and Data Safety

- Inspect existing cache implementations and invalidation rules before modifying data access.
- Invalidate relevant caches after successful database writes.
- Preserve existing API contracts unless a change is necessary and justified.
- Avoid repeatedly scanning the whole repository for a small UI task.
- Inspect shared components and the relevant feature files first.
- Never reset, drop, or reseed the database as a shortcut.
- Never delete existing backups or user data.
- Do not connect the application to a newly created empty database without confirming that it is the intended database.
- Do not claim tests passed unless they were actually executed.

## 6. Development Workflow

For every task:

1. Read this file and `CURRENT_STATUS.md`, if available.
2. Inspect only the files relevant to the task.
3. Reuse existing components, APIs, services, and styles.
4. Make the smallest safe change that achieves the goal.
5. Preserve unrelated workflows and data.
6. Run relevant tests and the frontend build when appropriate.
7. Inspect the actual rendered UI for visual tasks.
8. Report files changed, tests run, results, and remaining blockers.

Do not repeatedly re-analyze the entire repository unless the task requires it.

Do not stop after providing a plan. Implement the requested change when the necessary context and permissions are available.

## 7. Accuracy Requirements

Distinguish between:
- Verified facts found in the current codebase.
- Intended requirements documented here.
- Features not yet implemented or not yet verified.

If the code conflicts with this document, inspect the implementation and report the discrepancy. Do not silently assume a feature exists.

Update this memory only when an important project rule, architectural decision, or verified implementation detail changes.
