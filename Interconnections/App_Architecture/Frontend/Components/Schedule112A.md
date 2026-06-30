---
tags:
  - component
  - tax
  - frontend
aliases:
  - ITR-2 Export Engine
file: frontend/src/components/Schedule112A.jsx
type: React Component
---

# Schedule112A

> [!info] Tax Compliance
> The **Schedule112A** component generates an exact CSV format required by the Indian Income Tax Department's ITR-2 Java Utility for reporting Long Term Capital Gains.

## Core Features
1. **Red Team Vulnerability Fixes**: Contains extensive micro-fractional truncation math to precisely align units, prices, and cost bases to satisfy stringent (and often brittle) Java XML validations on the government portal.
2. **Cascading Loss Offset**: Implements Section 70 rules to expand the ₹1.25L LTCG quota by accurately cascading unabsorbed Short Term Capital Losses (STCL) through STCG and Debt Gains.
3. **Grandfathering Engine**: Identifies pre-2018 assets and suffixes their titles to visually prompt manual FMV entry, safely zeroing out `ISIN` and `FMV` to prevent utility crashes.
