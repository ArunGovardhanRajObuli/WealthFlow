---
tags:
  - service
  - backend
  - investment
aliases:
  - Gold Service
file: backend/src/services/goldService.js
type: Backend Service
---

# Gold Service

> [!info] Physical & Digital Gold
> The **goldService.js** handles the highly specific math associated with grams, milligrams, physical purchases, and Sovereign Gold Bonds (SGB).

## Core Responsibilities
1. **Milligram Precision Arithmetic**: Normalizes gold weight into milligrams (`weightGrams * 1000`) and uses `BigInt` parsing to prevent floating-point catastrophic cancellation when multiplying fractional grams with current market prices.
2. **SGB Accrued Interest**: For Sovereign Gold Bonds, it calculates accrued interest (`sgbInterestAccruedNum`) based on the days held since purchase, capping the interest accrual if the bond has already reached `maturityDate`.
3. **Yield Calculation**: Returns aggregated portfolio metrics including total weight, blended invested value, unrealized gain, and weighted return percentages.
