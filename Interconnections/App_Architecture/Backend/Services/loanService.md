---
tags:
  - service
  - backend
  - debt
aliases:
  - Loan Modeler
file: backend/src/services/loanService.js
type: Backend Service
---

# Loan Service

> [!info] Debt Management
> The **loanService.js** manages complex amortizing debt, refinancing, and dynamic interest accruals.

## Core Responsibilities
1. **Dynamic Interest Accrual**: When `recordPayment` is called, it checks the days elapsed since the *last* payment, queries the exact live `principal_bal` from the ledger, and dynamically calculates and injects an exact `loan_interest_accrual` transaction before applying the remaining payment to principal.
2. **EMI Restructuring**: Executes `restructureLoan` which allows skipping months, applying bullet payments, or recalibrating EMIs entirely, altering the forward-looking amortization schedule.
3. **Maturity Auto-Advancement**: If a payment covers at least 90% of the required EMI, it automatically advances the `dueDate` in the `reminders` table by one month, effectively acting as an automated debt collector tracker.
