---
tags:
  - route
  - backend
  - security
aliases:
  - Audit Routes
file: backend/src/routes/audit.js
type: Backend Route
---

# Audit Routes

> [!info] Immutable Logging Router
> The **audit.js** route file exposes endpoints for retrieving and creating immutable audit trail entries.

## Endpoints
1. **GET `/audit-logs`**: Retrieves paginated audit logs for the frontend table.
2. **POST `/audit-logs`**: Allows the frontend to manually submit critical user actions to the audit log (e.g., failed logins, configuration changes).

## Security Measures
- **Rate Limiting**: Employs `express-rate-limit` explicitly on the `POST` route (`auditLimiter`), capping log creation at 100 requests per 15-minute window to prevent malicious actors from flooding the database and exhausting disk space.
