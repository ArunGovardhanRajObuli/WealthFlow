---
tags:
  - controller
  - backend
  - analytics
aliases:
  - Cashflow Forecast API
file: backend/src/controllers/forecastingController.js
type: Backend Controller
---

# Forecasting Controller

> [!info] Future Simulation
> The **forecastingController.js** exposes the unified cash flow projection engine.

## Core Responsibilities
1. **Day Bounding**: Parses the `days` query parameter, enforcing a strict boundary via `Math.max(1, Math.min(..., 3650))` to ensure the forecasting engine doesn't attempt to simulate more than exactly 10 years into the future, preventing denial-of-service via massive loop iteration.
2. **Handoff**: Passes the bounded days parameter down to `forecastingService.getForecast(days)` to retrieve the unified event timeline.
