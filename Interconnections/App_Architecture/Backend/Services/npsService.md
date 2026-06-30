---
tags:
  - service
  - backend
  - retirement
aliases:
  - NPS Modeler
file: backend/src/services/npsService.js
type: Backend Service
---

# NPS Service

> [!info] Pension Modeler
> The **npsService.js** handles National Pension System Tier 1/2 tracking and complex retirement projections.

## Core Responsibilities
1. **Tier Management**: Stores explicit Tier designations (Tier 1 vs Tier 2) which impacts Section 80CCD(1B) tax deduction logic downstream.
2. **Asset Allocation Projections**: Reads the user's specific asset split (Equity %, Corporate Bonds %, Govt Securities %) and applies weighted, compounded growth curves (e.g., Equity at 12%, Govt at 7%) across the remaining months until the user's specified `retirementAge`.
3. **Maturity & Annuity Limits**: Implements the 60/40 rule upon projection maturity, estimating the mandatory 40% annuity purchase and the 60% tax-free lump sum withdrawal.
