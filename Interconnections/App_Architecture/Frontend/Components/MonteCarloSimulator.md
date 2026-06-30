---
tags:
  - component
  - analytics
  - frontend
aliases:
  - Retirement Stochastic Modeler
file: frontend/src/components/MonteCarloSimulator.jsx
type: React Component
---

# MonteCarloSimulator

> [!info] Stochastic Forecasting
> The **MonteCarloSimulator** uses probabilistic modeling (1,000 simulations) to determine the likelihood of reaching a target retirement corpus.

## Core Features
1. **Math Engine**: Implements the `Box-Muller transform` to generate normal distribution curves for randomized market returns based on expected volatility and inflation.
2. **Deep Wealth Integration**: Defaults the starting portfolio by aggregating every single asset (Investments, NPS, Gold, Real Estate, FDs) minus liabilities (Loans, CCs).
3. **Ito Correction**: Specifically adds half-variance (`(stdDev * stdDev) / 2`) to the arithmetic mean to ensure the geometric median matches the user's expected CAGR over long time horizons.
