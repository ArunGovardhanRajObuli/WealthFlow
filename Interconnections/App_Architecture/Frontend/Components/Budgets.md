---
tags:
  - component
  - budgeting
  - frontend
aliases:
  - Envelope System
file: frontend/src/components/Budgets.jsx
type: React Component
---

# Budgets

> [!info] Envelope Budgeting
> The **Budgets** component implements a zero-based envelope budgeting system for tracking category limits against actual monthly spend.

## Core Features
1. **BigInt Conversions**: Relies on `parseToPaiseBigInt` and `formatBigIntToDecimalString` when sending budget limits to the backend to ensure data integrity.
2. **API Interaction**: Mutates `/api/budgets` to add or update budget category constraints.
3. **Query Invalidation**: Automatically invalidates the `['budgets']` TanStack query on save, forcing dependent UI metrics to instantly update.
