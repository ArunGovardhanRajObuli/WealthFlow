---
tags:
  - component
  - debt
  - frontend
aliases:
  - Amortization Manager
file: frontend/src/components/Loans.jsx
type: React Component
---

# Loans

> [!info] Liability Manager
> The **Loans** component manages the lifecycle of amortized debts, utilizing a local amortization engine to calculate live balances.

## Core Features
1. **Engine Integration**: Ingests `loans-list` and `loan-payments` and passes them to `useAmortizationEngine` to determine active vs defeated (paid off) loans.
2. **Refinancing Detection**: Detects if a user edits a loan's `interestRate`, `termYears`, or `principalAmount` and automatically recalculates the backend EMI using `calculateEMIBigInt` before submitting the mutation.
3. **Tabbed Views**: Organizes the UI into `LoanDashboard`, `ActiveLoans`, and `DefeatedLoans` for clean portfolio management.
