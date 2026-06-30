---
tags:
  - controller
  - backend
  - audit
aliases:
  - Audit API
file: backend/src/controllers/auditController.js
type: Backend Controller
---

# Audit Controller

> [!info] Activity Logging
> The **auditController.js** validates and processes user activity logs before writing them to the database.

## Core Responsibilities
1. **Input Sanitization**: Strictly validates `action` and `entity` fields using regex (`/^[a-zA-Z0-9_\- ]{2,50}$/`) to ensure no malicious injection occurs in the system logs.
2. **Foreign Key Validation**: Uses `validateFk()` on the incoming `entity_id` to ensure standard integer formatting.
3. **Delegation**: Pushes the cleaned data down to `auditService.createAuditLog()` and returns a simple `{ success: true }` upon completion.
