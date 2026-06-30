---
tags:
  - service
  - backend
  - analytics
aliases:
  - Cashflow Forecaster
file: backend/src/services/forecastingService.js
type: Backend Service
---

# Forecasting Service

> [!info] Future Simulator
> The **forecastingService.js** projects liquid cash runways 90 to 1825 days into the future by stepping through an array of chronological days.

## Core Responsibilities
1. **Obligation Aggregation**: Dynamically queries all active loans, insurances, and subscriptions that are not matured, computing their actual simulated balances.
2. **Tax & Burn Normalization**: Calculates average daily burn based on the last 90 days of categorized ledger expenses (excluding capital deployments), and estimates forward income tax drags to establish a true "Net Daily Burn".
3. **Chronological For-Loop**: Loops through `d = 0` to `days`, deducting daily burn, triggering monthly salary/rent injections, and mathematically triggering EMI and Subscription deductions on their precise calendar `targetDay`.
