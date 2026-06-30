---
tags:
  - route
  - backend
  - security
aliases:
  - Auth Routes
file: backend/src/routes/auth.js
type: Backend Route
---

# Auth Routes

> [!info] Authentication & Session Management
> The **auth.js** route handles the Master Password setup, verification, and session token generation.

## Endpoints
1. **GET `/check-setup`**: Verifies if the master password has already been set by querying the `app_settings` table.
2. **POST `/setup`**: Allows setting the master password once. It securely hashes the password using `bcrypt` (salt rounds: 12) and saves it to the database, instantly authenticating the user.
3. **POST `/login`**: Verifies the submitted password against the `bcrypt` hash stored in the database.

## Security Measures
- **Strict Rate Limiting**: The entire router is wrapped in `authLimiter`, allowing only 5 requests per minute to thwart brute-force attacks.
- **In-Memory Sessions**: Successful logins generate a 32-byte cryptographic hex token stored globally in `ACTIVE_SESSION_TOKEN`. This means sessions are intentionally volatile and immediately expire upon server restart, preventing persistent token hijacking.
