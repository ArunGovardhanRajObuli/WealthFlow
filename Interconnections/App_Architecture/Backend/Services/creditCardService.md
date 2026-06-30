---
tags:
  - service
  - backend
  - debt
aliases:
  - CC Manager
file: backend/src/services/creditCardService.js
type: Backend Service
---

# Credit Card Service

> [!info] Unsecured Debt
> The **creditCardService.js** orchestrates the complex lifecycle of 30-day rolling credit debt and its ledger synchronization.

## Core Responsibilities
1. **Opening Balance Synchronization**: When a card is created with pre-existing debt, it automatically generates an `opening_balance` transaction and runs `syncAssetBalances` to instantly reflect the debt on the `Liability` ledger.
2. **Mutation Drift Correction**: If the user edits the card's current balance, the service calculates the `diffPaise`. If the difference is valid, it automatically mutates the underlying `opening_balance` ledger lines so the ledger stays perfectly in sync with the user's manual override.
3. **Orphan Repayment Handling**: When a card is deleted, any past `cc_repayment` transactions meant for this card are re-categorized to `uncategorized` with a suffix `(Deleted CC)` appended to their title to preserve historical cash outflow while removing the constraint.
