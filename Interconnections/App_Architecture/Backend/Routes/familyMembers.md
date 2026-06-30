---
tags:
  - route
  - backend
  - family
aliases:
  - Family Members Routes
file: backend/src/routes/familyMembers.js
type: Backend Route
---

# Family Members Routes

> [!info] Multi-Tenant Entity Router
> The **familyMembers.js** route file manages internal application users/entities for complex estate modeling.

## Endpoints
1. **GET `/`**: Retrieves all family members.
2. **POST `/`**: Creates a new family member entity.
3. **PUT `/:id`**: Updates an existing family member's details.
4. **POST `/:id/fund`**: Triggers a specific action to fund a member's sub-ledger, usually creating a transfer transaction.
5. **DELETE `/:id`**: Removes a family member.
