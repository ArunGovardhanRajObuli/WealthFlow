---
tags:
  - component
  - protection
  - frontend
aliases:
  - Policy Tracker
file: frontend/src/components/Insurance.jsx
type: React Component
---

# Insurance

> [!info] Risk Mitigation
> The **Insurance** component tracks life, health, auto, and property insurance policies and their recurring premium payments.

## Core Features
1. **Categorized Reminders**: Uses the shared `/api/reminders` endpoint but filters the UI strictly to `r.category === 'insurance'`.
2. **Quick Pay Action**: Provides a dedicated "Pay Premium" button which deducts funds from a selected bank ledger and rolls the `dueDate` of the policy forward.
3. **BigInt Guardrails**: Implements `parseToPaiseBigInt` checking against `bank.ledgerBalance` to prevent overdrafts when paying premiums.
