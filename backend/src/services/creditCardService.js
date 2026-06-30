const { nativeDb } = require('../../database');
const { parseToPaiseBigInt, formatBigIntToDecimalString } = require('../utils/financialUtils');
const { getLocalYYYYMMDD } = require('../utils/analyticsUtils');
const { syncAssetBalances } = require('./ledgerService');



exports.getAllCards = () => {
    return nativeDb.prepare('SELECT * FROM credit_cards').all();
};

exports.createCard = (safeName, limitPaise, initialDebtPaise, safeDueDate, safeOwnerId) => {
    const insertCard = nativeDb.prepare('INSERT INTO credit_cards (name, creditLimit, currentBalance, dueDate, owner_member_id) VALUES (?, ?, ?, ?, ?)');
    const insertTx = nativeDb.prepare('INSERT INTO transactions (title, date, category, isTaxDeductible, credit_card_id) VALUES (?,?,?,?,?)');

    const tx = nativeDb.transaction(() => {
        const info = insertCard.run(safeName, formatBigIntToDecimalString(limitPaise), '0.00', safeDueDate, safeOwnerId);
        const newCardId = info.lastInsertRowid;
        
        if (initialDebtPaise > 0n) {
            const today = getLocalYYYYMMDD();
            const title = `Opening Balance: ${safeName}`;
            const amount = formatBigIntToDecimalString(initialDebtPaise);
            const txInfo = insertTx.run(title, today, 'opening_balance', 0, newCardId);
            const txObj = { id: txInfo.lastInsertRowid, title, amount, type: 'expense', category: 'opening_balance', date: today, credit_card_id: newCardId };
            syncAssetBalances(null, txObj);
        }
        return newCardId;
    });

    return tx();
};

exports.updateCard = (id, safeName, limitPaise, currentBalance, safeDueDate, safeOwnerId) => {
    const getRow = nativeDb.prepare('SELECT currentBalance FROM credit_cards WHERE id = ?');
    const updateCardStmt = nativeDb.prepare('UPDATE credit_cards SET name = ?, creditLimit = ?, dueDate = ?, owner_member_id = ? WHERE id = ?');
    const getOB = nativeDb.prepare(`
        SELECT t.*, 
        (SELECT SUM(COALESCE(debit_amount, 0) - COALESCE(credit_amount, 0)) FROM ledger_lines WHERE transaction_id = t.id AND account_type = 'credit_card') as amount,
        'expense' as type
        FROM transactions t WHERE credit_card_id = ? AND category = "opening_balance"
    `);
    const insertOB = nativeDb.prepare('INSERT INTO transactions (title, date, category, isTaxDeductible, credit_card_id) VALUES (?,?,?,?,?)');

    const tx = nativeDb.transaction(() => {
        const row = getRow.get(id);
        if (!row) {
            throw new Error("Not found");
        }
        
        const newBalPaise = parseToPaiseBigInt(currentBalance);
        const oldBalPaise = parseToPaiseBigInt(row.currentBalance);
        const diffPaise = newBalPaise - oldBalPaise;
        
        updateCardStmt.run(safeName, formatBigIntToDecimalString(limitPaise), safeDueDate, safeOwnerId, id);
        
        if (diffPaise !== 0n) {
            const ob = getOB.get(id);
            if (ob) {
                const obPaise = parseToPaiseBigInt(ob.amount);
                const newOBPaise = obPaise + diffPaise;
                if (newOBPaise < 0n) {
                    throw new Error("Cannot reduce balance below the total of tracked spends.");
                }
                const updatedOb = { ...ob, amount: formatBigIntToDecimalString(newOBPaise) };
                syncAssetBalances(ob, updatedOb);
            } else {
                if (diffPaise < 0n) {
                    throw new Error("Cannot reduce balance below the total of tracked spends.");
                }
                if (diffPaise > 0n) {
                    const title = `Opening Balance: ${safeName}`;
                    const amount = formatBigIntToDecimalString(diffPaise);
                    const date = getLocalYYYYMMDD();
                    const txInfo = insertOB.run(title, date, 'opening_balance', 0, id);
                    const txObj = { id: txInfo.lastInsertRowid, title, amount, type: 'expense', category: 'opening_balance', date, credit_card_id: id };
                    syncAssetBalances(null, txObj);
                }
            }
        }
    });

    tx();
};

