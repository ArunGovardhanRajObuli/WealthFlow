---
tags:
  - controller
  - backend
  - family
aliases:
  - Family API
file: backend/src/controllers/familyMembersController.js
type: Backend Controller
---

# Family Members Controller

> [!info] Multi-User Management Layer
> The **familyMembersController.js** manages the HTTP logic for entity creation and their associated ring-fenced capital (endowments).

## Core Responsibilities
1. **Endowment Protection**: When creating a new family member, if the payload includes `collegeSavings` (an initial endowment), the controller explicitly mandates that a `source_bank_id` is provided. If it's missing, it blocks the request with a "Double-Entry Accounting Error", as cash cannot magically appear in an endowment without draining a bank account.
2. **Funding Handoff**: When a family member's endowment is funded via the `fund` endpoint, it calculates whether the amount is positive (capital deployment) or negative (capital retrieval) based on the string payload and passes those flags down to the `familyService`.
3. **Foreign Key Validations**: Uses standard utility checks to ensure string limits, integer parsing for ages, and standard decimal parsing for `annualIncome` and `lifeInsuranceCoverage`.
