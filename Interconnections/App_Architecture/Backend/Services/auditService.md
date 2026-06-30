---
tags:
  - service
  - backend
  - admin
aliases:
  - Audit Trail
file: backend/src/services/auditService.js
type: Backend Service
---

# Audit Service

> [!info] Immutable Logging
> The **auditService.js** provides a simple, transaction-safe logging mechanism to track mutations across the application.

## Core Responsibilities
1. **Transaction Safety**: Wraps the `INSERT` statement in a `nativeDb.transaction()` to ensure that if the primary ledger mutation succeeds, the audit log write is guaranteed.
2. **Action Structuring**: Serializes the `details` payload as JSON before inserting it into the `audit_logs` table, allowing complex differential states (before/after) to be stored in a single TEXT column.
