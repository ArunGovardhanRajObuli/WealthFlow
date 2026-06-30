const express = require('express');
const router = express.Router();
const successionController = require('../controllers/successionController');

// Routes for Succession Planning
router.get('/assignable-assets', successionController.getAssignableAssets);
router.get('/succession-summary', successionController.getSuccessionSummary);
router.post('/nominees', successionController.createNominee);
router.put('/nominees/:id', successionController.updateNominee);
router.delete('/nominees/:id', successionController.deleteNominee);
router.post('/execute/:memberId', successionController.executeSuccession);

module.exports = router;
