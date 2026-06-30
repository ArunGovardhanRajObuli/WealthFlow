---
tags:
  - component
  - security
  - frontend
aliases:
  - Immutable Logs
file: frontend/src/components/AuditTrail.jsx
type: React Component
---

# AuditTrail

> [!info] Immutable Traceability
> The **AuditTrail** component renders a read-only table displaying the system's modification logs.

## Core Features
1. **API Integration**: Fetches logs from `/api/audit-logs` mapping timestamps, actions, entities, and JSON details.
2. **Visual Tagging**: Automatically color-codes actions (`IMPORT`, `CREATE`, `UPDATE`, `DELETE`) for rapid visual scanning of destructive actions.
3. **Empty States**: Renders clean placeholder states when no logs exist or data is loading.
