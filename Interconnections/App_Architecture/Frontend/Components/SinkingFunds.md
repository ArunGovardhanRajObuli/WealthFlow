---
tags:
  - component
  - planning
  - frontend
aliases:
  - Goal Tracker
file: frontend/src/components/SinkingFunds.jsx
type: React Component
---

# SinkingFunds

> [!info] Goal Management
> The **SinkingFunds** component tracks targeted savings goals (e.g., vacations, large purchases) separate from the general budget.

## Core Features
1. **Double-Entry Funding**: Adding funds to a sinking fund goal uses `fundMut` which simultaneously credits the sinking fund and debits the selected `sourceBankId` in the global ledger.
2. **Target Tracking**: Calculates visual progress bars mapping `currentAmount` against `targetAmount`, converting all inputs via `parseToPaiseBigInt` for precision.
3. **Ledger Safeguards**: Deleting a sinking fund issues a confirmation warning that the underlying capital simply remains aggregated in the ledger, without explicitly refunding to a specific bank.
