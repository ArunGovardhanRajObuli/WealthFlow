const { validateAmount, validateTitle, validateDate, validateFk } = require('../utils/financialUtils');
const sinkingFundService = require('../services/sinkingFundService');

exports.getAll = (req, res, next) => {
    try {
        const rows = sinkingFundService.getAllSinkingFunds();
        res.json({ data: rows });
    } catch (err) {
        next(err);
    }
};

exports.create = (req, res, next) => {
    const { title, targetDate, source_bank_id = null, owner_member_id = null, joint_owner_member_id = null, owner_split_percent = 100 } = req.body;
    
    const safeTitle = validateTitle(title) || 'Sinking Fund';
    const safeTargetDate = validateDate(targetDate) || null;
    const safeSourceBankId = validateFk(source_bank_id);
    const safeOwnerId = validateFk(owner_member_id);
    const safeJointOwnerId = validateFk(joint_owner_member_id);
    let split = parseFloat(owner_split_percent);
    if (isNaN(split) || split < 0 || split > 100) split = 100;
    
    const targetAmount = validateAmount(req.body.targetAmount, true) || '0.00';
    const currentAmount = validateAmount(req.body.currentAmount, true) || '0.00';
    
    try {
        const newId = sinkingFundService.createSinkingFund({
            safeTitle, targetAmount, currentAmount, safeTargetDate, safeOwnerId, safeJointOwnerId, split, safeSourceBankId
        });
        res.json({ id: newId });
    } catch (err) {
        next(err);
    }
};

exports.update = (req, res, next) => {
    const { title, targetDate, owner_member_id = null, joint_owner_member_id = null, owner_split_percent = 100 } = req.body;
    const safeTitle = validateTitle(title) || 'Sinking Fund';
    const safeTargetDate = validateDate(targetDate) || null;
    const targetAmount = validateAmount(req.body.targetAmount, true) || '0.00';
    const safeOwnerId = validateFk(owner_member_id);
    const safeJointOwnerId = validateFk(joint_owner_member_id);
    let split = parseFloat(owner_split_percent);
    if (isNaN(split) || split < 0 || split > 100) split = 100;
    
    try {
        sinkingFundService.updateSinkingFund(req.params.id, {
            safeTitle, targetAmount, safeTargetDate, safeOwnerId, safeJointOwnerId, split
        });
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

exports.fund = (req, res, next) => {
    let amount = validateAmount(req.body.amount, false);
    if (!amount && req.body.amount !== 0 && req.body.amount !== "0") return res.status(400).json({ error: "Invalid amount" });
    amount = amount || '0.00';
    
    const safeSourceBankId = validateFk(req.body.source_bank_id);
    const fundId = req.params.id;
    
    if (!safeSourceBankId) {
        return res.status(400).json({ error: "Valid Source Bank Account is required to fund a Sinking Fund." });
    }
    
    try {
        sinkingFundService.fundSinkingFund(fundId, amount, safeSourceBankId);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

exports.remove = (req, res, next) => {
    const fundId = req.params.id;
    try {
        sinkingFundService.removeSinkingFund(fundId);
        res.json({ success: true, ledgerEntriesReversed: true });
    } catch (err) {
        if (err.message === 'Not found') {
            return res.status(404).json({ error: 'Not found' });
        }
        if (err.message.startsWith('Cannot delete')) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
};
