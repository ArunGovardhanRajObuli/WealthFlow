---
tags:
  - controller
  - backend
  - analytics
aliases:
  - Analytics API
file: backend/src/controllers/analyticsController.js
type: Backend Controller
---

# Analytics Controller

> [!info] Dashboard Analytics Layer
> The **analyticsController.js** orchestrates the high-level dashboard metrics for the frontend.

## Core Responsibilities
1. **Liquidity API**: Wraps `analyticsService.getLiquidityMetrics()` to return immediate cash on hand.
2. **Diagnostics API**: Serves up the core `getDiagnosticsMetrics()` payload which dictates the health check cards on the frontend dashboard.
3. **Emergency Adequacy**: Returns calculations representing how many months of runway the user possesses based on `getEmergencyAdequacyMetrics()`.
4. **Summary Filtering**: Extracts the `period` query parameter (e.g., `mtd` for month-to-date) and passes it to `getSummaryMetrics(period)` to filter expense vs income views over time.
