---
tags:
  - component
  - debt
  - frontend
aliases:
  - EMI Restructuring
file: frontend/src/components/EMIModeler.jsx
type: React Component
---

# EMIModeler

> [!info] Scenario Modeling
> The **EMIModeler** component calculates the exact financial impact of pausing loan payments (EMI skips) or restructuring debt.

## Core Features
1. **Interactive Timeline**: Allows the user to select 1-12 months to skip and immediately fetches `/api/emi-modeler?skipMonths=X` to project the capitalized interest burden.
2. **Restructure Execution**: Provides a UI to permanently restructure a loan on the backend by extending the tenure or increasing the EMI size, mutating `/api/loans/:id/restructure`.
3. **Optimistic Updates**: Uses `keepPreviousData` in TanStack Query to prevent UI flickering while the backend recalculates complex amortization tables during slider adjustments.
