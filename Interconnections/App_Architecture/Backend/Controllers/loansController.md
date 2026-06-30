---
tags:
  - controller
  - backend
  - debt
aliases:
  - Loans API
file: backend/src/controllers/loansController.js
type: Backend Controller
---

# Loans Controller

> [!info] Debt Management HTTP Layer
> The **loansController.js** orchestrates complex amortizing liabilities, EMI payments, and restructuring logic.

## Core Responsibilities
1. **Refinancing Input Validation**: Validates payloads for refinancing, enforcing that `termYears` and `interestRate` fall within mathematically viable boundaries (`Math.max(0, Math.min(val, 100))`) before passing down to `loanService.refinanceLoan`.
2. **EMI Payment Handling**: During `/payments`, it demands either a valid `source_bank_id` or `credit_card_id` so the ledger can debit the appropriate asset account to reduce the loan liability.
3. **Split Verification**: Strictly ensures that the `split_amount` defined for an EMI payment mathematically cannot exceed the total `amount` being paid, preventing anomalous sub-accounting.
4. **Restructure Shielding**: For "bullet" (lump-sum) restructure requests, it explicitly requires a valid Source Bank Account since bullet payments are massive, immediate cash outflows that must be recorded on the ledger.
