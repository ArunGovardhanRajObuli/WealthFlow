---
tags:
  - controller
  - backend
  - banking
aliases:
  - FDs API
file: backend/src/controllers/fixedDepositsController.js
type: Backend Controller
---

# Fixed Deposits Controller

> [!info] Safe Yield HTTP Layer
> The **fixedDepositsController.js** handles HTTP requests regarding fixed-income certificates, calculating maturity states on the fly.

## Core Responsibilities
1. **Dynamic Maturity Calculation**: When `getAll` is called, it iterates through all FDs, calculates elapsed time, projects the exact maturity date based on `tenureMonths`, and flags them dynamically as `active`, `maturing_quarter`, `maturing_soon` (<= 30 days), or `matured`.
2. **Liquidity Gap Analysis**: Computes `liquidityGaps`, mapping out the next 24 rolling months to determine which future months lack a maturing FD, enabling the frontend to suggest FD laddering strategies.
3. **Interest Accrual Wrapping**: Catches calls to `accrueInterest` and routes them securely to the underlying `fixedDepositService` to book non-cash interest transactions to the ledger.
