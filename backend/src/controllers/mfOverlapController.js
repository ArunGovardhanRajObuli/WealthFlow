const mfOverlapService = require('../services/mfOverlapService');

exports.getMfOverlap = (req, res, next) => {
    try {
        const data = mfOverlapService.getMfOverlap();
        res.json(data);
    } catch (err) {
        next(err);
    }
};
