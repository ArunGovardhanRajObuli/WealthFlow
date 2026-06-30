---
tags:
  - component
  - analytics
  - frontend
aliases:
  - Survival Runway
file: frontend/src/components/EmergencyAdequacy.jsx
type: React Component
---

# EmergencyAdequacy

> [!info] Survival Analysis
> The **EmergencyAdequacy** component computes the user's financial runway in months by dividing their liquid reserves by their aggregate monthly burn rate.

## Core Features
1. **Dynamic Burn Rate**: Aggregates normal monthly expenses (from `Budgets`), Loan EMIs (from `Loans`), Insurance Premiums, and Subscriptions into a single `totalMonthlyObligation`.
2. **Status Tiers**: Categorizes the runway into distinct tiers (Platinum, Gold, Secure, Warning, Critical) with color-coded UI states (e.g. Platinum > 12mo, Secure = 6mo, Critical < 3mo).
3. **SVG Visuals**: Renders a dynamic SVG progress ring mapping the survival months to a full circle (capped visually at 12 months for 100%).
