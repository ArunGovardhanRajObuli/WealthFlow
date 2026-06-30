---
tags:
  - component
  - analytics
  - frontend
aliases:
  - Payoff Strategy
file: frontend/src/components/DebtOptimizer.jsx
type: React Component
---

# DebtOptimizer

> [!info] Avalanche vs Snowball
> The **DebtOptimizer** component is an analytical engine that visually compares the math between the Avalanche (Highest Interest First) and Snowball (Smallest Balance First) debt payoff methods.

## Core Features
1. **Live Algorithmic Sorting**: Sorts active loans in real-time. `Avalanche` prioritizes `interestRate`, `Snowball` prioritizes `principalAmount`.
2. **Cost-Benefit Analysis**: Queries `/api/debt-strategy` to compute exact interest saved and months saved by choosing the mathematically optimal method.
3. **Visual Timeline**: Uses `react-chartjs-2` to plot the amortization burn-down charts of both strategies overlaid on each other to highlight the delta in timelines.
