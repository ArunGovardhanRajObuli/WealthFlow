const express = require('express');
const router = express.Router();
const familyMembersController = require('../controllers/familyMembersController');

router.get('/', familyMembersController.getAll);
router.post('/', familyMembersController.create);
router.put('/:id', familyMembersController.update);
router.post('/:id/fund', familyMembersController.fund);
router.delete('/:id', familyMembersController.remove);

module.exports = router;
