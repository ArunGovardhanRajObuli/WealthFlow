---
tags:
  - component
  - ledger
  - frontend
aliases:
  - Bank Sync
file: frontend/src/components/BankReconciliation.jsx
type: React Component
---

# BankReconciliation

> [!info] Account Balances
> The **BankReconciliation** component manages external bank accounts, manual balance syncing, and reconciliation mappings.

## Core Features
1. **BigInt Math Integrity**: Integrates custom parsing logic (`parseToPaiseBigInt`, `formatAmount`) locally to prevent precision loss when dealing with multi-crore fractional balances.
2. **Family Ownership mapping**: Associates bank accounts directly with registered `family_members` via the `owner_member_id`.
3. **Cross-Invalidation**: Actions like adding or updating a bank balance force a global invalidation cascade across `['reconciliation']`, `['bank-balances']`, and potentially affecting the overall net worth calculations.
