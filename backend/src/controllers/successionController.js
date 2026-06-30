const successionService = require('../services/successionService');
const { validateTitle, validateString, validateFk, validateAmount } = require('../utils/financialUtils');

exports.getAssignableAssets = (req, res, next) => {
    try {
        const result = successionService.getAssignableAssets();
        res.json(result);
    } catch (err) {
        next(err);
    }
};

exports.getSuccessionSummary = (req, res, next) => {
    try {
        const result = successionService.getSuccessionSummary();
        res.json(result);
    } catch (err) {
        next(err);
    }
};

exports.createNominee = (req, res, next) => {
    try {
        const { family_member_id, assetType, assetId, assetDescription, sharePercent, notes } = req.body;
        const safeData = {
            family_member_id: validateFk(family_member_id),
            assetType: validateString(assetType, 50),
            assetId: validateFk(assetId),
            assetDescription: validateTitle(assetDescription),
            sharePercent: validateAmount(sharePercent, true),
            notes: validateTitle(notes)
        };
        const result = successionService.createNominee(safeData);
        res.json(result);
    } catch (err) {
        if (err.message.includes('strictly positive') || err.message.includes('cannot exceed 100%') || err.message.includes('forged')) {
            return res.status(400).json({ error: err.message });
        }
        if (err.message.includes('Target family member does not exist') || err.message.includes('Orphan Injection Blocked')) {
            return res.status(404).json({ error: err.message });
        }
        next(err);
    }
};

exports.updateNominee = (req, res, next) => {
    try {
        const { sharePercent } = req.body;
        const safeData = {
            sharePercent: validateAmount(sharePercent, true)
        };
        const result = successionService.updateNominee(req.params.id, safeData);
        res.json(result);
    } catch (err) {
        if (err.message.includes('strictly positive') || err.message.includes('cannot exceed 100%')) {
            return res.status(400).json({ error: err.message });
        }
        if (err.message.includes('Nominee not found')) {
            return res.status(404).json({ error: err.message });
        }
        next(err);
    }
};

exports.deleteNominee = (req, res, next) => {
    try {
        const result = successionService.deleteNominee(req.params.id);
        res.json(result);
    } catch (err) {
        next(err);
    }
};

exports.executeSuccession = (req, res, next) => {
    try {
        const memberId = validateFk(req.params.memberId);
        const result = successionService.executeSuccession(memberId);
        res.json(result);
    } catch (err) {
        if (err.message.includes('not found') || err.message.includes('already executed')) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
};
