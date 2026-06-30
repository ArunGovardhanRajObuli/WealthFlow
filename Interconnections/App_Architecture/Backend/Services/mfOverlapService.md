---
tags:
  - service
  - backend
  - analytics
aliases:
  - Overlap Scanner
file: backend/src/services/mfOverlapService.js
type: Backend Service
---

# MF Overlap Service

> [!info] Portfolio Concentration
> The **mfOverlapService.js** is a lightweight analytical tool that scans mutual fund categorizations for redundancies.

## Core Responsibilities
1. **Asset Class Grouping**: Iterates over all investments tagged as `sip` or `mutual_fund`, grouping them by their internal `assetClass` (e.g., Large Cap, Mid Cap, Flexi Cap).
2. **Redundancy Scoring**: Calculates concentration percentages per asset class. If more than 2 funds exist in the exact same asset class, it flags the portfolio with a "high severity" warning, recommending consolidation to prevent tracking the same underlying stocks.
