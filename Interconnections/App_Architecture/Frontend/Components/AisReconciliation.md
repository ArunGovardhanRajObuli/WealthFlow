---
tags:
  - analytics
  - frontend
  - component
aliases:
  - AIS Checker
  - Tax Compliance Reconciler
file: frontend/src/components/AisReconciliation.jsx
type: React Component
---

# AisReconciliation

> [!info] Tax Compliance Checker
> The **AisReconciliation** component serves to compare the internal system's income ledger against the Government's Annual Information Statement (AIS) to proactively warn about tax notices.

## Core Logic
1. **Financial Year Bounds**: Automatically calculates current FY bounds (April 1st to March 31st).
2. **Ledger Aggregation**: Sums all `income` transactions natively categorizing them into:
   - Dividends
   - Interest (excluding PPF/EPF)
   - Rent
   - Salary
3. **Warning System**:
   - `match` (Green Check): AIS matches Ledger within a ₹10 tolerance.
   - `warning` (Orange): Ledger has *more* income than AIS (Safe, but implies AIS isn't updated).
   - `danger` (Red): AIS has *more* income than Ledger (High risk of an IT notice).
