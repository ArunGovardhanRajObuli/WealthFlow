# DoubleEntryExplorer

## Local State
- Uses `useQuery` to fetch `ledger-lines` with a large limit (100000).

## Key Functions & UI Behavior
- Extensively uses `useMemo` to group thousands of ledger lines into memory-capped (100-line) "T-Accounts" based on sanitized `account_class` and `account_type`.
- Computes precise global `totalSystemDebitsPaise` and `totalSystemCreditsPaise` using BigInt math.
- `formatBigIntCurrency`: Employs robust high-performance formatting of paise using a singleton `Intl.NumberFormat`.
- Displays critical urgency banners if `corruptedEntries` occur or the network payload hits truncation limits.
- Renders a "Live Trial Balance" banner indicating whether the entire system is "Balanced" or "Imbalanced", and renders complex T-Account cards with debit/credit columns and a Net Balance footer.
---
**Tags**: #frontend #component #DoubleEntryExplorer
