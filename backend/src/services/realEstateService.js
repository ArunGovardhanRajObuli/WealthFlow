const { nativeDb } = require('../../database');
const { syncAssetBalances } = require('./ledgerService');
const { getLocalYYYYMMDD } = require('../utils/analyticsUtils');
const { parseToPaiseBigInt, formatBigIntToDecimalString } = require('../utils/financialUtils');



function getFYStart() {
    const nowStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const now = new Date(nowStr);
    const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return `${year}-04-01`;
}

let CII_TABLE = {
    '2001': 100, '2002': 105, '2003': 109, '2004': 113, '2005': 117,
    '2006': 122, '2007': 129, '2008': 137, '2009': 148, '2010': 167,
    '2011': 184, '2012': 200, '2013': 220, '2014': 240, '2015': 254,
    '2016': 264, '2017': 272, '2018': 280, '2019': 289, '2020': 301,
    '2021': 317, '2022': 331, '2023': 348, '2024': 363, '2025': 364
};

async function fetchLatestCII() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch('https://raw.githubusercontent.com/arung/wealthflow-cii/main/cii.json', { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const externalCII = await response.json();
            
            // Validate schema: keys must be YYYY, values must be numbers between 100 and 10000
            const validCII = {};
            for (const [key, val] of Object.entries(externalCII)) {
                if (/^\d{4}$/.test(key) && typeof val === 'number' && val >= 100 && val <= 10000) {
                    validCII[key] = val;
                }
            }
            
            if (Object.keys(validCII).length > 0) {
                CII_TABLE = { ...CII_TABLE, ...validCII };
                console.log('Successfully updated CII Table from API.');
            }
        }
    } catch (err) {
        console.log('Using default CII Table. Failed to fetch latest from API:', err.message);
    }
}
fetchLatestCII();

function getFYKeyForDate(date) {
    return (date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1).toString();
}

exports.getAllRealEstate = () => {
    const properties = nativeDb.prepare('SELECT * FROM real_estate').all();
    const fyStart = getFYStart();
    
    const txs = nativeDb.prepare(
        `SELECT t.propertyId, 
                SUM(CASE WHEN l.account_class = 'Revenue' THEN COALESCE(l.credit_amount, 0) - COALESCE(l.debit_amount, 0) ELSE 0 END) as total_income, 
                SUM(CASE WHEN l.account_class = 'Expense' THEN COALESCE(l.debit_amount, 0) - COALESCE(l.credit_amount, 0) ELSE 0 END) as total_expense
         FROM ledger_lines l
         JOIN transactions t ON l.transaction_id = t.id
         WHERE t.propertyId IS NOT NULL AND t.date >= ? 
           AND l.account_class IN ('Revenue', 'Expense')
         GROUP BY t.propertyId`
    ).all(fyStart);

    const allTimeTxs = nativeDb.prepare(
        `SELECT t.propertyId, 
                SUM(CASE WHEN l.account_class = 'Revenue' THEN COALESCE(l.credit_amount, 0) - COALESCE(l.debit_amount, 0) ELSE 0 END) as total_income, 
                SUM(CASE WHEN l.account_class = 'Expense' THEN COALESCE(l.debit_amount, 0) - COALESCE(l.credit_amount, 0) ELSE 0 END) as total_expense
         FROM ledger_lines l
         JOIN transactions t ON l.transaction_id = t.id
         WHERE t.propertyId IS NOT NULL 
           AND l.account_class IN ('Revenue', 'Expense')
         GROUP BY t.propertyId`
    ).all();

    const enriched = properties.map(p => {
        const fyData = txs.find(t => t.propertyId === p.id) || {};
        const fyRent = fyData.total_income || 0;
        const fyExpense = fyData.total_expense || 0;
        const lifetimeData = allTimeTxs.find(t => t.propertyId === p.id) || {};
        const lifetimeRent = lifetimeData.total_income || 0;
        const lifetimeExpense = lifetimeData.total_expense || 0;
        
        const marketVal = p.currentMarketValue || p.baseValue;
        const appreciation = marketVal - p.baseValue;
        const appreciationPct = p.baseValue > 0 ? ((appreciation / p.baseValue) * 100) : 0;
        
        let indexedCostBasis = p.baseValue;
        let ltcgTaxable = 0;
        let stcgTaxable = 0;
        let isLTCG = false;
        let monthsOwned = 12;
        
        if (p.purchaseDate) {
            const purchase = new Date(p.purchaseDate);
            const nowStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
            const now = new Date(nowStr);
            let calculatedMonths = (now.getFullYear() - purchase.getFullYear()) * 12 + (now.getMonth() - purchase.getMonth());
            if (now.getDate() < purchase.getDate()) calculatedMonths--;
            monthsOwned = Math.max(1, calculatedMonths);
            isLTCG = monthsOwned >= 24;

            const cutoffDate = new Date('2024-07-23');
            if (purchase < cutoffDate && isLTCG) {
                const purchaseFY = getFYKeyForDate(purchase);
                const currentFY = getFYKeyForDate(now);
                const purchaseCII = CII_TABLE[purchaseFY] || 100;
                const currentCII = CII_TABLE[currentFY] || 363;
                const baseForIndexation = p.fmv2001 || p.baseValue;
                indexedCostBasis = baseForIndexation * (currentCII / purchaseCII);
                
                const taxIndexed = Math.max(0, marketVal - indexedCostBasis) * 0.20;
                const taxUnindexed = Math.max(0, marketVal - p.baseValue) * 0.125;
                
                if (taxUnindexed <= taxIndexed) {
                    p.optimalTaxRegime = '12.5% Unindexed (Budget 2024)';
                    p.optimalTaxAmount = taxUnindexed;
                    ltcgTaxable = Math.max(0, marketVal - p.baseValue);
                } else {
                    p.optimalTaxRegime = '20% Indexed (Grandfathered)';
                    p.optimalTaxAmount = taxIndexed;
                    ltcgTaxable = Math.max(0, marketVal - indexedCostBasis);
                }
            } else if (isLTCG) {
                p.optimalTaxRegime = '12.5% Unindexed';
                p.optimalTaxAmount = Math.max(0, marketVal - p.baseValue) * 0.125;
                ltcgTaxable = Math.max(0, marketVal - p.baseValue);
                indexedCostBasis = p.baseValue; 
            }
        } else {
            ltcgTaxable = appreciation;
        }
        
        if (p.purchaseDate) {
            if (!isLTCG) {
                stcgTaxable = Math.max(0, marketVal - p.baseValue);
            }
        }
        const annualizedRent = monthsOwned > 0 ? (lifetimeRent / monthsOwned) * 12 : 0;
        const annualizedYield = marketVal > 0 ? ((annualizedRent / marketVal) * 100) : 0;
        
        return {
            ...p,
            ytdRent: fyRent,
            ytdMaintenance: fyExpense,
            lifetimeRent,
            lifetimeExpense,
            currentMarketValue: marketVal,
            appreciation,
            appreciationPct: parseFloat(appreciationPct.toFixed(2)),
            indexedCostBasis: Math.round(indexedCostBasis),
            ltcgTaxable: Math.round(ltcgTaxable),
            stcgTaxable: Math.round(stcgTaxable),
            isLTCG,
            annualizedYield: parseFloat(annualizedYield.toFixed(2)),
            monthsOwned
        };
    });
    
    return { enriched, fyStart };
};

