const npsService = require('../services/npsService');
const { validateAmount, validateTitle, validateDate } = require('../utils/financialUtils');

exports.getAll = (req, res, next) => {
    try {
        const rows = npsService.getAllNpsAccounts();
        res.json(rows || []);
    } catch (err) {
        next(err);
    }
};

exports.create = (req, res, next) => {
    let { pranNumber, memberName, tier, totalContribution, currentValue, monthlyContribution, employerContribution, equityPct, corpBondPct, govtSecPct, startDate, isHistorical = false, source_bank_id, joint_bank_id, owner_member_id, joint_owner_member_id, owner_split_percent, split_amount } = req.body;
    
    const safeMemberName = validateTitle(memberName) || 'Unknown';
    const safePranNumber = validateTitle(pranNumber) || 'N/A';
    const safeTier = validateTitle(tier) || 'Tier 1';
    
    totalContribution = validateAmount(totalContribution) || '0.00';
    currentValue = validateAmount(currentValue) || '0.00';
    monthlyContribution = validateAmount(monthlyContribution) || '0.00';
    employerContribution = validateAmount(employerContribution) || '0.00';
    
    const rawSplit = parseFloat(owner_split_percent);
    const safeSplitPercent = (!isNaN(rawSplit) && rawSplit >= 0 && rawSplit <= 100) ? rawSplit : 100;
    
    const safeStartDate = validateDate(startDate) || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    
    try {
        const newId = npsService.createNpsAccount(
            safePranNumber, safeMemberName, safeTier, totalContribution, currentValue, 
            monthlyContribution, employerContribution, equityPct, corpBondPct, govtSecPct, 
            safeStartDate, isHistorical, source_bank_id, joint_bank_id, 
            owner_member_id || null, joint_owner_member_id || null, safeSplitPercent, split_amount
        );
        res.json({ id: newId, success: true });
    } catch (err) {
        next(err);
    }
};

exports.update = (req, res, next) => {
    const id = req.params.id;
    let { pranNumber, memberName, tier, currentValue, monthlyContribution, employerContribution, equityPct, corpBondPct, govtSecPct, startDate, owner_member_id, joint_owner_member_id, owner_split_percent } = req.body;
    
    const safeMemberName = validateTitle(memberName) || 'Unknown';
    const safePranNumber = validateTitle(pranNumber) || 'N/A';
    const safeTier = validateTitle(tier) || 'Tier 1';
    
    currentValue = validateAmount(currentValue) || '0.00';
    monthlyContribution = validateAmount(monthlyContribution) || '0.00';
    employerContribution = validateAmount(employerContribution) || '0.00';
    
    const safeStartDate = validateDate(startDate) || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

    const rawSplit = parseFloat(owner_split_percent);
    const safeSplitPercent = (!isNaN(rawSplit) && rawSplit >= 0 && rawSplit <= 100) ? rawSplit : 100;
    const safeOwnerId = owner_member_id || null;
    const safeJointOwnerId = joint_owner_member_id || null;

    try {
        npsService.updateNpsAccount(
            id, safePranNumber, safeMemberName, safeTier, currentValue, 
            monthlyContribution, employerContribution, equityPct, corpBondPct, 
            govtSecPct, safeStartDate, safeOwnerId, safeJointOwnerId, safeSplitPercent
        );
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

exports.remove = (req, res, next) => {
    const id = req.params.id;
    try {
        npsService.deleteNpsAccount(id);
        res.json({ success: true });
    } catch (err) {
        if (err.message.includes('Cannot delete')) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
};

exports.getProjection = (req, res, next) => {
    const { currentAge, retirementAge } = req.query;
    try {
        const projectionData = npsService.getNpsProjections(currentAge, retirementAge);
        res.json(projectionData);
    } catch (err) {
        next(err);
    }
};
