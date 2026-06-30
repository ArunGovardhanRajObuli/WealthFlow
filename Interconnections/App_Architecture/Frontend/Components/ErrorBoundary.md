---
tags:
  - component
  - utility
  - frontend
aliases:
  - Crash Handler
file: frontend/src/components/ErrorBoundary.jsx
type: React Component
---

# ErrorBoundary

> [!info] Fault Tolerance
> The **ErrorBoundary** is a standard React Class Component designed to catch JavaScript errors anywhere in its child component tree, logging those errors, and displaying a fallback UI instead of crashing the whole app.

## Core Features
1. **Lifecycle Hooks**: Uses `getDerivedStateFromError` to render fallback UI and `componentDidCatch` to log the raw stack trace.
2. **Graceful Degradation**: Renders a dark, glass-morphism styled error screen with a "Try Again" button to safely remount the children without a full page refresh.
3. **Stack Trace Display**: Safely parses and renders the error `.toString()` in a scrollable preformatted block for easy debugging by the developer.
