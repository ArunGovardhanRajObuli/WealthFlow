---
tags:
  - component
  - ui
  - frontend
aliases:
  - Action Confirmation
file: frontend/src/components/ConfirmationModal.jsx
type: React Component
---

# ConfirmationModal

> [!info] Reusable Prompt
> The **ConfirmationModal** is an accessible, portal-rendered dialog used to confirm destructive or high-stakes user actions.

## Core Features
1. **Portal Rendering**: Uses `createPortal` to `document.body` ensuring it always overlays the entire app regardless of parent CSS stacking contexts.
2. **Framer Motion**: Smooth entry and exit animations (`AnimatePresence`, scaling).
3. **Flexible Action Handling**: Can be styled as `danger` (red) or `success` (green) and supports `keepOpenOnConfirm` for multi-step async confirmations.
