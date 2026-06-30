---
tags:
  - architecture
  - map
  - master
aliases:
  - App Architecture Master
type: Master Index
---

# Financial Assistant - Master Architecture Map

> [!info] System Topology
> This document acts as the central hub connecting all architectural documentation for the Financial Assistant application. It links to every documented service, controller, route, frontend component, and database schema.

## 1. High-Level Overview
* [[Overview|System Overview]]
* [[Cookbook|Developer Cookbook]]
* [[Financial_Glossary|Financial Terminology Glossary]]
* [[Database_Schema|SQL Database Schema]]

---

## 2. Frontend Application (React)
* [[Component_Map|Frontend Components Map]]

### 2.1 React Components
* [[ActiveLoans.md]]
* [[AdvanceTaxEstimator.md]]
* [[AisReconciliation.md]]
* [[AlertModal.md]]
* [[AnalyticsEngine.md]]
* [[AssetCategories.md]]
* [[AuditTrail.md]]
* [[AuthLock.md]]
* [[BankReconciliation.md]]
* [[BucketStrategy.md]]
* [[Budgets.md]]
* [[CashFlowForecast.md]]
* [[ConfirmationModal.md]]
* [[CreditCards.md]]
* [[CustomSelect.md]]
* [[DebtHub.md]]
* [[DebtOptimizer.md]]
* [[DefeatedLoans.md]]
* [[DirectEquity.md]]
* [[DividendTracker.md]]
* [[DocumentVault.md]]
* [[DoubleEntryExplorer.md]]
* [[EmergencyAdequacy.md]]
* [[EMIModeler.md]]
* [[ErrorBoundary.md]]
* [[FamilyEstate.md]]
* [[FDLadder.md]]
* [[GoldTracker.md]]
* [[HLVCalculator.md]]
* [[HraCalculator.md]]
* [[Insurance.md]]
* [[Investments.md]]
* [[Ledger.md]]
* [[LedgerFilters.md]]
* [[LedgerPagination.md]]
* [[LedgerTable.md]]
* [[LifestyleCreep.md]]
* [[LoanDashboard.md]]
* [[Loans.md]]
* [[MFOverlap.md]]
* [[MonteCarloSimulator.md]]
* [[NewLoanForm.md]]
* [[NPSTracker.md]]
* [[ProtectionHub.md]]
* [[RealEstate.md]]
* [[ReceiptScanner.md]]
* [[Schedule112A.md]]
* [[Sentinel.md]]
* [[Settings.md]]
* [[SinkingFunds.md]]
* [[SipPortfolio.md]]
* [[SovereignVault.md]]
* [[StatementImporter.md]]
* [[StressTest.md]]
* [[Subscriptions.md]]
* [[SuccessionPlanner.md]]
* [[SystemSentinelBanner.md]]
* [[TaxLimitsTracker.md]]
* [[TaxVault.md]]
* [[TransactionModal.md]]
* [[WealthAdvisor.md]]
* [[WealthHub.md]]

---

## 3. Backend Application (Node.js/Express)

### 3.1 Services (Business Logic & Ledger)
* [[advancedModelingService.md]]
* [[analyticsService.md]]
* [[auditService.md]]
* [[backupService.md]]
* [[bankService.md]]
* [[budgetService.md]]
* [[creditCardService.md]]
* [[debtAnalyticsService.md]]
* [[dividendService.md]]
* [[documentService.md]]
* [[familyService.md]]
* [[fixedDepositService.md]]
* [[forecastingService.md]]
* [[goldService.md]]
* [[investmentService.md]]
* [[ledgerService.md]]
* [[loanService.md]]
* [[mfOverlapService.md]]
* [[netWorthService.md]]
* [[npsService.md]]
* [[realEstateService.md]]
* [[reminderService.md]]
* [[sinkingFundService.md]]
* [[successionService.md]]
* [[taxAnalyticsService.md]]
* [[transactionService.md]]

### 3.2 Controllers (HTTP Layer)
* [[advancedModelingController.md]]
* [[analyticsController.md]]
* [[auditController.md]]
* [[bankController.md]]
* [[budgetsController.md]]
* [[creditCardsController.md]]
* [[debtAnalyticsController.md]]
* [[dividendController.md]]
* [[documentsController.md]]
* [[familyMembersController.md]]
* [[fixedDepositsController.md]]
* [[forecastingController.md]]
* [[goldHoldingsController.md]]
* [[investmentsController.md]]
* [[ledgerController.md]]
* [[loansController.md]]
* [[mfOverlapController.md]]
* [[netWorthController.md]]
* [[npsAccountsController.md]]
* [[realEstateController.md]]
* [[remindersController.md]]
* [[settingsController.md]]
* [[sinkingFundsController.md]]
* [[successionController.md]]
* [[taxAnalyticsController.md]]
* [[transactionsController.md]]

### 3.3 Routes (API Endpoints)
* [[analytics.md]]
* [[audit.md]]
* [[auth.md]]
* [[banks.md]]
* [[budgets.md]]
* [[creditCards.md]]
* [[documents.md]]
* [[familyMembers.md]]
* [[fixedDeposits.md]]
* [[goldHoldings.md]]
* [[investments.md]]
* [[ledger.md]]
* [[loans.md]]
* [[netWorth.md]]
* [[npsAccounts.md]]
* [[realEstate.md]]
* [[reminders.md]]
* [[settings.md]]
* [[sinkingFunds.md]]
* [[succession.md]]
* [[transactions.md]]
