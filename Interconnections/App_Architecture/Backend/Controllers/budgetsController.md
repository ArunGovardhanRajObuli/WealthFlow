---
tags:
  - controller
  - backend
  - budgeting
aliases:
  - Budget API
file: backend/src/controllers/budgetsController.js
type: Backend Controller
---

# Budgets Controller

> [!info] Budgeting HTTP Layer
> The **budgetsController.js** manages the validation and routing for category-level expense limits.

## Core Responsibilities
1. **Category Normalization**: Enforces strict rules on the `category` string payload. It must not be empty, and it is automatically trimmed, converted to lowercase, and truncated to 50 characters to ensure standard matching against ledger transaction categories.
2. **Amount Formatting**: Parses the `monthlyLimit` through `validateAmount(..., true)` ensuring it's a valid decimal string.
3. **Safe Deletion**: Catches "Cannot delete:" constraints from `budgetService.removeBudget()` (if any business logic prevents deletion) and correctly surfaces a 400 error to the client.
