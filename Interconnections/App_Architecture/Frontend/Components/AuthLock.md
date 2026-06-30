---
tags:
  - component
  - auth
  - frontend
aliases:
  - Security Gate
file: frontend/src/components/AuthLock.jsx
type: React Component
---

# AuthLock

> [!info] Master Security Gate
> The **AuthLock** component restricts access to the entire application by enforcing a master password challenge upon startup.

## Core Features
1. **Zero-Trust Initialization**: Fetches `/api/auth/check-setup` to determine if a master password has been configured yet. If not, it enters `setupMode`.
2. **Session Handling**: Receives a `token` upon successful authentication and stores it securely in `sessionStorage` (preventing persistent disk-based access cross-session).
3. **Framer Motion**: Incorporates dynamic animations using glass-panel aesthetics and ambient orbs for a premium initial loading experience.
