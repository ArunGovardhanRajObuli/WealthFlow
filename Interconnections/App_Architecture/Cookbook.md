# Developer Cookbook

This document outlines the standard operating procedures and design patterns for extending the Financial Assistant. Use these recipes to ensure new features seamlessly integrate with the existing architecture.

## Recipe 1: Adding a New Asset Class

If you need to add a new type of asset (e.g., "Cryptocurrency", "Bonds", "Vehicles"), follow this exact flow:

1. **Database Schema**:
   - Create a new table in `database.js` (e.g., `CREATE TABLE cryptocurrencies (...)`).
   - Ensure the table has an `id`, `title`, and `currentValue` at a minimum.
2. **Ledger Integration** (`ledgerService.js`):
   - In `insertLedgerLines`, map the new asset type.
     - Add a case: `if (tx.category === 'crypto') { return { class: 'Asset', type: 'crypto' }; }`
   - In `syncAssetBalances`, add the math to update the specific `cryptocurrencies` table when a ledger line hits it.
3. **Net Worth Engine** (`netWorthService.js`):
   - Inside `getNetWorth()`, add a new SQLite query to `SUM()` the total value of your new table.
   - Inject the sum into the `assets` total.
4. **API Routes & Controllers**:
   - Create `crypto.js` in `routes/` and `cryptoController.js` in `controllers/` to handle standard CRUD (Create, Read, Update, Delete).

## Recipe 2: Creating a New Frontend Component

All frontend UI components must follow the standardized React architecture:

1. **State Management**:
   - Use `React Query` (`useQuery`, `useMutation`) for all server-state. Do NOT use `useEffect` to fetch data unless absolutely necessary.
   - Example: 
     ```javascript
     const { data, isLoading } = useQuery(['cryptoBalances'], fetchCrypto);
     ```
2. **Mathematical Precision**:
   - Never perform math directly on floats in JavaScript. Always convert UI inputs into `BigInt` (paise/cents) before sending to the backend API, or let the backend controllers handle the float-to-BigInt conversion.
3. **Component Structure**:
   - Isolate API calls into custom hooks (e.g., `useCrypto()`) inside the `src/hooks/` directory.
   - The UI Component itself should only handle rendering and passing props.

## Recipe 3: Writing a New Database Migration

Because we use SQLite in WAL mode without a heavy ORM (like Prisma), migrations must be handled manually but safely:

1. Never use `DROP COLUMN` as SQLite has limited support for it.
2. To modify a table structure:
   - Create a new table `new_table_name` with the desired schema.
   - `INSERT INTO new_table_name SELECT * FROM old_table_name;`
   - `DROP TABLE old_table_name;`
   - `ALTER TABLE new_table_name RENAME TO old_table_name;`

---
**Tags**: #cookbook #patterns #developer-guide
