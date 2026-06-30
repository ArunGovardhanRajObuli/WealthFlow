---
tags:
  - component
  - root
  - frontend
aliases:
  - Analytics Dashboard Root
file: frontend/src/components/AnalyticsEngine.jsx
type: React Component
---

# AnalyticsEngine

> [!info] Diagnostics Terminal
> The **AnalyticsEngine** serves as the root container orchestrating all analytical and diagnostic widgets.

## Composition
This component is purely structural, rendering the following key modules in order:
- `WealthAdvisor`
- `TaxVault`
- `CashFlowForecast`
- `MonteCarloSimulator`
- `StressTest`
- `DividendTracker` & `MFOverlap`
- `EmergencyAdequacy`
- `LifestyleCreep`
