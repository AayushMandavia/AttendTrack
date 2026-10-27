# Attendance Letter Workflow

1. Coordinator receives and records an official letter.
2. Letter file and supporting evidence should be securely uploaded in the production implementation.
3. Identify student ID, date(s), subject/lecture, and time window.
4. Match the details to the timetable and current attendance.
5. Show candidate lectures, current status, proposed change and validation warnings.
6. Coordinator approves/rejects; missing or ambiguous details require clarification.
7. Apply only approved corrections to matching lecture(s), retaining before/after values and audit details.

## Matching rules
- Match by student and date first, then subject/lecture and time.
- A specific time window must not update lectures outside that window.
- Partial overlap, multiple matches, missing student/date, or unclear evidence requires manual review.
- Duplicate letters must not apply duplicate corrections.
