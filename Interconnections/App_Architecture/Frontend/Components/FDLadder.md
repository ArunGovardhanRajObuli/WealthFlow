---
tags:
  - component
  - wealth
  - frontend
aliases:
  - Fixed Deposit Manager
file: frontend/src/components/FDLadder.jsx
type: React Component
---

# FDLadder

> [!info] Safe Yield Tracking
> The **FDLadder** component allows users to track and construct a ladder of Fixed Deposits (FDs) to maintain continuous liquidity while earning stable yields.

## Core Features
1. **Maturity Radar**: Dynamically categorizes active FDs by time-to-maturity (e.g. `< 30 days` vs `< 90 days`), alerting the user when liquidity events are approaching.
2. **Ledger Integration**: When adding a new FD (that isn't historical), it triggers a ledger mutation, deducting the principal from the chosen `source_bank_id`.
3. **Multi-Owner Support**: Allows assigning an owner (`family_members`) and a joint owner with a percentage split (e.g. 50/50), critical for accurate per-member net worth and tax attribution.
