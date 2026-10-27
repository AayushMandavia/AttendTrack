# Regular Lecture Attendance Workflow

1. Teacher signs in.
2. Teacher selects an assigned lecture with subject, date and time.
3. System loads the enrolled roster.
4. Teacher marks every student Present or Absent.
5. Teacher reviews the entries.
6. System validates roster completeness and prevents duplicate submission.
7. System saves one result per student for the lecture and records an audit event.

## Acceptance checks
- The selected lecture is shown with its exact date/time.
- Only enrolled students are accepted.
- Every enrolled student has one valid status.
- Duplicate submission is blocked.
- Submission actor and timestamp are stored.
