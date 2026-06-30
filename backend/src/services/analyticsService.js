const { nativeDb } = require('../../database');
const { computeFdAccruedInterest } = require('../utils/financialUtils');
const { isMatured, getTrueAmortizedDebt, getFreeCash, getLocalYYYYMMDD } = require('../utils/analyticsUtils');

const TX_JOIN_QUERY = `SELECT * FROM transaction_details`;

exports.getLiquidityMetrics = () => {
    const ledgerMetrics = nativeDb.prepare(`
        SELECT 
            ROUND(COALESCE(SUM(CASE WHEN account_class = 'Revenue' AND account_type = 'operating' THEN COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0) ELSE 0 END), 0), 2) as income,
            ROUND(COALESCE(SUM(CASE WHEN account_class = 'Expense' AND account_type = 'operating' THEN COALESCE(debit_amount, 0) - COALESCE(credit_amount, 0) ELSE 0 END), 0), 2) as expense,
            ROUND(COALESCE(SUM(CASE WHEN account_class = 'Liability' AND account_type = 'credit_card' THEN COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0) ELSE 0 END), 0), 2) as ccBalance
        FROM ledger_lines
    `).get();

    const txMetrics = nativeDb.prepare(`
        SELECT 
            ROUND(COALESCE(SUM(CASE WHEN LOWER(t.category) = 'capital_retrieval' AND l.account_type = 'bank' THEN COALESCE(debit_amount, 0) - COALESCE(credit_amount, 0) ELSE 0 END), 0), 2) as capitalRetrieval,
            ROUND(COALESCE(SUM(CASE WHEN LOWER(t.category) = 'capital_deployment' AND t.sinking_fund_id IS NOT NULL AND l.account_type = 'bank' THEN COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0) ELSE 0 END), 0), 2) as sinking,
            ROUND(COALESCE(SUM(CASE WHEN LOWER(t.category) = 'capital_deployment' AND t.family_member_id IS NOT NULL AND l.account_type = 'bank' THEN COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0) ELSE 0 END), 0), 2) as endow,
            ROUND(COALESCE(SUM(CASE WHEN LOWER(t.category) = 'capital_deployment' AND t.investment_id IS NOT NULL AND l.account_type = 'bank' THEN COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0) ELSE 0 END), 0), 2) as invest,
            ROUND(COALESCE(SUM(CASE WHEN LOWER(t.category) = 'capital_deployment' AND t.linked_loan_id IS NOT NULL AND l.account_type = 'bank' THEN COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0) ELSE 0 END), 0), 2) as prepayments
        FROM transactions t
        JOIN ledger_lines l ON t.id = l.transaction_id
    `).get();

    const monthsRaw = nativeDb.prepare("SELECT COUNT(DISTINCT strftime('%Y-%m', date)) as val FROM transactions").get().val;
    const realEstate = nativeDb.prepare("SELECT ROUND(COALESCE(SUM(COALESCE(currentMarketValue, baseValue)), 0), 2) as val FROM real_estate").get().val;
    const goldValue = nativeDb.prepare("SELECT ROUND(COALESCE(SUM(weightGrams * currentPricePerGram), 0), 2) as val FROM gold_holdings").get().val;
    const fdPrincipal = nativeDb.prepare("SELECT ROUND(COALESCE(SUM(principal), 0), 2) as val FROM fixed_deposits").get().val;
    const npsValue = nativeDb.prepare("SELECT ROUND(COALESCE(SUM(currentValue), 0), 2) as val FROM nps_accounts").get().val;
    
    const loanPrincipal = getTrueAmortizedDebt();
    const freeLiquidity = getFreeCash();

    const monthsTracked = Math.max(1, monthsRaw || 1);
    
    return {
        income: ledgerMetrics.income,
        expense: ledgerMetrics.expense,
        sinking: txMetrics.sinking,
        endow: txMetrics.endow,
        invest: txMetrics.invest,
        prepayments: txMetrics.prepayments,
        ccBalance: ledgerMetrics.ccBalance,
        freeLiquidity: Math.round(freeLiquidity),
        monthsTracked,
        monthlyAvgExpense: Math.round(ledgerMetrics.expense / monthsTracked),
        monthlyAvgIncome: Math.round(ledgerMetrics.income / monthsTracked),
        realEstate,
        loanPrincipal,
        goldValue: Math.round(goldValue),
        fdPrincipal: Math.round(fdPrincipal),
        npsValue: Math.round(npsValue)
    };
};

