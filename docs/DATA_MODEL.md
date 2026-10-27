# Prototype Data Model

## Student
`id`, `name`

## Lecture
`id`, `subject`, `className`, `date`, `startTime`, `endTime`, `studentIds[]`

## Attendance
`id`, `lectureId`, `studentId`, `status`, `submittedBy`, `submittedAt`, optional correction metadata

## Attendance Letter
`id`, `studentId`, `date`, `startTime`, `endTime`, `subject`, `reference`, `lectureId`, `validation`, `status`, `createdBy`, `reviewedBy`, timestamps

## Audit Event
`id`, `action`, `details`, `at`

The current implementation stores these in memory for demonstration. Use a database, migrations, foreign keys, retention rules, and immutable/append-only audit controls before production.
