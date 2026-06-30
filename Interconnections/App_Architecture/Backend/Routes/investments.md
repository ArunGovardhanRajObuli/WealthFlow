---
tags:
  - route
  - backend
  - equity
aliases:
  - Investments Routes
file: backend/src/routes/investments.js
type: Backend Route
---

# Investments Routes

> [!info] Equities & Mutual Funds Router
> The **investments.js** route exposes endpoints for the complex FIFO investment engine and live market data syncing.

## Endpoints
1. **GET `/`**: Retrieves the grouped equity/debt investment portfolio.
2. **POST `/`**: Creates a new investment lot.
3. **POST `/:id/fund`**: Accumulates more units in a SIP/Lumpsum without selling.
4. **POST `/:id/sell`**: Executes a highly strict unit-based FIFO sell sequence, calculating and routing capital gains to the ledger.
5. **DELETE `/:id`**: Reverses and deletes an entire investment history.
6. **POST `/:id/dividend`**: Books non-unit-based cash dividends directly to the ledger.
7. **POST `/sync-market`**: Triggers a global `yahoo-finance2` scrape to update NAVs and CMVs for all tracked schemes.
