---
tags:
  - service
  - backend
  - expense
aliases:
  - Budget Tracker
file: backend/src/services/budgetService.js
type: Backend Service
---

# Budget Service

> [!info] Limits Controller
> The **budgetService.js** handles the CRUD logic for monthly spending limits and calculates actual utilization in real-time.

## Core Responsibilities
1. **Real-time Utilization**: Dynamically calculates how much of a budget category has been spent in the current month by querying `ledger_lines` (account class `Expense` or `Revenue`) filtered by `t.date LIKE 'YYYY-MM%'`.
2. **Cascading Category Updates**: If a budget category name is changed, the service runs a cascade update on all `transactions` that historically used the old category name to prevent orphan transactions.
3. **Delete Protection**: Prevents deletion of a budget if any transactions are currently categorized under it, enforcing referential integrity manually (since category is stored as a string, not a foreign key).
