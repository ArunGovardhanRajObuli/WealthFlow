---
tags:
  - service
  - backend
  - analytics
aliases:
  - Debt Modeler
file: backend/src/services/debtAnalyticsService.js
type: Backend Service
---

# Debt Analytics Service

> [!info] Prepayment Optimizer
> The **debtAnalyticsService.js** performs algorithmic projections on liabilities to suggest mathematically optimal prepayment strategies.

## Core Responsibilities
1. **Algorithmic Simulation**: Runs a while-loop (up to 600 months) that simulates compounding interest and standard EMI payments across multiple active loans simultaneously.
2. **Strategy Switching**: Capable of switching between the **Avalanche Method** (sorting by highest interest rate) and the **Snowball Method** (sorting by lowest balance) to allocate extra free cash flow.
3. **Debt Trap Detection**: Continually monitors the aggregate remaining balance. If the total debt increases month-over-month despite maximum payments (i.e. interest > total budget), it flags the scenario as an infinite debt trap.
