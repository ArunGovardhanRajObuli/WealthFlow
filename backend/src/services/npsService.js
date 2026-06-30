const { nativeDb } = require('../../database');
const { syncAssetBalances } = require('./ledgerService');

exports.getAllNpsAccounts = () => {
    return nativeDb.prepare('SELECT * FROM nps_accounts ORDER BY id DESC').all();
};

exports.createNpsAccount = (
    pranNumber, memberName, tier, totalContribution, currentValue, 
    monthlyContribution, employerContribution, equityPct, corpBondPct, 
    govtSecPct, startDate, isHistorical, source_bank_id, joint_bank_id, 
    owner_member_id, joint_owner_member_id, owner_split_percent, split_amount
) => {
    if (!isHistorical && !source_bank_id && !joint_bank_id && parseFloat(currentValue) > 0) {
        throw new Error("Source Bank Account is required for non-historical NPS investments.");
    }

    const tx = nativeDb.transaction(() => {
        const info = nativeDb.prepare(
            `INSERT INTO nps_accounts (pranNumber, memberName, tier, totalContribution, currentValue, monthlyContribution, employerContribution, equityPct, corpBondPct, govtSecPct, startDate, owner_member_id, joint_owner_member_id, owner_split_percent) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(pranNumber, memberName, tier, 0, '0.00', monthlyContribution, employerContribution, equityPct, corpBondPct, govtSecPct, startDate, owner_member_id, joint_owner_member_id, owner_split_percent);
        
        const newId = info.lastInsertRowid;
        
        if (currentValue && parseFloat(currentValue) > 0) {
            let txInfo;
            if (!isHistorical) {
                const title = 'Initial NPS Balance';
                txInfo = nativeDb.prepare(
                    `INSERT INTO transactions (title, date, category, source_bank_id, joint_bank_id, split_amount, split_percent, nps_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
                ).run(title, startDate, 'nps_investment', source_bank_id || null, joint_bank_id || null, split_amount || null, owner_split_percent, newId);
                const txObj = { id: txInfo.lastInsertRowid, title, amount: currentValue, type: 'expense', category: 'nps_investment', date: startDate, source_bank_id: source_bank_id || null, joint_bank_id: joint_bank_id || null, split_percent: owner_split_percent, split_amount: split_amount || null, nps_id: newId };
                syncAssetBalances(null, txObj);
            } else {
                const title = 'Opening Balance: NPS';
                txInfo = nativeDb.prepare(
                    `INSERT INTO transactions (title, date, category, source_bank_id, joint_bank_id, split_amount, split_percent, nps_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
                ).run(title, startDate, 'opening_balance', null, null, null, owner_split_percent, newId);
                const txObj = { id: txInfo.lastInsertRowid, title, amount: currentValue, type: 'income', category: 'opening_balance', date: startDate, nps_id: newId, split_percent: owner_split_percent };
                syncAssetBalances(null, txObj);
            }
        }
        return newId;
    });

    return tx();
};

exports.updateNpsAccount = (
    id, pranNumber, memberName, tier, currentValue, monthlyContribution, 
    employerContribution, equityPct, corpBondPct, govtSecPct, startDate, 
    owner_member_id, joint_owner_member_id, owner_split_percent
) => {
    const result = nativeDb.prepare(
        `UPDATE nps_accounts SET 
            pranNumber = ?, memberName = ?, tier = ?, currentValue = ?, 
            monthlyContribution = ?, employerContribution = ?, equityPct = ?, corpBondPct = ?, govtSecPct = ?, startDate = ?,
            owner_member_id = ?, joint_owner_member_id = ?, owner_split_percent = ?
         WHERE id = ?`
    ).run(pranNumber, memberName, tier, currentValue, monthlyContribution, employerContribution, equityPct, corpBondPct, govtSecPct, startDate, owner_member_id, joint_owner_member_id, owner_split_percent, id);
    if (result.changes === 0) {
        throw new Error('Not found');
    }
};

exports.deleteNpsAccount = (id) => {
    const tx = nativeDb.transaction(() => {
        const checkTxs = nativeDb.prepare('SELECT COUNT(id) as cnt FROM transactions WHERE nps_id = ?').get(id);
        if (checkTxs && checkTxs.cnt > 0) {
            throw new Error('Cannot delete: ' + checkTxs.cnt + ' transaction(s) are linked to this entity. Delete them first to maintain ledger integrity.');
        }
        
        nativeDb.prepare('DELETE FROM nps_accounts WHERE id = ?').run(id);
        nativeDb.prepare("DELETE FROM nominees WHERE assetType = 'NPS Account' AND assetId = ?").run(id);
    });
    tx();
};

exports.getNpsProjections = (currentAge, retirementAge) => {
    const curAge = parseInt(currentAge) || 30;
    const retAge = parseInt(retirementAge) || 60;
    const years = Math.max(0, retAge - curAge);
    const months = years * 12;

    const accounts = nativeDb.prepare('SELECT * FROM nps_accounts').all();
    if (!accounts || accounts.length === 0) {
        return { accounts: [], totalProjected: 0 };
    }

    let totalProjected = 0;
    const projections = accounts.map(acc => {
        const currentVal = parseFloat(acc.currentValue) || 0;
        const monthlyCont = (parseFloat(acc.monthlyContribution) || 0) + (parseFloat(acc.employerContribution) || 0);
        
        let ePct = (parseFloat(acc.equityPct) || 50);
        let cPct = (parseFloat(acc.corpBondPct) || 30);
        let gPct = (parseFloat(acc.govtSecPct) || 20);
        const totalPct = ePct + cPct + gPct;
        if (totalPct > 0) { ePct /= totalPct; cPct /= totalPct; gPct /= totalPct; } else { ePct=0.5; cPct=0.3; gPct=0.2; }
        
        const expectedAnnualReturn = (ePct * 0.12) + (cPct * 0.08) + (gPct * 0.07);
        const r = expectedAnnualReturn / 12;
        
        let futureVal = currentVal * Math.pow(1 + r, months);
        if (r > 0 && monthlyCont > 0) {
            futureVal += monthlyCont * ((Math.pow(1 + r, months) - 1) / r) * (1 + r);
        } else {
            futureVal += monthlyCont * months;
        }
        
        totalProjected += futureVal;
        return {
            id: acc.id,
            memberName: acc.memberName,
            pranNumber: acc.pranNumber,
            currentValue: currentVal,
            projectedValue: futureVal
        };
    });
    
    return { accounts: projections, totalProjected };
};
