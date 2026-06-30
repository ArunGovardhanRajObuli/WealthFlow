---
tags:
  - route
  - backend
  - core
aliases:
  - Transactions Routes
file: backend/src/routes/transactions.js
type: Backend Route
---

# Transactions Routes

> [!info] Transaction Ingestion Router
> The **transactions.js** route file is a critical ingress for raw cashflow events, enforcing schema validation via middleware.

## Endpoints
1. **GET `/transactions`**: Retrieves paginated raw transactions.
2. **POST `/transactions`**: Creates a new standalone transaction. Protected by the `transactionValidation` middleware which strictly checks payload shapes before the controller acts.
3. **PUT `/transactions/:id`**: Updates a transaction (also protected by `transactionValidation`).
4. **DELETE `/transactions/:id`**: Removes a transaction, prompting the service layer to reverse the double-entry accounting.
5. **POST `/scan-bill`**: Accepts binary image uploads via `upload.single('receipt')` and triggers the async OCR extraction worker.
6. **POST `/transfer`**: Executes a standard A-to-B asset transfer.
7. **POST `/import-csv`**: Accepts a CSV binary stream via `upload.single('csvFile')` for bulk transaction ingestion.
