---
tags:
  - component
  - debt
  - frontend
aliases:
  - Debt Command Center
file: frontend/src/components/DebtHub.jsx
type: React Component
---

# DebtHub

> [!info] Liability Orchestrator
> The **DebtHub** is a high-level container component acting as the unified dashboard for all liabilities (Loans, Cards, Subscriptions).

## Core Features
1. **Amortization Engine Integration**: Ingests raw loan data and payment history and feeds it into the `useAmortizationEngine` custom hook to calculate live outstanding balances.
2. **Obligation Aggregation**: Dynamically sums Credit Card debts, Amortized Loan EMIs, and Subscription burn rates into normalized `Paise` BigInt values.
3. **Tabbed Routing**: Provides a keyboard-accessible tab navigation system (`ArrowRight`, `ArrowLeft`) to switch between `Loans`, `CreditCards`, `Subscriptions`, `DebtOptimizer`, and `EMIModeler`.
