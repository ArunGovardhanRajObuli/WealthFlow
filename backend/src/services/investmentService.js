const { nativeDb } = require('../../database');
const { syncAssetBalances } = require('./ledgerService');
const { isLongTerm: isLongTermUtils, getLocalYYYYMMDD } = require('../utils/analyticsUtils');



exports.getAllInvestments = () => {
    return nativeDb.prepare('SELECT * FROM investments').all();
};

exports.createInvestment = (data) => {
    const {
        title, category, assetClass, currentAmount, targetAmount, roi, dividendYield,
        unrealizedGain, schemeCode, latestNav, isHistorical, totalUnits,
        owner_member_id, joint_owner_member_id, owner_split_percent,
        source_bank_id, joint_bank_id, validatedSplitAmount
    } = data;

    const insertInv = nativeDb.prepare(
        'INSERT INTO investments (title, category, assetClass, currentAmount, targetAmount, roi, dividendYield, unrealizedGain, schemeCode, latestNav, totalUnits, owner_member_id, joint_owner_member_id, owner_split_percent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const insertTx = nativeDb.prepare(
        'INSERT INTO transactions (title, date, category, isTaxDeductible, source_bank_id, joint_bank_id, split_amount, split_percent, investment_id, asset_units) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    const tx = nativeDb.transaction(() => {
        const info = insertInv.run(title, category, assetClass, '0.00', targetAmount, roi, dividendYield, unrealizedGain, schemeCode, latestNav, 0, owner_member_id, joint_owner_member_id, owner_split_percent);
        const newId = info.lastInsertRowid;
        
        if (parseFloat(currentAmount) > 0) {
            const today = getLocalYYYYMMDD();
            let txInfo;
            if (!isHistorical) {
                const txTitle = `Capital -> ${title}`;
                const isTaxDed = (title.toLowerCase().includes('elss') || category.toLowerCase() === 'elss' || category.toLowerCase() === 'ppf' || category.toLowerCase() === 'epf') ? 1 : 0;
                txInfo = insertTx.run(txTitle, today, 'investment', isTaxDed, source_bank_id, joint_bank_id, validatedSplitAmount, owner_split_percent, newId, totalUnits);
                const txObj = { id: txInfo.lastInsertRowid, title: txTitle, amount: currentAmount, type: 'expense', category: 'investment', date: today, source_bank_id, joint_bank_id, split_amount: validatedSplitAmount, split_percent: owner_split_percent, investment_id: newId, asset_units: totalUnits };
                syncAssetBalances(null, txObj);
            } else {
                const txTitle = `Opening Balance: ${title}`;
                txInfo = insertTx.run(txTitle, today, 'opening_balance', 0, null, null, null, owner_split_percent, newId, totalUnits);
                const txObj = { id: txInfo.lastInsertRowid, title: txTitle, amount: currentAmount, type: 'income', category: 'opening_balance', date: today, split_percent: owner_split_percent, investment_id: newId, asset_units: totalUnits };
                syncAssetBalances(null, txObj);
            }
            
            // Track FIFO lot
            nativeDb.prepare('INSERT INTO investment_lots (investment_id, purchaseDate, purchaseAmount, units, costBasis, currentNav, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
                .run(newId, today, currentAmount, totalUnits, currentAmount, latestNav || 0, txInfo.lastInsertRowid);
        }
        return newId;
    });

    return tx();
};

