const express = require('express');
const router = express.Router();
const fixedDepositsController = require('../controllers/fixedDepositsController');

router.get('/', fixedDepositsController.getAll);
router.post('/', fixedDepositsController.create);
router.delete('/:id', fixedDepositsController.remove);

module.exports = router;
