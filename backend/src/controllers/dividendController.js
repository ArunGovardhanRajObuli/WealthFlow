const dividendService = require('../services/dividendService');

exports.getDividendTracker = (req, res, next) => {
    try {
        const data = dividendService.getDividendTracker();
        res.json(data);
    } catch (err) {
        next(err);
    }
};
