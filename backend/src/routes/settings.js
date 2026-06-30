const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');

router.get('/', settingsController.getSettings);
router.post('/', settingsController.updateSettings);
router.post('/wipe', settingsController.wipeData);

module.exports = router;
