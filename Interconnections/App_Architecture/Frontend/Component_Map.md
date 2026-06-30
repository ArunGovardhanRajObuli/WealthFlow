---
tags:
  - architecture
  - frontend
  - map
aliases:
  - React Component Map
---

# Frontend Component Map

> [!info] Component Hierarchy
> This file maps the architectural interconnections of all React components inside the frontend application.

## Core Hubs & Dashboards
- [[WealthHub]] - The root container for all wealth accumulation tabs.
- [[ProtectionHub]] - The root container for all insurance, risk, and succession tabs.
- [[DebtHub]] - The root container for all liabilities and loans.
- [[TaxVault]] - The root container for tax planning, harvesting, and AIS reconciliation.
- [[Settings]] - System configuration, backup management, and preferences.

## Global UI & Layout
- [[SystemSentinelBanner]] - Global watchdog alert for double-entry imbalances.
- [[ErrorBoundary]] - Top-level React error catcher to prevent white-screens.
- [[TransactionModal]] - The universal mutation interface for all ledger entries.
- [[ConfirmationModal]] - Reusable destructive-action verification.
- [[AlertModal]] - Standardized non-blocking alert dialogs.
- [[CustomSelect]] - Z-index escaping portal dropdown for complex forms.

## Ledger & Core Accounting
- [[Ledger]] - The master double-entry accounting view.
- [[LedgerFilters]] - State controllers for sorting and category filtering.
- [[LedgerTable]] - The actual grid presenting transaction data.
- [[LedgerPagination]] - Pagination controls for the Ledger table.
- [[BankReconciliation]] - Tool to sync app balances with real bank statements.
- [[AuditTrail]] - Immutable log viewer for tracking system changes.
- [[DoubleEntryExplorer]] - Technical view of debits vs credits under the hood.

## Wealth & Investments (Equities/MFs)
- [[Investments]] - General equity dashboard and active positions.
- [[DirectEquity]] - Direct stock holding tracker with API price integration.
- [[SipPortfolio]] - Mutual fund and SIP deployment tracker.
- [[MFOverlap]] - Utility to scan mutual funds for underlying asset redundancy.
- [[SovereignVault]] - Tax-free fixed income like PPF, SSY, and EPF.
- [[FDLadder]] - Fixed Deposit tracking with maturity mapping.
- [[GoldTracker]] - Physical gold and SGB (Sovereign Gold Bond) tracking.
- [[RealEstate]] - Property valuations and associated yield tracking.
- [[DividendTracker]] - Income generated passively from equity holdings.

## Retirement & Long-Term Planning
- [[NPSTracker]] - National Pension System Tier 1/2 tracking.
- [[MonteCarloSimulator]] - Stochastic projections for retirement survival.
- [[BucketStrategy]] - Time-segmented risk allocation for withdrawal phases.
- [[FamilyEstate]] - Multi-generational wealth assignment and polymorphic owner linking.
- [[SuccessionPlanner]] - Nominee assignments across all asset classes.

## Liabilities & Debt Optimization
- [[Loans]] - Active debt tracker and amortization visualizer.
- [[ActiveLoans]] - Component rendering currently active credit lines.
- [[DefeatedLoans]] - Gamified archive of fully paid-off debts.
- [[LoanDashboard]] - Financial HUD summarizing total credit exposure.
- [[NewLoanForm]] - Complex form triggering PMT calculations for new origination.
- [[DebtOptimizer]] - Algorithmic tool suggesting the mathematically optimal prepayments.
- [[EMIModeler]] - Playground to test prepay scenarios.
- [[CreditCards]] - Rolling 30-day unsecured debt management.

## Tax Optimization & Filing
- [[AdvanceTaxEstimator]] - Section 234A/B/C penalty avoider based on realized gains.
- [[Schedule112A]] - Precision ISIN-level capital gains formatter for ITR-2 Java XML.
- [[TaxLimitsTracker]] - Section 80C/80D/24B exhaustion gauge.
- [[HraCalculator]] - Section 10(13A) optimizer comparing rent vs basic vs metros.
- [[AisReconciliation]] - Tool to match internal app ledger against Income Tax Dept AIS.
- [[ReceiptScanner]] - OCR utility for Section 80G and medical receipts.

## Analytics & Behavioral Finance
- [[WealthAdvisor]] - Autonomous engine scanning for arbitrage and tax leaks.
- [[AnalyticsEngine]] - Historical net-worth progression and charts.
- [[CashFlowForecast]] - Future liquidity predictor based on recurring debits.
- [[EmergencyAdequacy]] - Checks liquid assets against average monthly burn.
- [[SinkingFunds]] - Goal-based micro-saving buckets for planned expenses.
- [[Budgets]] - Category-level spending limits vs actuals.
- [[LifestyleCreep]] - Inflation vs Income growth differential tracker.
- [[Subscriptions]] - Recurring automated expense dashboard.

## System Components
- [[AuthLock]] - Authentication barrier and session manager.
- [[Sentinel]] - Database integrity and backup verifier.
- [[StatementImporter]] - CSV parser for HDFC/SBI/ICICI bulk imports.
- [[DocumentVault]] - Local secure storage for KYC and sensitive PDFs.
- [[AssetCategories]] - Classification map for different asset types.
