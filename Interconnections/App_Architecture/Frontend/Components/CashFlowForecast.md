---
tags:
  - component
  - analytics
  - frontend
aliases:
  - Cash Flow Radar
file: frontend/src/components/CashFlowForecast.jsx
type: React Component
---

# CashFlowForecast

> [!info] Predictive Liquidity
> The **CashFlowForecast** component generates a predictive line-graph projecting future bank balances based on upcoming reminders, subscriptions, and SIPs.

## Core Features
1. **Chart.js Integration**: Uses `react-chartjs-2` to render an area chart visualizing the balance over a 30, 60, or 90-day time horizon.
2. **Crisis Detection**: Dynamically styles the graph red if a `crisisDate` is detected by the backend (meaning balance dips below zero), providing visual warning of impending liquidity crunches.
3. **Data Sampling**: Reduces client rendering load by sampling timeline data points (`i % 7 === 0`) to plot weekly intervals instead of daily.
