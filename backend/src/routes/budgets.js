const express = require('express');
const router = express.Router();
const budgetsController = require('../controllers/budgetsController');

router.get('/', budgetsController.getAll);
router.post('/', budgetsController.create);
router.put('/:id', budgetsController.update);
router.delete('/:id', budgetsController.remove);

module.exports = router;
