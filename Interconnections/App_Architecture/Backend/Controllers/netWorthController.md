---
tags:
  - controller
  - backend
  - analytics
aliases:
  - Net Worth API
file: backend/src/controllers/netWorthController.js
type: Backend Controller
---

# Net Worth Controller

> [!info] Historical Wealth API
> The **netWorthController.js** provides access to historical wealth tracking snapshots and allows triggering a new manual snapshot.

## Core Responsibilities
1. **Data Retrieval**: Delegates the call to `netWorthService.getNetWorthHistory()` to return the array of all historical daily snapshots for chart rendering.
2. **Triggering Snapshots**: Exposes `createSnapshot` which forces `netWorthService.createSnapshot()` to execute a live aggregation of all databases across the app, producing today's snapshot.
