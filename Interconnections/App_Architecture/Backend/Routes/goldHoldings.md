---
tags:
  - route
  - backend
  - commodities
aliases:
  - Gold Holdings Routes
file: backend/src/routes/goldHoldings.js
type: Backend Route
---

# Gold Holdings Routes

> [!info] Commodity Tracking Router
> The **goldHoldings.js** route connects the frontend to real-time bullion pricing.

## Endpoints
1. **GET `/portfolio`**: Retrieves the entire gold portfolio, grouped and aggregated by asset type (SGBs, Physical, Digital).
2. **POST `/sync`**: An active trigger endpoint that immediately calls out to Yahoo Finance to fetch live international gold prices and INR forex rates, updating the entire inventory valuation.
3. **POST `/`**: Creates a new gold holding entry.
4. **DELETE `/:id`**: Deletes a specific gold holding.
