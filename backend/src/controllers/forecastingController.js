const forecastingService = require('../services/forecastingService');

exports.getForecast = (req, res, next) => {
    try {
        const rawDays = parseInt(req.query.days, 10);
        const days = Math.max(1, Math.min(!isNaN(rawDays) ? rawDays : 30, 3650));
        const data = forecastingService.getForecast(days);
        res.json(data);
    } catch (err) {
        next(err);
    }
};


