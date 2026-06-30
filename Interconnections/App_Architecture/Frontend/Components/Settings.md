---
tags:
  - component
  - admin
  - frontend
aliases:
  - Global Configuration
file: frontend/src/components/Settings.jsx
type: React Component
---

# Settings

> [!info] Configuration Hub
> The **Settings** component governs global application parameters, localized backup controls, and system destructive actions.

## Core Features
1. **Data Sovereignty**: Provides a `/api/export` binding to download the entire SQLite database and config as a zipped local backup.
2. **Sentinel Tuning**: Allows the user to configure variables like `sentinel_cibil_threshold` and `sentinel_anomaly_multiplier` which dictate the strictness of the autonomous diagnostic engine.
3. **Hard Wipe**: Includes a highly guarded "Wipe Data" feature requiring explicit typed `DELETE` confirmation to permanently drop the SQLite database via `/api/settings/wipe`.
