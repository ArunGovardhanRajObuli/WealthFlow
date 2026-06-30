const { nativeDb } = require('../../database');
const { parseToPaiseBigInt, formatBigIntToDecimalString, validateAmount } = require('../utils/financialUtils');
const { syncAssetBalances } = require('./ledgerService');

exports.getGoldPortfolio = () => {
    const rows = nativeDb.prepare('SELECT * FROM gold_holdings').all();
    let totalWeightGrams = 0;
    let totalInvestedPaise = 0n;
    let totalCurrentValuePaise = 0n;
    let totalSGBInterestAccruedPaise = 0n;
    const byType = {};

    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const today = new Date(todayStr);

    const holdings = rows.map(h => {
        const weight = h.weightGrams || 0;
        const weightMg = BigInt(Math.round(weight * 1000));
        
        const purchasePricePaise = parseToPaiseBigInt(h.purchasePricePerGram || '0');
        const currentPricePaise = parseToPaiseBigInt(h.currentPricePerGram || '0');
        
        const investedPaise = (weightMg * purchasePricePaise) / 1000n;
        const currentValPaise = (weightMg * currentPricePaise) / 1000n;
        const gainPaise = currentValPaise - investedPaise;
        
        const investedNum = parseFloat(formatBigIntToDecimalString(investedPaise));
        const currentValNum = parseFloat(formatBigIntToDecimalString(currentValPaise));
        const gainNum = parseFloat(formatBigIntToDecimalString(gainPaise));
        
        const gainPct = investedNum > 0 ? ((gainNum / investedNum) * 100).toFixed(2) : 0;
        
        let yearsHeld = 0;
        if (h.purchaseDate) {
            const pDate = new Date(h.purchaseDate);
            if (today >= pDate) {
                yearsHeld = (today - pDate) / (1000 * 60 * 60 * 24 * 365.25);
            }
        }
        yearsHeld = Math.round(yearsHeld * 10) / 10;

        let sgbInterestAccruedNum = 0;
        let daysToMaturity = null;
        if (h.type === 'SGB' || h.type === 'Sovereign Gold Bond (SGB)') {
            let interestEndDate = today;
            if (h.maturityDate) {
                const mDate = new Date(h.maturityDate);
                daysToMaturity = Math.round((mDate - today) / (1000 * 60 * 60 * 24));
                if (mDate < today) {
                    interestEndDate = mDate;
                }
            }
            
            let interestYears = 0;
            if (h.purchaseDate) {
                const pDate = new Date(h.purchaseDate);
                if (interestEndDate >= pDate) {
                    interestYears = (interestEndDate - pDate) / (1000 * 60 * 60 * 24 * 365.25);
                }
            }

            const rate = parseFloat(h.interestRate) || 2.5;
            const accruedPaise = BigInt(Math.round(Number(investedPaise) * (rate / 100) * interestYears));
            totalSGBInterestAccruedPaise += accruedPaise;
            sgbInterestAccruedNum = parseFloat(formatBigIntToDecimalString(accruedPaise));
        }

        totalWeightGrams += weight;
        totalInvestedPaise += investedPaise;
        totalCurrentValuePaise += currentValPaise;

        if (!byType[h.type]) {
            byType[h.type] = { count: 0, weight: 0, invested: 0, currentVal: 0, gain: 0 };
        }
        byType[h.type].count++;
        byType[h.type].weight += weight;
        byType[h.type].invested += investedNum;
        byType[h.type].currentVal += currentValNum;
        byType[h.type].gain += gainNum;

        return {
            ...h,
            invested: investedNum,
            currentVal: currentValNum,
            gain: gainNum,
            gainPct,
            yearsHeld,
            sgbInterestAccrued: sgbInterestAccruedNum,
            daysToMaturity
        };
    });

    const totalInvestedNum = parseFloat(formatBigIntToDecimalString(totalInvestedPaise));
    const totalCurrentValueNum = parseFloat(formatBigIntToDecimalString(totalCurrentValuePaise));
    const unrealizedGainNum = parseFloat(formatBigIntToDecimalString(totalCurrentValuePaise - totalInvestedPaise));
    const totalSGBInterestAccruedNum = parseFloat(formatBigIntToDecimalString(totalSGBInterestAccruedPaise));
    const returnPct = totalInvestedNum > 0 ? ((unrealizedGainNum / totalInvestedNum) * 100).toFixed(2) : 0;

    return {
        totalWeightGrams: Math.round(totalWeightGrams * 100) / 100,
        totalInvested: totalInvestedNum,
        totalCurrentValue: totalCurrentValueNum,
        unrealizedGain: unrealizedGainNum,
        returnPct,
        totalSGBInterestAccrued: totalSGBInterestAccruedNum,
        byType,
        holdings
    };
};

