const analyticsService = require('../services/analyticsService');

exports.getLiquidity = (req, res, next) => {
    try {
        const metrics = analyticsService.getLiquidityMetrics();
        res.json(metrics);
    } catch (err) {
        next(err);
    }
};

exports.getDiagnostics = (req, res, next) => {
    try {
        const diagnostics = analyticsService.getDiagnosticsMetrics();
        res.json({ data: diagnostics });
    } catch (err) {
        next(err);
    }
};

exports.getEmergencyAdequacy = (req, res, next) => {
    try {
        const adequacy = analyticsService.getEmergencyAdequacyMetrics();
        res.json(adequacy);
    } catch (err) {
        next(err);
    }
};

exports.getSummary = (req, res, next) => {
    try {
        const period = req.query.period || 'mtd';
        const rows = analyticsService.getSummaryMetrics(period);
        res.json({ data: rows });
    } catch (err) {
        next(err);
    }
};
