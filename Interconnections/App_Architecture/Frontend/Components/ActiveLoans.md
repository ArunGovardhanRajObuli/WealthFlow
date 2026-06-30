---
tags:
  - component
  - liability
  - frontend
aliases:
  - Active Liabilities
file: frontend/src/components/loans/ActiveLoans.jsx
type: React Component
---

# ActiveLoans

> [!info] Amortization Visualizer
> The **ActiveLoans** component maps over all active liability reminders, executing local amortization math to visualize the burn-down of principal.

## Core Features
1. **Dynamic Urgency Borders**: Parses the loan's `progressRatio` (derived from the engine calculation). If paid down >70%, border turns green; >30% yellow; else red, instantly signaling liability health.
2. **One-Click Prepayment**: Clicking "Pay EMI" intercepts the standard flow, pre-filling a `prepayData` payload with the exact EMI amount, allowing frictionless debt servicing that automatically hits the ledger.
3. **Analyzer Expansion**: Toggling "Analyze" opens an embedded chart component (`react-chartjs-2`), overlaying the principal vs interest curves over the remaining `termYears`.
