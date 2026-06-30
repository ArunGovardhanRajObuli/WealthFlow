const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');

const rateLimit = require('express-rate-limit');
const auditLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: { error: 'Too many audit logs created' } });

router.get('/audit-logs', auditController.getAuditLogs);
router.post('/audit-logs', auditLimiter, auditController.createAuditLog);

module.exports = router;
