---
tags:
  - component
  - admin
  - frontend
aliases:
  - Double Entry Alert
file: frontend/src/components/SystemSentinelBanner.jsx
type: React Component
---

# SystemSentinelBanner

> [!info] Watchdog Overlay
> The **SystemSentinelBanner** is a highly visible, globally-rendered animated alert banner that triggers exclusively when the core Ledger detects a fundamental double-entry accounting imbalance.

## Core Features
1. **Continuous Polling**: Implements a 30-second `refetchInterval` on the `/api/system/reconciliation` endpoint to constantly sniff for data corruption or manual entry errors.
2. **Null-State Submersion**: Exits the React DOM entirely (`return null`) if the system is healthy (`imbalancedCount === 0`), staying completely invisible during normal operations.
3. **Imbalance Visualization**: If a row is corrupted, it renders the raw transaction mapping, specifically highlighting the exact mathematical discrepancy between Debits and Credits so the user can manually patch the SQLite row.
