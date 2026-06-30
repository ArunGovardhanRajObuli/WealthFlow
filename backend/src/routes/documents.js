const express = require('express');
const router = express.Router();
const documentsController = require('../controllers/documentsController');

const upload = require('../middlewares/upload');

router.get('/documents', documentsController.getDocuments);
router.post('/documents', upload.single('document'), documentsController.createDocument);
router.delete('/documents/:id', documentsController.deleteDocument);

module.exports = router;
