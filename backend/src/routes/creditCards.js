const express = require('express');
const router = express.Router();
const creditCardsController = require('../controllers/creditCardsController');

router.get('/', creditCardsController.getAll);
router.post('/', creditCardsController.create);
router.put('/:id', creditCardsController.update);
router.delete('/:id', creditCardsController.remove);
router.post('/:id/spend', creditCardsController.spend);
router.post('/:id/pay', creditCardsController.pay);

module.exports = router;
