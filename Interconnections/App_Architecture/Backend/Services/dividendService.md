---
tags:
  - service
  - backend
  - investment
aliases:
  - Dividend Service
file: backend/src/services/dividendService.js
type: Backend Service
---

# Dividend Service

> [!info] Passive Income
> The **dividendService.js** calculates passive income yields across active investments.

## Core Responsibilities
1. **Yield Calculation**: Iterates over all equity investments (excluding EPF/PPF) and multiplies the current market value by the declared dividend yield percentage to project annual passive income.
2. **Weighted ROI**: Computes a total weighted yield across the entire dividend-paying portfolio to provide a blended metric of income generation.
3. **Historical Splicing**: Fetches the last 10 realized `dividend` transactions from the ledger to provide historical context alongside forward-looking projections.
