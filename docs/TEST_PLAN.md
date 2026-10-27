# Test Plan

- Teacher submits attendance for a valid assigned lecture.
- Submission missing one student is rejected.
- Duplicate submission for the same lecture is blocked.
- Letter with an exact lecture/date/time is queued for coordinator review.
- Letter with no exact match is flagged for clarification.
- Letter with partial time overlap cannot be approved automatically.
- Letter with multiple candidate lectures requires clarification.
- Rejected letter leaves attendance unchanged.
- Approved letter changes only the matching student/lecture.
- Audit log includes actor, action, time, and source reference.
- Production tests must additionally cover authentication, authorization, secure file upload, persistence, and SAP integration.
