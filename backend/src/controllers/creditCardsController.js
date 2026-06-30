const { parseToPaiseBigInt, validateTitle, validateDate, validateFk } = require('../utils/financialUtils');
const creditCardService = require('../services/creditCardService');

function getLocalYYYYMMDD(d = new Date()) {
    const tzOffsetMs = d.getTimezoneOffset() * 60000;
    const localDate = new Date(d.getTime() - tzOffsetMs);
    return localDate.toISOString().split('T')[0];
}

exports.getAll = (req, res, next) => {
    try {
        const rows = creditCardService.getAllCards();
        res.json({ data: rows });
    } catch (err) {
        next(err);
    }
};

exports.create = (req, res, next) => {
    const { name, creditLimit, currentBalance, dueDate, owner_member_id = null } = req.body;
    let limitStr = typeof creditLimit === 'string' ? creditLimit : String(creditLimit || 0);
    let balStr = typeof currentBalance === 'string' ? currentBalance : String(currentBalance || 0);
    const initialDebtPaise = parseToPaiseBigInt(balStr);
    const limitPaise = parseToPaiseBigInt(limitStr);
    
    const safeName = validateTitle(name) || 'Credit Card';
    const safeDueDate = validateDate(dueDate) || getLocalYYYYMMDD();
    const safeOwnerId = owner_member_id === '' ? null : owner_member_id;
    
    if (!safeOwnerId) {
        return res.status(400).json({ error: 'All credit cards must be explicitly assigned to a Family Member (Owner) to ensure Estate Ledger integrity.' });
    }
    
    try {
        const newCardId = creditCardService.createCard(safeName, limitPaise, initialDebtPaise, safeDueDate, safeOwnerId);
        res.json({ id: newCardId });
    } catch (err) {
        next(err);
    }
};

exports.update = (req, res, next) => {
    const { name, creditLimit, currentBalance, dueDate, owner_member_id = null } = req.body;
    const id = req.params.id;
    
    const safeName = validateTitle(name) || 'Credit Card';
    const safeDueDate = validateDate(dueDate) || getLocalYYYYMMDD();
    const safeOwnerId = owner_member_id === '' ? null : owner_member_id;
    
    if (!safeOwnerId) {
        return res.status(400).json({ error: 'All credit cards must be explicitly assigned to a Family Member (Owner) to ensure Estate Ledger integrity.' });
    }
    
    try {
        const limitPaise = parseToPaiseBigInt(creditLimit);
        
        creditCardService.updateCard(id, safeName, limitPaise, currentBalance, safeDueDate, safeOwnerId);
        res.json({ success: true });
    } catch (err) {
        if (err.message === "Not found") {
            return res.status(404).json({ error: 'Not found' });
        }
        if (err.message === "Cannot reduce balance below the total of tracked spends.") {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
};

exports.remove = (req, res, next) => {
    const id = req.params.id;
    try {
        creditCardService.removeCard(id);
        res.json({ success: true });
    } catch (err) {
        if (err.message.startsWith('Cannot delete')) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
};

exports.spend = (req, res, next) => {
    const { amount, description, newDueDate } = req.body;
    const spendAmtPaise = parseToPaiseBigInt(amount);
    if (spendAmtPaise <= 0n) return res.status(400).json({ error: 'Invalid amount' });
    const id = req.params.id;
    
    const safeDesc = validateTitle(description) || null;
    const safeDueDate = newDueDate ? (validateDate(newDueDate) || null) : null;
    
    try {
        const newBalance = creditCardService.spendOnCard(id, spendAmtPaise, safeDesc, safeDueDate);
        res.json({ success: true, newBalance });
    } catch (err) {
        if (err.message === "Card not found") return res.status(500).json({ error: "Card not found" });
        next(err);
    }
};

exports.pay = (req, res, next) => {
    const { amount, sourceBankId, joint_bank_id, split_amount } = req.body;
    const payAmtPaise = parseToPaiseBigInt(amount);
    if (payAmtPaise <= 0n) return res.status(400).json({ error: 'Invalid amount' });
    const id = req.params.id;
    
    const safeSourceBankId = validateFk(sourceBankId);
    if (!safeSourceBankId) {
        return res.status(400).json({ error: 'Valid Source Bank Account is required for credit card payments.' });
    }
    const safeJointBankId = validateFk(joint_bank_id);
    
    try {
        const splitAmtPaise = split_amount ? parseToPaiseBigInt(split_amount) : 0n;
        
        const newBalance = creditCardService.payCard(id, payAmtPaise, safeSourceBankId, safeJointBankId, splitAmtPaise);
        res.json({ success: true, newBalance });
    } catch (err) {
        if (err.message === "Card not found") return res.status(500).json({ error: "Card not found" });
        if (err.message === "Balance is already zero") return res.status(400).json({ error: "Balance is already zero" });
        if (err.message === "Split amount cannot exceed total payment amount") return res.status(400).json({ error: err.message });
        next(err);
    }
};
