---
tags:
  - service
  - backend
  - investment
aliases:
  - Equity & MF Modeler
file: backend/src/services/investmentService.js
type: Backend Service
---

# Investment Service

> [!info] Equity Engine
> The **investmentService.js** handles mutual funds, SIPs, ELSS, direct equity, and EPF/PPF with integrated FIFO lot accounting.

## Core Responsibilities
1. **FIFO Lot Engine**: On every purchase (SIP or lump sum), inserts an `investment_lots` row to track distinct tranches of units and their specific purchase price, essential for accurate Long Term vs Short Term Capital Gains tracking.
2. **Tax Deductible Routing**: Automatically flags `isTaxDeductible = 1` for transactions where the category or title implies an ELSS, EPF, or PPF investment, directly feeding into the `TaxLimitsTracker`.
3. **Selling & Capital Retrieval**: Executes complex `sellInvestment` logic that pops units off the oldest FIFO lots, calculates exact `realizedGain` (distinguishing between short term and long term via `isLongTermUtils`), and splits the transaction into a `capital_retrieval` base and a `capital_gains_realized` (or loss) ledger line.
