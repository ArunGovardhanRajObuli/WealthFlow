const express = require('express');
const router = express.Router();
const realEstateController = require('../controllers/realEstateController');

router.get('/', realEstateController.getAll);
router.post('/', realEstateController.create);
router.put('/:id', realEstateController.update);
router.delete('/:id', realEstateController.remove);

module.exports = router;
