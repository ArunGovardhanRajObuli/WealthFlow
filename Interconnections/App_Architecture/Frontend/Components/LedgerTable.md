---
tags:
  - component
  - ledger
  - frontend
aliases:
  - Master Transaction Grid
file: frontend/src/components/ledger/LedgerTable.jsx
type: React Component
---

# LedgerTable

> [!info] Data Presentation Core
> The **LedgerTable** component is the central visualizer for all `transactions` in the system, supporting inline editing, sorting, and split-payment rendering.

## Core Features
1. **Framer Motion Integration**: Implements a staggered `tableContainer` and spring-based `tableRow` animation, so transactions cascade into view elegantly rather than jarringly popping in.
2. **Split Transaction Parsing**: Contains a complex `getSplitString` parser that mathematically decomposes a single ledger entry if it was funded by two separate bank accounts simultaneously (e.g., a shared expense).
3. **Inline Mutation**: Rather than triggering a modal, clicking "Edit" transforms the row locally into a `<form>`, intercepting the submit to trigger `updateTxnMutation` or `deleteTxnMutation` while locking the UI state.
