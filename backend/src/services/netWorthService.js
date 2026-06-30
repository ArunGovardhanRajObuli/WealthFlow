const { nativeDb } = require('../../database');
const { getFreeCash, getTrueAmortizedDebt, getLocalYYYYMMDD } = require('../utils/analyticsUtils');

exports.getNetWorthHistory = () => {
    return nativeDb.prepare('SELECT * FROM net_worth_snapshots ORDER BY snapshotDate ASC').all();
};

exports.createSnapshot = () => {
    const freeCash = getFreeCash ? getFreeCash() : 0;
    
    const sinking = nativeDb.prepare("SELECT COALESCE(SUM(COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0)),0) as val FROM ledger_lines l JOIN transactions t ON l.transaction_id = t.id WHERE LOWER(t.category) = 'capital_deployment' AND t.sinking_fund_id IS NOT NULL AND l.account_type='bank'").get().val;
    const endow = nativeDb.prepare("SELECT COALESCE(SUM(COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0)),0) as val FROM ledger_lines l JOIN transactions t ON l.transaction_id = t.id WHERE LOWER(t.category) = 'capital_deployment' AND t.family_member_id IS NOT NULL AND l.account_type='bank'").get().val;
    const invest = nativeDb.prepare("SELECT COALESCE(SUM(COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0)),0) as val FROM ledger_lines l JOIN transactions t ON l.transaction_id = t.id WHERE LOWER(t.category) = 'capital_deployment' AND t.investment_id IS NOT NULL AND l.account_type='bank'").get().val;
    const realEstate = nativeDb.prepare("SELECT COALESCE(SUM(COALESCE(currentMarketValue, baseValue)),0) as val FROM real_estate").get().val;
    const goldValue = nativeDb.prepare("SELECT COALESCE(SUM(weightGrams * currentPricePerGram),0) as val FROM gold_holdings").get().val;
    const fdPrincipal = nativeDb.prepare("SELECT COALESCE(SUM(principal),0) as val FROM fixed_deposits").get().val;
    const npsValue = nativeDb.prepare("SELECT COALESCE(SUM(currentValue),0) as val FROM nps_accounts").get().val;
    
    const totalAssets = freeCash + sinking + endow + invest + realEstate + goldValue + fdPrincipal + npsValue;

    const ccBalance = nativeDb.prepare("SELECT COALESCE(SUM(COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0)),0) as val FROM ledger_lines WHERE account_class='Liability' AND account_type='credit_card'").get().val;
    const loanPrincipal = getTrueAmortizedDebt ? getTrueAmortizedDebt() : 0;
    
    const totalLiabilities = ccBalance + loanPrincipal;
    
    const snapshotDate = getLocalYYYYMMDD(new Date());

    const existing = nativeDb.prepare("SELECT id FROM net_worth_snapshots WHERE snapshotDate = ?").get(snapshotDate);
    if (existing) {
        nativeDb.prepare("UPDATE net_worth_snapshots SET assets = ?, liabilities = ? WHERE id = ?").run(totalAssets, totalLiabilities, existing.id);
    } else {
        nativeDb.prepare("INSERT INTO net_worth_snapshots (snapshotDate, assets, liabilities) VALUES (?, ?, ?)").run(snapshotDate, totalAssets, totalLiabilities);
    }

    return { success: true, message: 'Snapshot created' };
};
