---
tags:
  - controller
  - backend
  - analytics
aliases:
  - MF Overlap API
file: backend/src/controllers/mfOverlapController.js
type: Backend Controller
---

# MF Overlap Controller

> [!info] Portfolio Concentration API
> The **mfOverlapController.js** is a simple passthrough controller that retrieves mutual fund redundancy metrics.

## Core Responsibilities
1. **Data Retrieval**: Simply delegates the call to `mfOverlapService.getMfOverlap()` to return redundancy scoring to the frontend.
