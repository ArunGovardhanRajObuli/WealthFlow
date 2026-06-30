---
tags:
  - component
  - utilities
  - frontend
aliases:
  - OCR Engine Client
file: frontend/src/components/ReceiptScanner.jsx
type: React Component
---

# ReceiptScanner

> [!info] Automation Pipeline
> The **ReceiptScanner** component allows users to upload images of bills/receipts, interfacing with an external OCR endpoint to parse transaction amounts automatically.

## Core Features
1. **Multipart Forms**: Uses `FormData` to safely upload binary image files to `/api/scan-bill` rather than standard JSON payloads.
2. **Ledger Integration**: Upon successful OCR parsing, allows the user to append a category and source bank, subsequently pushing a new row directly into the global `transactions` ledger.
3. **State Machine**: Maintains internal UI state for `idle`, `scanning`, `success`, and `error` to provide real-time user feedback during async operations.
