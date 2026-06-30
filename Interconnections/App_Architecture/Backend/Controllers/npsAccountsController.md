---
tags:
  - controller
  - backend
  - retirement
aliases:
  - NPS Accounts API
file: backend/src/controllers/npsAccountsController.js
type: Backend Controller
---

# NPS Accounts Controller

> [!info] Pension HTTP Layer
> The **npsAccountsController.js** handles Tier 1/2 tracking, asset allocation definitions, and retirement projections.

## Core Responsibilities
1. **Input Normalization**: Extensively sanitizes text fields like `memberName`, `pranNumber`, and `tier` defaulting to fallback strings (e.g., 'Unknown', 'N/A', 'Tier 1') to prevent database exceptions.
2. **Asset Allocation**: Parses incoming percentage strings for `equityPct`, `corpBondPct`, and `govtSecPct` seamlessly via `validateAmount` to support the projection engine.
3. **Projection Gateway**: Exposes `getProjection(currentAge, retirementAge)`, passing the query parameters down to the `npsService.getNpsProjections()` engine to return the final projected maturity annuity and lump sum.
