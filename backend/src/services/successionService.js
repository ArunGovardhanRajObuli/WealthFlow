const { nativeDb } = require('../../database');

exports.getAssignableAssets = () => {
    const assets = [];
    
    // Fetch Real Estate (Net of Linked Loans & Split Percent)
    const re = nativeDb.prepare(`
        SELECT r.id, r.title, r.currentMarketValue, r.linkedLoanId, COALESCE(r.owner_split_percent, 100) as split,
               COALESCE((SELECT SUM(COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0)) FROM ledger_lines WHERE account_class='Liability' AND account_type='loan' AND entity_id = r.linkedLoanId), 0) as loanBal
        FROM real_estate r
    `).all();
    
    re.forEach(a => {
        const grossValue = (a.currentMarketValue || 0) * (a.split / 100);
        const netValue = grossValue - (a.loanBal * (a.split / 100)); // Debt is also split
        let desc = a.title;
        if (a.split < 100) desc += ` (${a.split}% Share)`;
        if (a.loanBal > 0) desc += ' (Net of Debt)';
        assets.push({ type: 'Property', id: a.id, description: desc, value: netValue });
    });
    
    // Fetch Fixed Deposits
    const fds = nativeDb.prepare('SELECT id, bankName, principal as principalAmount, COALESCE(owner_split_percent, 100) as split FROM fixed_deposits').all();
    fds.forEach(a => {
        const netValue = (a.principalAmount || 0) * (a.split / 100);
        assets.push({ type: 'Fixed Deposit', id: a.id, description: a.bankName + (a.split < 100 ? ` (${a.split}% Share)` : ''), value: netValue });
    });
    
    // Fetch Investments
    const inv = nativeDb.prepare('SELECT id, title as fundName, currentAmount, COALESCE(owner_split_percent, 100) as split FROM investments').all();
    inv.forEach(a => {
        const netValue = (a.currentAmount || 0) * (a.split / 100);
        assets.push({ type: 'Investment', id: a.id, description: a.fundName + (a.split < 100 ? ` (${a.split}% Share)` : ''), value: netValue });
    });
    
    // Fetch Bank Balances
    const banks = nativeDb.prepare('SELECT id, bankName, balance, 100 as split FROM bank_balances').all();
    banks.forEach(a => {
        const netValue = (a.balance || 0) * (a.split / 100);
        assets.push({ type: 'Bank Account', id: a.id, description: a.bankName + (a.split < 100 ? ` (${a.split}% Share)` : ''), value: netValue });
    });
    
    // Fetch NPS
    const nps = nativeDb.prepare('SELECT id, pranNumber as pran, currentValue, COALESCE(owner_split_percent, 100) as split FROM nps_accounts').all();
    nps.forEach(a => {
        const netValue = (a.currentValue || 0) * (a.split / 100);
        assets.push({ type: 'NPS Account', id: a.id, description: 'PRAN: ' + a.pran + (a.split < 100 ? ` (${a.split}% Share)` : ''), value: netValue });
    });
    
    // Fetch Gold
    const gold = nativeDb.prepare('SELECT id, title as itemDescription, (weightGrams * currentPricePerGram) as totalVal, COALESCE(owner_split_percent, 100) as split FROM gold_holdings').all();
    gold.forEach(a => {
        const netValue = (a.totalVal || 0) * (a.split / 100);
        assets.push({ type: 'Gold Holding', id: a.id, description: a.itemDescription + (a.split < 100 ? ` (${a.split}% Share)` : ''), value: netValue });
    });

    // Fetch Sinking Funds
    const sinking = nativeDb.prepare('SELECT id, title, currentAmount, COALESCE(owner_split_percent, 100) as split FROM sinking_funds').all();
    sinking.forEach(a => {
        const netValue = (a.currentAmount || 0) * (a.split / 100);
        assets.push({ type: 'Sinking Fund', id: a.id, description: a.title + (a.split < 100 ? ` (${a.split}% Share)` : ''), value: netValue });
    });

    return { assets };
};

