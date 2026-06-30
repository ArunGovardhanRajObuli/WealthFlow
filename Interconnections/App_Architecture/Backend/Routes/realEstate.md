---
tags:
  - route
  - backend
  - property
aliases:
  - Real Estate Routes
file: backend/src/routes/realEstate.js
type: Backend Route
---

# Real Estate Routes

> [!info] Illiquid Asset Router
> The **realEstate.js** route defines the CRUD endpoints for property assets.

## Endpoints
1. **GET `/`**: Retrieves all properties and the current financial year start date.
2. **POST `/`**: Creates a new property.
3. **PUT `/:id`**: Updates specific fields of a property dynamically.
4. **DELETE `/:id`**: Removes a property entry.
