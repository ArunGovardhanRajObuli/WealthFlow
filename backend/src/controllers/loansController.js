const loanService = require('../services/loanService');
const { validateAmount, validateTitle, validateDate, validateFk, parseToPaiseBigInt } = require('../utils/financialUtils');

function getLocalYYYYMMDD(d = new Date()) {
    const tzOffsetMs = d.getTimezoneOffset() * 60000;
    const localDate = new Date(d.getTime() - tzOffsetMs);
    return localDate.toISOString().split('T')[0];
}

exports.refinance = (req, res, next) => {
    let { title, amount, termYears, principalAmount, interestRate, owner_member_id } = req.body;
    const safeTitle = validateTitle(title) || null;
    const safeOwnerId = validateFk(owner_member_id);
    amount = validateAmount(amount, true) || '0.00'; 
    termYears = Math.max(0, Math.min(parseFloat(termYears) || 0, 100)); 
    principalAmount = validateAmount(principalAmount, true) || '0.00'; 
    interestRate = Math.max(0, Math.min(parseFloat(interestRate) || 0, 100));
    
    try {
        loanService.refinanceLoan(req.params.id, {
            safeTitle, amount, termYears, principalAmount, interestRate, safeOwnerId
        });
        res.status(204).send();
    } catch (err) {
        if (err.message === 'Loan not found') return res.status(404).json({ error: 'Loan not found' });
        next(err);
    }
};

exports.payments = (req, res, next) => {
    let { amount, date, source_bank_id, joint_bank_id, split_percent, split_amount, credit_card_id } = req.body;
    amount = validateAmount(amount);
    if (amount === null || parseFloat(amount) <= 0) return res.status(400).json({ error: "Invalid amount" });
    
    const safeDate = validateDate(date) || getLocalYYYYMMDD();
    const safeSourceBankId = validateFk(source_bank_id);
    const safeJointBankId = validateFk(joint_bank_id);
    const safeCreditCardId = validateFk(credit_card_id);
    
    if (!safeSourceBankId && !safeCreditCardId) {
        return res.status(400).json({ error: 'Valid Source Bank Account or Credit Card is required for loan payments.' });
    }

    const rawSplit = parseFloat(split_percent);
    const safeSplitPercent = (!isNaN(rawSplit) && rawSplit >= 0 && rawSplit <= 100) ? rawSplit : 100;
    
    const validatedSplitAmount = split_amount ? validateAmount(split_amount) : null;
    
    if (validatedSplitAmount) {
        const splitPaise = parseToPaiseBigInt(validatedSplitAmount);
        const totalPaise = parseToPaiseBigInt(amount);
        if (splitPaise < 0n || splitPaise > totalPaise) {
            return res.status(400).json({ error: 'Split amount must be between 0 and total payment amount.' });
        }
    }
    const loanId = req.params.id;
    
    try {
        const { txId } = loanService.recordPayment(loanId, {
            amount, safeDate, safeSourceBankId, safeJointBankId, safeSplitPercent, validatedSplitAmount, safeCreditCardId
        });
        res.json({ success: true, paymentId: txId });
    } catch (err) {
        if (err.message === 'Loan not found') return res.status(404).json({ error: 'Loan not found' });
        next(err);
    }
};

exports.restructure = (req, res, next) => {
    const loanId = req.params.id;
    const { type, skipMonths, source_bank_id } = req.body;
    const safeSourceBankId = validateFk(source_bank_id);
    
    if (type === 'bullet' && !safeSourceBankId) {
        return res.status(400).json({ error: 'Valid Source Bank Account is required for bullet restructure payments.' });
    }

    try {
        const restructured = loanService.restructureLoan(loanId, {
            type, skipMonths, safeSourceBankId
        });
        res.json({ success: true, restructured });
    } catch (err) {
        if (err.message === 'Loan not found') return res.status(404).json({ error: 'Loan not found' });
        next(err);
    }
};

exports.getLoansList = (req, res, next) => {
    try {
        const enriched = loanService.getLoansList();
        res.json({ data: enriched || [] });
    } catch (err) {
        next(err);
    }
};

exports.getAllPayments = (req, res, next) => {
    try {
        const rows = loanService.getAllPayments();
        res.json({ data: rows || [] });
    } catch (err) {
        next(err);
    }
};
