---
tags:
  - component
  - wealth
  - frontend
aliases:
  - Pension Tracker
file: frontend/src/components/NPSTracker.jsx
type: React Component
---

# NPSTracker

> [!info] Retirement Corpus
> The **NPSTracker** manages National Pension System (NPS) Tier I/II accounts, including complex projection math for retirement corpus estimation based on user-defined asset allocations.

## Core Features
1. **Real-time Projections**: Uses debounced local state (`localCurrentAge`, `localRetirementAge`) to delay querying the `/api/nps-projection` endpoint, preventing rapid slider movements from spamming the backend.
2. **Allocation Math**: Enforces strict validation that `equityPct + corpBondPct + govtSecPct === 100` before allowing mutation.
3. **BigInt Serialization**: Uses `parseToPaiseBigInt` for monetary inputs before converting to decimals, guaranteeing accuracy across contributions and current values.
