const debtAnalyticsService = require('../services/debtAnalyticsService');

exports.getDebtStrategy = (req, res, next) => {
    try {
        const data = debtAnalyticsService.getDebtStrategy();
        res.json({ data });
    } catch (err) {
        next(err);
    }
};

exports.getEmiModeler = (req, res, next) => {
    try {
        const skipMonths = parseInt(req.query.skipMonths, 10) || 0;
        const data = debtAnalyticsService.getEmiModeler(Math.max(0, skipMonths));
        res.json(data);
    } catch (err) {
        next(err);
    }
};
