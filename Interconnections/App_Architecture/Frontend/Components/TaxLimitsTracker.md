---
tags:
  - component
  - tax
  - frontend
aliases:
  - 80C Exhaustion
file: frontend/src/components/TaxLimitsTracker.jsx
type: React Component
---

# TaxLimitsTracker

> [!info] Chapter VI-A Dashboard
> The **TaxLimitsTracker** mathematically parses the entire transaction ledger to estimate how much of the user's allowed tax exemptions under the old regime (80C, 80D, etc.) have been exhausted.

## Core Features
1. **Deduction Engine**: Filters purely by `type === 'expense'` and specific categories or Title regex (e.g. `title.includes('term')`) to guess which Section (80C, 24B, 80D) the transaction belongs to.
2. **Cascading Overflows**: Specifically handles Section 80CCD(1B) by capping NPS at ₹50,000 and automatically flowing any excess contribution directly back into the Section 80C bucket.
3. **Age-Based Adjustments**: Checks `userAge >= 60` to automatically swap the interest deduction from Section 80TTA (Savings only) to Section 80TTB (Savings + FD).
