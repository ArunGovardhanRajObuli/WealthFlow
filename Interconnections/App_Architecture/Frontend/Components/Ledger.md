---
tags:
  - component
  - ledger
  - frontend
aliases:
  - Global Ledger
file: frontend/src/components/Ledger.jsx
type: React Component
---

# Ledger

> [!info] Core Database Viewer
> The **Ledger** component is the central source of truth interface, displaying the raw double-entry transaction log that powers the entire application.

## Core Features
1. **CSV Export**: Contains complex logic to generate a full CSV export of the ledger, correctly parsing and injecting joint bank splits into the `Split Details` column.
2. **Modular Architecture**: Delegates rendering to `LedgerFilters`, `LedgerTable`, and `LedgerPagination` while passing state down from a unified `useLedgerState` custom hook.
3. **Data Integrity**: Uses `isTaxDeductibleTrue` utility to normalize the boolean parsing of the `tax_deductible` flag from various SQLite/JSON string representations.
