---
tags:
  - route
  - backend
  - banking
aliases:
  - Fixed Deposits Routes
file: backend/src/routes/fixedDeposits.js
type: Backend Route
---

# Fixed Deposits Routes

> [!info] Safe Yield Router
> The **fixedDeposits.js** route exposes CRUD operations for fixed-income banking products.

## Endpoints
1. **GET `/`**: Retrieves all Fixed Deposits, dynamically calculating their maturity status.
2. **POST `/`**: Creates a new Fixed Deposit entry.
3. **DELETE `/:id`**: Removes a Fixed Deposit entry.