exports.getDiagnosticsMetrics = () => {
    const diagnostics = { alerts: [], structuralDeficit: false };

    const settingsRows = nativeDb.prepare("SELECT key, value FROM app_settings").all();
    const settings = {};
    settingsRows.forEach(r => settings[r.key] = r.value);
    
    const cibilThreshold = settings.sentinel_cibil_threshold ? parseFloat(settings.sentinel_cibil_threshold) : 0.3;
    const anomalyMultiplier = settings.sentinel_anomaly_multiplier ? parseFloat(settings.sentinel_anomaly_multiplier) : 1.4;
    const anomalyAbsolute = settings.sentinel_anomaly_absolute ? parseFloat(settings.sentinel_anomaly_absolute) : 5000;

    const totalIncomeAnnual = nativeDb.prepare("SELECT ROUND(COALESCE(SUM(annualIncome), 0), 2) as val FROM family_members").get().val;
    const totalBudgets = nativeDb.prepare("SELECT ROUND(COALESCE(SUM(monthlyLimit), 0), 2) as val FROM budgets").get().val;
    
    const { getMonthlyEquivalent } = require('../utils/financialUtils');
    
    const loansRaw = nativeDb.prepare("SELECT * FROM reminders WHERE LOWER(category)='loan'").all();
    const activeLoans = loansRaw.filter(l => !isMatured(l.dueDate, l.termYears, l.frequency));
    const totalEMI = activeLoans.reduce((sum, l) => sum + getMonthlyEquivalent(l.amount, l.frequency), 0);
    
    const subRowsRaw = nativeDb.prepare("SELECT * FROM reminders WHERE LOWER(category)='subscription'").all();
    const subRows = subRowsRaw.filter(s => !isMatured(s.dueDate, s.termYears, s.frequency));
    
    const insRowsRaw = nativeDb.prepare("SELECT * FROM reminders WHERE LOWER(category)='insurance'").all();
    const insRows = insRowsRaw.filter(i => !isMatured(i.dueDate, i.termYears, i.frequency));
    const cards = nativeDb.prepare("SELECT * FROM credit_cards").all();
    const freeLiquidity = getFreeCash();
    const recentTxs = nativeDb.prepare(`
        SELECT * FROM (
            ${TX_JOIN_QUERY} WHERE date >= date('now', '-6 months')
        ) txs
        WHERE LOWER(type)='expense' AND LOWER(category) != 'capital_deployment'
    `).all();

    const monthlyIncome = totalIncomeAnnual / 12;
    const subTotal = subRows.reduce((a, b) => a + getMonthlyEquivalent(b.amount, b.frequency), 0);
    const insTotal = insRows.reduce((a, b) => a + getMonthlyEquivalent(b.amount, b.frequency), 0);
    const totalMonthlyObligations = totalBudgets + totalEMI + subTotal + insTotal;

    if (monthlyIncome > 0 && totalMonthlyObligations > monthlyIncome) {
        diagnostics.structuralDeficit = true;
        diagnostics.alerts.push({
            type: 'critical',
            title: 'Structural Bleed Detected',
            message: `System mathematically proves your monthly burn (₹${totalMonthlyObligations.toLocaleString('en-IN')}) exceeds baseline income (₹${monthlyIncome.toLocaleString('en-IN')}).`,
            action: 'Reduce Budgets or EMIs'
        });
    }

    if (freeLiquidity < 0) {
        diagnostics.alerts.push({
            type: 'critical',
            title: 'Negative Free Liquidity',
            message: `Your locked assets exceed your actual ledger cash by ₹${Math.abs(freeLiquidity).toLocaleString('en-IN')}. Mathematical impossibility detected.`,
            action: 'Liquidate Illiquid Assets'
        });
    }

    cards.forEach(c => {
        if (c.creditLimit > 0 && (c.currentBalance / c.creditLimit) > cibilThreshold) {
            const pct = ((c.currentBalance / c.creditLimit) * 100).toFixed(1);
            diagnostics.alerts.push({
                type: 'warning',
                title: 'CIBIL Score Threat',
                message: `Card '${c.name}' is at ${pct}% capacity. Crossing ${Math.round(cibilThreshold * 100)}% permanently suppresses credit scoring mechanisms.`,
                action: 'Execute Priority Debt Paydown'
            });
        }
    });

    if (recentTxs.length > 0) {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        const currentMonthSpends = {};
        const historicalSpends = {};
        
        recentTxs.forEach(t => {
            const txDate = new Date(t.date);
            if (txDate >= thirtyDaysAgo) {
                currentMonthSpends[t.category] = (currentMonthSpends[t.category] || 0) + t.amount;
            } else {
                historicalSpends[t.category] = (historicalSpends[t.category] || 0) + t.amount;
            }
        });

        const historicalTxMonths = new Set();
        recentTxs.forEach(t => {
            const txDate = new Date(t.date);
            if (txDate < thirtyDaysAgo) {
                historicalTxMonths.add(t.date.slice(0, 7));
            }
        });
        const dynamicDivisor = Math.max(1, historicalTxMonths.size);

        Object.keys(currentMonthSpends).forEach(cat => {
            const current = currentMonthSpends[cat];
            const historicalAvg = (historicalSpends[cat] || 0) / dynamicDivisor;
            
            if (historicalAvg > 0 && current > historicalAvg * anomalyMultiplier && (current - historicalAvg) > anomalyAbsolute) {
                diagnostics.alerts.push({
                    type: 'warning',
                    title: `Statistical Anomaly: ${cat.toUpperCase()}`,
                    message: `Your trailing 30-day spend on ${cat} (₹${Math.round(current).toLocaleString('en-IN')}) is ${Math.round((current/historicalAvg - 1)*100)}% higher than your historical 5-month average (₹${Math.round(historicalAvg).toLocaleString('en-IN')}).`,
                    action: `Review ${cat} Ledger`
                });
            }
        });
    }

    const now = new Date();
    const days45Ago = new Date(now.getTime() - (45 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
    const days105Ago = new Date(now.getTime() - (105 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
    const days395Ago = new Date(now.getTime() - (395 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

    const candidateTxs = nativeDb.prepare(`
        SELECT * FROM (
            ${TX_JOIN_QUERY} WHERE date >= ?
        ) txs
        WHERE LOWER(type)='expense' AND (LOWER(category) IN ('insurance', 'subscription') OR (category='capital_deployment' AND family_member_id IS NOT NULL))
        ORDER BY date DESC
    `).all(days395Ago);

    const usedTxIds = new Set();
        
    const checkGhostLiability = (items, categoryName) => {
        items.forEach(item => {
            if (item.frequency === 'once') return; 

            try {
                const isMonthly = item.frequency === 'monthly';
                const isQuarterly = item.frequency === 'quarterly';
                const isYearly = item.frequency === 'yearly';
                
                let timeLimitStr = isMonthly ? days45Ago : (isQuarterly ? days105Ago : (isYearly ? days395Ago : null));
                if (!timeLimitStr) return;

                const amt = Math.abs(Number(String(item.amount).replace(/,/g, '')));
                if (amt === 0) return;
                
                const searchTitle = item.title.trim().toLowerCase();
                
                const foundTx = candidateTxs.find(t => {
                    if (usedTxIds.has(t.id)) return false;
                    if (t.date < timeLimitStr) return false;
                    
                    if (t.category === 'capital_deployment') {
                        if (item.owner_member_id && String(t.family_member_id) !== String(item.owner_member_id)) return false;
                        return Math.abs(Number(String(t.amount).replace(/,/g, ''))) === amt;
                    } else {
                        if (t.category !== categoryName) return false;
                        if (categoryName === 'insurance' && String(t.insurance_id) === String(item.id)) return true;
                        if (categoryName === 'subscription' && String(t.subscription_id) === String(item.id)) return true;
                        if (searchTitle.length > 0 && t.title.toLowerCase().includes(searchTitle)) return true;
                        if (Math.abs(Number(String(t.amount).replace(/,/g, ''))) === amt) return true;
                        return false;
                    }
                });
                
                if (foundTx) {
                    usedTxIds.add(foundTx.id);
                } else {
                    const timeframe = isMonthly ? '45 days' : '13 months';
                    diagnostics.alerts.push({
                        type: 'warning',
                        title: `Ghost Liability (${categoryName})`,
                        message: `Tracking actively says you pay ₹${amt} for '${item.title}' ${item.frequency}, but no expense matching this exists in the Ledger over the last ${timeframe}. Policy lapse risk detected.`,
                        action: 'Log Missing Premium'
                    });
                }
            } catch (err) {
                console.error("Error checking ghost liability:", err);
            }
        });
    };

    checkGhostLiability(subRows, 'subscription');
    checkGhostLiability(insRows, 'insurance');

    if (diagnostics.alerts.length === 0) {
        diagnostics.alerts.push({
            type: 'success',
            title: 'System Optimal',
            message: 'Sentinel detected zero structural paradoxes. Complete asset accounting integrity achieved.',
            action: 'None Required'
        });
    }

    return diagnostics;
};

exports.getEmergencyAdequacyMetrics = () => {
    const avgExpQuery = "SELECT ROUND(COALESCE(SUM(COALESCE(debit_amount, 0) - COALESCE(credit_amount, 0)), 0), 2) as val FROM ledger_lines l JOIN transactions t ON l.transaction_id = t.id WHERE l.account_class='Expense' AND l.account_type='operating' AND TRIM(LOWER(COALESCE(t.category, 'uncategorized'))) NOT IN ('loan', 'insurance', 'subscription', 'loan_interest_accrual', 'credit_card', 'credit card', 'creditcard', 'emi', 'tax', 'taxes', 'income_tax', 'tds', 'advance_tax', 'property_tax', 'capital_gains_tax') AND t.date >= date('now', '-6 months') AND t.date <= date('now')";
    const sumExp = nativeDb.prepare(avgExpQuery).get().val || 0;
    
    const dateRangeQuery = nativeDb.prepare("SELECT CAST(julianday('now') - julianday(MIN(t.date)) AS INTEGER) as days FROM ledger_lines l JOIN transactions t ON l.transaction_id = t.id WHERE l.account_class='Expense' AND l.account_type='operating' AND TRIM(LOWER(COALESCE(t.category, 'uncategorized'))) NOT IN ('loan', 'insurance', 'subscription', 'loan_interest_accrual', 'credit_card', 'credit card', 'creditcard', 'emi', 'tax', 'taxes', 'income_tax', 'tds', 'advance_tax', 'property_tax', 'capital_gains_tax') AND t.date >= date('now', '-6 months') AND t.date <= date('now')").get().days;
    let trackedDivisor = 1;
    if (dateRangeQuery !== undefined && dateRangeQuery !== null) {
        trackedDivisor = dateRangeQuery / 30.44;
    }
    trackedDivisor = Math.max(0.5, Math.min(6, trackedDivisor));
    
    const avgExp = Math.max(0, sumExp / trackedDivisor);
    
    const computeMonthlyObligation = (amt, freq, dueDate) => {
        let f = String(freq || '').trim().toLowerCase();
        if (!f) f = 'monthly';
        if (f === 'once') return 0; 
        if (f === 'monthly') return amt;
        if (f === 'quarterly') return amt / 3.0;
        if (f === 'yearly' || f === 'annual' || f === 'annually') return amt / 12.0;
        if (f === 'half-yearly' || f === 'semi-annually' || f === 'bi-annually') return amt / 6.0;
        if (f === 'weekly') return (amt * 52.0) / 12.0;
        if (f === 'biweekly' || f === 'bi-weekly' || f === 'fortnightly') return (amt * 26.0) / 12.0;
        if (f === 'daily') return (amt * 365.25) / 12.0;
        return amt;
    };
    
    const dependentHeads = nativeDb.prepare("SELECT id FROM family_members WHERE LOWER(role) = 'dependent' OR LOWER(role) = 'child'").all();
    const depIds = dependentHeads.map(d => String(d.id));
    const depIdStr = "SELECT id FROM family_members WHERE LOWER(role) IN ('dependent', 'child')";

    const loansRaw = nativeDb.prepare(`SELECT * FROM reminders WHERE TRIM(LOWER(category))='loan' AND (owner_member_id IS NULL OR owner_member_id NOT IN (${depIdStr}))`).all();
    const allOtherLiabilities = nativeDb.prepare(`
        SELECT ll.entity_id, ROUND(COALESCE(SUM(COALESCE(debit_amount, 0) - COALESCE(credit_amount, 0)), 0), 2) as bal 
        FROM ledger_lines ll
        LEFT JOIN reminders r ON ll.entity_id = r.id AND ll.account_type IN ('loan', 'insurance', 'subscription', 'other')
        WHERE ll.account_class='Liability' AND ll.account_type != 'credit_card'
        AND (r.owner_member_id IS NULL OR r.owner_member_id NOT IN (${depIdStr}))
        GROUP BY ll.entity_id
    `).all();
    
    let maturedDebt = 0;
    for (const ll of allOtherLiabilities) {
        if (ll.bal > 0) {
            const reminder = loansRaw.find(r => String(r.id) === String(ll.entity_id));
            if (!reminder) {
                maturedDebt += ll.bal;
            } else {
                if (isMatured(reminder.dueDate, reminder.termYears, reminder.frequency)) {
                    maturedDebt += ll.bal;
                }
            }
        }
    }
    
    const emi = loansRaw.filter(l => !isMatured(l.dueDate, l.termYears, l.frequency)).reduce((sum, l) => {
        const amt = Math.abs(parseFloat(String(l.amount).replace(/,/g, '')) || 0);
        const freq = String(l.frequency || '').trim().toLowerCase();
        return sum + computeMonthlyObligation(amt, freq, l.dueDate);
    }, 0);
    
    const insRaw = nativeDb.prepare(`SELECT * FROM reminders WHERE TRIM(LOWER(category))='insurance' AND (owner_member_id IS NULL OR owner_member_id NOT IN (${depIdStr}))`).all();
    const ins = insRaw.filter(i => !isMatured(i.dueDate, i.termYears, i.frequency)).reduce((sum, i) => {
        const amt = Math.abs(parseFloat(String(i.amount).replace(/,/g, '')) || 0);
        const freq = String(i.frequency || '').trim().toLowerCase();
        return sum + computeMonthlyObligation(amt, freq, i.dueDate);
    }, 0);
    
    const subsRaw = nativeDb.prepare(`SELECT * FROM reminders WHERE TRIM(LOWER(category))='subscription' AND (owner_member_id IS NULL OR owner_member_id NOT IN (${depIdStr}))`).all();
    const subs = subsRaw.filter(s => !isMatured(s.dueDate, s.termYears, s.frequency)).reduce((sum, s) => {
        const amt = Math.abs(parseFloat(String(s.amount).replace(/,/g, '')) || 0);
        const freq = String(s.frequency || '').trim().toLowerCase();
        return sum + computeMonthlyObligation(amt, freq, s.dueDate);
    }, 0);


    const ccDebtQuery = `
        SELECT ROUND(COALESCE(SUM(COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0)), 0), 2) as val 
        FROM ledger_lines ll
        LEFT JOIN credit_cards cc ON ll.entity_id = cc.id
        WHERE ll.account_class='Liability' AND ll.account_type='credit_card' 
        AND (cc.owner_member_id IS NULL OR cc.owner_member_id NOT IN (${depIdStr}))
    `;
    const ccDebt = nativeDb.prepare(ccDebtQuery).get().val || 0;

    const freeCashQuery = `
        SELECT ROUND(COALESCE(SUM(COALESCE(debit_amount, 0) - COALESCE(credit_amount, 0)), 0), 2) as val 
        FROM ledger_lines ll
        LEFT JOIN bank_balances b ON ll.entity_id = b.id AND ll.account_type = 'bank'
        WHERE ll.account_class='Asset' AND ll.account_type IN ('bank', 'operating', 'transfer_clearing')
        AND (ll.account_type != 'bank' OR b.owner_member_id IS NULL OR b.owner_member_id NOT IN (${depIdStr}))
    `;
    const freeCash = nativeDb.prepare(freeCashQuery).get().val || 0;

    const liquidSinking = nativeDb.prepare(`SELECT ROUND(COALESCE(SUM(currentAmount), 0), 2) as val FROM sinking_funds WHERE (targetDate IS NULL OR targetDate > date('now', '+6 months')) AND (owner_member_id IS NULL OR owner_member_id NOT IN (${depIdStr}))`).get().val || 0;
    
    const fds = nativeDb.prepare(`SELECT * FROM fixed_deposits WHERE owner_member_id IS NULL OR owner_member_id NOT IN (${depIdStr})`).all();
    let liquidFdValue = 0, lockedFdValue = 0;
    const now = new Date();
    now.setHours(0,0,0,0);
    fds.forEach(fd => {
        const val = (parseFloat(String(fd.principal).replace(/,/g, '')) || 0) + computeFdAccruedInterest(fd);
        let isLocked = String(fd.isTaxSaver) === '1' || String(fd.isTaxSaver).trim().toLowerCase() === 'true';
        if (isLocked && fd.maturityDate) {
            const mDate = new Date(fd.maturityDate);
            if (mDate < now) isLocked = false;
        }
        if (isLocked) lockedFdValue += val;
        else liquidFdValue += val;
    });

    const excludedCategories = `('epf', 'employee provident fund', 'ppf', 'public provident fund', 'nps', 'national pension scheme', 'national pension system', 'ssy', 'sukanya', 'sukanya samriddhi', 'sukanya samriddhi yojana')`;
    const epfCategories = `('epf', 'employee provident fund')`;
    
    const debtFundsAmount = nativeDb.prepare(`SELECT ROUND(COALESCE(SUM(CASE WHEN schemeCode IS NOT NULL AND latestNav > 0 AND totalUnits > 0 THEN (latestNav * totalUnits) ELSE (currentAmount + COALESCE(unrealizedGain, 0)) END), 0), 2) as val FROM investments WHERE TRIM(LOWER(assetClass)) IN ('debt', 'sovereign', 'liquid', 'gilt') AND TRIM(LOWER(COALESCE(category, ''))) NOT IN ${excludedCategories} AND (owner_member_id IS NULL OR owner_member_id NOT IN (${depIdStr}))`).get().val || 0;
    const equityAmount = nativeDb.prepare(`SELECT ROUND(COALESCE(SUM(CASE WHEN schemeCode IS NOT NULL AND latestNav > 0 AND totalUnits > 0 THEN (latestNav * totalUnits) ELSE (currentAmount + COALESCE(unrealizedGain, 0)) END), 0), 2) as val FROM investments WHERE TRIM(LOWER(assetClass)) NOT IN ('debt', 'sovereign', 'liquid', 'gilt') AND TRIM(LOWER(COALESCE(category, ''))) NOT IN ${excludedCategories} AND (owner_member_id IS NULL OR owner_member_id NOT IN (${depIdStr}))`).get().val || 0;
    const equityHaircut = equityAmount * 0.50;
    const epfAmount = nativeDb.prepare(`SELECT ROUND(COALESCE(SUM(currentAmount + COALESCE(unrealizedGain, 0)), 0), 2) as val FROM investments WHERE TRIM(LOWER(category)) IN ${epfCategories} AND (owner_member_id IS NULL OR owner_member_id NOT IN (${depIdStr}))`).get().val || 0;
    const epfBreakable = epfAmount * 0.50;
    
    const golds = nativeDb.prepare(`SELECT * FROM gold_holdings WHERE owner_member_id IS NULL OR owner_member_id NOT IN (${depIdStr})`).all();
    let liquidGoldTotal = 0, sgbTotal = 0;
    const nowForGold = new Date();
    nowForGold.setHours(0,0,0,0);
    golds.forEach(g => {
        const price = parseFloat(String(g.currentPricePerGram || '').replace(/,/g, '')) || parseFloat(String(g.purchasePricePerGram || '').replace(/,/g, '')) || 0;
        const baseVal = (Number(String(g.weightGrams).replace(/,/g, '')) * price) || 0;
        let gType = String(g.type || '').trim().toLowerCase();
        let isSGB = (gType === 'sgb' || gType === 'sovereign gold bond (sgb)');
        if (isSGB && g.maturityDate) {
            const mDate = new Date(g.maturityDate);
            if (mDate < nowForGold) isSGB = false;
        }
        if (isSGB) sgbTotal += baseVal;
        else liquidGoldTotal += baseVal;
    });

    const totalEndowments = nativeDb.prepare(`SELECT ROUND(COALESCE(SUM(annualIncome), 0), 2) as val FROM family_members WHERE LOWER(role) NOT IN ('child', 'dependent')`).get().val || 0;

    const totalMonthlyObligation = avgExp + emi + ins + subs;
    
    let bulletEncumbrances = 0;
    const nowTime = new Date();
    nowTime.setHours(0,0,0,0);
    const oneYearFromNow = new Date(nowTime);
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    const processBullet = (item) => {
        if (String(item.frequency || '').trim().toLowerCase() === 'once') {
            if (!item.dueDate) {
                bulletEncumbrances += Math.abs(parseFloat(String(item.amount).replace(/,/g, '')) || 0);
                return;
            }
            const dDate = new Date(item.dueDate + 'T00:00:00');
            if (!isNaN(dDate.getTime()) && dDate >= nowTime && dDate <= oneYearFromNow) {
                bulletEncumbrances += Math.abs(parseFloat(String(item.amount).replace(/,/g, '')) || 0);
            }
        }
    };

    loansRaw.filter(l => !isMatured(l.dueDate, l.termYears, l.frequency)).forEach(processBullet);
    insRaw.filter(i => !isMatured(i.dueDate, i.termYears, i.frequency)).forEach(processBullet);
    subsRaw.filter(s => !isMatured(s.dueDate, s.termYears, s.frequency)).forEach(processBullet);

    const grossLiquidReserves = freeCash + liquidFdValue + debtFundsAmount;
    const totalLiquidReserves = Math.max(0, grossLiquidReserves - ccDebt - maturedDebt - bulletEncumbrances);
    
    const sgbHaircut = sgbTotal * 0.50;
    const endowmentHaircut = totalEndowments * 0.50;
    const grossBreakableReserves = grossLiquidReserves + liquidGoldTotal + liquidSinking + endowmentHaircut + equityHaircut + epfBreakable + sgbHaircut;
    const breakableReserves = Math.max(0, grossBreakableReserves - ccDebt - maturedDebt - bulletEncumbrances);
    
    const survivalMonths = totalMonthlyObligation > 0 ? totalLiquidReserves / totalMonthlyObligation : 99;
    const extendedSurvival = totalMonthlyObligation > 0 ? breakableReserves / totalMonthlyObligation : 99;

    let adequacy = 'critical';
    if (survivalMonths >= 12) adequacy = 'platinum';
    else if (survivalMonths >= 9) adequacy = 'gold';
    else if (survivalMonths >= 6) adequacy = 'secure';
    else if (survivalMonths >= 3) adequacy = 'warning';

    const targetGap = Math.max(0, (6 * totalMonthlyObligation) - totalLiquidReserves);

    return {
        totalMonthlyObligation: Math.round(totalMonthlyObligation),
        breakdown: { avgExpense: Math.round(avgExp), emi: Math.round(emi), insurance: Math.round(ins), subscriptions: Math.round(subs) },
        reservesBreakdown: {
            freeCash: Math.round(freeCash),
            liquidFdValue: Math.round(liquidFdValue),
            debtFundsAmount: Math.round(debtFundsAmount),
            ccDebt: Math.round(ccDebt),
            maturedDebt: Math.round(maturedDebt),
            bulletEncumbrances: Math.round(bulletEncumbrances)
        },
        illiquidBreakdown: {
            liquidGoldTotal: Math.round(liquidGoldTotal),
            sgbHaircut: Math.round(sgbHaircut),
            endowmentHaircut: Math.round(endowmentHaircut),
            equityHaircut: Math.round(equityHaircut),
            epfBreakable: Math.round(epfBreakable),
            liquidSinking: Math.round(liquidSinking)
        },
        totalLiquidReserves: Math.round(totalLiquidReserves),
        breakableReserves: Math.round(breakableReserves),
        survivalMonths: parseFloat(survivalMonths.toFixed(1)),
        extendedSurvival: parseFloat(extendedSurvival.toFixed(1)),
        adequacy,
        targetGap: Math.round(targetGap)
    };
};

exports.getSummaryMetrics = (period) => {
    const now = new Date();
    let startDate = null;

    if (period === 'mtd') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'qtd') {
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
    } else if (period === 'ytd') {
        startDate = new Date(now.getFullYear(), 0, 1);
    } else if (period === 'fy') {
        const currentMonth = now.getMonth();
        const year = currentMonth >= 3 ? now.getFullYear() : now.getFullYear() - 1;
        startDate = new Date(year, 3, 1);
    }

    let dateFilter = '';
    const queryParams = [];
    if (startDate) {
        const tzOffset = startDate.getTimezoneOffset() * 60000;
        const isoDate = (new Date(startDate - tzOffset)).toISOString().slice(0, 10);
        dateFilter = 'AND date >= ?';
        queryParams.push(isoDate);
    }

    const incomeQuery = `
        SELECT ROUND(COALESCE(SUM(COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0)), 0), 2) as total
        FROM ledger_lines l
        JOIN transactions t ON l.transaction_id = t.id
        WHERE l.account_class = 'Revenue' AND l.account_type = 'operating'
        ${dateFilter}
    `;

    const expenseQuery = `
        SELECT ROUND(COALESCE(SUM(COALESCE(debit_amount, 0) - COALESCE(credit_amount, 0)), 0), 2) as total
        FROM ledger_lines l
        JOIN transactions t ON l.transaction_id = t.id
        WHERE l.account_class = 'Expense' AND l.account_type = 'operating'
        ${dateFilter}
    `;

    const income = nativeDb.prepare(incomeQuery).get(...queryParams).total;
    const expense = nativeDb.prepare(expenseQuery).get(...queryParams).total;

    return [
        { type: 'income', total: income },
        { type: 'expense', total: expense }
    ];
};
