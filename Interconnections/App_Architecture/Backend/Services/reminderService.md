---
tags:
  - service
  - backend
  - reminders
aliases:
  - Reminder Manager
file: backend/src/services/reminderService.js
type: Backend Service
---

# Reminder Service

> [!info] Event Scheduling
> The **reminderService.js** manages recurring and one-off chronological events like EMIs, premium payments, and maturities.

## Core Responsibilities
1. **Loan Orchestration**: When a new loan is registered here, it immediately fires off a "Loan Disbursement" transaction into the ledger to reflect the sudden influx of principal cash into the user's source bank account.
2. **Insurance Locking**: Heavily restricts modifications to policy parameters (like Owner or Principal Amount) if premium payments have already been executed against it in the ledger, enforcing data immutability.
3. **Ledger Decoupling**: If a reminder is deleted, it nullifies foreign keys (`insurance_id`, `subscription_id`) on all associated historical transactions so the ledger history is not destroyed when the event schedule is cleared.
