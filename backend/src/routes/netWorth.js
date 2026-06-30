const express = require('express');
const router = express.Router();
const netWorthController = require('../controllers/netWorthController');

router.get('/', netWorthController.getNetWorthHistory);
router.post('/snapshot', netWorthController.createSnapshot);

module.exports = router;
