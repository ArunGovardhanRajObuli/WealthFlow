---
tags:
  - route
  - backend
  - retirement
aliases:
  - NPS Accounts Routes
file: backend/src/routes/npsAccounts.js
type: Backend Route
---

# NPS Accounts Routes

> [!info] Pension Plan Router
> The **npsAccounts.js** route manages Tier 1/2 government pension portfolios and asset allocations.

## Endpoints
1. **GET `/`**: Retrieves all tracked NPS accounts, calculating current values based on underlying equity/bond allocations.
2. **POST `/`**: Creates a new NPS account.
3. **PUT `/:id`**: Updates contributions or allocation percentages.
4. **DELETE `/:id`**: Removes an NPS account.
