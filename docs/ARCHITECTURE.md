# Architecture

```text
Teacher / Coordinator / Student / Admin
                  |
            React Web UI
                  |
          Express REST API
       /          |           \
Attendance   Letter Matching   Audit Log
Service        & Review        Service
       \          |           /
          In-memory prototype data
                  |
     Future: database + approved SAP interface
```

## Current prototype
- `client/`: React/Vite user interface.
- `server/`: Express API and mock data.
- `docs/`: project requirements and architecture notes.

## Production direction
Confirm the institution's SAP environment, integration interface, identity provider, hosting and data governance before selecting the production persistence and integration implementation. Do not treat the demo role selector as authentication.