exports.removeCard = (id) => {
    const countTxs = nativeDb.prepare('SELECT COUNT(id) as cnt FROM transactions WHERE credit_card_id = ?');
    const delOB = nativeDb.prepare('DELETE FROM transactions WHERE credit_card_id = ? AND category = "opening_balance"');
    const updateRepayments = nativeDb.prepare('UPDATE transactions SET category = "uncategorized", title = title || " (Deleted CC)" WHERE credit_card_id = ? AND category = "cc_repayment"');
    const unlinkTxs = nativeDb.prepare('UPDATE transactions SET credit_card_id = NULL WHERE credit_card_id = ?');
    const delCard = nativeDb.prepare('DELETE FROM credit_cards WHERE id = ?');

    const delTx = nativeDb.transaction(() => {
        const linkedTxs = countTxs.get(id);
        if (linkedTxs && linkedTxs.cnt > 0) {
            throw new Error('Cannot delete: ' + linkedTxs.cnt + ' transaction(s) are linked to this entity. Delete them first to maintain ledger integrity.');
        }

        delOB.run(id);
        updateRepayments.run(id);
        unlinkTxs.run(id);
        delCard.run(id);
    });

    delTx();
};

exports.spendOnCard = (id, spendAmtPaise, safeDesc, safeDueDate) => {
    const getCard = nativeDb.prepare('SELECT * FROM credit_cards WHERE id = ?');
    const updateDueDate = nativeDb.prepare('UPDATE credit_cards SET dueDate = ? WHERE id = ?');
    const insertTx = nativeDb.prepare('INSERT INTO transactions (title, date, category, isTaxDeductible, credit_card_id) VALUES (?,?,?,?,?)');

    let newBalance = "0.00";
    const tx = nativeDb.transaction(() => {
        const card = getCard.get(id);
        if (!card) {
            throw new Error("Card not found");
        }
        
        if (safeDueDate) {
            updateDueDate.run(safeDueDate, id);
        }
        
        const today = getLocalYYYYMMDD();
        const title = safeDesc ? `CC Spend: ${card.name} — ${safeDesc}` : `CC Spend: ${card.name}`;
        const amount = formatBigIntToDecimalString(spendAmtPaise);
        
        const txInfo = insertTx.run(title, today, 'credit_card', 0, id);
        const txObj = { id: txInfo.lastInsertRowid, title, amount, type: 'expense', category: 'credit_card', date: today, credit_card_id: id };
        syncAssetBalances(null, txObj);
        
        const updatedCard = getCard.get(id);
        newBalance = updatedCard.currentBalance;
    });

    tx();
    return newBalance;
};

exports.payCard = (id, payAmtPaise, safeSourceBankId, safeJointBankId, splitAmtPaise) => {
    const getCard = nativeDb.prepare('SELECT * FROM credit_cards WHERE id = ?');
    const insertTx = nativeDb.prepare('INSERT INTO transactions (title, date, category, isTaxDeductible, credit_card_id, source_bank_id, joint_bank_id, split_amount) VALUES (?,?,?,?,?,?,?,?)');

    let newBalance = "0.00";
    const tx = nativeDb.transaction(() => {
        const card = getCard.get(id);
        if (!card) {
            throw new Error("Card not found");
        }
        
        const cardBalPaise = parseToPaiseBigInt(card.currentBalance);
        const actualPayPaise = payAmtPaise > cardBalPaise ? cardBalPaise : payAmtPaise;
        
        if (actualPayPaise <= 0n) {
            throw new Error("Balance is already zero");
        }
        
        const today = getLocalYYYYMMDD();
        if (splitAmtPaise > actualPayPaise) {
            throw new Error("Split amount cannot exceed total payment amount");
        }
        
        const title = `CC Payment: ${card.name}`;
        const amount = formatBigIntToDecimalString(actualPayPaise);
        const split_amount = splitAmtPaise > 0n ? formatBigIntToDecimalString(splitAmtPaise) : null;
        
        const txInfo = insertTx.run(title, today, 'cc_repayment', 0, id, safeSourceBankId, safeJointBankId, split_amount);
        const txObj = { id: txInfo.lastInsertRowid, title, amount, type: 'expense', category: 'cc_repayment', date: today, credit_card_id: id, source_bank_id: safeSourceBankId, joint_bank_id: safeJointBankId, split_amount };
        syncAssetBalances(null, txObj);
        
        const updatedCard = getCard.get(id);
        newBalance = updatedCard.currentBalance;
    });

    tx();
    return newBalance;
};
