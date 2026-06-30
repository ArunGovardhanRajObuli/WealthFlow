const auditService = require('../services/auditService');
const { validateTitle, validateFk } = require('../utils/financialUtils');

exports.getAuditLogs = (req, res, next) => {
    try {
        const rows = auditService.getAuditLogs();
        res.json({ data: rows });
    } catch (err) {
        next(err);
    }
};

exports.createAuditLog = (req, res, next) => {
    try {
        const { action, entity, entity_id, details } = req.body;
        
        const safeAction = typeof action === 'string' && /^[a-zA-Z0-9_\- ]{2,50}$/.test(action) ? action : 'UNKNOWN_ACTION';
        const safeEntity = typeof entity === 'string' && /^[a-zA-Z0-9_\- ]{2,50}$/.test(entity) ? entity : 'UNKNOWN_ENTITY';
        const safeEntityId = validateFk(entity_id);
        const safeDetails = validateTitle(details) || 'No details provided';

        auditService.createAuditLog(safeAction, safeEntity, safeEntityId, safeDetails);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};
