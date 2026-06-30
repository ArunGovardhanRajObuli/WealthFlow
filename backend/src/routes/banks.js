const express = require('express');
const router = express.Router();
const bankController = require('../controllers/bankController');

router.get('/bank-balances', bankController.getBankBalances);
router.post('/bank-balances', bankController.createBankBalance);
router.delete('/bank-balances/:id', bankController.deleteBankBalance);

module.exports = router;
