---
tags:
  - component
  - wealth
  - frontend
aliases:
  - Property Ledger
file: frontend/src/components/RealEstate.jsx
type: React Component
---

# RealEstate

> [!info] Illiquid Asset Manager
> The **RealEstate** component tracks property assets, including linked mortgages, expected rental yields, and joint ownership splits.

## Core Features
1. **Asset Lifecycles**: Creates and manages property records, supporting detailed joint-ownership splits integrated with the `FamilyEstate` module.
2. **Double-Entry Bridging**: Facilitates injecting manual appreciation/depreciation logs directly into the global Ledger using the `txMut` transaction mutation.
3. **BigInt Guardrails**: Normalizes massive illiquid valuations (`baseValue`, `currentMarketValue`, `expectedRent`) into strict `Paise` integers before saving.
