---
tags:
  - component
  - wealth
  - frontend
aliases:
  - Wealth Categorization
file: frontend/src/components/AssetCategories.jsx
type: React Component
---

# AssetCategories

> [!info] Wealth Aggregator
> The **AssetCategories** component acts as a high-level aggregator, fetching from multiple disparate API endpoints to build a holistic categorized view of net worth.

## Core Features
1. **Multi-Source Fetching**: Concurrently queries `reconciliation`, `investments`, `sinking-funds`, `nps-projection`, `gold-portfolio`, `fixed-deposits`, and `real-estate`.
2. **Liquid vs Illiquid Equity**: Natively traverses the `investments` array to separate Liquid Equities from Illiquid Equities (identifying 'PPF' and 'EPF' categories and lock-ins).
3. **Big-Picture Rendering**: Outputs a grid of categorized wealth summing up to the total mapped wealth, ignoring zero-value categories automatically.
