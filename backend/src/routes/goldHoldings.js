const express = require('express');
const router = express.Router();
const goldHoldingsController = require('../controllers/goldHoldingsController');

// The /api/gold-portfolio endpoint was formerly standalone
router.get('/portfolio', goldHoldingsController.getPortfolio);
router.post('/sync', goldHoldingsController.syncPrice);

router.post('/', goldHoldingsController.create);
router.delete('/:id', goldHoldingsController.remove);

module.exports = router;