exports.updateGoldPrice = (livePrice) => {
    const tx = nativeDb.transaction(() => {
        const updateRes = nativeDb.prepare('UPDATE gold_holdings SET currentPricePerGram = ?').run(livePrice);
        return updateRes.changes;
    });
    return tx();
};

exports.createGoldHolding = ({
    type, safeTitle, weightGrams, safePurchasePrice, safeCurrentPrice, safePurchaseDate, 
    interestRate, safeMaturityDate, owner_member_id, joint_owner_member_id, safeSplitPercent, 
    isHistorical, source_bank_id, joint_bank_id, split_amount
}) => {
    const insertGold = nativeDb.prepare(
        `INSERT INTO gold_holdings 
         (type, title, weightGrams, purchasePricePerGram, currentPricePerGram, purchaseDate, interestRate, maturityDate, owner_member_id, joint_owner_member_id, owner_split_percent) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertTx = nativeDb.prepare(
        `INSERT INTO transactions (title, date, category, source_bank_id, joint_bank_id, split_amount, split_percent, gold_id, asset_units) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const tx = nativeDb.transaction(() => {
        const info = insertGold.run(
            type || 'Physical', safeTitle, 0, safePurchasePrice, 
            safeCurrentPrice, safePurchaseDate, 
            interestRate || 0, safeMaturityDate, 
            owner_member_id || null, joint_owner_member_id || null, safeSplitPercent
        );
        const newId = info.lastInsertRowid;
        
        const investedAmt = (weightGrams * parseFloat(safePurchasePrice)).toFixed(2);
        
        if (!isHistorical) {
            const title = `Gold Purchase: ${safeTitle}`;
            const amount = validateAmount(investedAmt);
            const txInfo = insertTx.run(title, safePurchaseDate, 'capital_deployment', source_bank_id || null, joint_bank_id || null, split_amount || null, safeSplitPercent, newId, weightGrams);
            const txObj = { id: txInfo.lastInsertRowid, title, amount, type: 'expense', category: 'capital_deployment', date: safePurchaseDate, source_bank_id: source_bank_id || null, joint_bank_id: joint_bank_id || null, split_percent: safeSplitPercent, split_amount: split_amount || null, gold_id: newId, asset_units: weightGrams };
            syncAssetBalances(null, txObj);
        } else if (weightGrams > 0) {
            const title = `Opening Balance: ${safeTitle}`;
            const amount = validateAmount(investedAmt);
            const txInfo = insertTx.run(title, safePurchaseDate, 'opening_balance', null, null, null, safeSplitPercent, newId, weightGrams);
            const txObj = { id: txInfo.lastInsertRowid, title, amount, type: 'income', category: 'opening_balance', date: safePurchaseDate, split_percent: safeSplitPercent, gold_id: newId, asset_units: weightGrams };
            syncAssetBalances(null, txObj);
        }
        return newId;
    });

    return tx();
};

exports.removeGoldHolding = (id) => {
    const checkTxs = nativeDb.prepare('SELECT COUNT(id) as cnt FROM transactions WHERE gold_id = ?').get(id);
    if (checkTxs && checkTxs.cnt > 0) {
        throw new Error('Cannot delete: ' + checkTxs.cnt + ' transaction(s) are linked to this entity. Delete them first to maintain ledger integrity.');
    }

    const delGold = nativeDb.prepare('DELETE FROM gold_holdings WHERE id = ?');
    const delTxs = nativeDb.prepare('DELETE FROM transactions WHERE gold_id = ?');
    let delNominees;
    try { delNominees = nativeDb.prepare('DELETE FROM nominees WHERE assetType = "Gold Holding" AND assetId = ?'); } catch(e) { console.warn('Nominees table not available for cleanup:', e.message); }

    const tx = nativeDb.transaction(() => {
        delGold.run(id);
        delTxs.run(id);
        if (delNominees) delNominees.run(id);
    });

    tx();
};
