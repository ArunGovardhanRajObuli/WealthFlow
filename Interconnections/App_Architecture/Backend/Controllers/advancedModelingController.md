---
tags:
  - controller
  - backend
  - modeling
aliases:
  - Advanced Modeling API
file: backend/src/controllers/advancedModelingController.js
type: Backend Controller
---

# Advanced Modeling Controller

> [!info] Modeling HTTP Layer
> The **advancedModelingController.js** is the REST API gateway for advanced financial calculations.

## Core Responsibilities
1. **Request Handoff**: Extracts standard HTTP query parameters (`req.query` for GET, `req.body` for POST) and passes them to the underlying [[advancedModelingService]].
2. **Endpoint Mapping**: Exposes explicit routes for:
   - `getHlvCalculator`: Human Life Value modeling.
   - `runStressTest`: Market crash / job loss stress testing.
   - `getInflation`: Real return mapping.
   - `getLifestyleCreep`: Expense growth modeling.
3. **Utility Passthrough**: Directly exports `getFreeCash` and `getTrueAmortizedDebt` from `analyticsUtils.js` for convenience if required by specific frontend analytics calls.
