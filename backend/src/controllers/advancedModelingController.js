const advancedModelingService = require('../services/advancedModelingService');

exports.getHlvCalculator = (req, res, next) => {
    try {
        const result = advancedModelingService.getHlvCalculator(req.query);
        res.json(result);
    } catch (err) {
        next(err);
    }
};

exports.runStressTest = (req, res, next) => {
    try {
        const result = advancedModelingService.runStressTest(req.body);
        res.json(result);
    } catch (err) {
        next(err);
    }
};

exports.getInflation = (req, res, next) => {
    try {
        const result = advancedModelingService.getInflation(req.query);
        res.json(result);
    } catch (err) {
        next(err);
    }
};

exports.getLifestyleCreep = (req, res, next) => {
    try {
        const result = advancedModelingService.getLifestyleCreep();
        res.json(result);
    } catch (err) {
        next(err);
    }
};



exports.getFreeCash = require('../utils/analyticsUtils').getFreeCash;
exports.getTrueAmortizedDebt = require('../utils/analyticsUtils').getTrueAmortizedDebt;
