const { validateAmount, validateTitle, validateDate, validateFk } = require('../utils/financialUtils');
const reminderService = require('../services/reminderService');

function getLocalYYYYMMDD(d = new Date()) {
    const tzOffsetMs = d.getTimezoneOffset() * 60000;
    const localDate = new Date(d.getTime() - tzOffsetMs);
    return localDate.toISOString().split('T')[0];
}

exports.getAll = (req, res, next) => {
    try {
        const rows = reminderService.getAllReminders();
        res.json({ data: rows });
    } catch (err) {
        next(err);
    }
};

exports.create = (req, res, next) => {
    let { title, amount, dueDate, category, termYears = 0, frequency = 'once', principalAmount = "0", interestRate = 0, owner_member_id = null, policyType = 'Life', source_bank_id = null, maturityAmount = "0" } = req.body;
    const safeTitle = validateTitle(title) || 'Reminder';
    const safeDueDate = validateDate(dueDate) || getLocalYYYYMMDD();
    const safeOwnerId = validateFk(owner_member_id);
    const safeSourceBankId = validateFk(source_bank_id);
    const safeCategory = validateTitle(category) || 'reminder';
    const safeFrequency = validateTitle(frequency) || 'once';
    const safePolicyType = validateTitle(policyType) || 'Life';
    
    amount = validateAmount(amount, true) || "0.00"; 
    termYears = parseFloat(termYears) || 0; 
    principalAmount = validateAmount(principalAmount, true) || "0.00"; 
    interestRate = parseFloat(interestRate) || 0;
    maturityAmount = validateAmount(maturityAmount, true) || "0.00";
    
    try {
        if (safeCategory === 'loan' && parseFloat(principalAmount) > 0 && !safeSourceBankId) {
            return res.status(400).json({ error: "Valid Source Bank Account is required for loan disbursement." });
        }

        const newId = reminderService.createReminder({
            safeTitle, amount, safeDueDate, safeCategory, termYears, safeFrequency, principalAmount, interestRate, safeOwnerId, safePolicyType, safeSourceBankId, maturityAmount
        });

        res.json({ id: newId });
    } catch (err) {
        next(err);
    }
};

exports.update = (req, res, next) => {
    let { title, amount, dueDate, termYears = 0, frequency = 'once', principalAmount = "0", interestRate = 0, owner_member_id = null, policyType = 'Life', maturityAmount = "0" } = req.body;
    const safeTitle = validateTitle(title) || 'Reminder';
    const safeDueDate = validateDate(dueDate) || getLocalYYYYMMDD();
    const safeOwnerId = validateFk(owner_member_id);
    const safeFrequency = validateTitle(frequency) || 'once';
    const safePolicyType = validateTitle(policyType) || 'Life';
    
    amount = validateAmount(amount, true) || "0.00"; 
    termYears = parseFloat(termYears) || 0; 
    principalAmount = validateAmount(principalAmount, true) || "0.00"; 
    interestRate = parseFloat(interestRate) || 0;
    maturityAmount = validateAmount(maturityAmount, true) || "0.00";
    
    try {
        reminderService.updateReminder(req.params.id, {
            safeTitle, amount, safeDueDate, termYears, safeFrequency, principalAmount, interestRate, safeOwnerId, safePolicyType, maturityAmount
        });
        res.json({ success: true });
    } catch (err) {
        if (err.message.startsWith('Cannot modify Policy Type')) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
};

exports.remove = (req, res, next) => {
    try {
        reminderService.removeReminder(req.params.id);
        res.json({ success: true });
    } catch (err) {
        if (err.message.startsWith('Cannot delete:')) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
};
