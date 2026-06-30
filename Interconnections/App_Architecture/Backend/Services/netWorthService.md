---
tags:
  - service
  - backend
  - analytics
aliases:
  - Net Worth Snapshots
file: backend/src/services/netWorthService.js
type: Backend Service
---

# Net Worth Service

> [!info] Historical Tracking
> The **netWorthService.js** takes point-in-time snapshots of the entire application state to build historical wealth charts.

## Core Responsibilities
1. **Global Aggregation**: Fires parallel aggregation queries against free cash, sinking funds, endowments, real estate, gold, FDs, and NPS to sum total `assets`.
2. **Liability Deduction**: Sums credit card ledger balances and true amortized loan principals to calculate total `liabilities`.
3. **Idempotent Insertion**: Uses the current `YYYY-MM-DD` as a unique constraint. If a snapshot already exists for today, it performs an `UPDATE` rather than an `INSERT`, allowing the snapshot to be run continuously without bloating the database.
