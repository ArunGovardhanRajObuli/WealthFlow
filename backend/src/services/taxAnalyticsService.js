const { nativeDb } = require('../../database');
const { computeFdAccruedInterest } = require('../utils/financialUtils');
const { isMatured, getTrueAmortizedDebt, getFreeCash, getLocalYYYYMMDD, isLongTerm: isLongTermUtils } = require('../utils/analyticsUtils');

exports.getTaxHarvest = () => {
    const realizedSTCG = nativeDb.prepare("SELECT COALESCE(SUM(COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0)), 0) as val FROM ledger_lines l JOIN transactions t ON l.transaction_id = t.id WHERE LOWER(t.category) = 'realized_stcg' AND l.account_class='Revenue'").get().val;
    const realizedLTCG = nativeDb.prepare("SELECT COALESCE(SUM(COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0)), 0) as val FROM ledger_lines l JOIN transactions t ON l.transaction_id = t.id WHERE LOWER(t.category) = 'realized_ltcg' AND l.account_class='Revenue'").get().val;
    const realizedDebtGains = nativeDb.prepare("SELECT COALESCE(SUM(COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0)), 0) as val FROM ledger_lines l JOIN transactions t ON l.transaction_id = t.id WHERE LOWER(t.category) = 'realized_stcg_debt' AND l.account_class='Revenue'").get().val;
    
    const realizedSTCL = nativeDb.prepare("SELECT COALESCE(SUM(COALESCE(debit_amount, 0) - COALESCE(credit_amount, 0)), 0) as val FROM ledger_lines l JOIN transactions t ON l.transaction_id = t.id WHERE LOWER(t.category) = 'realized_stcl' AND l.account_class='Expense'").get().val;
    const realizedLTCL = nativeDb.prepare("SELECT COALESCE(SUM(COALESCE(debit_amount, 0) - COALESCE(credit_amount, 0)), 0) as val FROM ledger_lines l JOIN transactions t ON l.transaction_id = t.id WHERE LOWER(t.category) = 'realized_ltcl' AND l.account_class='Expense'").get().val;
    
    // Unrealized lots for Schedule 112A planning
    const lotsRaw = nativeDb.prepare(`
        SELECT il.*, i.title, i.schemeCode, i.latestNav, i.assetClass 
        FROM investment_lots il
        JOIN investments i ON il.investment_id = i.id
        WHERE il.units > 0
    `).all();
    
    const now = new Date();
    const enrichedLots = lotsRaw.map(lot => {
        const effectiveNav = lot.latestNav || lot.currentNav || 0;
        const currentValue = effectiveNav > 0 ? (lot.units * effectiveNav) : lot.costBasis;
        const unrealizedGain = currentValue - lot.costBasis;
        
        const pdStr = lot.purchaseDate;
        let isLongTerm = pdStr ? isLongTermUtils(pdStr) : false;
        
        const normalizedClass = (lot.assetClass || '').toLowerCase().trim();
        const isEquity = normalizedClass === 'equity';
        isLongTerm = isEquity && isLongTerm;

        return {
            ...lot,
            currentValue,
            unrealizedGain,
            isLongTerm
        };
    });
    
    return {
        data: {
            realizedSTCG,
            realizedLTCG,
            realizedDebtGains,
            realizedSTCL,
            realizedLTCL,
            lots: enrichedLots
        }
    };
};
