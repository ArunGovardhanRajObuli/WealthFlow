---
tags:
  - route
  - backend
  - analytics
aliases:
  - Analytics Routes
file: backend/src/routes/analytics.js
type: Backend Route
---

# Analytics Routes

> [!info] Data Aggregation Router
> The **analytics.js** route file acts as the primary ingress for massive data aggregation requests, connecting frontend dashboards to deep mathematical engines.

## Endpoints
1. **Core Analytics**: `/liquidity`, `/summary`, `/sentinel/diagnostics`, `/emergency-adequacy` map to `analyticsController` to provide high-level health metrics.
2. **Forecasting**: `/forecast` maps to `forecastingController` for cashflow projections.
3. **Debt Strategy**: `/debt-strategy` and `/emi-modeler` map to `debtAnalyticsController` for liability optimization.
4. **Tax & Advanced Modeling**: Routes like `/hlv-calculator` (Human Life Value), `/tax-harvest`, `/stress-test`, and `/lifestyle-creep` map to `taxAnalyticsController` and `advancedModelingController`.
5. **External Controllers**: Includes `/dividend-tracker` and `/mf-overlap` to serve specialized investment metrics.

These endpoints heavily rely on their corresponding controllers to parse parameters before invoking complex, CPU-bound service layer functions.
