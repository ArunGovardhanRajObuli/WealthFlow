---
tags:
  - service
  - backend
  - analytics
aliases:
  - Analytics Engine
file: backend/src/services/analyticsService.js
type: Backend Service
---

# Analytics Service

> [!info] Aggregation Hub
> The **analyticsService.js** aggregates raw ledger data into high-level metrics for the WealthHub, Diagnostics, and Tax boundaries.

## Core Responsibilities
1. **Liquidity Metrics**: Executes complex `CASE WHEN` SQL aggregations against `ledger_lines` to compute free liquidity, operating income vs expenses, and total AUM across real estate, gold, NPS, and FDs.
2. **Diagnostics Engine**: Constantly checks the user's cashflow against recurring obligations (loans, subscriptions, insurance). If total monthly obligations exceed monthly income, it triggers a "structural deficit" alert.
3. **Data Sanitization**: Relies on utility helpers like `getTrueAmortizedDebt` and `getFreeCash` to decouple business logic from raw SQL querying, ensuring standard metric definitions are respected.
