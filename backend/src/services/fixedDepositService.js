const { nativeDb } = require('../../database');
const { syncAssetBalances } = require('./ledgerService');
const { getLocalYYYYMMDD } = require('../utils/analyticsUtils');



exports.getAllFixedDeposits = () => {
    return nativeDb.prepare('SELECT * FROM fixed_deposits ORDER BY maturityDate ASC').all();
};

exports.createFixedDeposit = ({ safeBankName, principal, interestRate, safeTenure, safeStartDate, safeMaturityDate, isAutoRenew, isTaxSaver, safeOwnerId, safeJointOwnerId, safeSplitPercent, safeSourceBankId, isHistorical }) => {
    const insertFd = nativeDb.prepare(
        'INSERT INTO fixed_deposits (bankName, principal, interestRate, tenureMonths, startDate, maturityDate, maturityAmount, isAutoRenew, isTaxSaver, owner_member_id, joint_owner_member_id, owner_split_percent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const insertTx = nativeDb.prepare(
        'INSERT INTO transactions (title, date, category, isTaxDeductible, source_bank_id, split_percent, fd_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    const tx = nativeDb.transaction(() => {
        const periods = 4;
        const years = safeTenure / 12;
        const computedMaturityAmount = (parseFloat(principal) * Math.pow(1 + (interestRate / 100) / periods, periods * years)).toFixed(2);
        
        const info = insertFd.run(safeBankName, 0.00, interestRate, safeTenure, safeStartDate, safeMaturityDate, computedMaturityAmount, isAutoRenew, isTaxSaver, safeOwnerId, safeJointOwnerId, safeSplitPercent);
        const newId = info.lastInsertRowid;
        
        if (parseFloat(principal) > 0) {
            let txInfo;
            if (!isHistorical) {
                const title = `Capital -> FD ${safeBankName}`;
                const isTaxDed = isTaxSaver ? 1 : 0;
                txInfo = insertTx.run(title, safeStartDate, 'fd_investment', isTaxDed, safeSourceBankId, safeSplitPercent, newId);
                const txObj = { id: txInfo.lastInsertRowid, title, amount: principal, type: 'expense', category: 'fd_investment', date: safeStartDate, source_bank_id: safeSourceBankId, split_percent: safeSplitPercent, fd_id: newId };
                syncAssetBalances(null, txObj);
            } else {
                const title = `Opening Balance: FD ${safeBankName}`;
                txInfo = insertTx.run(title, safeStartDate, 'opening_balance', 0, null, safeSplitPercent, newId);
                const txObj = { id: txInfo.lastInsertRowid, title, amount: principal, type: 'income', category: 'opening_balance', date: safeStartDate, split_percent: safeSplitPercent, fd_id: newId };
                syncAssetBalances(null, txObj);
            }
        }
        return newId;
    });

    return tx();
};

exports.removeFixedDeposit = (id) => {
    const checkTxs = nativeDb.prepare('SELECT COUNT(id) as cnt FROM transactions WHERE fd_id = ?').get(id);
    if (checkTxs && checkTxs.cnt > 0) {
        throw new Error('Cannot delete: ' + checkTxs.cnt + ' transaction(s) are linked to this entity. Delete them first to maintain ledger integrity.');
    }
    
    const delFd = nativeDb.prepare('DELETE FROM fixed_deposits WHERE id = ?');
    const delNominees = nativeDb.prepare('DELETE FROM nominees WHERE assetType = \'Fixed Deposit\' AND assetId = ?');

    const tx = nativeDb.transaction(() => {
        delFd.run(id);
        delNominees.run(id);
    });

    tx();
};
