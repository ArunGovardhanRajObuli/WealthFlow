---
tags:
  - component
  - wealth
  - frontend
aliases:
  - Precious Metals Portfolio
file: frontend/src/components/GoldTracker.jsx
type: React Component
---

# GoldTracker

> [!info] Sovereign Wealth
> The **GoldTracker** component manages physical gold, digital gold, and Sovereign Gold Bonds (SGBs).

## Core Features
1. **API Sync**: Features a manual Sync button mutating `/api/gold-holdings/sync` which fetches live gold prices to calculate current market values of the stored grams.
2. **SGB Yields**: Specifically handles `SGB` types by defaulting to a 2.5% yield and capturing maturity dates, unlike physical gold which yields 0%.
3. **Estate Ledger Hooks**: Fully integrated into the global state map, triggering invalidations of `bank-balances` and `family-estate-ledger` upon any purchase or sale.
