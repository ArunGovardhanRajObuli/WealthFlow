const taxAnalyticsService = require('../services/taxAnalyticsService');

exports.getTaxHarvest = (req, res, next) => {
    try {
        const result = taxAnalyticsService.getTaxHarvest();
        res.json(result);
    } catch (err) {
        next(err);
    }
};

