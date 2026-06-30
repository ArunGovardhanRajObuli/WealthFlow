---
tags:
  - controller
  - backend
  - debt
aliases:
  - Credit Cards API
file: backend/src/controllers/creditCardsController.js
type: Backend Controller
---

# Credit Cards Controller

> [!info] Debt Management HTTP Layer
> The **creditCardsController.js** orchestrates the high-frequency lifecycle of revolving credit card debt.

## Core Responsibilities
1. **Estate Legality**: Explicitly blocks card creation or updates if an `owner_member_id` is not provided, stating that all credit cards must be assigned to a specific family member for Estate Ledger integrity.
2. **Spend Wrapping**: Catches incoming `spend` requests, converts floating point payloads to pure integer paise (`parseToPaiseBigInt`), and blocks negative or zero spends before passing the payload down to the `creditCardService.spendOnCard` method.
3. **Safety Guardrails**: Catches a specific error from the service: "Cannot reduce balance below the total of tracked spends." This prevents users from artificially lowering their current balance in a way that would break the double-entry accounting reconciliation against individual tracked ledger spends.
