const { nativeDb } = require('../../database');
const { syncAssetBalances } = require('./ledgerService');
const { getLocalYYYYMMDD } = require('../utils/analyticsUtils');



exports.getAllReminders = () => {
    return nativeDb.prepare('SELECT * FROM reminders ORDER BY dueDate ASC').all();
};

exports.createReminder = ({ safeTitle, amount, safeDueDate, safeCategory, termYears, safeFrequency, principalAmount, interestRate, safeOwnerId, safePolicyType, safeSourceBankId, maturityAmount }) => {
    const insertReminder = nativeDb.prepare('INSERT INTO reminders (title, amount, dueDate, category, termYears, frequency, principalAmount, interestRate, owner_member_id, policyType, maturityAmount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

    const tx = nativeDb.transaction(() => {
        const info = insertReminder.run(safeTitle, amount, safeDueDate, safeCategory, termYears, safeFrequency, principalAmount, interestRate, safeOwnerId, safePolicyType, maturityAmount);
        const newLoanId = info.lastInsertRowid;
        
        if (safeCategory === 'loan' && parseFloat(principalAmount) > 0) {
            const disbursementDate = getLocalYYYYMMDD();
            const title = `Loan Disbursement: ${safeTitle}`;
            const insertTx = nativeDb.prepare('INSERT INTO transactions (title, date, category, isTaxDeductible, source_bank_id, linked_loan_id) VALUES (?, ?, ?, ?, ?, ?)');
            const tInfo = insertTx.run(title, disbursementDate, 'loan', 0, safeSourceBankId, newLoanId);
            const newTxId = tInfo.lastInsertRowid;
            const newTx = { id: newTxId, title, amount: principalAmount, type: 'income', category: 'loan', date: disbursementDate, source_bank_id: safeSourceBankId, linked_loan_id: newLoanId };
            syncAssetBalances(null, newTx);
        }
        return newLoanId;
    });

    return tx();
};

exports.updateReminder = (id, { safeTitle, amount, safeDueDate, termYears, safeFrequency, principalAmount, interestRate, safeOwnerId, safePolicyType, maturityAmount }) => {
    const updateReminderStmt = nativeDb.prepare('UPDATE reminders SET title = ?, amount = ?, dueDate = ?, termYears = ?, frequency = ?, principalAmount = ?, interestRate = ?, owner_member_id = ?, policyType = ?, maturityAmount = ? WHERE id = ?');

    const tx = nativeDb.transaction(() => {
        const oldReminder = nativeDb.prepare('SELECT * FROM reminders WHERE id = ?').get(id);
        if (oldReminder && oldReminder.category === 'insurance') {
            const oldOwner = oldReminder.owner_member_id ? String(oldReminder.owner_member_id) : null;
            const newOwner = safeOwnerId ? String(safeOwnerId) : null;
            const hasPrincipalChanged = (parseFloat(oldReminder.principalAmount) > 0) !== (parseFloat(principalAmount) > 0);
            
            if (oldReminder.policyType !== safePolicyType || oldOwner !== newOwner || hasPrincipalChanged) {
                const checkTxs = nativeDb.prepare('SELECT COUNT(id) as cnt FROM transactions WHERE insurance_id = ?').get(id);
                if (checkTxs && checkTxs.cnt > 0) {
                    throw new Error('Cannot modify Policy Type, Owner, or Principal Amount (>0) on an Insurance policy with existing premium payments. Delete the premium payments first.');
                }
            }
        }

        updateReminderStmt.run(safeTitle, amount, safeDueDate, termYears, safeFrequency, principalAmount, interestRate, safeOwnerId, safePolicyType, maturityAmount, id);
        
        const oldTxRow = nativeDb.prepare("SELECT * FROM transactions WHERE linked_loan_id = ? AND category = 'loan'").get(id);
        if (oldTxRow) {
            const amtRow = nativeDb.prepare("SELECT SUM(COALESCE(debit_amount, 0) - COALESCE(credit_amount, 0)) as amt FROM ledger_lines WHERE transaction_id = ? AND account_type = 'bank'").get(oldTxRow.id);
            const oldAmount = amtRow && amtRow.amt ? String(amtRow.amt) : "0";
            const oldTx = { ...oldTxRow, amount: oldAmount, type: 'income' };
            const updateTx = nativeDb.prepare("UPDATE transactions SET title = ? WHERE id = ?");
            updateTx.run(`Loan Disbursement: ${safeTitle}`, oldTxRow.id);
            const newTx = { ...oldTx, title: `Loan Disbursement: ${safeTitle}`, amount: String(principalAmount) };
            syncAssetBalances(oldTx, newTx);
        }
    });

    tx();
};

exports.removeReminder = (id) => {
    const tx = nativeDb.transaction(() => {
        const reminder = nativeDb.prepare('SELECT category FROM reminders WHERE id = ?').get(id);
        if (reminder && (reminder.category === 'loan' || reminder.category === 'insurance')) {
            const field = reminder.category === 'loan' ? 'linked_loan_id' : 'insurance_id';
            const checkTxs = nativeDb.prepare(`SELECT COUNT(id) as cnt FROM transactions WHERE ${field} = ?`).get(id);
            if (checkTxs && checkTxs.cnt > 0) {
                throw new Error(`Cannot delete: ${checkTxs.cnt} transaction(s) are linked to this ${reminder.category}. Delete them first to maintain ledger integrity.`);
            }
        }

        nativeDb.prepare('UPDATE transactions SET subscription_id = NULL WHERE subscription_id = ?').run(id);
        nativeDb.prepare('UPDATE transactions SET insurance_id = NULL WHERE insurance_id = ?').run(id);
        nativeDb.prepare('DELETE FROM reminders WHERE id = ?').run(id);
    });

    tx();
};
