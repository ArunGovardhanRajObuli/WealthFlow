const { nativeDb } = require('../../database');
const { syncAssetBalances } = require('./ledgerService');
const { getLocalYYYYMMDD } = require('../utils/analyticsUtils');
const { validateAmount, parseToPaiseBigInt } = require('../utils/financialUtils');



exports.refinanceLoan = (id, data) => {
    const { safeTitle, amount, termYears, principalAmount, interestRate, safeOwnerId } = data;

    const getLoan = nativeDb.prepare('SELECT * FROM reminders WHERE id = ? AND category = ?');
    const updateLoan = nativeDb.prepare('UPDATE reminders SET title = ?, amount = ?, termYears = ?, principalAmount = ?, interestRate = ?, owner_member_id = ? WHERE id = ?');
    const insertTx = nativeDb.prepare('INSERT INTO transactions (title, date, category, isTaxDeductible, linked_loan_id) VALUES (?, ?, ?, ?, ?)');

    const tx = nativeDb.transaction(() => {
        const loan = getLoan.get(id, 'loan');
        if (!loan) throw new Error('Loan not found');

        const safeLoanTitle = safeTitle || loan.title || 'Loan';
        updateLoan.run(safeLoanTitle, amount, termYears, principalAmount, interestRate, safeOwnerId, id);
        
        const date = getLocalYYYYMMDD();
        const title = `Loan Terms Updated: ${safeLoanTitle}`;
        const txRes = insertTx.run(title, date, 'loan', 0, id);
        const txObj = { id: txRes.lastInsertRowid, title, amount: 0, type: 'expense', category: 'loan', date, linked_loan_id: id };
        syncAssetBalances(null, txObj);
    });

    tx();
};

