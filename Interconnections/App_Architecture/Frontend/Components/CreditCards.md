---
tags:
  - component
  - debt
  - frontend
aliases:
  - Credit Card Tracker
file: frontend/src/components/CreditCards.jsx
type: React Component
---

# CreditCards

> [!info] Revolving Debt
> The **CreditCards** component manages the lifecycle, spending, and repayment of family credit cards.

## Core Features
1. **BigInt Accounting**: Uses `parseToPaiseBigInt` to accurately handle large credit limits and balances without floating-point errors.
2. **Ledger Integration**: Features inline forms to "Log Spend" or "Pay Bill", which internally map to mutations that insert rows into the global ledger, adjusting target bank balances.
3. **Split Transactions**: Supports attributing a partial payment amount to a joint bank account vs a personal bank account during bill payment.
