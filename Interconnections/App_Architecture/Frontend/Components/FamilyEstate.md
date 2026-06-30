---
tags:
  - component
  - wealth
  - frontend
aliases:
  - Family Member Hierarchy
file: frontend/src/components/FamilyEstate.jsx
type: React Component
---

# FamilyEstate

> [!info] Entity Management
> The **FamilyEstate** component acts as the foundational entity registry for the application, defining the members of the family (Providers, Dependents) to which all assets and liabilities are mapped.

## Core Features
1. **Ownership Splitting**: Displays a ledger table calculating exact individual net worth by dynamically dividing joint assets (like properties or joint bank accounts) according to predefined `owner_split_percent`.
2. **Member Lifecycle**: Allows CRUD operations on family members via `/api/family-members`, requiring fields like age and role which power downstream algorithms like `TaxVault` and `SuccessionPlanner`.
3. **Ledger Invalidation**: Heavily tied to `['family-estate-ledger']`, ensuring that if a member is added or their role changes, the global estate view recalculates immediately.
