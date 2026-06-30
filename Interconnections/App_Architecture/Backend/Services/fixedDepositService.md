---
tags:
  - service
  - backend
  - treasury
aliases:
  - Fixed Deposit Modeler
file: backend/src/services/fixedDepositService.js
type: Backend Service
---

# Fixed Deposit Service

> [!info] Treasury Management
> The **fixedDepositService.js** handles Fixed Deposit lifecycle, compounding interest projection, and Ledger synchronization.

## Core Responsibilities
1. **Maturity Projection**: Calculates the `computedMaturityAmount` on creation using quarterly compounding (`periods = 4`) to project exact yields at maturity.
2. **Ledger Integrity Check**: Blocks deletion if the FD has been actively tracked or mutated via transactions, requiring the user to zero out the ledger footprint before deleting the underlying asset.
3. **Historical Splice**: Safely bypasses `capital_deployment` logic if `isHistorical` is checked, inserting an `opening_balance` to seed the ledger without penalizing current liquid cash.