exports.recordPayment = (id, data) => {
    const { amount, safeDate, safeSourceBankId, safeJointBankId, safeSplitPercent, validatedSplitAmount, safeCreditCardId } = data;

    const getLoan = nativeDb.prepare('SELECT title, interestRate, amount FROM reminders WHERE id = ?');
    const getBal = nativeDb.prepare("SELECT SUM(COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0)) as principal_bal FROM ledger_lines WHERE account_class='Liability' AND account_type='loan' AND entity_id=?");
    const insertPay = nativeDb.prepare('INSERT INTO loan_payments (loan_id, amount, date, source_bank_id, joint_bank_id, split_percent, split_amount, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const insertInterest = nativeDb.prepare('INSERT INTO transactions (title, date, category, isTaxDeductible, linked_loan_id) VALUES (?, ?, ?, ?, ?)');
    const insertTx = nativeDb.prepare('INSERT INTO transactions (title, date, category, isTaxDeductible, source_bank_id, joint_bank_id, split_percent, split_amount, linked_loan_id, credit_card_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

    const tx = nativeDb.transaction(() => {
        const loan = getLoan.get(id);
        if (!loan) throw new Error('Loan not found');
        
        const title = loan.title || 'Loan';
        const rate = loan.interestRate || 0;
        
        const balRow = getBal.get(id);
        const P = balRow && balRow.principal_bal !== null ? balRow.principal_bal : 0;
        const P_paise = Math.round(P * 100);
        
        const lastTx = nativeDb.prepare("SELECT date FROM transactions WHERE linked_loan_id = ? AND category IN ('loan_payment', 'loan') ORDER BY date DESC LIMIT 1").get(id);
        let daysElapsed = 30; // default to ~1 month if no history
        if (lastTx && lastTx.date) {
            const lastDate = new Date(lastTx.date);
            const currDate = new Date(safeDate);
            const diffTime = currDate - lastDate;
            if (diffTime >= 0) {
                daysElapsed = diffTime / (1000 * 60 * 60 * 24);
            } else {
                daysElapsed = 0; // preventing negative interest on backdated payments
            }
        }
        
        const interestPaise = Math.max(0, Math.round(P_paise * (rate / 100) * (daysElapsed / 365)));
        const interest = (interestPaise / 100).toFixed(2);
        
        if (interestPaise > 0) {
            const intTitle = `Interest Accrual → ${title}`;
            const intTxRes = insertInterest.run(intTitle, safeDate, 'loan_interest_accrual', 0, id);
            const intTxObj = { id: intTxRes.lastInsertRowid, title: intTitle, amount: interest, type: 'expense', category: 'loan_interest_accrual', date: safeDate, linked_loan_id: id };
            syncAssetBalances(null, intTxObj);
        }
        
        const payTitle = `Payment → ${title}`;
        const txRes = insertTx.run(payTitle, safeDate, 'loan_payment', 0, safeSourceBankId, safeJointBankId, safeSplitPercent, validatedSplitAmount, id, safeCreditCardId);
        const payTxObj = { id: txRes.lastInsertRowid, title: payTitle, amount, type: 'expense', category: 'loan_payment', date: safeDate, linked_loan_id: id, source_bank_id: safeSourceBankId, joint_bank_id: safeJointBankId, split_percent: safeSplitPercent, split_amount: validatedSplitAmount, credit_card_id: safeCreditCardId };
        syncAssetBalances(null, payTxObj);
        
        insertPay.run(id, amount, safeDate, safeSourceBankId, safeJointBankId, safeSplitPercent, validatedSplitAmount, txRes.lastInsertRowid);
        
        // Advance the due date if payment is >= 90% of EMI
        const emiAmount = parseFloat(loan.amount) || 0;
        if (emiAmount > 0 && parseFloat(amount) >= emiAmount * 0.9) {
            const updateReminder = nativeDb.prepare(`
                UPDATE reminders 
                SET dueDate = date(dueDate, '+1 month') 
                WHERE id = ? AND category = 'loan'
            `);
            updateReminder.run(id);
        }
        
        return { txId: txRes.lastInsertRowid, title };
    });

    return tx();
};

exports.restructureLoan = (id, data) => {
    const { type, skipMonths, safeSourceBankId } = data;

    const getLoan = nativeDb.prepare("SELECT id, title, principalAmount, amount, interestRate, termYears * 12 as termMonths FROM reminders WHERE category='loan' AND id = ?");
    const getBal = nativeDb.prepare("SELECT SUM(COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0)) as principal_bal FROM ledger_lines WHERE account_class='Liability' AND account_type='loan' AND entity_id=?");
    const updateLoan = nativeDb.prepare('UPDATE reminders SET principalAmount = ?, termYears = ?, amount = ? WHERE id = ?');
    const insertBullet = nativeDb.prepare('INSERT INTO transactions (date, category, title, linked_loan_id, source_bank_id) VALUES (?, ?, ?, ?, ?)');

    const tx = nativeDb.transaction(() => {
        const loan = getLoan.get(id);
        if (!loan) throw new Error('Loan not found');
        
        const balRow = getBal.get(id);
        const ledgerPrincipal = balRow && balRow.principal_bal !== null ? parseFloat(balRow.principal_bal) / 100 : parseFloat(loan.principalAmount);
        
        const r = parseFloat(loan.interestRate) / 12 / 100;
        const p = Math.max(0, ledgerPrincipal);
        const term = parseInt(loan.termMonths);
        
        let oldEMI = parseFloat(loan.amount) || 0;
        if (oldEMI <= 0 && term > 0) {
            if (r > 0) {
                oldEMI = (p * r * Math.pow(1 + r, term)) / (Math.pow(1 + r, term) - 1);
            } else {
                oldEMI = p / term;
            }
        }
        
        let newPrincipal = p;
        let newEMI = oldEMI;
        let newTerm = term;
        
        const k = Math.max(0, parseInt(skipMonths) || 0);

        if (type === 'bullet') {
            newPrincipal = p * 0.95;
            if (term > 0) {
                if (r > 0) {
                    newEMI = (newPrincipal * r * Math.pow(1 + r, term)) / (Math.pow(1 + r, term) - 1);
                } else {
                    newEMI = newPrincipal / term;
                }
            }
            
            const bulletAmt = validateAmount(p * 0.05);
            const safeDate = new Date().toISOString().split('T')[0];
            const bulletTitle = `Bullet payment for ${loan.title}`;
            const bulletTxInfo = insertBullet.run(safeDate, 'loan_payment', bulletTitle, id, safeSourceBankId);
            const bulletTxObj = { id: bulletTxInfo.lastInsertRowid, title: bulletTitle, amount: bulletAmt, type: 'expense', category: 'loan_payment', date: safeDate, linked_loan_id: id, source_bank_id: safeSourceBankId };
            syncAssetBalances(null, bulletTxObj);
            
            const insertPay = nativeDb.prepare('INSERT INTO loan_payments (loan_id, amount, date, source_bank_id, transaction_id) VALUES (?, ?, ?, ?, ?)');
            insertPay.run(id, bulletAmt, safeDate, safeSourceBankId, bulletTxInfo.lastInsertRowid);
        } else if (type === 'accelerate') {
            newEMI = oldEMI * 1.2;
            newTerm = Math.max(1, Math.round(term * 0.8));
        } else if (type === 'higher_emi' || type === 'extended_tenure') {
            if (r > 0 && k > 0) {
                newPrincipal = p * Math.pow(1 + r, k);
            }
            
            let n = term;
            if (oldEMI > 0) {
                if (r > 0) {
                    if (oldEMI > p * r) {
                        n = Math.log(oldEMI / (oldEMI - p * r)) / Math.log(1 + r);
                    }
                } else {
                    n = p / oldEMI;
                }
            }
            if (!isFinite(n) || n < 1) n = term || 1;

            if (type === 'higher_emi') {
                newTerm = n;
                if (r > 0) {
                    newEMI = (newPrincipal * r * Math.pow(1 + r, newTerm)) / (Math.pow(1 + r, newTerm) - 1);
                } else {
                    newEMI = newPrincipal / newTerm;
                }
            } else if (type === 'extended_tenure') {
                newEMI = oldEMI;
                if (r > 0) {
                    if (newEMI > newPrincipal * r) {
                        newTerm = Math.log(newEMI / (newEMI - newPrincipal * r)) / Math.log(1 + r);
                    } else {
                        newTerm = n;
                        newEMI = (newPrincipal * r * Math.pow(1 + r, newTerm)) / (Math.pow(1 + r, newTerm) - 1);
                    }
                } else {
                    newTerm = newPrincipal / newEMI;
                }
            }

            if (newPrincipal > p) {
                const diffAmt = (newPrincipal - p).toFixed(2);
                const safeDate = new Date().toISOString().split('T')[0];
                const insertInterest = nativeDb.prepare('INSERT INTO transactions (title, date, category, isTaxDeductible, linked_loan_id) VALUES (?, ?, ?, ?, ?)');
                const intTitle = `EMI Holiday Interest Accrual → ${loan.title}`;
                const intTxRes = insertInterest.run(intTitle, safeDate, 'loan_interest_accrual', 0, id);
                const intTxObj = { id: intTxRes.lastInsertRowid, title: intTitle, amount: diffAmt, type: 'expense', category: 'loan_interest_accrual', date: safeDate, linked_loan_id: id };
                syncAssetBalances(null, intTxObj);
            }
        }
        
        updateLoan.run(newPrincipal, newTerm / 12, newEMI.toFixed(2), id);
        
        return {
            title: loan.title,
            oldPrincipal: p,
            newPrincipal,
            oldEMI,
            newEMI,
            oldTermYears: (term / 12).toFixed(1),
            newTermYears: (newTerm / 12).toFixed(1)
        };
    });

    return tx();
};

exports.getLoansList = () => {
    const rows = nativeDb.prepare("SELECT * FROM reminders WHERE category = 'loan'").all();
    const getBal = nativeDb.prepare("SELECT SUM(COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0)) as principal_bal FROM ledger_lines WHERE account_class='Liability' AND account_type='loan' AND entity_id=?");
    
    return rows.map(row => {
        const balRow = getBal.get(row.id);
        const liveBalance = balRow && balRow.principal_bal !== null ? balRow.principal_bal : row.principalAmount;
        return {
            ...row,
            originalPrincipal: row.principalAmount,
            principalAmount: liveBalance
        };
    });
};

exports.getAllPayments = () => {
    return nativeDb.prepare('SELECT * FROM loan_payments ORDER BY date DESC').all();
};
