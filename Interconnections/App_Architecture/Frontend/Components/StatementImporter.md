---
tags:
  - component
  - data-entry
  - frontend
aliases:
  - CSV Ingestion
file: frontend/src/components/StatementImporter.jsx
type: React Component
---

# StatementImporter

> [!info] Bulk Data Pipeline
> The **StatementImporter** allows users to upload raw CSV statements from Indian institutional banks (HDFC, SBI, ICICI) to be parsed by the backend ML engine.

## Core Features
1. **Multipart Upload**: Wraps CSV files into a `FormData` payload alongside the selected `source_bank_id` or `credit_card_id` and fires it to `/api/import-csv`.
2. **Entity Polymorphism**: The `sourceBankId` state can represent either a standard bank ID or a credit card ID (prefixed with `cc_`), dynamically splitting the payload based on the entity type.
3. **Global Invalidation**: Upon successful import, calls `queryClient.invalidateQueries()` globally rather than targeting specific keys, as massive statement imports can affect budgets, cash flow, debt, and ledgers simultaneously.
