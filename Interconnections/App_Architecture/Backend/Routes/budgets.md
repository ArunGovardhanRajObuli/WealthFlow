---
tags:
  - route
  - backend
  - budgeting
aliases:
  - Budgets Routes
file: backend/src/routes/budgets.js
type: Backend Route
---

# Budgets Routes

> [!info] Expenditure Limit Router
> The **budgets.js** route defines the standard CRUD interface for the strict 50-30-20 (or custom) monthly budgeting system.

## Endpoints
1. **GET `/`**: Retrieves all active budgets and their current utilization statuses.
2. **POST `/`**: Creates a new budgetary limit for a specific category.
3. **PUT `/:id`**: Updates an existing budget's target amount or associated category.
4. **DELETE `/:id`**: Removes a budget.

The logic is immediately passed to `budgetsController.js` to ensure inputs are sanitized.
