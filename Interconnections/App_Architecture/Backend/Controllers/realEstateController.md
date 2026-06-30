---
tags:
  - controller
  - backend
  - property
aliases:
  - Real Estate API
file: backend/src/controllers/realEstateController.js
type: Backend Controller
---

# Real Estate Controller

> [!info] Property Management HTTP Layer
> The **realEstateController.js** orchestrates illiquid physical assets and dynamically links them to amortizing loans.

## Core Responsibilities
1. **Occupancy Status Shielding**: Validates incoming `occupancyStatus` explicitly against an allowlist (`['rented', 'self-occupied', 'vacant', 'commercial']`), forcing a fallback to `self-occupied` if an anomaly is detected.
2. **Double-Entry Enforcement**: During property creation (`create`), if a non-zero `baseValue` is passed, it rigorously demands a valid `source_bank_id` (unless `isHistorical` is checked). This prevents users from artificially generating property wealth without showing the cash outflow in the ledger.
3. **Dynamic Updates**: Processes partial `PATCH/PUT` update requests dynamically, pushing only the supplied fields into an SQL parameterized updates array before handing off to `realEstateService.updateRealEstate`.
