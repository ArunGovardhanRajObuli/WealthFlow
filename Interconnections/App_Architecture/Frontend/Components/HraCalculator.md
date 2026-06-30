---
tags:
  - component
  - tax
  - frontend
aliases:
  - Rent Exemption
file: frontend/src/components/HraCalculator.jsx
type: React Component
---

# HraCalculator

> [!info] Tax Optimization
> The **HraCalculator** computes the maximum allowable tax exemption under Section 10(13A) of the Income Tax Act for House Rent Allowance.

## Core Features
1. **Rule Engine**: Evaluates the minimum of: Actual HRA, 50%/40% of Basic+DA, or Rent paid - 10% of Basic+DA.
2. **Regime Override**: Instantly zeroes out the exemption if the user selects the "New Tax Regime" (Section 115BAC restriction).
3. **Client-Side Compute**: Performs all calculations strictly in the browser without backend API calls, providing immediate feedback.
