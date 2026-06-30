# Financial & Component Glossary

This document serves as the single source of truth for the business logic, financial terminology, and specific features used throughout the application. It maps our complex React components directly to their real-world financial definitions.

## 1. Core Accounting Concepts

### Double-Entry Ledger (`DoubleEntryExplorer`, `Ledger`)
The foundational accounting mechanism. Every single financial transaction creates at least **two** rows in the `ledger_lines` table: a **Debit** and a **Credit**. This ensures the accounting equation (Assets = Liabilities + Equity) always remains balanced.

### Joint Splitting / Owner Split Percent (`split_percent`)
A mathematical mechanism used when calculating Net Worth. If an asset (like a joint bank account or a shared property) is owned by multiple family members, the `split_percent` ensures that the net worth engine only attributes the fractional ownership percentage to a specific individual in the `FamilyEstate`.

### Bank Reconciliation (`BankReconciliation`)
The process of matching the calculated ledger balances against actual bank statements (imported via `StatementImporter` or `ReceiptScanner`) to detect missing or duplicate transactions.

## 2. Indian Taxation & Compliance (`TaxVault`)

### AIS Reconciliation (`AisReconciliation`)
Matches the user's recorded income and TDS (Tax Deducted at Source) against the official Annual Information Statement (AIS) from the Income Tax Department of India, ensuring no discrepancies before tax filing.

### Schedule 112A (`Schedule112A`)
A specific tax calculation engine for Indian Long-Term Capital Gains (LTCG) on equity shares and equity-oriented mutual funds. It calculates grandfathering rules (pre-2018 acquisitions) and the ₹1.25 Lakh exemption limit.

### Advance Tax Estimator (`AdvanceTaxEstimator`)
Calculates estimated tax liability for the financial year and tracks the quarterly payment deadlines (15% by June, 45% by Sep, 75% by Dec, 100% by March) to avoid Section 234B/234C penal interest.

### HRA Calculator (`HraCalculator`)
Calculates the House Rent Allowance exemption based on the lowest of three criteria: Actual HRA received, 50%/40% of basic salary (Metro vs Non-Metro), or Actual rent paid minus 10% of basic salary.

### Tax Limits Tracker (`TaxLimitsTracker`)
Monitors utilization of various Section 80 deductions (e.g., 80C limit of ₹1.5L, 80D medical insurance, 80CCD(1B) for NPS).

## 3. Asset Strategies (`WealthHub`)

### FD Laddering (`FDLadder`)
A strategy where Fixed Deposits (FDs) are broken into smaller amounts with staggered maturity dates rather than a single large FD. This provides regular liquidity while locking in high interest rates.

### NPS Tracker (`NPSTracker`)
Tracks the National Pension System investments, differentiating between Tier-I (locked-in retirement) and Tier-II (voluntary) accounts, and estimating the annuity vs lumpsum split at age 60.

### MF Overlap (`MFOverlap`)
Analyzes the underlying stock portfolios of multiple Mutual Funds to detect if the user is unintentionally over-exposed to specific stocks despite holding different funds.

### Bucket Strategy (`BucketStrategy`)
A retirement withdrawal strategy that divides assets into "buckets" based on when the money is needed:
- **Bucket 1 (1-3 years)**: Highly liquid, low risk (FDs, Savings).
- **Bucket 2 (4-7 years)**: Balanced risk (Debt funds, Hybrid).
- **Bucket 3 (7+ years)**: High growth (Equities, Real Estate).

## 4. Protection & Estate (`ProtectionHub`)

### HLV (Human Life Value) Calculator (`HLVCalculator`)
Calculates the exact amount of term life insurance a user needs based on their current income, future years of earning, existing liabilities, and inflation-adjusted living expenses for dependents.

### Succession Planner (`SuccessionPlanner` / `FamilyEstate`)
An estate planning engine mapping every single asset (Bank, FD, Mutual Fund, Real Estate) to its registered **Nominee**. Flags assets that are missing nominations.

## 5. Advanced Analytics & Modeling (`AnalyticsEngine`)

### Monte Carlo Simulator (`MonteCarloSimulator`)
Runs thousands of randomized simulations varying inflation, market returns, and life expectancy to determine the probability of a user's retirement corpus surviving until the end of their life.

### Debt Optimizer / EMI Modeler (`DebtOptimizer`, `EMIModeler`)
Calculates the impact of making prepayments on home loans. Uses mathematical models to suggest whether the user should invest excess cash or use it to prepay a loan based on the interest rate arbitrage.

### Opportunity Cost (`OpportunityCost`)
Calculates the long-term wealth lost when money is spent on a depreciating liability (like a car or lifestyle creep) instead of being invested in an appreciating asset over 10-20 years.

---
**Tags**: #glossary #domain #architecture #components