exports.getSuccessionSummary = () => {
    const nominees = nativeDb.prepare(`
        SELECT n.*, f.name as family_member_name, f.role as family_member_role 
        FROM nominees n 
        LEFT JOIN family_members f ON n.family_member_id = f.id
    `).all();
    
    // Calculate completeness based on unique assets mapped
    const totalAssets = nativeDb.prepare(`
        SELECT 
            (SELECT COUNT(id) FROM real_estate) +
            (SELECT COUNT(id) FROM fixed_deposits) +
            (SELECT COUNT(id) FROM investments) +
            (SELECT COUNT(id) FROM bank_balances) +
            (SELECT COUNT(id) FROM nps_accounts) +
            (SELECT COUNT(id) FROM gold_holdings) +
            (SELECT COUNT(id) FROM sinking_funds)
        AS total
    `).get().total;
    
    let mappedAssets = 0;
    if (totalAssets > 0) {
        const mappedCount = nativeDb.prepare(`
            SELECT COALESCE(SUM(MIN(total_share, 100)) / 100.0, 0) as c
            FROM (
                SELECT n.assetType, n.assetId, SUM(n.sharePercent) as total_share
                FROM nominees n 
                WHERE n.assetType != 'General'
                AND (
                    (n.assetType = 'Property' AND EXISTS (SELECT 1 FROM real_estate WHERE id = n.assetId)) OR
                    (n.assetType = 'Fixed Deposit' AND EXISTS (SELECT 1 FROM fixed_deposits WHERE id = n.assetId)) OR
                    (n.assetType = 'Investment' AND EXISTS (SELECT 1 FROM investments WHERE id = n.assetId)) OR
                    (n.assetType = 'Bank Account' AND EXISTS (SELECT 1 FROM bank_balances WHERE id = n.assetId)) OR
                    (n.assetType = 'NPS Account' AND EXISTS (SELECT 1 FROM nps_accounts WHERE id = n.assetId)) OR
                    (n.assetType = 'Gold Holding' AND EXISTS (SELECT 1 FROM gold_holdings WHERE id = n.assetId)) OR
                    (n.assetType = 'Sinking Fund' AND EXISTS (SELECT 1 FROM sinking_funds WHERE id = n.assetId))
                )
                GROUP BY n.assetType, n.assetId
            )
        `).get().c;
        mappedAssets = mappedCount;
    }
    
    let completeness = totalAssets > 0 ? Math.round((mappedAssets / totalAssets) * 100) : 0;
    if (completeness > 100) completeness = 100;
    
    const coverage = [];
    const assetCategories = [
        { name: 'Property', table: 'real_estate' },
        { name: 'Fixed Deposit', table: 'fixed_deposits' },
        { name: 'Investment', table: 'investments' },
        { name: 'Bank Account', table: 'bank_balances' },
        { name: 'NPS Account', table: 'nps_accounts' },
        { name: 'Gold Holding', table: 'gold_holdings' },
        { name: 'Sinking Fund', table: 'sinking_funds' }
    ];

    assetCategories.forEach(cat => {
        const count = nativeDb.prepare(`SELECT COUNT(id) as c FROM ${cat.table}`).get().c;
        if (count > 0) {
            const mappedCount = nativeDb.prepare(`SELECT COUNT(DISTINCT assetId) as c FROM nominees WHERE assetType = ?`).get(cat.name).c;
            coverage.push({
                type: cat.name,
                count: count,
                hasNominee: mappedCount === count
            });
        }
    });

    let recommendation = '';
    if (completeness === 100) {
        recommendation = 'Your estate is fully documented with nominees. Excellent coverage.';
    } else if (completeness >= 50) {
        recommendation = 'Partial coverage detected. Review exposed asset categories to prevent probate issues.';
    } else {
        recommendation = 'High probate risk. Most of your assets are missing succession mappings.';
    }

    return { nominees, completeness, totalAssets, coverage, recommendation };
};

