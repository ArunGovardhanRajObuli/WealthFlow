---
tags:
  - component
  - ledger
  - frontend
aliases:
  - Search Header
file: frontend/src/components/ledger/LedgerFilters.jsx
type: React Component
---

# LedgerFilters

> [!info] Transaction Query Bar
> The **LedgerFilters** component controls the active view of the global `LedgerTable`, acting as a purely stateless UI controller for the search and export state.

## Core Features
1. **Text & Category Constraints**: Provides a debounced text search, alongside `<CustomSelect>` dropdowns to filter by strict transaction types (`income`, `expense`, `transfer`) and dynamic user-created categories.
2. **State Resetting**: Automatically intercepts filter changes (e.g., `onChange` of search) to reset `editingId` to null, ensuring the user isn't stuck editing a row that vanishes from the DOM due to a filter change.
3. **Data Exporter**: Mounts the CSV export button, disabling it if the `updateTxnMutation` or `deleteTxnMutation` are actively processing to prevent corrupted data snapshots.
