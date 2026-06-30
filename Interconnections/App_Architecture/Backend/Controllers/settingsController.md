---
tags:
  - controller
  - backend
  - core
aliases:
  - Settings API
file: backend/src/controllers/settingsController.js
type: Backend Controller
---

# Settings Controller

> [!info] System Configuration & Wiping API
> The **settingsController.js** handles global application preferences and the dangerous data wiping mechanism.

## Core Responsibilities
1. **Key-Value Store**: Serves and updates global system configurations (like theme preferences, taxation flags) stored in the `app_settings` table using an `ON CONFLICT(key) DO UPDATE` UPSERT command.
2. **Atomic Data Wipe (`wipeData`)**: Orchestrates the nuclear option. Executes a massive, atomic SQLite transaction iterating through an exact array of 22 mission-critical tables (including `ledger_lines`, `transactions`, `investments`), explicitly issuing `DELETE FROM` to completely reset the financial database while preserving schemas.
