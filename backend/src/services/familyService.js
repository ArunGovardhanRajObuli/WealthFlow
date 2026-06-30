const { nativeDb } = require('../../database');
const { syncAssetBalances } = require('./ledgerService');
const { getLocalYYYYMMDD } = require('../utils/analyticsUtils');
const { validateAmount } = require('../utils/financialUtils');



exports.getAllMembers = () => {
    const rows = nativeDb.prepare(`SELECT * FROM family_members`).all();
    // Fix Lexical Coverage Evaporation Paradox (Nomenclature Blindspot)
    const lifePolicies = nativeDb.prepare("SELECT * FROM reminders WHERE LOWER(category)='insurance' AND (LOWER(policyType) LIKE '%life%' OR LOWER(policyType) LIKE '%ulip%' OR LOWER(policyType) LIKE '%endowment%' OR LOWER(policyType) = 'term' OR LOWER(policyType) LIKE '%term insurance%')").all();
    
    // Fix Chronological Displacement Paradox (Maturity Reset Deflation)
    const isMatured = (reminder) => {
        let startStr = reminder.startDate;
        if (!startStr && reminder.id) {
            const earliestTx = nativeDb.prepare(`SELECT MIN(date) as val FROM transactions WHERE insurance_id = ?`).get(reminder.id);
            if (earliestTx && earliestTx.val) startStr = earliestTx.val;
        }
        if (!startStr) return false; // Perpetual fallback prevents termYears addition to current dueDate
        
        if (!reminder.termYears || parseFloat(String(reminder.termYears).replace(/,/g, '')) <= 0) return false;
        
        const start = new Date(startStr);
        start.setFullYear(start.getFullYear() + parseInt(String(reminder.termYears).replace(/,/g, '')));
        
        const now = new Date();
        now.setHours(0,0,0,0);
        return start < now;
    };

    return rows.map(fm => {
        const activePolicies = lifePolicies.filter(p => p.owner_member_id === fm.id && !isMatured(p));
        const coverage = activePolicies.reduce((sum, p) => sum + Math.abs(parseFloat(String(p.principalAmount).replace(/,/g, '')) || 0), Math.abs(parseFloat(String(fm.lifeInsuranceCoverage).replace(/,/g, '')) || 0));
        return {
            ...fm,
            lifeInsuranceCoverage: coverage
        };
    });
};

exports.createMember = ({ name, role, age, annualIncome, lifeInsuranceCoverage, targetAge, targetCollegeValue, collegeSavingsInitial, source_bank_id }) => {
    const insertMember = nativeDb.prepare('INSERT INTO family_members (name, role, age, annualIncome, lifeInsuranceCoverage, collegeSavings, targetAge, targetCollegeValue) VALUES (?, ?, ?, ?, ?, 0, ?, ?)');
    const insertTx = nativeDb.prepare('INSERT INTO transactions (title, date, category, isTaxDeductible, source_bank_id, family_member_id) VALUES (?, ?, ?, ?, ?, ?)');

    const tx = nativeDb.transaction(() => {
        const info = insertMember.run(name, role, age, annualIncome, lifeInsuranceCoverage, targetAge, targetCollegeValue);
        const newId = info.lastInsertRowid;
        
        if (parseFloat(collegeSavingsInitial) > 0) {
            const today = getLocalYYYYMMDD();
            const txInfo = insertTx.run(`Endowment -> ${name}`, today, 'capital_deployment', 0, source_bank_id, newId);
            const newTx = nativeDb.prepare('SELECT * FROM transactions WHERE id = ?').get(txInfo.lastInsertRowid);
            newTx.amount = collegeSavingsInitial;
            newTx.type = 'expense';
            syncAssetBalances(null, newTx);
        }
        return newId;
    });

    return tx();
};

exports.fundMember = (memberId, amountStr, isNegative, source_bank_id, rawAmount) => {
    const getMember = nativeDb.prepare('SELECT * FROM family_members WHERE id = ?');
    const insertTx = nativeDb.prepare('INSERT INTO transactions (title, date, category, isTaxDeductible, source_bank_id, family_member_id) VALUES (?, ?, ?, ?, ?, ?)');

    const tx = nativeDb.transaction(() => {
        const member = getMember.get(memberId);
        if (!member) {
            throw new Error("Member not found");
        }
        
        const today = getLocalYYYYMMDD();
        let newTxId;
        if (!isNegative) {
            const info = insertTx.run(`Endowment ← ${member.name}`, today, 'capital_deployment', 0, source_bank_id, memberId);
            newTxId = info.lastInsertRowid;
            const newTx = nativeDb.prepare('SELECT * FROM transactions WHERE id = ?').get(newTxId);
            newTx.amount = amountStr;
            newTx.type = 'expense';
            syncAssetBalances(null, newTx);
        } else {
            const absAmount = validateAmount(Math.abs(Number(rawAmount)), true);
            const info = insertTx.run(`Retrieval ← ${member.name}`, today, 'capital_retrieval', 0, source_bank_id, memberId);
            newTxId = info.lastInsertRowid;
            const newTx = nativeDb.prepare('SELECT * FROM transactions WHERE id = ?').get(newTxId);
            newTx.amount = absAmount;
            newTx.type = 'income';
            syncAssetBalances(null, newTx);
        }
        
        return nativeDb.prepare('SELECT collegeSavings FROM family_members WHERE id = ?').get(memberId).collegeSavings;
    });

    return tx();
};

