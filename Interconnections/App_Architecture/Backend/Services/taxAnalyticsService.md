---
tags:
  - service
  - backend
  - taxation
aliases:
  - Tax Harvester
file: backend/src/services/taxAnalyticsService.js
type: Backend Service
---

# Tax Analytics Service

> [!info] Schedule 112A
> The **taxAnalyticsService.js** calculates realized and unrealized capital gains for tax planning purposes.

## Core Responsibilities
1. **Realized Harvesting**: Scans the ledger for all booked transactions tagged as `realized_stcg`, `realized_ltcg`, `realized_stcl`, and `realized_ltcl` to sum up the current financial year's exact realized tax burden.
2. **Unrealized Planning (112A)**: Evaluates all open `investment_lots`. It maps current live NAVs against the historical `costBasis` and calculates holding periods on a FIFO basis to project potential STCG/LTCG exposure if the user were to liquidate today.
