---
tags:
  - route
  - backend
  - family
aliases:
  - Succession Routes
file: backend/src/routes/succession.js
type: Backend Route
---

# Succession Routes

> [!info] Estate Planning Router
> The **succession.js** route exposes endpoints for the inheritance assignment and execution engine.

## Endpoints
1. **GET `/assignable-assets`**: Retrieves a categorized list of all assets that can legally accept a nominee.
2. **GET `/succession-summary`**: Retrieves a grouped summary of assigned vs unassigned assets.
3. **POST `/nominees`**: Assigns a fractional ownership percentage of an asset to a family member.
4. **PUT `/nominees/:id`**: Updates the fractional share of an existing nominee assignment.
5. **DELETE `/nominees/:id`**: Removes a nominee assignment.
6. **POST `/execute/:memberId`**: Triggers the algorithmic liquidation of a deceased member's estate, re-routing assets across the ledger.
