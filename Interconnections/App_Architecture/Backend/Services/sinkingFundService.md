---
tags:
  - service
  - backend
  - saving
aliases:
  - Goal Tracker
file: backend/src/services/sinkingFundService.js
type: Backend Service
---

# Sinking Fund Service

> [!info] Goal Based Savings
> The **sinkingFundService.js** tracks segregated savings goals that are structurally ring-fenced from generic free cash.

## Core Responsibilities
1. **Capital Deployment/Retrieval**: Explicitly moves money between standard liquid cash and ring-fenced sinking funds via `capital_deployment` and `capital_retrieval` transactions, updating both sides of the ledger simultaneously.
2. **Nominee Purging**: Cascades deletions cleanly, ensuring that if a sinking fund is deleted, any associated legacy nominee allocations in the `nominees` table are gracefully purged.
