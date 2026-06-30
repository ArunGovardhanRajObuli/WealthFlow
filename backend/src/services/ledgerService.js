const { nativeDb } = require('../../database');
const { 
    parseToPaiseBigInt, 
    formatBigIntToDecimalString,
    computeFdAccruedInterest,
    computeSgbInterest
} = require('../utils/financialUtils');

const ALLOWED_TABLES = ['sinking_funds', 'investments', 'family_members', 'fixed_deposits', 'nps_accounts', 'gold_holdings', 'real_estate', 'bank_balances', 'credit_cards'];
const ALLOWED_COLUMNS = ['currentAmount', 'collegeSavings', 'principal', 'currentValue', 'totalContribution', 'baseValue', 'balance', 'currentBalance'];

function executeBigIntUpdate(table, column, idColumn, id, deltaPaise) {
    if (!ALLOWED_TABLES.includes(table)) throw new Error(`Table ${table} not allowed in executeBigIntUpdate`);
    if (!ALLOWED_COLUMNS.includes(column)) throw new Error(`Column ${column} not allowed in executeBigIntUpdate`);
    if (idColumn !== 'id') throw new Error(`idColumn must be 'id'`);

    if (deltaPaise === 0n) return;
    const row = nativeDb.prepare(`SELECT ${column} FROM ${table} WHERE id = ?`).get(id);
    if (!row) return;
    const currentPaise = parseToPaiseBigInt(row[column]);
    const newPaise = currentPaise + deltaPaise;
    nativeDb.prepare(`UPDATE ${table} SET ${column} = ? WHERE id = ?`)
            .run(formatBigIntToDecimalString(newPaise), id);
}

const CATEGORY_CONFIG = {
    'salary': { aClass: 'Revenue', aType: 'operating' },
    'rental': { aClass: 'Revenue', aType: 'operating' },
    'dividend': { aClass: 'Revenue', aType: 'operating' },
    'opening_balance': { aClass: 'Equity', aType: 'operating' },
    'transfer': { aClass: 'Asset', aType: 'transfer_clearing' },
    'cc_repayment': { aClass: 'Liability', aType: 'credit_card', idField: 'credit_card_id' },
    'loan': { aClass: 'Liability', aType: 'loan', idField: 'linked_loan_id' },
    'loan_payment': { aClass: 'Liability', aType: 'loan', idField: 'linked_loan_id' },
    'loan_interest_accrual': { aClass: 'Expense', aType: 'loan_interest', idField: 'linked_loan_id' },
    'sinking_fund': { aClass: 'Asset', aType: 'sinking_fund', idField: 'sinking_fund_id' },
    'investment': { aClass: 'Asset', aType: 'investment', idField: 'investment_id' },
    'fd_investment': { aClass: 'Asset', aType: 'fd', idField: 'fd_id' },
    'gold_investment': { aClass: 'Asset', aType: 'gold', idField: 'gold_id' },
    'nps_investment': { aClass: 'Asset', aType: 'nps', idField: 'nps_id' }
};

const ENTITY_MAPPINGS = [
    { idField: 'investment_id', aClass: 'Asset', aType: 'investment' },
    { idField: 'fd_id', aClass: 'Asset', aType: 'fd' },
    { idField: 'nps_id', aClass: 'Asset', aType: 'nps' },
    { idField: 'gold_id', aClass: 'Asset', aType: 'gold' },
    { idField: 'propertyId', aClass: 'Asset', aType: 'real_estate' },
    { idField: 'sinking_fund_id', aClass: 'Asset', aType: 'sinking_fund' },
    { idField: 'family_member_id', aClass: 'Asset', aType: 'endowment' },
    { idField: 'linked_loan_id', aClass: 'Liability', aType: 'loan' },
    { idField: 'credit_card_id', aClass: 'Liability', aType: 'credit_card' },
    { idField: 'source_bank_id', aClass: 'Asset', aType: 'bank' }
];

function getEntityAccount(tx) {
    for (const map of ENTITY_MAPPINGS) {
        if (tx[map.idField]) return { aClass: map.aClass, aType: map.aType, eId: tx[map.idField] };
    }
    return { aClass: 'Asset', aType: 'operating', eId: null };
}

