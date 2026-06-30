---
tags:
  - route
  - backend
  - banking
aliases:
  - Banks Routes
file: backend/src/routes/banks.js
type: Backend Route
---

# Banks Routes

> [!info] Liquid Asset Router
> The **banks.js** route handles CRUD operations specifically for Bank Balances (liquid cash).

## Endpoints
1. **GET `/bank-balances`**: Retrieves all tracked bank accounts and their current balances.
2. **POST `/bank-balances`**: Creates a new bank account entry (often accompanied by an opening balance ledger transaction generated in the controller).
3. **DELETE `/bank-balances/:id`**: Removes a bank account, relying on the controller to verify that no ledger transactions are tied to it before deletion.
