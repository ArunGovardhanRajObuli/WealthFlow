---
tags:
  - controller
  - backend
  - equity
aliases:
  - Investments API
file: backend/src/controllers/investmentsController.js
type: Backend Controller
---

# Investments Controller

> [!info] Equity and Debt Funds HTTP Layer
> The **investmentsController.js** is one of the most complex controllers, handling live pricing, strict ledger routing, and FIFO liquidations.

## Core Responsibilities
1. **Auto-Categorization**: Forcefully intercepts `sip` or `lumpsum` categories. If the title contains words like "liquid", "debt", or "gilt", it forces the `assetClass` to `debt`, which is critical for downstream capital gains taxation logic.
2. **Live NAV Initialization**: If a `schemeCode` is provided during creation, it calls `yahooFinance.quote()` to fetch the absolute latest price before calculating `totalUnits`, ensuring the initial lot has perfect cost basis data.
3. **Liquidation Blocking**: If a user attempts to retrieve capital via the `/fund` endpoint using a negative number, it blocks the request, explicitly stating that: "Capital retrieval must be executed via the /sell endpoint to preserve FIFO tax lots."
4. **Sell Routing**: Exposes the `/sell` endpoint which processes exact unit liquidations via `investmentService.sellInvestment`, cleanly splitting realized capital gains back into the ledger.
