---
tags:
  - component
  - ui
  - frontend
aliases:
  - Global Notification
file: frontend/src/components/AlertModal.jsx
type: React Component
---

# AlertModal

> [!info] Accessible UI Primitive
> The **AlertModal** is a globally accessible modal component used for presenting notifications and alerts to the user.

## Core Features
1. **Portal Rendering**: Uses `createPortal` targeting `document.body` to safely break out of `overflow: hidden` parent containers.
2. **Accessibility**: Includes global keyboard event listeners to capture `Escape` and `Enter` keydowns for quick closure.
3. **Framer Motion**: Smoothly animates in scaling from 0.95 and fading in, with a backdrop blur.