exports.updateMember = (memberId, { age, annualIncome, lifeInsuranceCoverage, targetAge, targetCollegeValue }) => {
    const getMember = nativeDb.prepare('SELECT name FROM family_members WHERE id = ?');
    const updateMember = nativeDb.prepare('UPDATE family_members SET age = ?, annualIncome = ?, lifeInsuranceCoverage = ?, targetAge = ?, targetCollegeValue = ? WHERE id = ?');

    const tx = nativeDb.transaction(() => {
        const member = getMember.get(memberId);
        if (!member) {
            throw new Error("Member not found");
        }
        
        updateMember.run(age, annualIncome, lifeInsuranceCoverage, targetAge, targetCollegeValue, memberId);
    });

    tx();
};

exports.removeMember = (memberId) => {
    const checkTxs = nativeDb.prepare('SELECT COUNT(id) as cnt FROM transactions WHERE family_member_id = ?').get(memberId);
    const checkInsuranceTxs = nativeDb.prepare('SELECT COUNT(t.id) as cnt FROM transactions t JOIN reminders r ON t.insurance_id = r.id WHERE r.owner_member_id = ?').get(memberId);
    
    // Check if the user owns bank accounts that have transactions other than opening_balance
    const checkBankTxs = nativeDb.prepare(`
        SELECT COUNT(t.id) as cnt 
        FROM transactions t 
        JOIN bank_balances b ON t.source_bank_id = b.id OR t.joint_bank_id = b.id 
        WHERE b.owner_member_id = ? AND t.category != 'opening_balance'
    `).get(memberId);

    const totalTxs = (checkTxs ? checkTxs.cnt : 0) + (checkInsuranceTxs ? checkInsuranceTxs.cnt : 0) + (checkBankTxs ? checkBankTxs.cnt : 0);
    if (totalTxs > 0) {
        throw new Error('Cannot delete: ' + totalTxs + ' transaction(s) are linked to this member, their bank accounts, or their insurance policies. Delete them first to maintain ledger integrity.');
    }

    const delMember = nativeDb.prepare('DELETE FROM family_members WHERE id = ?');
    const delNominees = nativeDb.prepare('DELETE FROM nominees WHERE family_member_id = ?');
    
    const updateRealEstate = nativeDb.prepare('UPDATE real_estate SET owner_member_id = NULL WHERE owner_member_id = ?');
    const updateRealEstateJoint = nativeDb.prepare('UPDATE real_estate SET joint_owner_member_id = NULL WHERE joint_owner_member_id = ?');
    const updateInvestments = nativeDb.prepare('UPDATE investments SET owner_member_id = NULL WHERE owner_member_id = ?');
    const updateInvestmentsJoint = nativeDb.prepare('UPDATE investments SET joint_owner_member_id = NULL WHERE joint_owner_member_id = ?');
    const updateFixedDeposits = nativeDb.prepare('UPDATE fixed_deposits SET owner_member_id = NULL WHERE owner_member_id = ?');
    const updateFixedDepositsJoint = nativeDb.prepare('UPDATE fixed_deposits SET joint_owner_member_id = NULL WHERE joint_owner_member_id = ?');
    const updateGold = nativeDb.prepare('UPDATE gold_holdings SET owner_member_id = NULL WHERE owner_member_id = ?');
    const updateGoldJoint = nativeDb.prepare('UPDATE gold_holdings SET joint_owner_member_id = NULL WHERE joint_owner_member_id = ?');
    const updateReminders = nativeDb.prepare('UPDATE reminders SET owner_member_id = NULL WHERE owner_member_id = ?');
    
    const bankIds = nativeDb.prepare('SELECT id FROM bank_balances WHERE owner_member_id = ?').all(memberId);
    const delBankOpeningTxs = nativeDb.prepare("DELETE FROM transactions WHERE category = 'opening_balance' AND source_bank_id = ?");
    const delLedgerLinesForTx = nativeDb.prepare("DELETE FROM ledger_lines WHERE transaction_id = ?");
    const delBank = nativeDb.prepare('DELETE FROM bank_balances WHERE id = ?');

    const tx = nativeDb.transaction(() => {
        delMember.run(memberId);
        delNominees.run(memberId);
        
        updateRealEstate.run(memberId);
        updateRealEstateJoint.run(memberId);
        updateInvestments.run(memberId);
        updateInvestmentsJoint.run(memberId);
        updateFixedDeposits.run(memberId);
        updateFixedDepositsJoint.run(memberId);
        updateGold.run(memberId);
        updateGoldJoint.run(memberId);
        updateReminders.run(memberId);
        
        for (let b of bankIds) {
            const openingTxs = nativeDb.prepare("SELECT id FROM transactions WHERE category = 'opening_balance' AND source_bank_id = ?").all(b.id);
            for (let tx of openingTxs) {
                delLedgerLinesForTx.run(tx.id);
            }
            delBankOpeningTxs.run(b.id);
            delBank.run(b.id);
        }
    });

    tx();
};
