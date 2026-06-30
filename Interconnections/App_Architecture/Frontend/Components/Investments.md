---
tags:
  - component
  - root
  - frontend
aliases:
  - Investment Engine Root
file: frontend/src/components/Investments.jsx
type: React Component
---

# Investments

> [!info] Portfolio Container
> The **Investments** component acts as a lightweight structural root to host the sub-modules related to market-linked assets.

## Composition
It renders three distinct sub-components in a column:
1. `SipPortfolio`
2. `DirectEquity`
3. `SovereignVault`

It also manages the page-level navigation `ArrowLeft` to return to the main dashboard.
