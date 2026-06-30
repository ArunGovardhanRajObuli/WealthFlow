const { validateAmount, validateTitle, validateDate, validateFk, parseToPaiseBigInt, getLocalYYYYMMDD } = require('../utils/financialUtils');
const realEstateService = require('../services/realEstateService');
const validStatuses = ['rented', 'self-occupied', 'vacant', 'commercial'];

exports.getAll = (req, res, next) => {
    try {
        const { enriched, fyStart } = realEstateService.getAllRealEstate();
        res.json({ data: enriched, fyStart });
    } catch (err) {
        next(err);
    }
};

exports.create = (req, res, next) => {
    let { title, propertyType, baseValue = '0', expectedRent = '0', currentMarketValue = '0', purchaseDate = null, occupancyStatus = 'rented', linkedLoanId = null, owner_member_id = null, joint_owner_member_id = null, owner_split_percent = 100, source_bank_id = null, joint_bank_id = null, split_amount = null, isHistorical = false } = req.body;
    
    const safeTitle = validateTitle(title) || 'Property';
    baseValue = validateAmount(baseValue, true) || '0.00';
    expectedRent = validateAmount(expectedRent, true) || '0.00';
    currentMarketValue = validateAmount(currentMarketValue, true) || baseValue;
    split_amount = split_amount ? validateAmount(split_amount, true) : null;
    
    const safePurchaseDate = validateDate(purchaseDate) || getLocalYYYYMMDD();
    
    const safeOwnerId = validateFk(owner_member_id);
    const safeJointOwnerId = validateFk(joint_owner_member_id);
    const safeSourceBankId = validateFk(source_bank_id);
    const safeJointBankId = validateFk(joint_bank_id);
    const safeLoanId = validateFk(linkedLoanId);
    
    const rawSplit = parseFloat(owner_split_percent);
    const safeSplitPercent = (!isNaN(rawSplit) && rawSplit >= 0 && rawSplit <= 100) ? rawSplit : 100;
    
    if (split_amount && parseToPaiseBigInt(split_amount) > parseToPaiseBigInt(baseValue)) {
        return res.status(400).json({ error: 'Double-Entry Accounting Error: Split amount cannot exceed base value.' });
    }
    const safeOccupancyStatus = validStatuses.includes(occupancyStatus) ? occupancyStatus : 'self-occupied';

    try {
        if (!isHistorical && !safeSourceBankId && parseFloat(baseValue) > 0) {
            throw new Error("Valid Source Bank Account is required for non-historical Property Purchases.");
        }
        
        const newId = realEstateService.createRealEstate({
            safeTitle, propertyType, baseValue, expectedRent, currentMarketValue, safePurchaseDate, occupancyStatus: safeOccupancyStatus, safeLoanId, safeOwnerId, safeJointOwnerId, safeSplitPercent, safeSourceBankId, safeJointBankId, split_amount, isHistorical
        });
        
        res.json({ id: newId });
    } catch (err) {
        next(err);
    }
};

exports.update = (req, res, next) => {
    const { currentMarketValue, occupancyStatus, linkedLoanId, expectedRent, title, owner_member_id, joint_owner_member_id, owner_split_percent } = req.body;
    const updates = [];
    const params = [];
    
    if (currentMarketValue !== undefined) { updates.push('currentMarketValue = ?'); params.push(validateAmount(currentMarketValue, true) || '0.00'); }
    if (occupancyStatus !== undefined) { 
        updates.push('occupancyStatus = ?'); 
        params.push(validStatuses.includes(occupancyStatus) ? occupancyStatus : 'self-occupied'); 
    }
    if (linkedLoanId !== undefined) { updates.push('linkedLoanId = ?'); params.push(validateFk(linkedLoanId)); }
    if (expectedRent !== undefined) { updates.push('expectedRent = ?'); params.push(validateAmount(expectedRent, true) || '0.00'); }
    if (title !== undefined) { const s = validateTitle(title); if (s) { updates.push('title = ?'); params.push(s); } }
    if (owner_member_id !== undefined) { updates.push('owner_member_id = ?'); params.push(validateFk(owner_member_id)); }
    if (joint_owner_member_id !== undefined) { updates.push('joint_owner_member_id = ?'); params.push(validateFk(joint_owner_member_id)); }
    if (owner_split_percent !== undefined) { 
        const rawSplit = parseFloat(owner_split_percent);
        const safeSplitPercent = (!isNaN(rawSplit) && rawSplit >= 0 && rawSplit <= 100) ? rawSplit : 100;
        updates.push('owner_split_percent = ?'); params.push(safeSplitPercent); 
    }
    
    if (updates.length === 0) return res.json({ success: true });
    params.push(req.params.id);
    
    try {
        realEstateService.updateRealEstate(req.params.id, updates, params);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

exports.remove = (req, res, next) => {
    const propId = req.params.id;
    try {
        realEstateService.removeRealEstate(propId);
        res.json({ success: true });
    } catch (err) {
        if (err.message.startsWith('Cannot delete')) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
};
