---
tags:
  - route
  - backend
  - budgeting
aliases:
  - Sinking Funds Routes
file: backend/src/routes/sinkingFunds.js
type: Backend Route
---

# Sinking Funds Routes

> [!info] Future Expense Router
> The **sinkingFunds.js** route manages virtual sub-accounts for planned expenditures.

## Endpoints
1. **GET `/`**: Retrieves all sinking funds.
2. **POST `/`**: Creates a new sinking fund target.
3. **PUT `/:id`**: Updates an existing sinking fund's metadata.
4. **POST `/:id/fund`**: Accumulates cash into the fund by actively debiting a source bank account.
5. **DELETE `/:id`**: Removes a sinking fund, reversing its ledger entries if possible.
