---
tags:
  - component
  - analytics
  - frontend
aliases:
  - Expenditure Drift
file: frontend/src/components/LifestyleCreep.jsx
type: React Component
---

# LifestyleCreep

> [!info] Silent Inflation Radar
> The **LifestyleCreep** component detects and visualizes subtle, month-over-month increases in spending across budget categories.

## Core Features
1. **Pattern Detection**: Highlights categories actively drifting upwards over a 6-month period, classifying them as `Stable`, `Drifting`, or `Critical`.
2. **Mini Sparklines**: Renders pure CSS/HTML bar charts inline to visualize the 6-month trailing spend trend without heavy chart libraries.
3. **Financial Impact**: Computes the `Annual Impact` (annual projected increase in expenses) and the 6-month percentage change to quantify the creep.
