---
tags:
  - route
  - backend
  - core
aliases:
  - Settings Routes
file: backend/src/routes/settings.js
type: Backend Route
---

# Settings Routes

> [!info] Configuration & Factory Reset Router
> The **settings.js** route handles system-wide preferences and the critical data wipe action.

## Endpoints
1. **GET `/`**: Retrieves all key-value settings.
2. **POST `/`**: Upserts multiple settings into the `app_settings` table.
3. **POST `/wipe`**: Executes the highly destructive, atomic system reset transaction that purges all financial data from the SQL database.
