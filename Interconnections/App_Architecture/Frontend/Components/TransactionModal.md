---
tags:
  - component
  - data-entry
  - frontend
aliases:
  - Universal Input Gateway
file: frontend/src/components/TransactionModal.jsx
type: React Component
---

# TransactionModal

> [!info] Omnichannel Mutator
> The **TransactionModal** is the most complex data-entry component in the system. It handles standard income/expenses, internal transfers, and entity-specific capital deployments (e.g., paying a Credit Card vs funding a Sinking Fund).

## Core Features
1. **Polymorphic Dropdowns**: Renders dynamic `<select>` fields that drastically morph depending on the transaction `category`. If the category is `loan`, it fetches and requires a `linked_loan_id`. If `capital_retrieval`, it exposes every asset class in the app to withdraw from.
2. **Strict BigInt Sanitization**: Implements robust local `parseToPaiseBigInt` interceptors that strip commas, normalize decimals, and block invalid floats before the payload ever reaches the `/api/transactions` endpoint.
3. **Mass Invalidation**: Due to its ability to touch almost every table (Banks, CCs, Loans, FDs, NPS, Real Estate, Investments), successful mutations forcefully `invalidateQueries` across a massive swath of TanStack Query keys to ensure the rest of the app immediately reflects the new ledger state.
