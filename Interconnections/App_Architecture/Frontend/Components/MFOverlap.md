---
tags:
  - component
  - analytics
  - frontend
aliases:
  - Mutual Fund Intersection
file: frontend/src/components/MFOverlap.jsx
type: React Component
---

# MFOverlap

> [!info] Portfolio Redundancy
> The **MFOverlap** component analyzes the mutual fund/SIP portfolio to detect instances where multiple funds invest heavily in the same underlying asset class or sector.

## Core Features
1. **Severity Classification**: Displays a color-coded status (`Clean`, `Moderate`, `High`) based on the computed overlap concentration.
2. **Actionable Alerts**: Automatically provides a textual `recommendation` warning the user against redundant fees if concentration exceeds 40% in a single class.
3. **Visual Breakdown**: Groups overlapping funds by `assetClass` and highlights the specific concentration percentages.
