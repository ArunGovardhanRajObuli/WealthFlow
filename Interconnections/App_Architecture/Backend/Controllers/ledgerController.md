---
tags:
  - controller
  - backend
  - core
aliases:
  - Ledger API
file: backend/src/controllers/ledgerController.js
type: Backend Controller
---

# Ledger Controller

> [!info] Double Entry Query Layer
> The **ledgerController.js** acts as a read-only HTTP interface into the strict double-entry `ledger_lines` table.

## Core Responsibilities
1. **Pagination/Limiting**: Restricts raw ledger queries to a maximum of 1000 rows to prevent massive payload transmission overhead.
2. **Estate Sub-Ledgers**: Exposes `getFamilyEstateLedger` which returns fully isolated trial balances for individual family members based on their specific equity ownership across all asset classes.
3. **Reconciliation Endpoints**: Serves `getReconciliation` (standard trial balance checking total Debits == total Credits) and `getSystemReconciliation` (deep anomaly detection checking `ledger_lines` vs entity cached balances).
