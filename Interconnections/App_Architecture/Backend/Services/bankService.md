---
tags:
  - service
  - backend
  - core
aliases:
  - Bank Accounts
file: backend/src/services/bankService.js
type: Backend Service
---

# Bank Service

> [!info] Account Management
> The **bankService.js** manages the CRUD operations for actual physical bank accounts and digital wallets.

## Core Responsibilities
1. **Balance Reconciliation**: Overlays the user's hardcoded "Snapshot Balance" with the dynamic "Ledger Balance" by executing a real-time `SUM(debit - credit)` query against the `ledger_lines` table.
2. **Cascading Deletes**: When a bank account is deleted, it manually sweeps and deletes any auto-generated "Opening Balance" transactions associated with that account.
3. **Integrity Locks**: Explicitly blocks deletion (`throw new Error`) if the bank account is linked to any active historical transaction, preventing double-entry ledger corruption.
