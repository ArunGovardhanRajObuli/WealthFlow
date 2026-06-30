---
tags:
  - component
  - analytics
  - frontend
aliases:
  - Robo-Advisor Engine
file: frontend/src/components/WealthAdvisor.jsx
type: React Component
---

# WealthAdvisor

> [!info] Autonomous Intelligence
> The **WealthAdvisor** component processes the entire state of the user's financial profile to generate actionable, algorithmic alerts and recommendations.

## Core Features
1. **Interest Arbitrage Detection**: Scans `bank-balances` for idle cash exceeding ₹1,00,000 while simultaneously checking `loans-list` for high-interest debt (>8%), calculating the exact mathematical arbitrage of prepayment.
2. **Sovereign Headroom Parsing**: Aggregates all `transactions` linked to PPF/SSY investments within the current fiscal year, alerting the user if they are leaving any of their Section 80C EEE limits unutilized before March 31st.
3. **Asset Class Sweeping**: Categorizes all assets across mutual funds, NPS, and stocks into an `Equity` vs `Fixed Income` vs `Sovereign` matrix to identify portfolio allocation drifts.
