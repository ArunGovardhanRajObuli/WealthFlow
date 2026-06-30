const express = require('express');
const router = express.Router();
const remindersController = require('../controllers/remindersController');

router.get('/', remindersController.getAll);
router.post('/', remindersController.create);
router.put('/:id', remindersController.update);
router.delete('/:id', remindersController.remove);

module.exports = router;
