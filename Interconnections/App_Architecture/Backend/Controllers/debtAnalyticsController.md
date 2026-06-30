---
tags:
  - controller
  - backend
  - debt
  - analytics
aliases:
  - Debt Analytics API
file: backend/src/controllers/debtAnalyticsController.js
type: Backend Controller
---

# Debt Analytics Controller

> [!info] Liability Projections API
> The **debtAnalyticsController.js** serves advanced debt modeling and EMI schedule projections.

## Core Responsibilities
1. **EMI Modeler**: Exposes `getEmiModeler` which reads a `skipMonths` query parameter, ensuring it cannot be negative via `Math.max(0, skipMonths)`, allowing the frontend to dynamically preview the impact of deferring loan payments.
2. **Strategy Payload**: Serves the overarching `getDebtStrategy` which consolidates all loans and credit cards into a single actionable avalanche/snowball payoff plan.
