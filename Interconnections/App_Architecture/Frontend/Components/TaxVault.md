---
tags:
  - component
  - tax
  - frontend
aliases:
  - Income Tax Command Center
file: frontend/src/components/TaxVault.jsx
type: React Component
---

# TaxVault

> [!info] Regulatory Compliance Root
> The **TaxVault** component is the central hub for tax calculations, AIS (Annual Information Statement) reconciliation, and harvesting reports.

## Core Features
1. **Dynamic Financial Year**: Automatically calculates `fyStart` and `fyEnd` by checking if the current month is >= April (Month 3), scoping all Ledger queries purely to the current fiscal year.
2. **Mass Aggregation**: Pulls all transaction expenses, intelligently mapping standard deductions, rental income offsets (Section 24a 30% flat cut), and realized capital gains into a massive `taxMath` useMemo block.
3. **Secure Download Intercept**: Provides a custom `handleSecureDownload` wrapper to fetch PDF/Receipt BLOBs, bypassing hardcoded localhost origins to prevent CORS/auth drops when downloading 80G donation receipts.
