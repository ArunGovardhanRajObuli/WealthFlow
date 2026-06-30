const ledgerService = require('../services/ledgerService');

exports.getLedgerLines = (req, res, next) => {
    try {
        const rawLimit = parseInt(req.query.limit, 10);
        const limit = Math.max(1, Math.min(!isNaN(rawLimit) ? rawLimit : 1000, 1000));
        
        const rows = ledgerService.getLedgerLines(limit);
        
        if (!rows || rows.length === 0) return res.status(204).send();
        res.json({ data: rows });
    } catch (err) {
        next(err);
    }
};

exports.getFamilyEstateLedger = (req, res, next) => {
    try {
        const ledger = ledgerService.getFamilyEstateLedger();
        res.json({ ledger });
    } catch (err) {
        next(err);
    }
};

exports.getReconciliation = (req, res, next) => {
    try {
        const reconciliation = ledgerService.getReconciliation();
        res.json(reconciliation);
    } catch (err) {
        next(err);
    }
};

exports.getSystemReconciliation = (req, res, next) => {
    try {
        const sysReconciliation = ledgerService.getSystemReconciliation();
        res.json({ success: true, ...sysReconciliation });
    } catch (err) {
        next(err);
    }
};
