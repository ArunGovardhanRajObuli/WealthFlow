---
tags:
  - service
  - backend
  - admin
aliases:
  - Auto Backups
file: backend/src/services/backupService.js
type: Backend Service
---

# Backup Service

> [!info] Data Preservation
> The **backupService.js** runs an asynchronous background timer loop inside the Node.js process to automatically snapshot the SQLite database file.

## Core Responsibilities
1. **Cron Polling**: Instantiates an hourly `setInterval` loop to check if a backup is due (based on user settings: daily or weekly).
2. **Direct File Copy**: Uses native Node.js `fs.copyFileSync` to physically copy the `finance.sqlite` database file to a user-defined destination folder without blocking the main event loop.
3. **State Management**: Updates the `last_backup_date` in the `app_settings` table to prevent duplicate backups on the same day if the node server restarts.