function determineTargetAccount(tx) {
    if (CATEGORY_CONFIG[tx.category]) {
        const conf = CATEGORY_CONFIG[tx.category];
        return { aClass: conf.aClass, aType: conf.aType, eId: conf.idField ? tx[conf.idField] : null };
    }

    if (tx.category === 'capital_deployment' || tx.category === 'capital_retrieval') {
        const entity = getEntityAccount(tx);
        return { aClass: 'Asset', aType: entity.aType, eId: entity.eId }; // Force Asset class for these
    }

    if (tx.category === 'insurance' && tx.insurance_id) {
        const reminder = nativeDb.prepare("SELECT * FROM reminders WHERE id = ?").get(tx.insurance_id);
        if (reminder && reminder.policyType === 'Life' && parseFloat(reminder.principalAmount) > 0 && reminder.owner_member_id) {
            return { aClass: 'Asset', aType: 'endowment', eId: reminder.owner_member_id };
        }
    }

    if (tx.type === 'income') return { aClass: 'Revenue', aType: 'operating', eId: null };
    return { aClass: 'Expense', aType: 'operating', eId: null };
}

function insertLedgerLines(tx) {
    if (!tx || !tx.id) return;
    const amount = tx.amount;
    if (!amount) return;
    
    const target = determineTargetAccount(tx);
    const isCreditCardPrimary = tx.credit_card_id && tx.category !== 'cc_repayment' && tx.category !== 'opening_balance';
    const isLoanInterestAccrual = tx.category === 'loan_interest_accrual';
    
    let primaryClass = 'Asset';
    let primaryType = 'bank';
    let primaryId = tx.source_bank_id;

    if (tx.category === 'opening_balance') {
        const entity = getEntityAccount(tx);
        if (entity.eId) {
            primaryClass = entity.aClass;
            primaryType = entity.aType;
            primaryId = entity.eId;
        }
    } else {
        if (isCreditCardPrimary) {
            primaryClass = 'Liability';
            primaryType = 'credit_card';
            primaryId = tx.credit_card_id;
        } else if (isLoanInterestAccrual) {
            primaryClass = 'Liability';
            primaryType = 'loan';
            primaryId = tx.linked_loan_id;
        }
    }

    const totalPaise = parseToPaiseBigInt(amount);
    let primaryPaise = totalPaise;
    let secondaryPaise = 0n;
    
    if (tx.joint_bank_id) {
        if (tx.split_amount !== null && tx.split_amount !== undefined && String(tx.split_amount).trim() !== '') {
            const splitAmtPaise = parseToPaiseBigInt(tx.split_amount);
            secondaryPaise = splitAmtPaise;
            primaryPaise = totalPaise - secondaryPaise;
        } else if (tx.split_percent !== null && tx.split_percent !== undefined && String(tx.split_percent).trim() !== '') {
            const splitPercentBig = parseToPaiseBigInt(tx.split_percent);
            secondaryPaise = (totalPaise * splitPercentBig) / 10000n;
            primaryPaise = totalPaise - secondaryPaise;
        }
    }
    
    const primaryAmtStr = formatBigIntToDecimalString(primaryPaise);
    const secondaryAmtStr = formatBigIntToDecimalString(secondaryPaise);
    const totalAmtStr = formatBigIntToDecimalString(totalPaise);

    if (tx.type === 'expense') {
        // Debit target
        nativeDb.prepare(`INSERT INTO ledger_lines (transaction_id, account_class, account_type, entity_id, debit_amount, credit_amount) VALUES (?, ?, ?, ?, ?, 0)`).run(tx.id, target.aClass, target.aType, target.eId, totalAmtStr);
        
        // Credit primary
        nativeDb.prepare(`INSERT INTO ledger_lines (transaction_id, account_class, account_type, entity_id, debit_amount, credit_amount) VALUES (?, ?, ?, ?, 0, ?)`).run(tx.id, primaryClass, primaryType, primaryId, primaryAmtStr);
        
        // Credit secondary if split
        if (secondaryPaise > 0n && tx.joint_bank_id) {
            nativeDb.prepare(`INSERT INTO ledger_lines (transaction_id, account_class, account_type, entity_id, debit_amount, credit_amount) VALUES (?, ?, ?, ?, 0, ?)`).run(tx.id, 'Asset', 'bank', tx.joint_bank_id, secondaryAmtStr);
        }
    } else if (tx.type === 'income') {
        // Debit primary
        nativeDb.prepare(`INSERT INTO ledger_lines (transaction_id, account_class, account_type, entity_id, debit_amount, credit_amount) VALUES (?, ?, ?, ?, ?, 0)`).run(tx.id, primaryClass, primaryType, primaryId, primaryAmtStr);
        
        // Debit secondary if split
        if (secondaryPaise > 0n && tx.joint_bank_id) {
            nativeDb.prepare(`INSERT INTO ledger_lines (transaction_id, account_class, account_type, entity_id, debit_amount, credit_amount) VALUES (?, ?, ?, ?, ?, 0)`).run(tx.id, 'Asset', 'bank', tx.joint_bank_id, secondaryAmtStr);
        }

        // Credit target
        nativeDb.prepare(`INSERT INTO ledger_lines (transaction_id, account_class, account_type, entity_id, debit_amount, credit_amount) VALUES (?, ?, ?, ?, 0, ?)`).run(tx.id, target.aClass, target.aType, target.eId, totalAmtStr);
    }
}

