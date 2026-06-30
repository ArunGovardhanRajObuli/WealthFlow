const express = require('express');
const router = express.Router();
const loansController = require('../controllers/loansController');

router.get('/query', (req, res) => {
    const { nativeDb } = require('../../database');
    const data = nativeDb.prepare("SELECT id, title, startDate, dueDate, principalAmount FROM reminders WHERE category='loan'").all();
    res.json({ data });
});

router.post('/:id/refinance', loansController.refinance);
router.post('/:id/payments', loansController.payments);
router.post('/:id/restructure', loansController.restructure);

// Handled in app.js at /api/loans-list
// We can also route it here if desired, but we'll leave it in app.js routing for compatibility

module.exports = router;
