---
tags:
  - component
  - wealth
  - frontend
aliases:
  - Passive Income Tracker
file: frontend/src/components/DividendTracker.jsx
type: React Component
---

# DividendTracker

> [!info] Yield Logging
> The **DividendTracker** component tracks and logs incoming passive yields, such as stock dividends or mutual fund IDCW payouts.

## Core Features
1. **Bank Ledger Sync**: When a dividend is logged, it mutates `/api/investments/:id/dividend` which posts a ledger entry depositing the amount directly into a selected Bank Balance.
2. **Joint Account Splitting**: Supports splitting a dividend payout across a primary target bank and a secondary joint bank.
3. **Cascade Invalidation**: Upon logging, aggressively invalidates `dividend-tracker`, `bank-balances`, `transactions`, and `family-estate-ledger` to ensure the entire UI stays in sync.