/**
 * Synchronous equivalent of syncAssetBalancesAsync using better-sqlite3.
 * Automatically reverses oldTx side effects and applies newTx side effects.
 * Uses BigInt math to prevent precision loss.
 */
function processAssetSideEffects(tx, multiplier) {
    const amtPaiseRaw = parseToPaiseBigInt(tx.amount);
    const amtPaise = amtPaiseRaw * multiplier;
    
    let primaryPaise = amtPaise;
    let secondaryPaise = 0n;
    if (tx.joint_bank_id) {
        if (tx.split_amount !== null && tx.split_amount !== undefined && String(tx.split_amount).trim() !== '') {
            const splitPaiseRaw = parseToPaiseBigInt(tx.split_amount);
            secondaryPaise = splitPaiseRaw * multiplier;
            primaryPaise = amtPaise - secondaryPaise;
        } else if (tx.split_percent !== null && tx.split_percent !== undefined && String(tx.split_percent).trim() !== '') {
            const splitPercentBig = parseToPaiseBigInt(tx.split_percent);
            secondaryPaise = (amtPaise * splitPercentBig) / 10000n;
            primaryPaise = amtPaise - secondaryPaise;
        }
    }
    
    const cc_id = tx.credit_card_id;
    const sf_id = tx.sinking_fund_id;
    const inv_id = tx.investment_id;
    const fam_id = tx.family_member_id;
    const fd_id = tx.fd_id;
    const nps_id = tx.nps_id;
    const gold_id = tx.gold_id;
    const prop_id = tx.propertyId;

    const applyAssetAddition = () => {
        if (sf_id && (tx.category === 'sinking_fund' || tx.category === 'capital_deployment' || tx.category === 'opening_balance')) {
            executeBigIntUpdate('sinking_funds', 'currentAmount', 'id', sf_id, amtPaise);
        }
        if (inv_id && (tx.category === 'investment' || tx.category === 'capital_deployment' || tx.category === 'opening_balance')) {
            executeBigIntUpdate('investments', 'currentAmount', 'id', inv_id, amtPaise);
            if (tx.asset_units) {
                if (multiplier === 1n) {
                    nativeDb.prepare('UPDATE investments SET totalUnits = totalUnits + ? WHERE id = ?').run(tx.asset_units, inv_id);
                } else {
                    nativeDb.prepare('UPDATE investments SET totalUnits = MAX(0, totalUnits - ?) WHERE id = ?').run(tx.asset_units, inv_id);
                }
            }
        }
        if (fam_id && (tx.category === 'investment' || tx.category === 'capital_deployment' || tx.category === 'opening_balance')) {
            executeBigIntUpdate('family_members', 'collegeSavings', 'id', fam_id, amtPaise);
        }
        if (fd_id && (tx.category === 'fd_investment' || tx.category === 'capital_deployment' || tx.category === 'opening_balance')) {
            executeBigIntUpdate('fixed_deposits', 'principal', 'id', fd_id, amtPaise);
        }
        if (nps_id && (tx.category === 'nps_investment' || tx.category === 'capital_deployment' || tx.category === 'opening_balance')) {
            executeBigIntUpdate('nps_accounts', 'currentValue', 'id', nps_id, amtPaise);
            executeBigIntUpdate('nps_accounts', 'totalContribution', 'id', nps_id, amtPaise);
        }
        if (gold_id && (tx.category === 'gold_investment' || tx.category === 'capital_deployment' || tx.category === 'opening_balance')) {
            if (tx.asset_units) {
                if (multiplier === 1n) {
                    nativeDb.prepare('UPDATE gold_holdings SET weightGrams = weightGrams + ? WHERE id = ?').run(tx.asset_units, gold_id);
                } else {
                    nativeDb.prepare('UPDATE gold_holdings SET weightGrams = MAX(0, weightGrams - ?) WHERE id = ?').run(tx.asset_units, gold_id);
                }
            }
        }
        if (prop_id && (tx.category === 'capital_deployment' || tx.category === 'opening_balance')) {
            executeBigIntUpdate('real_estate', 'baseValue', 'id', prop_id, amtPaise);
        }
    };

    if (tx.type === 'expense') {
        if (tx.source_bank_id) {
            executeBigIntUpdate('bank_balances', 'balance', 'id', tx.source_bank_id, -primaryPaise);
        }
        if (tx.joint_bank_id) {
            executeBigIntUpdate('bank_balances', 'balance', 'id', tx.joint_bank_id, -secondaryPaise);
        }
        
        if (tx.category === 'cc_repayment' && cc_id) {
            executeBigIntUpdate('credit_cards', 'currentBalance', 'id', cc_id, -amtPaise);
        } else if (tx.category === 'opening_balance' && cc_id) {
            executeBigIntUpdate('credit_cards', 'currentBalance', 'id', cc_id, amtPaise);
        } else if (cc_id && tx.category !== 'opening_balance') {
            executeBigIntUpdate('credit_cards', 'currentBalance', 'id', cc_id, amtPaise);
        }
        
        applyAssetAddition();

        if (tx.category === 'insurance' && tx.insurance_id) {
            const reminder = nativeDb.prepare("SELECT * FROM reminders WHERE id = ?").get(tx.insurance_id);
            if (reminder && reminder.policyType === 'Life' && parseFloat(reminder.principalAmount) > 0 && reminder.owner_member_id) {
                executeBigIntUpdate('family_members', 'collegeSavings', 'id', reminder.owner_member_id, amtPaise);
            }
        }
    } else if (tx.type === 'income') {
        if (tx.source_bank_id) {
            executeBigIntUpdate('bank_balances', 'balance', 'id', tx.source_bank_id, primaryPaise);
        }
        if (tx.joint_bank_id) {
            executeBigIntUpdate('bank_balances', 'balance', 'id', tx.joint_bank_id, secondaryPaise);
        }
        if (cc_id && tx.category !== 'opening_balance') {
            executeBigIntUpdate('credit_cards', 'currentBalance', 'id', cc_id, -amtPaise);
        }
        if (tx.category === 'opening_balance') {
            applyAssetAddition();
        }
        if (tx.category === 'capital_retrieval') {
            if (sf_id) executeBigIntUpdate('sinking_funds', 'currentAmount', 'id', sf_id, -amtPaise);
            if (inv_id) {
                executeBigIntUpdate('investments', 'currentAmount', 'id', inv_id, -amtPaise);
                if (tx.asset_units) {
                    if (multiplier === 1n) {
                        nativeDb.prepare('UPDATE investments SET totalUnits = MAX(0, totalUnits - ?) WHERE id = ?').run(tx.asset_units, inv_id);
                    } else {
                        nativeDb.prepare('UPDATE investments SET totalUnits = totalUnits + ? WHERE id = ?').run(tx.asset_units, inv_id);
                    }
                }
            }
            if (fam_id) executeBigIntUpdate('family_members', 'collegeSavings', 'id', fam_id, -amtPaise);
            if (fd_id) executeBigIntUpdate('fixed_deposits', 'principal', 'id', fd_id, -amtPaise);
            if (nps_id) executeBigIntUpdate('nps_accounts', 'currentValue', 'id', nps_id, -amtPaise);
            if (gold_id && tx.asset_units) {
                if (multiplier === 1n) {
                    nativeDb.prepare('UPDATE gold_holdings SET weightGrams = MAX(0, weightGrams - ?) WHERE id = ?').run(tx.asset_units, gold_id);
                } else {
                    nativeDb.prepare('UPDATE gold_holdings SET weightGrams = weightGrams + ? WHERE id = ?').run(tx.asset_units, gold_id);
                }
            }
            if (prop_id) executeBigIntUpdate('real_estate', 'baseValue', 'id', prop_id, -amtPaise);
        }
    } else if (tx.type === 'transfer') {
        if (tx.source_bank_id) {
            executeBigIntUpdate('bank_balances', 'balance', 'id', tx.source_bank_id, -amtPaise);
        }
        if (tx.joint_bank_id) {
            executeBigIntUpdate('bank_balances', 'balance', 'id', tx.joint_bank_id, amtPaise);
        }
    }
}

