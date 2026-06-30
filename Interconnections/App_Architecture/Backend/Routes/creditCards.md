---
tags:
  - route
  - backend
  - debt
aliases:
  - Credit Cards Routes
file: backend/src/routes/creditCards.js
type: Backend Route
---

# Credit Cards Routes

> [!info] Revolving Debt Router
> The **creditCards.js** route file exposes endpoints for managing credit card entities and their specific ledger-impacting actions.

## Endpoints
1. **GET `/`**: Retrieves all credit cards.
2. **POST `/`**: Creates a new credit card account.
3. **PUT `/:id`**: Updates credit card details (name, limit, due date).
4. **DELETE `/:id`**: Deletes a credit card, blocking if ledger entries exist.
5. **POST `/:id/spend`**: Records a purchase made on the card, increasing the liability balance and logging a transaction.
6. **POST `/:id/pay`**: Records a payment made to the card from a source bank account, reducing the liability balance.
