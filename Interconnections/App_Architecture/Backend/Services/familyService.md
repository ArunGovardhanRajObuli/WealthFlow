---
tags:
  - service
  - backend
  - polymorphic
aliases:
  - Family Member Service
file: backend/src/services/familyService.js
type: Backend Service
---

# Family Service

> [!info] Polymorphic Ownership
> The **familyService.js** handles the core profiles for the users (Providers, Partners, Children, Dependents) and orchestrates endowment funding logic.

## Core Responsibilities
1. **Dynamic HLV Coverage Integration**: Rather than storing static life insurance coverage, it dynamically sweeps the `reminders` table for active life insurance policies owned by the family member (`owner_member_id = fm.id`), excluding expired policies, and aggregates the true active coverage limit.
2. **Endowment Logic**: Manages `capital_deployment` and `capital_retrieval` transactions for college savings and endowments attached to dependents.
3. **Lexical Coverage Evaporation Fix**: Implements robust string matching (`%life%`, `%ulip%`, `term`) to dynamically detect life insurance policies that should contribute to the coverage metric, bypassing brittle exact-match dropdowns.
