const express = require('express');
const router = express.Router();
const transactionsController = require('../controllers/transactionsController');
const transactionValidation = require('../middlewares/transactionValidation');

// Transaction endpoints
router.get('/transactions', transactionsController.getAll);
router.post('/transactions', transactionValidation, transactionsController.create);
router.put('/transactions/:id', transactionValidation, transactionsController.update);
router.delete('/transactions/:id', transactionsController.remove);

const upload = require('../middlewares/upload');

// New Migrated Endpoints
router.post('/scan-bill', upload.single('receipt'), transactionsController.scanBill);
router.post('/transfer', transactionsController.transfer);
router.post('/import-csv', upload.single('csvFile'), transactionsController.importCsv);

module.exports = router;
