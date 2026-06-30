---
tags:
  - controller
  - backend
  - commodities
aliases:
  - Gold API
file: backend/src/controllers/goldHoldingsController.js
type: Backend Controller
---

# Gold Holdings Controller

> [!info] Commodity Tracking
> The **goldHoldingsController.js** manages precious metals inventory and real-time commodity price synchronization.

## Core Responsibilities
1. **Live Price Syncing (`syncPrice`)**: Fetches international gold prices (`GC=F`) and forex rates (`INR=X`) via `yahoo-finance2`. Computes the exact INR per gram conversion and pushes this live price to `goldService.updateGoldPrice` to immediately re-evaluate the entire inventory.
2. **Split Verification**: When adding a new holding (`create`), it strictly checks if `split_amount` exceeds the total invested amount (grams * price), throwing a Double-Entry error if invalid.
3. **Asset Abstraction**: Treats Sovereign Gold Bonds (SGBs), Digital Gold, and Physical Gold interchangeably under the hood for pricing, but retains their specific types for UI rendering.
