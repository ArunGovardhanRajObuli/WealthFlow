---
tags:
  - component
  - protection
  - frontend
aliases:
  - Nominee Matrix
file: frontend/src/components/SuccessionPlanner.jsx
type: React Component
---

# SuccessionPlanner

> [!info] Legacy Matrix
> The **SuccessionPlanner** component allows users to allocate percentage-based ownership rights of their global assets to specific family members in the event of their passing.

## Core Features
1. **Asset Polymorphism**: Handles the complex `selectedAsset` state which concatenates the `assetType`, `assetId`, and `assetDescription` separated by `||` strings to allow a single `<select>` dropdown to list completely disparate tables (Bank Accounts, Property, Mutual Funds, NPS).
2. **Share Validation**: Ensures that the cumulative sum of `sharePercent` for any single asset across all assigned nominees never exceeds 100%, rejecting mutations if it does.
3. **Estate Readiness Score**: Visualizes an overall `completeness` score out of 100, color-coding the UI green, yellow, or red depending on how much of the user's total net worth has an explicit succession instruction.
