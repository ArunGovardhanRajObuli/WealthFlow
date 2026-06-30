---
tags:
  - component
  - admin
  - frontend
aliases:
  - System Diagnostics
file: frontend/src/components/Sentinel.jsx
type: React Component
---

# Sentinel

> [!info] Watchdog Daemon
> The **Sentinel** component acts as an autonomous liquid asset auditing engine, providing real-time diagnostics on system integrity.

## Core Features
1. **Anomaly Detection**: Queries `/api/sentinel/diagnostics` to fetch a list of critical warnings, structural deficits, and success logs.
2. **Dynamic Theming**: Adjusts its entire UI color scheme based on the highest severity alert (`critical` -> Coral, `warning` -> Sapphire, `success` -> Emerald).
3. **Audit Trail Hub**: Embeds the full `AuditTrail` component at the bottom of the view, creating a unified security and diagnostics dashboard.
