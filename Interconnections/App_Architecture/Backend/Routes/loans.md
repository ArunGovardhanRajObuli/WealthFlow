---
tags:
  - route
  - backend
  - debt
aliases:
  - Loans Routes
file: backend/src/routes/loans.js
type: Backend Route
---

# Loans Routes

> [!info] Debt Amortization Router
> The **loans.js** route connects the frontend to the liability restructuring and EMI payment engine.

## Endpoints
1. **GET `/query`**: Raw fast-path query grabbing loan data directly from the `reminders` table where `category='loan'`.
2. **POST `/:id/refinance`**: Adjusts the `interestRate` and `termYears` of an active loan.
3. **POST `/:id/payments`**: Logs an EMI payment, requiring a valid source bank account to decrement liquid assets while reducing the liability.
4. **POST `/:id/restructure`**: Processes bullet payments or EMI holidays.