exports.fundInvestment = (investId, amount, source_bank_id, joint_bank_id, split_amount) => {
    const getInv = nativeDb.prepare('SELECT latestNav, title, category, owner_split_percent FROM investments WHERE id = ?');
    const insertTx = nativeDb.prepare('INSERT INTO transactions (title, date, category, isTaxDeductible, source_bank_id, joint_bank_id, split_amount, split_percent, investment_id, asset_units) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const insertSip = nativeDb.prepare('INSERT INTO sip_purchases (investment_id, date, amount, navPrice, unitsPurchased, transaction_id) VALUES (?, ?, ?, ?, ?, ?)');

    const tx = nativeDb.transaction(() => {
        const inv = getInv.get(investId);
        if (!inv) throw new Error('Not found');
        
        let newUnits = 0;
        if (inv.latestNav > 0) {
            newUnits = parseFloat(amount) / inv.latestNav;
        }
        
        const today = getLocalYYYYMMDD();
        if (parseFloat(amount) > 0) {
            const txTitle = `Capital → ${inv.title}`;
            const isTaxDed = (inv.title.toLowerCase().includes('elss') || (inv.category && inv.category.toLowerCase() === 'elss') || (inv.category && inv.category.toLowerCase() === 'ppf') || (inv.category && inv.category.toLowerCase() === 'epf')) ? 1 : 0;
            const txInfo = insertTx.run(txTitle, today, 'investment', isTaxDed, source_bank_id, joint_bank_id, split_amount, inv.owner_split_percent || 100, investId, newUnits);
            
            const txObj = { id: txInfo.lastInsertRowid, title: txTitle, amount, type: 'expense', category: 'investment', date: today, source_bank_id, joint_bank_id, split_amount, split_percent: inv.owner_split_percent || 100, investment_id: investId, asset_units: newUnits };
            syncAssetBalances(null, txObj);
            
            insertSip.run(investId, today, amount, inv.latestNav || 0, newUnits, txInfo.lastInsertRowid);
            
            // Track FIFO lot
            nativeDb.prepare('INSERT INTO investment_lots (investment_id, purchaseDate, purchaseAmount, units, costBasis, currentNav, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
                .run(investId, today, amount, newUnits, amount, inv.latestNav || 0, txInfo.lastInsertRowid);
        }
        return newUnits;
    });

    return tx();
};

exports.sellInvestment = (investId, unitsToSell, source_bank_id, joint_bank_id, validateAmountFn) => {
    const getInv = nativeDb.prepare('SELECT currentAmount, totalUnits, latestNav, title, assetClass, owner_split_percent FROM investments WHERE id = ?');
    const getLots = nativeDb.prepare('SELECT id, units, costBasis, purchaseDate FROM investment_lots WHERE investment_id = ? AND units > 0 ORDER BY purchaseDate ASC');
    const delLot = nativeDb.prepare('DELETE FROM investment_lots WHERE id = ?');
    const updateLot = nativeDb.prepare('UPDATE investment_lots SET units = ?, costBasis = ? WHERE id = ?');
    const insertTx = nativeDb.prepare('INSERT INTO transactions (title, date, category, isTaxDeductible, source_bank_id, joint_bank_id, split_amount, split_percent, investment_id, asset_units) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const insertTxGeneral = nativeDb.prepare('INSERT INTO transactions (title, date, category, isTaxDeductible, source_bank_id, joint_bank_id, split_amount, split_percent, investment_id) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)');

    let capitalRetrieved = 0;
    let realizedGain = 0;
    const today = getLocalYYYYMMDD();

    const tx = nativeDb.transaction(() => {
        const inv = getInv.get(investId);
        if (!inv) throw new Error('Not found');
        
        const totalUnits = inv.totalUnits || 0;
        if (unitsToSell > totalUnits) throw new Error('Cannot sell more units than owned');

        const nav = inv.latestNav || 0;
        const currentAmount = inv.currentAmount || 0;
        const lots = getLots.all(investId);

        let remainingToSell = unitsToSell;
        let investedCapitalReduction = 0;
        const lotUpdates = [];
        
        let realizedLTCG = 0;
        let realizedSTCG = 0;
        let realizedSTCG_Debt = 0;
        let realizedLTCL = 0;
        let realizedSTCL = 0;
        
        let hasGrandfatheredLtcg = false;

        if (lots && lots.length > 0) {
            for (const lot of lots) {
                if (remainingToSell <= 0) break;
                const unitsFromLot = Math.min(remainingToSell, lot.units);
                const costPerUnit = lot.units > 0 ? (lot.costBasis / lot.units) : 0;
                
                const lotCost = unitsFromLot * costPerUnit;
                const lotProceeds = unitsFromLot * nav;
                const lotGain = lotProceeds - lotCost;
                
                const pdStr = lot.purchaseDate;
                const normalizedClass = (inv.assetClass || '').toLowerCase().trim();
                const isEquity = normalizedClass === 'equity';
                const isSovereign = normalizedClass === 'sovereign';
                
                let isLongTerm = pdStr ? isLongTermUtils(pdStr) : false;
                isLongTerm = isEquity && isLongTerm;
                
                const isGrandfathered = pdStr && new Date(pdStr) < new Date('2018-02-01');
                
                if (isSovereign) {
                    investedCapitalReduction += lotProceeds;
                } else {
                    const isDebt = !isEquity && !isSovereign;
                    if (lotGain > 0) {
                        if (isLongTerm) {
                            realizedLTCG += lotGain;
                            if (isGrandfathered) hasGrandfatheredLtcg = true;
                        }
                        else if (isDebt) realizedSTCG_Debt += lotGain;
                        else realizedSTCG += lotGain;
                    } else if (lotGain < 0) {
                        if (isLongTerm) realizedLTCL += Math.abs(lotGain);
                        else realizedSTCL += Math.abs(lotGain);
                    }
                    investedCapitalReduction += lotCost;
                }
                
                remainingToSell -= unitsFromLot;
                lotUpdates.push({ id: lot.id, newUnits: lot.units - unitsFromLot, newCostBasis: lot.costBasis - lotCost });
            }
        }
        
        if (remainingToSell > 0.000001) {
            const avgCost = totalUnits > 0 ? (currentAmount / totalUnits) : 0;
            const fallbackCost = remainingToSell * avgCost;
            const fallbackProceeds = remainingToSell * nav;
            const normalizedClass = (inv.assetClass || '').toLowerCase().trim();
            
            if (normalizedClass === 'sovereign') {
                investedCapitalReduction += fallbackProceeds;
            } else {
                investedCapitalReduction += fallbackCost;
                const fallbackGain = fallbackProceeds - fallbackCost;
                const isDebt = normalizedClass !== 'equity' && normalizedClass !== 'sovereign';
                if (fallbackGain > 0) {
                    if (isDebt) realizedSTCG_Debt += fallbackGain;
                    else realizedSTCG += fallbackGain;
                } else if (fallbackGain < 0) {
                    realizedSTCL += Math.abs(fallbackGain);
                }
            }
        }

        capitalRetrieved = unitsToSell * nav;

        for (const update of lotUpdates) {
            if (update.newUnits < 0.001) {
                delLot.run(update.id);
            } else {
                updateLot.run(update.newUnits, update.newCostBasis, update.id);
            }
        }
        
        const splitPercent = inv.owner_split_percent || 100;
        const calcSplit = (amount) => (splitPercent < 100 ? (amount * (100 - splitPercent)) / 100 : 0);

        const addTx = (title, amount, category, type) => {
            const splitAmt = validateAmountFn(calcSplit(amount));
            const txInfo = insertTxGeneral.run(title, today, category, source_bank_id, joint_bank_id, splitAmt, splitPercent, investId);
            const txObj = { id: txInfo.lastInsertRowid, title, amount: validateAmountFn(amount), type, category, date: today, source_bank_id, joint_bank_id, split_amount: splitAmt, split_percent: splitPercent, investment_id: investId };
            syncAssetBalances(null, txObj);
        };

        const capitalSplitAmt = validateAmountFn(calcSplit(investedCapitalReduction));
        const titleCap = `Capital Retrieved ← ${inv.title}`;
        const amtCap = validateAmountFn(investedCapitalReduction);
        const txInfo = insertTx.run(titleCap, today, 'capital_retrieval', 0, source_bank_id, joint_bank_id, capitalSplitAmt, splitPercent, investId, unitsToSell);
        const txObj = { id: txInfo.lastInsertRowid, title: titleCap, amount: amtCap, type: 'income', category: 'capital_retrieval', date: today, source_bank_id, joint_bank_id, split_amount: capitalSplitAmt, split_percent: splitPercent, investment_id: investId, asset_units: unitsToSell };
        syncAssetBalances(null, txObj);
            
        if (realizedLTCG > 0) {
            const titleStr = hasGrandfatheredLtcg ? `LTCG: ${inv.title} [NEEDS FMV ADJUSTMENT]` : `LTCG: ${inv.title}`;
            addTx(titleStr, realizedLTCG, 'realized_ltcg', 'income');
        }
        if (realizedSTCG > 0) addTx(`STCG: ${inv.title}`, realizedSTCG, 'realized_stcg', 'income');
        if (realizedSTCG_Debt > 0) addTx(`STCG (Debt): ${inv.title}`, realizedSTCG_Debt, 'realized_stcg_debt', 'income');
        if (realizedLTCL > 0) addTx(`LTCL: ${inv.title}`, realizedLTCL, 'realized_ltcl', 'expense');
        if (realizedSTCL > 0) addTx(`STCL: ${inv.title}`, realizedSTCL, 'realized_stcl', 'expense');

        realizedGain = (realizedLTCG + realizedSTCG + realizedSTCG_Debt) - (realizedLTCL + realizedSTCL);
    });

    tx();
    return { capitalRetrieved, realizedGain };
};

exports.deleteInvestment = (investId) => {
    const checkTxs = nativeDb.prepare('SELECT COUNT(id) as cnt FROM transactions WHERE investment_id = ?').get(investId);
    if (checkTxs && checkTxs.cnt > 0) {
        throw new Error('Cannot delete: ' + checkTxs.cnt + ' transaction(s) are linked to this entity. Delete them first to maintain ledger integrity.');
    }
    const delInv = nativeDb.prepare('DELETE FROM investments WHERE id = ?');
    const delSip = nativeDb.prepare('DELETE FROM sip_purchases WHERE investment_id = ?');
    const delLots = nativeDb.prepare('DELETE FROM investment_lots WHERE investment_id = ?');
    let delNominees;
    try { delNominees = nativeDb.prepare('DELETE FROM nominees WHERE assetType = "Investment" AND assetId = ?'); } catch(e) { console.warn('Nominees table not available for cleanup:', e.message); }

    const tx = nativeDb.transaction(() => {
        delSip.run(investId);
        delLots.run(investId);
        delInv.run(investId);
        if (delNominees) delNominees.run(investId);
    });

    tx();
};

exports.addDividend = (investId, amount, date, target_bank_id, joint_bank_id, validatedSplitAmount) => {
    const getInv = nativeDb.prepare('SELECT * FROM investments WHERE id = ?');
    const insertTx = nativeDb.prepare(
        `INSERT INTO transactions (title, date, category, source_bank_id, joint_bank_id, split_amount, split_percent, investment_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const tx = nativeDb.transaction(() => {
        const inv = getInv.get(investId);
        if (!inv) throw new Error('Not found');
        
        const splitPercent = joint_bank_id ? inv.owner_split_percent : 100;
        
        const title = `Dividend: ${inv.schemeName || inv.title}`;
        const txInfo = insertTx.run(title, date, 'dividend', target_bank_id, joint_bank_id || null, validatedSplitAmount, splitPercent || 100, inv.id);
        const txObj = { id: txInfo.lastInsertRowid, title, amount, type: 'income', category: 'dividend', date, source_bank_id: target_bank_id, joint_bank_id: joint_bank_id || null, split_amount: validatedSplitAmount, split_percent: splitPercent || 100, investment_id: inv.id };
        syncAssetBalances(null, txObj);
    });

    tx();
};

exports.getInvestmentsWithSchemeCode = () => {
    return nativeDb.prepare('SELECT id, schemeCode, category FROM investments WHERE schemeCode IS NOT NULL').all();
};

exports.updateInvestmentNav = (nav, id) => {
    nativeDb.prepare('UPDATE investments SET latestNav = ? WHERE id = ?').run(nav, id);
};
