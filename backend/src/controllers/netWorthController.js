const netWorthService = require('../services/netWorthService');

exports.getNetWorthHistory = (req, res, next) => {
    try {
        const snapshots = netWorthService.getNetWorthHistory();
        res.json({ success: true, data: snapshots });
    } catch (err) {
        next(err);
    }
};

exports.createSnapshot = (req, res, next) => {
    try {
        const result = netWorthService.createSnapshot();
        res.json(result);
    } catch (err) {
        next(err);
    }
};
