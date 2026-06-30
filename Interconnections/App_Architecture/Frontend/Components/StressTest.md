---
tags:
  - component
  - analytics
  - frontend
aliases:
  - Catastrophe Simulator
file: frontend/src/components/StressTest.jsx
type: React Component
---

# StressTest

> [!info] Financial Resilience
> The **StressTest** component runs hypothetical disaster scenarios (Job Loss, Market Crash) to determine the portfolio's survival duration in months.

## Core Features
1. **Debounced Sliders**: Uses local state variables (`localDuration`, `localSeverity`) with a 400ms `setTimeout` to delay firing the heavy backend `/api/stress-test` mutation.
2. **Scenario Matrix**: Supports 5 distinct macro-shocks (Job Loss, Medical Emergency, EMI Rate Hike, Tenant Default, Market Crash) that dynamically alter the baseline assumptions.
3. **Immediate Recalculation**: `useEffect` automatically triggers a recalculation whenever the debounced sliders settle or the active scenario is swapped.
