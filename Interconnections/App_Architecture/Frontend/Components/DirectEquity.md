---
tags:
  - component
  - investment
  - frontend
aliases:
  - Stock Tracker
file: frontend/src/components/investments/DirectEquity.jsx
type: React Component
---

# DirectEquity

> [!info] Shareholding Ledger
> The **DirectEquity** component isolates the user's active direct stock holdings (`category === 'stock'`), abstracting them from general mutual funds.

## Core Features
1. **Ticker Autocomplete**: Triggers a debounced (500ms) query to `/api/stocks-search` to fetch real-time BSE/NSE ticker symbols and current market prices during initialization.
2. **Transaction Linking**: When buying (`fundMut`) or selling (`sellMut`) shares, it implicitly requires a source bank account to fund the purchase or receive the payout, updating the `bank-balances` cache simultaneously.
3. **BigInt Precision**: Protects fractional share quantities and highly volatile capital gains calculations by enforcing `parseToPaiseBigInt` mathematically before submission.
