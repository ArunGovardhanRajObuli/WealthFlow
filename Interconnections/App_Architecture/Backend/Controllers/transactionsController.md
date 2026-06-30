---
tags:
  - controller
  - backend
  - core
aliases:
  - Transactions API
file: backend/src/controllers/transactionsController.js
type: Backend Controller
---

# Transactions Controller

> [!info] Raw Entry & OCR HTTP Layer
> The **transactionsController.js** handles raw transaction ingestion and spins up Node.js child processes for asynchronous AI parsing.

## Core Responsibilities
1. **Pagination & Bounding**: `getAll` enforces a hard limit of `1000` rows per page via `Math.max(1, Math.min(rawLimit, 1000))`, protecting the server from memory exhaustion during massive data fetches.
2. **Asynchronous OCR Execution**: The `scanBill` endpoint creates an isolated child process (`fork(ocrWorker.js)`) to run intensive Tesseract/OCR workloads. This prevents the single-threaded Node.js event loop from blocking while parsing large images.
3. **Regex Data Extraction**: Parses the raw text returned by the OCR worker, using Regex to intelligently scrape `amount` (`\d+(\.\d{1,2})?`), `date` (`\d{2}\/\d{2}\/\d{4}`), and `merchant` names.
4. **XSS Sanitization**: Aggressively strips HTML tags from the OCR text (`replace(/<[^>]*>?/gm, '')`) before sending it back to the client, neutralizing potential Cross-Site Scripting attacks hidden in scanned barcodes or receipt text.
