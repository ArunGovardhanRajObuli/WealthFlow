---
tags:
  - service
  - backend
  - estate_planning
aliases:
  - Succession Manager
file: backend/src/services/successionService.js
type: Backend Service
---

# Succession Service

> [!info] Estate Planning
> The **successionService.js** acts as a meta-service, scanning across all asset classes to determine estate transfer readiness.

## Core Responsibilities
1. **Asset Harvesting**: Dynamically executes parallel queries across Real Estate, Fixed Deposits, Investments, Bank Balances, NPS, Gold, and Sinking Funds to aggregate a master list of all assignable wealth.
2. **Net Valuation**: For assets like Real Estate, it subtracts linked amortized debt before calculating the net transferable value. It also correctly applies the `owner_split_percent` so that only the primary user's legitimate equity share is considered assignable.
3. **Completeness Scoring**: Calculates an overarching "Succession Coverage" metric by dividing the number of legally assigned assets by the total pool of known assets, displaying a progress bar to encourage users to complete their estate planning.
