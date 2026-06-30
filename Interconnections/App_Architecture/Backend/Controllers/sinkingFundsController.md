---
tags:
  - controller
  - backend
  - budgeting
aliases:
  - Sinking Funds API
file: backend/src/controllers/sinkingFundsController.js
type: Backend Controller
---

# Sinking Funds Controller

> [!info] Goal Tracking HTTP Layer
> The **sinkingFundsController.js** handles virtual sub-accounting for future expenses.

## Core Responsibilities
1. **Funding Interception (`fund`)**: To prevent artificial wealth creation, it explicitly blocks funding requests (`/fund`) unless a valid `source_bank_id` is provided. This ensures that money moved into a sinking fund is simultaneously deducted from a real-world liquid asset on the ledger.
2. **Split Ownership**: Ingests and sanitizes `owner_split_percent`. If passed an anomalous value, it aggressively forces it back to `100` before passing to the database, preventing fractional sub-accounting errors.
3. **Ledger Reversal Handling**: Catches the specific 'Cannot delete' error thrown by the service layer when attempting to delete a sinking fund that already has tied ledger transactions.
