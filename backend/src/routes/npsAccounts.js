const express = require('express');
const router = express.Router();
const npsAccountsController = require('../controllers/npsAccountsController');

router.get('/', npsAccountsController.getAll);
router.post('/', npsAccountsController.create);
router.put('/:id', npsAccountsController.update);
router.delete('/:id', npsAccountsController.remove);

module.exports = router;
