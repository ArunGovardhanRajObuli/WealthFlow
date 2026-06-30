---
tags:
  - component
  - investment
  - frontend
aliases:
  - Mutual Fund Engine
file: frontend/src/components/investments/SipPortfolio.jsx
type: React Component
---

# SipPortfolio

> [!info] SIP Commander
> The **SipPortfolio** component manages Systematic Investment Plans (SIPs) and lump-sum mutual fund deployments.

## Core Features
1. **AMFI Registry Sync**: Exposes a `syncMut` call to `/api/investments/sync-market` to manually pull the absolute latest NAVs from the AMFI API for all tracked mutual funds.
2. **Scheme Resolution**: During fund creation, the user searches by fund name, hitting `/api/amfi-search` which resolves the exact `schemeCode` needed for daily NAV lookups.
3. **Polymorphic Ownership**: Inherits the FamilyEstate logic by requiring `ownerId`, `jointOwnerId`, and a `splitPercent` to allocate capital gains to specific PAN holders for tax harvesting.
