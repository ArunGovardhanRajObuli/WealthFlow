---
tags:
  - component
  - budget
  - frontend
aliases:
  - Recurring Subscriptions
file: frontend/src/components/Subscriptions.jsx
type: React Component
---

# Subscriptions

> [!info] Fixed Cost Monitor
> The **Subscriptions** component filters and manages recurring obligations mapped specifically to the `subscription` category from the global reminders table.

## Core Features
1. **Urgency Engine**: Computes exact days until due (`getDaysUntilDue`) by zeroing out time portions, then colors rows (`critical`, `warning`, `safe`) based on proximity.
2. **Annualization Math**: Computes aggregate metrics by normalizing monthly, quarterly, and annual subscriptions into a unified `monthlyPaise` BigInt figure.
3. **Quick Pay Integration**: Interfaces with the central `/api/transactions` engine to execute "Pay Now" actions, debiting selected banks while rolling the subscription due date forward.
