const { validateAmount } = require('../utils/financialUtils');
const budgetService = require('../services/budgetService');

exports.getAll = (req, res, next) => {
    try {
        const enrichedRows = budgetService.getAllBudgets();
        res.json({ data: enrichedRows });
    } catch (err) {
        next(err);
    }
};

exports.create = (req, res, next) => {
    let { category, monthlyLimit } = req.body;
    if (!category || typeof category !== 'string' || category.trim() === '') {
        return res.status(400).json({ error: "Budget category name is strictly required." });
    }
    monthlyLimit = validateAmount(monthlyLimit, true) || '0.00';
    const safeCategory = category.trim().substring(0, 50);
    
    try {
        const newId = budgetService.createBudget(safeCategory, monthlyLimit);
        res.json({ id: newId });
    } catch (err) {
        next(err);
    }
};

exports.update = (req, res, next) => {
    let { category, monthlyLimit } = req.body;
    if (!category || typeof category !== 'string' || category.trim() === '') {
        return res.status(400).json({ error: "Budget category name is strictly required." });
    }
    monthlyLimit = validateAmount(monthlyLimit, true) || '0.00';
    const safeCategory = category.trim().substring(0, 50);
    
    try {
        budgetService.updateBudget(req.params.id, safeCategory, monthlyLimit);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

exports.remove = (req, res, next) => {
    try {
        budgetService.removeBudget(req.params.id);
        res.json({ success: true });
    } catch (err) {
        if (err.message.startsWith('Cannot delete:')) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
};
