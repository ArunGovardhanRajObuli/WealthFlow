---
tags:
  - component
  - liability
  - frontend
aliases:
  - Liability Metrics HUD
file: frontend/src/components/loans/LoanDashboard.jsx
type: React Component
---

# LoanDashboard

> [!info] Debt Aggregation HUD
> The **LoanDashboard** component is a purely functional, stateless four-pane metrics display that summarizes the user's total liability exposure.

## Core Features
1. **BigInt Formatting**: Re-implements the standard comma separation algorithm specifically for BigInt `paise` values, ensuring absolutely no floating-point rounding errors when displaying massive mortgage balances.
2. **Color-Coded Status**: 
    - Red: Total Outstanding (The enemy)
    - Yellow: Monthly EMI Burden (Cashflow restriction)
    - Blue: Total Prepaid (Aggressive attack)
    - Green: Interest Destroyed (Wealth preserved)
