---
tags:
  - route
  - backend
  - storage
aliases:
  - Documents Routes
file: backend/src/routes/documents.js
type: Backend Route
---

# Documents Routes

> [!info] File Upload Router
> The **documents.js** route file handles secure binary file uploads for financial record keeping.

## Endpoints
1. **GET `/documents`**: Retrieves metadata for all securely stored documents.
2. **POST `/documents`**: Accepts a `multipart/form-data` payload containing a file. Critically, this route injects the `upload.single('document')` middleware from `middlewares/upload.js` which parses the binary stream before handing off metadata to `documentsController`.
3. **DELETE `/documents/:id`**: Removes a document's metadata from the database and deletes the physical file from the local storage.
