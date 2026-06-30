---
tags:
  - component
  - ledger
  - frontend
aliases:
  - Page Controller
file: frontend/src/components/ledger/LedgerPagination.jsx
type: React Component
---

# LedgerPagination

> [!info] Table Navigation Footer
> The **LedgerPagination** component provides standard Next/Previous controls for the global Ledger.

## Core Features
1. **State Preservation**: Ensures that navigating between pages (`setCurrentPage`) clears any active `editingId` or `editFormData` to prevent phantom edit states.
2. **Mutation Blocking**: Hard-disables the pagination buttons (`disabled={isPending}`) if the parent Ledger is currently saving an edit or deleting a row.
3. **Null-State Collapse**: Returns `null` if the total items are 0 and `totalPages` is 1, completely hiding the pagination strip on empty filtered lists.
