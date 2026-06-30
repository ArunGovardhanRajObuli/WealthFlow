const express = require('express');
const router = express.Router();
const sinkingFundsController = require('../controllers/sinkingFundsController');

router.get('/', sinkingFundsController.getAll);
router.post('/', sinkingFundsController.create);
router.put('/:id', sinkingFundsController.update);
router.post('/:id/fund', sinkingFundsController.fund);
router.delete('/:id', sinkingFundsController.remove);

module.exports = router;
