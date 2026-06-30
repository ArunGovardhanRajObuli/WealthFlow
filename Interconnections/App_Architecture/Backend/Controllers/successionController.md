---
tags:
  - controller
  - backend
  - family
aliases:
  - Succession API
file: backend/src/controllers/successionController.js
type: Backend Controller
---

# Succession Controller

> [!info] Inheritance HTTP Layer
> The **successionController.js** orchestrates the assignment of nominees and the execution of the "Pass Away" sequence.

## Core Responsibilities
1. **Nominee Validation**: Extremely strict validation on `createNominee`. Catches and handles specific business logic exceptions raised by the service layer, such as 'sharePercent cannot exceed 100%' or 'Orphan Injection Blocked' (attempting to assign a nominee to a non-existent asset).
2. **Execution Gateway**: Exposes `executeSuccession(memberId)`. This is the trigger that invokes the complex estate liquidation algorithm in the service layer, catching and mapping errors like 'already executed' to 400 Bad Request to prevent double-liquidation of an estate.
