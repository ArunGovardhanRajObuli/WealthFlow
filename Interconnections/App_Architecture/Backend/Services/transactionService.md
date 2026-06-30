---
tags:
  - service
  - backend
  - core
aliases:
  - Transaction Router
file: backend/src/services/transactionService.js
type: Backend Service
---

# Transaction Service

> [!info] Universal Ledger Entry
> The **transactionService.js** is the primary API gateway for all user-initiated financial events, wrapping them in SQLite transactions and routing them into the ledger.

## Core Responsibilities
1. **Foreign Key Multiplexing**: Accepts a massive payload of possible links (`source_bank_id`, `linked_loan_id`, `investment_id`, `fd_id`, etc.) and dynamically calculates derived values (like `asset_units` = `amount` / `latestNav`).
2. **Ledger Delegation**: After inserting the base record into the `transactions` table, it synchronously invokes `ledgerService.syncAssetBalances` to cascade the double-entry accounting effects across the entire database.
3. **Lot Generation**: If the transaction is an investment purchase, it automatically spawns granular rows in `investment_lots` and `sip_purchases` to enable FIFO taxation tracking.
4. **Cascading Deletion**: Complex rollback logic ensures that deleting a transaction correctly reverses `syncAssetBalances` and deletes linked dependent records (like SIPs or loan payments).
