---
tags:
  - controller
  - backend
  - banking
aliases:
  - Bank Accounts API
file: backend/src/controllers/bankController.js
type: Backend Controller
---

# Bank Controller

> [!info] Banking HTTP Layer
> The **bankController.js** manages the CRUD operations for `bank_balances`, intertwining it closely with the ledger system.

## Core Responsibilities
1. **Creation Validation**: Validates `bankName`, `balance`, `asOfDate`, and `owner_member_id` via `financialUtils.js` before invoking `bankService.createBankBalance`.
2. **Opening Balance Injection**: If a new bank account is created with a `balance > 0`, the controller manually crafts a mock transaction payload and injects it directly into `transactionService.createTransaction()` categorizing it as an `opening_balance`. This ensures the ledger immediately reflects the new cash.
3. **Deletion Safety**: Wraps `bankService.deleteBankBalance(id)` in a try-catch. If the service throws a specific "Cannot delete" error (because transactions exist tied to the bank), it catches the error and surfaces a clean `400 Bad Request` to the frontend rather than crashing the server.