exports.createNominee = (data) => {
    const { family_member_id, assetType, assetId, assetDescription, sharePercent, notes } = data;
    const parsedShare = parseFloat(sharePercent) || 0;
    
    if (parsedShare <= 0) {
        throw new Error('Share percentage must be strictly positive.');
    }

    const tx = nativeDb.transaction(() => {
        const member = nativeDb.prepare('SELECT name, role FROM family_members WHERE id = ?').get(family_member_id);
        if (!member) {
            throw new Error('Target family member does not exist.');
        }
        
        let currentTotal = 0;
        if (assetType !== 'General') {
            const validTypes = {
                'Property': 'real_estate',
                'Fixed Deposit': 'fixed_deposits',
                'Investment': 'investments',
                'Bank Account': 'bank_balances',
                'NPS Account': 'nps_accounts',
                'Gold Holding': 'gold_holdings',
                'Sinking Fund': 'sinking_funds'
            };
            if (!validTypes[assetType]) {
                throw new Error('Invalid asset type forged.');
            }
            
            const tableName = validTypes[assetType];
            const assetExists = nativeDb.prepare(`SELECT id FROM ${tableName} WHERE id = ?`).get(assetId);
            if (!assetExists) {
                throw new Error('Target asset does not exist in the ledger (Orphan Injection Blocked).');
            }

            const existing = nativeDb.prepare('SELECT SUM(sharePercent) as total FROM nominees WHERE assetType = ? AND assetId = ?').get(assetType, assetId);
            currentTotal = existing && existing.total ? existing.total : 0;
        } else {
            const existing = nativeDb.prepare("SELECT SUM(sharePercent) as total FROM nominees WHERE assetType = 'General'").get();
            currentTotal = existing && existing.total ? existing.total : 0;
        }

        if (currentTotal + parsedShare > 100) {
            throw new Error('Total share percentage for this asset (or General Estate) cannot exceed 100%.');
        }
        
        const insert = nativeDb.prepare('INSERT INTO nominees (name, relationship, family_member_id, assetType, assetId, assetDescription, sharePercent, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        const info = insert.run(member.name, member.role, family_member_id, assetType, assetId, assetDescription || '', parsedShare, notes || '');

        nativeDb.prepare("INSERT INTO audit_logs (action, entity, entity_id, details) VALUES (?, ?, ?, ?)").run(
            'CREATE', 'succession_nominee', info.lastInsertRowid, 
            JSON.stringify({ family_member: member.name, assetType, assetId, sharePercent: parsedShare })
        );

        return { success: true, id: info.lastInsertRowid };
    });

    return tx();
};

exports.updateNominee = (id, data) => {
    const { sharePercent } = data;
    const parsedShare = parseFloat(sharePercent) || 0;
    
    if (parsedShare <= 0) {
        throw new Error('Share percentage must be strictly positive.');
    }
    
    const tx = nativeDb.transaction(() => {
        const currentNominee = nativeDb.prepare('SELECT * FROM nominees WHERE id = ?').get(id);
        if (!currentNominee) {
            throw new Error('Nominee not found.');
        }

        let otherTotal = 0;
        if (currentNominee.assetType !== 'General') {
            const existing = nativeDb.prepare('SELECT SUM(sharePercent) as total FROM nominees WHERE assetType = ? AND assetId = ? AND id != ?').get(currentNominee.assetType, currentNominee.assetId, id);
            otherTotal = existing && existing.total ? existing.total : 0;
        } else {
            const existing = nativeDb.prepare("SELECT SUM(sharePercent) as total FROM nominees WHERE assetType = 'General' AND id != ?").get(id);
            otherTotal = existing && existing.total ? existing.total : 0;
        }

        if (otherTotal + parsedShare > 100) {
            throw new Error('Total share percentage for this asset (or General Estate) cannot exceed 100%.');
        }

        nativeDb.prepare('UPDATE nominees SET sharePercent = ? WHERE id = ?').run(parsedShare, id);

        nativeDb.prepare("INSERT INTO audit_logs (action, entity, entity_id, details) VALUES (?, ?, ?, ?)").run(
            'UPDATE', 'succession_nominee', id, 
            JSON.stringify({ old_share: currentNominee.sharePercent, new_share: parsedShare })
        );

        return { success: true };
    });

    return tx();
};

exports.deleteNominee = (id) => {
    const current = nativeDb.prepare('SELECT * FROM nominees WHERE id = ?').get(id);
    
    const del = nativeDb.prepare('DELETE FROM nominees WHERE id = ?');
    del.run(id);

    if (current) {
        nativeDb.prepare("INSERT INTO audit_logs (action, entity, entity_id, details) VALUES (?, ?, ?, ?)").run(
            'DELETE', 'succession_nominee', id, 
            JSON.stringify({ family_member_id: current.family_member_id, assetType: current.assetType, assetId: current.assetId })
        );
    }

    return { success: true };
};

exports.executeSuccession = (memberId) => {
    return nativeDb.transaction(() => {
        const deceased = nativeDb.prepare('SELECT * FROM family_members WHERE id = ? AND COALESCE(isDeceased, 0) = 0').get(memberId);
        if (!deceased) {
            throw new Error('Member not found or already executed.');
        }

        const fallbackMemberRow = nativeDb.prepare("SELECT id FROM family_members WHERE role IN ('Partner', 'HUF') AND COALESCE(isDeceased, 0) = 0 ORDER BY role DESC LIMIT 1").get();
        const fallbackMemberId = fallbackMemberRow ? fallbackMemberRow.id : null;

        const getNomineesForAsset = (assetType, assetId) => {
            let noms = nativeDb.prepare('SELECT family_member_id, sharePercent FROM nominees WHERE assetType = ? AND assetId = ?').all(assetType, assetId);
            if (noms.length > 0) return noms;
            noms = nativeDb.prepare("SELECT family_member_id, sharePercent FROM nominees WHERE assetType = 'General'").all();
            if (noms.length > 0) return noms;
            if (fallbackMemberId) {
                return [{ family_member_id: fallbackMemberId, sharePercent: 100 }];
            }
            return []; // Orphaned
        };

        const executeTransfer = (table, typeName, assetId, valCol, nameCol, duplicateFn) => {
            const asset = nativeDb.prepare(`SELECT * FROM ${table} WHERE id = ? AND COALESCE(isClosed, 0) = 0`).get(assetId);
            if (!asset) return;
            
            const noms = getNomineesForAsset(typeName, assetId);
            if (noms.length === 0) return; // leave orphaned if no fallback
            
            let totalVal = asset[valCol] || 0;
            
            // Mint for each nominee
            noms.forEach(n => {
                const fraction = n.sharePercent / 100.0;
                duplicateFn(asset, n.family_member_id, fraction);
            });
            
            // Zero out old asset
            nativeDb.prepare(`UPDATE ${table} SET ${valCol} = 0, isClosed = 1, ${nameCol} = ? WHERE id = ?`).run(`[Settled] ${asset[nameCol]}`, assetId);
            
            // Log transfer out transaction
            const txInfo = nativeDb.prepare("INSERT INTO transactions (title, category, date, family_member_id) VALUES (?, 'transfer', date('now'), ?)").run(`Succession Transfer Out: ${asset[nameCol]}`, memberId);
            nativeDb.prepare("INSERT INTO ledger_lines (transaction_id, account_class, account_type, entity_id, debit_amount, credit_amount) VALUES (?, 'Equity', 'equity', ?, ?, 0)").run(txInfo.lastInsertRowid, memberId, totalVal);
        };

        // Real Estate
        const res = nativeDb.prepare('SELECT id FROM real_estate WHERE owner_member_id = ? AND COALESCE(isClosed, 0) = 0').all(memberId);
        res.forEach(r => {
            executeTransfer('real_estate', 'Property', r.id, 'currentMarketValue', 'title', (asset, newOwner, fraction) => {
                nativeDb.prepare(`INSERT INTO real_estate (title, propertyType, baseValue, expectedRent, currentMarketValue, purchaseDate, occupancyStatus, linkedLoanId, owner_member_id, owner_split_percent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 100)`).run(
                    `${asset.title} (Inherited - ${fraction * 100}%)`, asset.propertyType, (asset.baseValue||0)*fraction, (asset.expectedRent||0)*fraction, (asset.currentMarketValue||0)*fraction, asset.purchaseDate, asset.occupancyStatus, asset.linkedLoanId, newOwner
                );
            });
        });

        // Fixed Deposits
        const fds = nativeDb.prepare('SELECT id FROM fixed_deposits WHERE owner_member_id = ? AND COALESCE(isClosed, 0) = 0').all(memberId);
        fds.forEach(r => {
            executeTransfer('fixed_deposits', 'Fixed Deposit', r.id, 'principal', 'bankName', (asset, newOwner, fraction) => {
                nativeDb.prepare(`INSERT INTO fixed_deposits (bankName, principal, interestRate, tenureMonths, startDate, maturityDate, maturityAmount, isAutoRenew, isTaxSaver, owner_member_id, owner_split_percent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 100)`).run(
                    `${asset.bankName} (Inherited - ${fraction * 100}%)`, (asset.principal||0)*fraction, asset.interestRate, asset.tenureMonths, asset.startDate, asset.maturityDate, (asset.maturityAmount||0)*fraction, asset.isAutoRenew, asset.isTaxSaver, newOwner
                );
            });
        });

        // Investments
        const invs = nativeDb.prepare('SELECT id FROM investments WHERE owner_member_id = ? AND COALESCE(isClosed, 0) = 0').all(memberId);
        invs.forEach(r => {
            executeTransfer('investments', 'Investment', r.id, 'currentAmount', 'title', (asset, newOwner, fraction) => {
                nativeDb.prepare(`INSERT INTO investments (title, category, assetClass, currentAmount, targetAmount, roi, unrealizedGain, schemeCode, dividendYield, latestNav, totalUnits, owner_member_id, owner_split_percent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 100)`).run(
                    `${asset.title} (Inherited - ${fraction * 100}%)`, asset.category, asset.assetClass, (asset.currentAmount||0)*fraction, (asset.targetAmount||0)*fraction, asset.roi, (asset.unrealizedGain||0)*fraction, asset.schemeCode, asset.dividendYield, asset.latestNav, (asset.totalUnits||0)*fraction, newOwner
                );
            });
        });

        // Bank Balances
        const banks = nativeDb.prepare('SELECT id FROM bank_balances WHERE owner_member_id = ? AND COALESCE(isClosed, 0) = 0').all(memberId);
        banks.forEach(r => {
            executeTransfer('bank_balances', 'Bank Account', r.id, 'balance', 'bankName', (asset, newOwner, fraction) => {
                nativeDb.prepare(`INSERT INTO bank_balances (bankName, balance, asOfDate, owner_member_id) VALUES (?, ?, ?, ?)`).run(
                    `${asset.bankName} (Inherited - ${fraction * 100}%)`, (asset.balance||0)*fraction, asset.asOfDate, newOwner
                );
            });
        });

        // NPS Accounts
        const nps = nativeDb.prepare('SELECT id FROM nps_accounts WHERE owner_member_id = ? AND COALESCE(isClosed, 0) = 0').all(memberId);
        nps.forEach(r => {
            executeTransfer('nps_accounts', 'NPS Account', r.id, 'currentValue', 'pranNumber', (asset, newOwner, fraction) => {
                nativeDb.prepare(`INSERT INTO nps_accounts (pranNumber, memberName, tier, totalContribution, currentValue, monthlyContribution, employerContribution, equityPct, corpBondPct, govtSecPct, startDate, owner_member_id, owner_split_percent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 100)`).run(
                    `${asset.pranNumber} (Inh)`, asset.memberName, asset.tier, (asset.totalContribution||0)*fraction, (asset.currentValue||0)*fraction, (asset.monthlyContribution||0)*fraction, (asset.employerContribution||0)*fraction, asset.equityPct, asset.corpBondPct, asset.govtSecPct, asset.startDate, newOwner
                );
            });
        });

        // Gold Holdings
        const golds = nativeDb.prepare('SELECT id FROM gold_holdings WHERE owner_member_id = ? AND COALESCE(isClosed, 0) = 0').all(memberId);
        golds.forEach(r => {
            executeTransfer('gold_holdings', 'Gold Holding', r.id, 'weightGrams', 'title', (asset, newOwner, fraction) => {
                nativeDb.prepare(`INSERT INTO gold_holdings (title, type, weightGrams, purchasePricePerGram, currentPricePerGram, interestRate, purchaseDate, maturityDate, owner_member_id, owner_split_percent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 100)`).run(
                    `${asset.title} (Inherited - ${fraction * 100}%)`, asset.type, (asset.weightGrams||0)*fraction, asset.purchasePricePerGram, asset.currentPricePerGram, asset.interestRate, asset.purchaseDate, asset.maturityDate, newOwner
                );
            });
        });

        // Sinking Funds
        const sinks = nativeDb.prepare('SELECT id FROM sinking_funds WHERE owner_member_id = ? AND COALESCE(isClosed, 0) = 0').all(memberId);
        sinks.forEach(r => {
            executeTransfer('sinking_funds', 'Sinking Fund', r.id, 'currentAmount', 'title', (asset, newOwner, fraction) => {
                nativeDb.prepare(`INSERT INTO sinking_funds (title, targetAmount, currentAmount, targetDate, owner_member_id, owner_split_percent) VALUES (?, ?, ?, ?, ?, 100)`).run(
                    `${asset.title} (Inherited - ${fraction * 100}%)`, (asset.targetAmount||0)*fraction, (asset.currentAmount||0)*fraction, asset.targetDate, newOwner
                );
            });
        });

        nativeDb.prepare('UPDATE family_members SET isDeceased = 1 WHERE id = ?').run(memberId);
        nativeDb.prepare("INSERT INTO audit_logs (action, entity, entity_id, details) VALUES (?, ?, ?, ?)").run('EXECUTE_SUCCESSION', 'family_member', memberId, 'Succession plan executed');

        return { success: true };
    })();
};
