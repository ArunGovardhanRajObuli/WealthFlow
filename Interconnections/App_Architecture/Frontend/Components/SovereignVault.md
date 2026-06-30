---
tags:
  - component
  - investment
  - frontend
aliases:
  - PPF & EPF Vault
file: frontend/src/components/investments/SovereignVault.jsx
type: React Component
---

# SovereignVault

> [!info] EEE Tax Shield
> The **SovereignVault** component exclusively handles fixed-income sovereign-backed instruments like PPF (Public Provident Fund) and EPF (Employees' Provident Fund).

## Core Features
1. **Exempt-Exempt-Exempt Tracking**: Unlike equity where gains are realized upon sale, Sovereign instruments accumulate tax-free interest. This component isolates them from `realized_ltcg` taxation logic.
2. **Hardcoded Categories**: Specifically filters investments where `category === 'ppf'` or `category === 'epf'`, decoupling them from volatile daily NAV updates.
3. **Unified Contribution**: While creating or funding a PPF/EPF account, the UI dynamically allows funding from standard Bank Accounts, executing the ledger withdrawal alongside the vault deposit.
