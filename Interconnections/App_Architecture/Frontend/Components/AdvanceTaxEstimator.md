---
tags:
  - component
  - tax
  - frontend
aliases:
  - Tax Deadline Tracker
file: frontend/src/components/AdvanceTaxEstimator.jsx
type: React Component
---

# AdvanceTaxEstimator

> [!info] Tax Compliance
> The **AdvanceTaxEstimator** computes quarterly Advance Tax payment deadlines and liabilities under Indian Tax law.

## Core Features
1. **Rule Engine**: Hardcoded Section 288B (rounding to nearest 10), Section 207 (senior citizen exemption without business income), and Section 44AD/44ADA (single presumptive installment on 15 Mar).
2. **Dynamic UI**: Visually highlights red if advance tax is due (`liability >= 10000`).
3. **Form Controls**: Checkboxes for Resident status, Senior Citizen override, and Business Income override to handle complex edge cases dynamically.
