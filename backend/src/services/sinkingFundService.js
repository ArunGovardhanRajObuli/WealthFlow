const { nativeDb } = require('../../database');
const { parseToPaiseBigInt, formatBigIntToDecimalString } = require('../utils/financialUtils');
const { getLocalYYYYMMDD } = require('../utils/analyticsUtils');
const { syncAssetBalances } = require('./ledgerService');



exports.getAllSinkingFunds = () => {
    return nativeDb.prepare('SELECT * FROM sinking_funds ORDER BY targetDate ASC').all();
};

exports.createSinkingFund = ({ safeTitle, targetAmount, currentAmount, safeTargetDate, safeOwnerId, safeJointOwnerId, split, safeSourceBankId }) => {
    const insertFund = nativeDb.prepare('INSERT INTO sinking_funds (title, targetAmount, currentAmount, targetDate, owner_member_id, joint_owner_member_id, owner_split_percent) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const insertTx = nativeDb.prepare('INSERT INTO transactions (title, date, category, isTaxDeductible, source_bank_id, sinking_fund_id) VALUES (?, ?, ?, ?, ?, ?)');

    const tx = nativeDb.transaction(() => {
        const info = insertFund.run(safeTitle, targetAmount, '0.00', safeTargetDate, safeOwnerId, safeJointOwnerId, split);
        const newId = info.lastInsertRowid;
        
        if (parseFloat(currentAmount) > 0) {
            const today = getLocalYYYYMMDD();
            let txInfo;
            if (safeSourceBankId) {
                const title = `Capital -> ${safeTitle}`;
                txInfo = insertTx.run(title, today, 'capital_deployment', 0, safeSourceBankId, newId);
                const txObj = { id: txInfo.lastInsertRowid, title, amount: currentAmount, type: 'expense', category: 'capital_deployment', date: today, source_bank_id: safeSourceBankId, sinking_fund_id: newId };
                syncAssetBalances(null, txObj);
            } else {
                const title = `Opening Balance: ${safeTitle}`;
                txInfo = insertTx.run(title, today, 'opening_balance', 0, null, newId);
                const txObj = { id: txInfo.lastInsertRowid, title, amount: currentAmount, type: 'income', category: 'opening_balance', date: today, sinking_fund_id: newId };
                syncAssetBalances(null, txObj);
            }
        }
        return newId;
    });

    return tx();
};

exports.updateSinkingFund = (id, { safeTitle, targetAmount, safeTargetDate, safeOwnerId, safeJointOwnerId, split }) => {
    const updateFund = nativeDb.prepare('UPDATE sinking_funds SET title = ?, targetAmount = ?, targetDate = ?, owner_member_id = ?, joint_owner_member_id = ?, owner_split_percent = ? WHERE id = ?');
    const result = updateFund.run(safeTitle, targetAmount, safeTargetDate, safeOwnerId, safeJointOwnerId, split, id);
    if (result.changes === 0) {
        throw new Error('Not found');
    }
};

exports.fundSinkingFund = (fundId, amount, safeSourceBankId) => {
    const getFund = nativeDb.prepare('SELECT title, currentAmount FROM sinking_funds WHERE id = ?');
    const insertTx = nativeDb.prepare('INSERT INTO transactions (title, date, category, isTaxDeductible, source_bank_id, sinking_fund_id) VALUES (?, ?, ?, ?, ?, ?)');

    const tx = nativeDb.transaction(() => {
        const fund = getFund.get(fundId);
        if (!fund) throw new Error("Fund not found");
        
        const amountPaise = parseToPaiseBigInt(amount);
        
        if (amountPaise !== 0n) {
            const title = fund.title || 'Sinking Fund';
            const today = getLocalYYYYMMDD();
            
            let txInfo;
            if (amountPaise > 0n) {
                const txTitle = `Capital -> ${title}`;
                txInfo = insertTx.run(txTitle, today, 'capital_deployment', 0, safeSourceBankId, fundId);
                const txObj = { id: txInfo.lastInsertRowid, title: txTitle, amount, type: 'expense', category: 'capital_deployment', date: today, source_bank_id: safeSourceBankId, sinking_fund_id: fundId };
                syncAssetBalances(null, txObj);
            } else if (amountPaise < 0n) {
                const txTitle = `Retrieval <- ${title}`;
                const posAmount = formatBigIntToDecimalString(-amountPaise);
                txInfo = insertTx.run(txTitle, today, 'capital_retrieval', 0, safeSourceBankId, fundId);
                const txObj = { id: txInfo.lastInsertRowid, title: txTitle, amount: posAmount, type: 'income', category: 'capital_retrieval', date: today, source_bank_id: safeSourceBankId, sinking_fund_id: fundId };
                syncAssetBalances(null, txObj);
            }
        }
    });

    tx();
};

exports.removeSinkingFund = (fundId) => {
    const checkTxs = nativeDb.prepare('SELECT COUNT(id) as cnt FROM transactions WHERE sinking_fund_id = ?').get(fundId);
    if (checkTxs && checkTxs.cnt > 0) {
        throw new Error('Cannot delete: ' + checkTxs.cnt + ' transaction(s) are linked to this entity. Delete them first to maintain ledger integrity.');
    }

    const delFund = nativeDb.prepare('DELETE FROM sinking_funds WHERE id = ?');
    let delNominees;
    try { delNominees = nativeDb.prepare("DELETE FROM nominees WHERE assetType = 'Sinking Fund' AND assetId = ?"); } catch(e) { console.warn('Nominees table not available for cleanup:', e.message); }

    const tx = nativeDb.transaction(() => {
        const fund = nativeDb.prepare('SELECT title FROM sinking_funds WHERE id = ?').get(fundId);
        if (!fund) throw new Error("Not found");
        
        delFund.run(fundId);
        if (delNominees) delNominees.run(fundId);
    });

    tx();
};
