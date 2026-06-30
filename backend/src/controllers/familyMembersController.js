const { validateAmount } = require('../utils/financialUtils');
const familyService = require('../services/familyService');

exports.getAll = (req, res, next) => {
    try {
        const enrichedRows = familyService.getAllMembers();
        res.json({ data: enrichedRows });
    } catch (err) {
        next(err);
    }
};

exports.create = (req, res, next) => {
    let { name, role, age, annualIncome = 0, lifeInsuranceCoverage = 0, collegeSavings = 0, targetAge = 18, targetCollegeValue = 150000, source_bank_id = null } = req.body;
    age = parseFloat(age) || 0; 
    annualIncome = validateAmount(annualIncome, true) || '0.00'; 
    lifeInsuranceCoverage = validateAmount(lifeInsuranceCoverage, true) || '0.00'; 
    const collegeSavingsInitial = validateAmount(collegeSavings, true) || '0.00'; 
    targetAge = parseFloat(targetAge) || 0; 
    targetCollegeValue = validateAmount(targetCollegeValue, true) || '0.00';
    
    if (parseFloat(collegeSavingsInitial) > 0 && !source_bank_id) {
        return res.status(400).json({ error: "Double-Entry Accounting Error: A valid Source Bank Account is required to fund the initial Endowment." });
    }

    try {
        const newId = familyService.createMember({
            name, role, age, annualIncome, lifeInsuranceCoverage, targetAge, targetCollegeValue, collegeSavingsInitial, source_bank_id
        });
        res.json({ id: newId });
    } catch (err) {
        next(err);
    }
};

exports.fund = (req, res, next) => {
    const amountStr = validateAmount(req.body.amount, false);
    if (!amountStr) return res.status(400).json({ error: "Invalid amount" });
    const isNegative = Number(req.body.amount) < 0;
    const source_bank_id = req.body.source_bank_id || null;
    const memberId = req.params.id;
    
    if (!source_bank_id) {
        return res.status(400).json({ error: "Double-Entry Accounting Error: A valid Source Bank Account is required for Endowment transactions." });
    }
    
    try {
        const newSavings = familyService.fundMember(memberId, amountStr, isNegative, source_bank_id, req.body.amount);
        res.json({ success: true, newSavings });
    } catch (err) {
        if (err.message === "Member not found") return res.status(404).json({ error: "Member not found" });
        next(err);
    }
};

exports.update = (req, res, next) => {
    let { age, annualIncome, lifeInsuranceCoverage, targetAge, targetCollegeValue } = req.body;
    age = parseFloat(age) || 0; 
    annualIncome = validateAmount(annualIncome, true) || '0.00'; 
    lifeInsuranceCoverage = validateAmount(lifeInsuranceCoverage, true) || '0.00'; 
    targetAge = parseFloat(targetAge) || 0; 
    targetCollegeValue = validateAmount(targetCollegeValue, true) || '0.00';
    
    try {
        familyService.updateMember(req.params.id, {
            age, annualIncome, lifeInsuranceCoverage, targetAge, targetCollegeValue
        });
        res.json({ success: true });
    } catch (err) {
        if (err.message === "Member not found") return res.status(404).json({ error: "Member not found" });
        next(err);
    }
};

exports.remove = (req, res, next) => {
    const memberId = req.params.id;
    try {
        familyService.removeMember(memberId);
        res.json({ success: true });
    } catch (err) {
        if (err.message.startsWith('Cannot delete')) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
};
