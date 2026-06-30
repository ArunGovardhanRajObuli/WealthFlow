---
tags:
  - controller
  - backend
  - utility
aliases:
  - Reminders API
file: backend/src/controllers/remindersController.js
type: Backend Controller
---

# Reminders Controller

> [!info] Notification & Disbursement HTTP Layer
> The **remindersController.js** orchestrates scheduled alerts and catches loan disbursement triggers.

## Core Responsibilities
1. **Loan Disbursement Trap**: Explicitly traps categories marked as `loan`. If a user creates a loan reminder with a `principalAmount > 0`, it strictly forces them to provide a `source_bank_id`. This guarantees that when a loan is disbursed, the exact cash outflow is simultaneously debited from a real asset account, keeping the ledger perfectly balanced.
2. **Policy Type Locking**: When updating a reminder, if `reminderService` throws a 'Cannot modify Policy Type' error (because changing a policy type fundamentally changes tracking metrics), the controller catches this and returns a clean 400 error rather than a generic 500.
