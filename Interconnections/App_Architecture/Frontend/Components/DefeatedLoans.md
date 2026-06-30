---
tags:
  - component
  - liability
  - frontend
aliases:
  - Paid Off Archive
file: frontend/src/components/loans/DefeatedLoans.jsx
type: React Component
---

# DefeatedLoans

> [!info] Liability Graveyard
> The **DefeatedLoans** component is a gamified archive that proudly displays all loans that the user has successfully amortized to zero.

## Core Features
1. **Gamification UI**: Renders a trophy icon and "Defeated" nomenclature instead of "Closed", heavily emphasizing the behavioral finance victory of clearing debt.
2. **Savings Display**: Extracts `loan.engine.interestSaved` and `monthsShavedOff` from the API payload, calculating exactly how much money and time the user saved via early prepayments compared to the original schedule.
3. **Collapsible Archive**: Wraps the entire list in a Framer Motion `AnimatePresence` block, defaulting to closed to keep the UI clean while allowing the user to unroll their victories.
