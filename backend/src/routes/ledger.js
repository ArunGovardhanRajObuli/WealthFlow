const express = require('express');
const router = express.Router();
const ledgerController = require('../controllers/ledgerController');

router.get('/ledger-lines', ledgerController.getLedgerLines);
router.get('/family-estate-ledger', ledgerController.getFamilyEstateLedger);
router.get('/reconciliation', ledgerController.getReconciliation);
router.get('/system/reconciliation', ledgerController.getSystemReconciliation);

module.exports = router;
