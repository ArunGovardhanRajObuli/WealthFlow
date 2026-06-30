const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const dividendController = require('../controllers/dividendController');
const mfOverlapController = require('../controllers/mfOverlapController');
// Route definition
// Actually, let's just define the routes here and not worry about heavyLimiter in the route file for now, I'll let app.js apply middleware or I'll skip heavyLimiter.
// Or wait, the user's instructions didn't specify about heavyLimiter, let's just define the routes.

const forecastingController = require('../controllers/forecastingController');
const debtAnalyticsController = require('../controllers/debtAnalyticsController');
const taxAnalyticsController = require('../controllers/taxAnalyticsController');
const advancedModelingController = require('../controllers/advancedModelingController');

// Core Analytics
router.get('/liquidity', analyticsController.getLiquidity);
router.get('/summary', analyticsController.getSummary);
router.get('/sentinel/diagnostics', analyticsController.getDiagnostics);
router.get('/emergency-adequacy', analyticsController.getEmergencyAdequacy);

// Forecasting
router.get('/forecast', forecastingController.getForecast);

// Debt Strategy
router.get('/debt-strategy', debtAnalyticsController.getDebtStrategy);
router.get('/emi-modeler', debtAnalyticsController.getEmiModeler);

// Tax & Advanced Modeling
router.get('/hlv-calculator', advancedModelingController.getHlvCalculator);
router.get('/tax-harvest', taxAnalyticsController.getTaxHarvest);
router.post('/stress-test', advancedModelingController.runStressTest);

router.get('/lifestyle-creep', advancedModelingController.getLifestyleCreep);


// External Controllers
router.get('/dividend-tracker', dividendController.getDividendTracker);
router.get('/mf-overlap', mfOverlapController.getMfOverlap);

module.exports = router;
