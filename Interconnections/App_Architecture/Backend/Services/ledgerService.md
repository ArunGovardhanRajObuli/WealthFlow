---
tags:
  - service
  - backend
  - core
aliases:
  - Double Entry Engine
file: backend/src/services/ledgerService.js
type: Backend Service
---

# Ledger Service

> [!info] Core Accounting
> The **ledgerService.js** is the absolute foundational pillar of the backend, enforcing strict double-entry accounting rules across all tables.

## Core Responsibilities
1. **Transaction Router (`determineTargetAccount`)**: A massive mapping engine that looks at a transaction's category (e.g., `loan_payment`, `salary`, `sinking_fund`) and deterministically assigns the correct `account_class` (Asset, Liability, Equity, Revenue, Expense) and `account_type`.
2. **Ledger Line Generation (`insertLedgerLines`)**: Whenever a transaction is created, this function generates the mirrored double-entry rows (the Debit line and the Credit line) inside `ledger_lines`.
3. **Asset Balance Synchronization (`syncAssetBalances`)**: The single most critical function. It compares an old transaction object with a new transaction object, calculates the delta in pure integer paise, and fires `executeBigIntUpdate` to directly patch the cached balance columns (`currentAmount`, `principal`, `currentValue`) in the underlying entity tables (e.g., `investments`, `loans`, `nps_accounts`), ensuring instantaneous UI updates without heavy recalculations.
