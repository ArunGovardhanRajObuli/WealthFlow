---
tags:
  - component
  - wealth
  - frontend
aliases:
  - Temporal Wealth Categorization
file: frontend/src/components/BucketStrategy.jsx
type: React Component
---

# BucketStrategy

> [!info] Liquidity Planning
> The **BucketStrategy** component categorizes the entire family net worth into three distinct temporal buckets: Short Term (Liquidity), Medium Term (Preservation), and Long Term (Growth).

## Core Features
1. **Deep Aggregation**: Similarly to `AssetCategories`, it aggressively queries all wealth endpoints (`reconciliation`, `investments`, `nps`, `gold`, `real-estate`, `sinking-funds`, `fd-ladder`).
2. **Hardcoded Bucket Logic**:
   - **Short Term**: Bank Free Cash, FDs, Liquid/Cash MFs.
   - **Medium Term**: Debt MFs, Sinking Funds.
   - **Long Term**: Equity, NPS, Gold, Real Estate.
3. **Dynamic Computation**: Automatically recalculates the % allocation per bucket to visually ensure the user isn't over-leveraged in illiquid assets.
