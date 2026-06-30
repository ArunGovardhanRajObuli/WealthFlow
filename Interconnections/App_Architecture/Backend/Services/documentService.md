---
tags:
  - service
  - backend
  - vault
aliases:
  - Document Service
file: backend/src/services/documentService.js
type: Backend Service
---

# Document Service

> [!info] File Storage
> The **documentService.js** is responsible for managing physical file uploads (PDFs, images) and linking them to financial entities.

## Core Responsibilities
1. **Polymorphic Joins**: Executes complex SQL `CASE WHEN` statements with layered `UNION ALL` subqueries to fetch the human-readable names of the assets that a document is linked to (e.g., fetching a Bank Name if linked to a Bank, or Policy Name if linked to Insurance).
2. **Path Sanitization**: Explicitly blocks directory traversal attacks by ensuring `fileUrl` does not contain `..` strings before serving it.
3. **Physical Deletion**: When a document record is deleted from SQLite, the service uses `fs.unlinkSync` to securely wipe the physical file from the local `/uploads/` directory to prevent storage bloat.
