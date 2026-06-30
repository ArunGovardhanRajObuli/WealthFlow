---
tags:
  - component
  - analytics
  - frontend
aliases:
  - Actuarial Life Value
file: frontend/src/components/HLVCalculator.jsx
type: React Component
---

# HLVCalculator

> [!info] Protection Requirement
> The **HLVCalculator** (Human Life Value) computes the exact insurance coverage required to replace the primary earner's economic value using actuarial math.

## Core Features
1. **Dynamic Inputs**: Sliders for `workingYears` and `discountRate` which update state natively in the client.
2. **Debounced Fetching**: Uses a 300ms debounce before triggering the `/api/hlv-calculator` endpoint to prevent network spam while sliding.
3. **Coverage Gap Visualization**: Compares the required HLV against actual `existingCoverage` (pulled automatically from the user's Insurance ledger) to visualize the `coverageGap`.
