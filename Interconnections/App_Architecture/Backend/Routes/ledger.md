---
tags:
  - route
  - backend
  - core
aliases:
  - Ledger Routes
file: backend/src/routes/ledger.js
type: Backend Route
---

# Ledger Routes

> [!info] Double Entry Query Router
> The **ledger.js** route strictly exposes read-only endpoints for the immutable double-entry ledger system.

## Endpoints
1. **GET `/ledger-lines`**: Retrieves paginated raw double-entry accounting lines.
2. **GET `/family-estate-ledger`**: Retrieves a filtered trial balance calculated precisely for a specific family member based on fractional ownership.
3. **GET `/reconciliation`**: Executes a standard Trial Balance check (Total Debits must equal Total Credits) across the entire system.
4. **GET `/system/reconciliation`**: Deep anomaly check comparing the calculated ledger sum for an entity against that entity's cached `currentValue` in the database.
