---
tags:
  - controller
  - backend
  - equity
aliases:
  - Dividend API
file: backend/src/controllers/dividendController.js
type: Backend Controller
---

# Dividend Controller

> [!info] Income HTTP Layer
> The **dividendController.js** is a simple passthrough controller that retrieves aggregated historical dividend data.

## Core Responsibilities
1. **Data Retrieval**: Simply delegates the call to `dividendService.getDividendTracker()` to return historical dividend metrics to the frontend.
