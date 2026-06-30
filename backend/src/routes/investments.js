const express = require('express');
const router = express.Router();
const investmentsController = require('../controllers/investmentsController');

router.get('/', investmentsController.getAll);
router.post('/', investmentsController.create);
router.post('/:id/fund', investmentsController.fund);
router.post('/:id/sell', investmentsController.sell);
router.delete('/:id', investmentsController.remove);
router.post('/:id/dividend', investmentsController.addDividend);

router.post('/sync-market', investmentsController.syncMarket);

module.exports = router;
