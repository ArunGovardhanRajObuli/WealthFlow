const { nativeDb } = require('../../database');

const isMatured = (dueDate, termYears, frequency = 'monthly') => {
    if (!dueDate) return false;
    const start = new Date(dueDate);
    if (isNaN(start.getTime())) return false;
    
    const freq = String(frequency || '').trim().toLowerCase();
    
    if (freq === 'once') {
        const end = new Date(start);
        end.setHours(23, 59, 59, 999);
        return end < new Date();
    }
    
    const tYears = parseFloat(String(termYears || '0').replace(/,/g, '')) || 0;
    if (tYears <= 0) return false;
    
    const end = new Date(start);
    end.setMonth(end.getMonth() + Math.round(tYears * 12));
    end.setHours(23, 59, 59, 999);
    return end < new Date();
};

function getTrueAmortizedDebt() {
    const row = nativeDb.prepare("SELECT COALESCE(SUM(CAST(REPLACE(credit_amount, ',', '') AS REAL) - CAST(REPLACE(debit_amount, ',', '') AS REAL)),0) as val FROM ledger_lines WHERE account_class='Liability' AND account_type IN ('loan', 'credit_card')").get();
    return row ? row.val || 0 : 0;
}

function getFreeCash() {
    const row = nativeDb.prepare("SELECT COALESCE(SUM(CAST(REPLACE(debit_amount, ',', '') AS REAL) - CAST(REPLACE(credit_amount, ',', '') AS REAL)),0) as val FROM ledger_lines WHERE account_class='Asset' AND account_type IN ('bank', 'operating', 'transfer_clearing')").get();
    return row ? row.val || 0 : 0;
}

function getLocalYYYYMMDD(dateObj = new Date()) {
    const tzOffset = dateObj.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(dateObj - tzOffset)).toISOString().slice(0, 10);
    return localISOTime;
}

function isLongTerm(purchaseDateStr) {
    if (!purchaseDateStr) return false;
    
    // Timezone Date Drift fix: parse YYYY-MM-DD in UTC to avoid 12-month boundary drift.
    const pdParts = purchaseDateStr.substring(0, 10).split('-');
    const pdUtc = new Date(Date.UTC(parseInt(pdParts[0], 10), parseInt(pdParts[1], 10) - 1, parseInt(pdParts[2], 10)));
    
    const oneYearLater = new Date(pdUtc.getTime());
    oneYearLater.setUTCFullYear(oneYearLater.getUTCFullYear() + 1);
    
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayParts = todayStr.split('-');
    const todayUtc = new Date(Date.UTC(parseInt(todayParts[0], 10), parseInt(todayParts[1], 10) - 1, parseInt(todayParts[2], 10)));
    
    return (oneYearLater.getTime() < todayUtc.getTime());
}

module.exports = {
    isMatured,
    getTrueAmortizedDebt,
    getFreeCash,
    getLocalYYYYMMDD,
    isLongTerm
};