exports.createRealEstate = ({ safeTitle, propertyType, baseValue, expectedRent, currentMarketValue, safePurchaseDate, occupancyStatus, safeLoanId, safeOwnerId, safeJointOwnerId, safeSplitPercent, safeSourceBankId, safeJointBankId, split_amount, isHistorical }) => {
    const insertProp = nativeDb.prepare(
        `INSERT INTO real_estate (title, propertyType, baseValue, expectedRent, currentMarketValue, purchaseDate, occupancyStatus, linkedLoanId, owner_member_id, joint_owner_member_id, owner_split_percent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertTx = nativeDb.prepare(
        `INSERT INTO transactions (title, date, category, isTaxDeductible, source_bank_id, joint_bank_id, split_amount, split_percent, propertyId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const tx = nativeDb.transaction(() => {
        const info = insertProp.run(safeTitle, propertyType, '0.00', expectedRent, currentMarketValue, safePurchaseDate, occupancyStatus, safeLoanId, safeOwnerId, safeJointOwnerId, safeSplitPercent);
        const newId = info.lastInsertRowid;
        
        if (parseFloat(baseValue) > 0) {
            let txInfo;
            if (!isHistorical) {
                const title = `Property Purchase: ${safeTitle}`;
                txInfo = insertTx.run(title, safePurchaseDate, 'capital_deployment', 0, safeSourceBankId, safeJointBankId, split_amount, safeSplitPercent, newId);
                const txObj = { id: txInfo.lastInsertRowid, title, amount: baseValue, type: 'expense', category: 'capital_deployment', date: safePurchaseDate, source_bank_id: safeSourceBankId, joint_bank_id: safeJointBankId, split_percent: safeSplitPercent, split_amount: split_amount, propertyId: newId };
                syncAssetBalances(null, txObj);
            } else {
                const title = `Opening Balance: ${safeTitle}`;
                txInfo = insertTx.run(title, safePurchaseDate, 'opening_balance', 0, null, null, null, safeSplitPercent, newId);
                const txObj = { id: txInfo.lastInsertRowid, title, amount: baseValue, type: 'income', category: 'opening_balance', date: safePurchaseDate, propertyId: newId, split_percent: safeSplitPercent };
                syncAssetBalances(null, txObj);
            }
        }
        return newId;
    });

    return tx();
};

exports.updateRealEstate = (id, updates, params) => {
    // Whitelist-validate every SET clause to prevent SQL injection
    const ALLOWED_COLUMNS = new Set([
        'currentMarketValue', 'occupancyStatus', 'linkedLoanId', 'expectedRent',
        'title', 'owner_member_id', 'joint_owner_member_id', 'owner_split_percent'
    ]);
    const setClausePattern = /^([a-zA-Z_]+)\s*=\s*\?$/;
    for (const clause of updates) {
        const match = clause.match(setClausePattern);
        if (!match || !ALLOWED_COLUMNS.has(match[1])) {
            throw new Error(`Invalid update column: ${clause}`);
        }
    }
    const updateQuery = nativeDb.prepare(`UPDATE real_estate SET ${updates.join(', ')} WHERE id = ?`);
    nativeDb.transaction(() => {
        updateQuery.run(...params);
    })();
};

exports.removeRealEstate = (propId) => {
    const checkTxs = nativeDb.prepare('SELECT COUNT(id) as cnt FROM transactions WHERE propertyId = ?').get(propId);
    if (checkTxs && checkTxs.cnt > 0) {
        throw new Error('Cannot delete: ' + checkTxs.cnt + ' transaction(s) are linked to this entity. Delete them first to maintain ledger integrity.');
    }
    
    const delProp = nativeDb.prepare('DELETE FROM real_estate WHERE id = ?');
    let delNominees;
    try { delNominees = nativeDb.prepare('DELETE FROM nominees WHERE assetType = "Real Estate" AND assetId = ?'); } catch(e) { console.warn('Nominees table not available for cleanup:', e.message); }

    const tx = nativeDb.transaction(() => {
        delProp.run(propId);
        if (delNominees) delNominees.run(propId);
    });

    tx();
};
