---
tags:
  - route
  - backend
  - analytics
aliases:
  - Net Worth Routes
file: backend/src/routes/netWorth.js
type: Backend Route
---

# Net Worth Routes

> [!info] Wealth Snapshot Router
> The **netWorth.js** route handles the creation and retrieval of historical wealth aggregations.

## Endpoints
1. **GET `/`**: Retrieves the historical timeline of daily wealth snapshots for chart rendering.
2. **POST `/snapshot`**: Manually forces the backend to iterate through every single asset and liability table, calculate the real-time net worth, and inject a new row into the `net_worth_snapshots` table.
