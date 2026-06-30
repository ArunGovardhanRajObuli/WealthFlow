---
tags:
  - component
  - liability
  - frontend
aliases:
  - Origination Modal
file: frontend/src/components/loans/NewLoanForm.jsx
type: React Component
---

# NewLoanForm

> [!info] Debt Constructor
> The **NewLoanForm** handles the complex task of initializing a new liability, immediately executing the PMT (Payment) mathematical formula in the browser to establish the baseline EMI.

## Core Features
1. **Real-Time PMT Calculation**: Imports `calculateEMIBigInt` from the utility folder. As the user types the Principal, APR, and Term, it continuously recalculates the exact `calculatedEMI` in real-time before submission.
2. **Disbursement Linking**: Requires the user to select a `source_bank_id`. While creating the loan reminder, the backend will simultaneously inject the disbursement principal into the selected bank account as a capital influx.
3. **Object Freezing**: Implements `Object.freeze(payload)` right before the mutation to guarantee immutability of the financial payload as it travels into the React Query mutation pipeline.
