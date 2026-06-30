---
tags:
  - controller
  - backend
  - analytics
aliases:
  - Tax Analytics API
file: backend/src/controllers/taxAnalyticsController.js
type: Backend Controller
---

# Tax Analytics Controller

> [!info] Capital Gains API
> The **taxAnalyticsController.js** is a clean passthrough for complex taxation reporting.

## Core Responsibilities
1. **Data Passthrough**: Exposes `getTaxHarvest` which delegates to `taxAnalyticsService.getTaxHarvest()` to return unrealized Short-Term and Long-Term capital gains data to the frontend for year-end tax loss harvesting strategies.
