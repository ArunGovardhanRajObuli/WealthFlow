---
tags:
  - component
  - root
  - frontend
aliases:
  - Asset Central Container
file: frontend/src/components/WealthHub.jsx
type: React Component
---

# WealthHub

> [!info] Unified Asset View
> The **WealthHub** component serves as the master structural root for the wealth accumulation side of the platform, aggregating net worth totals across disparate asset classes.

## Composition
It renders a tabbed navigation interface linking to:
1. `Investments` (Equities & MFs)
2. `RealEstate`
3. `GoldTracker`
4. `NPSTracker`
5. `FDLadder`
6. `SinkingFunds`

## Core Features
1. **Global AUM Aggregation**: Computes the `totalPortfolio` sum by combining live NAV API values for stocks/funds, manually appraised values for real estate, and accrued interest values for fixed deposits.
2. **Keyboard Accessibility**: Supports native arrow-key and Home/End navigation to switch between asset class tabs without clicking.
