# Product Requirements — AttendTrack

## Purpose
Record attendance for individual college lectures and process attendance letters without changing unrelated lectures.

## Roles
- **Teacher / Faculty:** marks Present/Absent for an assigned lecture.
- **Attendance Coordinator:** submits letter details, reviews candidate matches, and approves/rejects valid corrections.
- **Student:** views personal attendance (future UI scope).
- **Administrator:** manages users, classes, subjects, timetable and permissions (future UI scope).

## Core workflows
1. **Regular attendance:** select scheduled lecture → load roster → mark → review → submit → validate → save and log.
2. **Attendance letter:** upload/enter letter details → identify student/date/time → match timetable → coordinator reviews → process queue → apply approved change and log.
3. **Clarification:** if student/date/time/lecture is missing, ambiguous or partially overlapping, do not update attendance. Send it to manual review.

## Critical business rule
A letter affects only the student and lecture(s) supported by its explicit date/time/subject details. Never assume that a letter for one lecture means full-day attendance.

## Prototype assumptions
- Attendance status after an approved letter is set to Present in this demo. Confirm this with college policy.
- Partial time overlaps require manual review.
- Real document upload/OCR, production authentication, persistent storage and SAP integration are not implemented.