function syncAssetBalances(oldTx, newTx) {
    if (oldTx) {
        nativeDb.prepare('DELETE FROM ledger_lines WHERE transaction_id = ?').run(oldTx.id);
        processAssetSideEffects(oldTx, -1n);
    }

    if (newTx) {
        insertLedgerLines(newTx);
        processAssetSideEffects(newTx, 1n);
    }
}

exports.getLedgerLines = (limit) => {
    return nativeDb.prepare(`
        SELECT 
            l.id,
            l.transaction_id,
            l.account_class,
            l.account_type,
            l.entity_id,
            l.debit_amount,
            l.credit_amount,
            t.date,
            t.title,
            t.category as description
        FROM ledger_lines l
        LEFT JOIN transactions t ON l.transaction_id = t.id
        ORDER BY t.date DESC, l.id DESC
        LIMIT ?
    `).all(limit);
};

exports.getFamilyEstateLedger = () => {
    const members = nativeDb.prepare('SELECT * FROM family_members').all();
    const banks = nativeDb.prepare('SELECT * FROM bank_balances').all();
    const realEstate = nativeDb.prepare('SELECT * FROM real_estate').all();
    const investments = nativeDb.prepare('SELECT * FROM investments').all();
    const fds = nativeDb.prepare('SELECT * FROM fixed_deposits').all();
    const gold = nativeDb.prepare('SELECT * FROM gold_holdings').all();
    const nps = nativeDb.prepare('SELECT * FROM nps_accounts').all();
    const sinking_funds = nativeDb.prepare('SELECT * FROM sinking_funds').all();
    const allLoans = nativeDb.prepare("SELECT * FROM reminders WHERE category='loan'").all();
    const allCCs = nativeDb.prepare("SELECT * FROM credit_cards").all();

    const ledgerBankBalances = nativeDb.prepare("SELECT entity_id, SUM(COALESCE(debit_amount, 0) - COALESCE(credit_amount, 0)) as bal FROM ledger_lines WHERE account_type = 'bank' GROUP BY entity_id").all();
    const loansRows = nativeDb.prepare("SELECT entity_id, SUM(COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0)) as principal_bal FROM ledger_lines WHERE account_class='Liability' AND account_type='loan' GROUP BY entity_id").all();
    const ccRows = nativeDb.prepare("SELECT entity_id, SUM(COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0)) as bal FROM ledger_lines WHERE account_class='Liability' AND account_type='credit_card' GROUP BY entity_id").all();
    
    const loanBalances = {};
    for (let r of loansRows) loanBalances[r.entity_id] = r.principal_bal;
    const ccBalances = {};
    for (let r of ccRows) ccBalances[r.entity_id] = r.bal;

    const enhancedBanks = banks.map(b => {
        const dbBal = ledgerBankBalances.find(l => l.entity_id === b.id);
        const trueBalance = dbBal ? dbBal.bal : 0;
        return { ...b, snapshotBalance: b.balance, ledgerBalance: trueBalance };
    });

    const fdsWithInterest = fds.map(fd => {
        const interest = computeFdAccruedInterest(fd);
        return { ...fd, liveValue: fd.principal + interest };
    });

    const goldWithInterest = gold.map(g => {
        let interest = 0;
        if (g.type === 'SGB' || g.type === 'Sovereign Gold Bond (SGB)') {
            interest = computeSgbInterest(g);
        }
        return { ...g, liveValue: (g.weightGrams * g.currentPricePerGram) + interest };
    });

    const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
    const calculateOwnershipShare = (asset, memberId, baseValue) => {
        const split = clamp(Number(asset.owner_split_percent ?? 100), 0, 100);
        let percent = 0;
        if (asset.owner_member_id === memberId) percent += split;
        if (asset.joint_owner_member_id === memberId) percent += (100 - split);
        return baseValue * (percent / 100);
    };

    return members.map(m => {
        const memberAssets = {
            banks: enhancedBanks.filter(b => b.owner_member_id === m.id),
            realEstate: realEstate.filter(r => r.owner_member_id === m.id || r.joint_owner_member_id === m.id).map(r => ({
                ...r, calculatedValue: calculateOwnershipShare(r, m.id, r.currentMarketValue || r.baseValue)
            })),
            investments: investments.filter(i => i.owner_member_id === m.id || i.joint_owner_member_id === m.id).map(i => {
                const liveValue = (i.schemeCode && i.latestNav > 0 && i.totalUnits > 0) ? (i.latestNav * i.totalUnits) : i.currentAmount;
                return { ...i, calculatedValue: calculateOwnershipShare(i, m.id, liveValue) };
            }),
            fds: fdsWithInterest.filter(f => f.owner_member_id === m.id || f.joint_owner_member_id === m.id).map(f => ({
                ...f, calculatedValue: calculateOwnershipShare(f, m.id, f.liveValue)
            })),
            gold: goldWithInterest.filter(g => g.owner_member_id === m.id || g.joint_owner_member_id === m.id).map(g => ({
                ...g, calculatedValue: calculateOwnershipShare(g, m.id, g.liveValue)
            })),
            nps: nps.filter(n => n.owner_member_id === m.id || n.joint_owner_member_id === m.id).map(n => ({
                ...n, calculatedValue: calculateOwnershipShare(n, m.id, n.currentValue || 0)
            })),
            sinkingFunds: sinking_funds.filter(s => s.owner_member_id === m.id || s.joint_owner_member_id === m.id).map(s => ({
                ...s, calculatedValue: calculateOwnershipShare(s, m.id, s.currentAmount || 0)
            }))
        };
        
        const memberLiabilities = {
            linkedLoans: realEstate.filter(r => r.owner_member_id === m.id || r.joint_owner_member_id === m.id).map(r => {
                if (!r.linkedLoanId) return null;
                const propertiesLinkedToThisLoan = realEstate.filter(rx => rx.linkedLoanId === r.linkedLoanId).length;
                const debt = Number(loanBalances[r.linkedLoanId] || 0) / (propertiesLinkedToThisLoan || 1);
                return { loanId: r.linkedLoanId, calculatedDebt: calculateOwnershipShare(r, m.id, debt) };
            }).filter(x => x !== null),
            unlinkedLoans: allLoans.filter(l => l.owner_member_id === m.id).map(l => {
                const linkedProps = realEstate.filter(r => r.linkedLoanId === l.id);
                if (linkedProps.length === 0) {
                    return { loanId: l.id, calculatedDebt: Number(loanBalances[l.id] || 0) };
                }
                
                const debtPerProp = Number(loanBalances[l.id] || 0) / linkedProps.length;
                let totalDebtAssignedToMembers = 0;
                linkedProps.forEach(r => {
                    const split = clamp(Number(r.owner_split_percent ?? 100), 0, 100);
                    if (r.owner_member_id) totalDebtAssignedToMembers += debtPerProp * (split / 100);
                    if (r.joint_owner_member_id) totalDebtAssignedToMembers += debtPerProp * ((100 - split) / 100);
                });
                
                const residualDebt = Number(loanBalances[l.id] || 0) - totalDebtAssignedToMembers;
                if (Math.round(residualDebt) > 0) {
                    return { loanId: l.id, calculatedDebt: residualDebt };
                }
                return null;
            }).filter(x => x !== null),
            creditCards: allCCs.filter(c => c.owner_member_id === m.id).map(c => {
                return { ccId: c.id, calculatedDebt: Number(ccBalances[c.id] !== undefined ? ccBalances[c.id] : (c.currentBalance || 0)) };
            })
        };

        const totalGrossAssets = memberAssets.banks.reduce((sum, b) => sum + b.ledgerBalance, 0)
            + memberAssets.realEstate.reduce((sum, r) => sum + r.calculatedValue, 0)
            + memberAssets.investments.reduce((sum, i) => sum + i.calculatedValue, 0)
            + memberAssets.fds.reduce((sum, f) => sum + f.calculatedValue, 0)
            + memberAssets.gold.reduce((sum, g) => sum + g.calculatedValue, 0)
            + memberAssets.nps.reduce((sum, n) => sum + n.calculatedValue, 0)
            + memberAssets.sinkingFunds.reduce((sum, s) => sum + s.calculatedValue, 0)
            + (Number(m.collegeSavings) || 0);

        const totalLiabilities = memberLiabilities.linkedLoans.reduce((sum, l) => sum + l.calculatedDebt, 0)
            + memberLiabilities.unlinkedLoans.reduce((sum, l) => sum + l.calculatedDebt, 0)
            + memberLiabilities.creditCards.reduce((sum, c) => sum + c.calculatedDebt, 0);

        const totalEstateShare = totalGrossAssets - totalLiabilities;

        return {
            ...m,
            assets: memberAssets,
            liabilities: memberLiabilities,
            totalGrossAssets,
            totalLiabilities,
            totalEstateShare
        };
    });
};

exports.getReconciliation = () => {
    const banks = nativeDb.prepare('SELECT * FROM bank_balances ORDER BY asOfDate DESC').all();
    const ledgers = nativeDb.prepare("SELECT entity_id, SUM(COALESCE(debit_amount, 0) - COALESCE(credit_amount, 0)) as bal FROM ledger_lines WHERE account_type = 'bank' GROUP BY entity_id").all();
    
    let computedFreeCash = 0n;
    let actualBankBalance = 0n;
    let totalDiscrepancy = 0n;
    
    const enrichedBanks = banks.map(b => {
        const dbBal = ledgers.find(l => String(l.entity_id) === String(b.id));
        const ledgerBalPaise = dbBal ? parseToPaiseBigInt(dbBal.bal) : 0n;
        const bankBalPaise = parseToPaiseBigInt(b.balance);
        const diffPaise = bankBalPaise > ledgerBalPaise ? bankBalPaise - ledgerBalPaise : ledgerBalPaise - bankBalPaise;
        
        totalDiscrepancy += diffPaise;
        computedFreeCash += ledgerBalPaise;
        actualBankBalance += bankBalPaise;
        
        return { 
            ...b, 
            snapshotBalance: b.balance, 
            ledgerBalance: formatBigIntToDecimalString(ledgerBalPaise), 
            discrepancy: formatBigIntToDecimalString(diffPaise)
        };
    });
    
    let status = 'aligned';
    if (totalDiscrepancy > 10000n) status = 'major_discrepancy'; // > 100 rupees
    else if (totalDiscrepancy > 0n) status = 'minor_discrepancy';
    
    return { 
        banks: enrichedBanks, 
        computedFreeCash: formatBigIntToDecimalString(computedFreeCash), 
        actualBankBalance: formatBigIntToDecimalString(actualBankBalance),
        status 
    };
};

exports.getSystemReconciliation = () => {
    const query = `
        SELECT 
            t.id AS transaction_id, 
            t.title, 
            t.date, 
            t.category,
            COALESCE(SUM(l.debit_amount), 0) AS total_debit, 
            COALESCE(SUM(l.credit_amount), 0) AS total_credit 
        FROM transactions t 
        LEFT JOIN ledger_lines l ON t.id = l.transaction_id 
        GROUP BY t.id 
        HAVING COUNT(l.id) = 0 OR ABS(COALESCE(SUM(l.debit_amount), 0) - COALESCE(SUM(l.credit_amount), 0)) > 0.01
        ORDER BY t.date DESC
    `;
    const imbalancedRows = nativeDb.prepare(query).all();
    return { imbalancedCount: imbalancedRows.length, data: imbalancedRows };
};

exports.syncAssetBalances = syncAssetBalances;
