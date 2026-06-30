const { nativeDb } = require('../../database');
const { getFreeCash } = require('../utils/analyticsUtils');

const { calculateTotalIncomeTax } = require('../utils/financialUtils');

const getRemainingMonths = (reminder) => {
    if (!reminder || !reminder.termYears || parseFloat(String(reminder.termYears).replace(/,/g, '')) <= 0) return 12;
    let col = null;
    const cat = String(reminder.category).trim().toLowerCase();
    if (cat === 'loan') col = 'linked_loan_id';
    else if (cat === 'insurance') col = 'insurance_id';
    else if (cat === 'subscription') col = 'subscription_id';
    let startStr = reminder.startDate;
    if (!startStr && col && reminder.id) {
        const earliestTx = nativeDb.prepare(`SELECT MIN(date) as val FROM transactions WHERE ${col} = ?`).get(reminder.id);
        if (earliestTx && earliestTx.val) startStr = earliestTx.val;
    }
    if (!startStr) return 12;
    const startDate = new Date(startStr);
    if (isNaN(startDate.getTime())) return 12;
    startDate.setMonth(startDate.getMonth() + Math.round(parseFloat(String(reminder.termYears).replace(/,/g, '')) * 12));
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (startDate < now) return 0;
    const diffMonths = (startDate.getFullYear() - now.getFullYear()) * 12 + (startDate.getMonth() - now.getMonth());
    return Math.min(12, Math.max(0, diffMonths));
};

const computeHorizonAmount = (amt, freq, remainingMonths) => {
    if (remainingMonths <= 0) return 0;
    const a = Math.abs(parseFloat(String(amt).replace(/,/g, '')) || 0);
    let annual = 0;
    let f = (freq || '').toString().trim().toLowerCase();
    if (!f) f = 'monthly';
    switch (f) {
        case 'daily': annual = a * 365.25; break;
        case 'weekly': annual = a * 52.0; break;
        case 'biweekly':
        case 'fortnightly':
        case 'bi-weekly': annual = a * 26.0; break;
        case 'monthly': annual = a * 12.0; break;
        case 'quarterly': annual = a * 4.0; break;
        case 'semi-annually':
        case 'half-yearly':
        case 'bi-annually': annual = a * 2.0; break;
        case 'annual':
        case 'annually':
        case 'yearly': annual = a * 1.0; break;
        case 'once': return a;
        default: annual = a * 12.0; break;
    }
    return (annual / 12) * remainingMonths;
};

// ─── HLV Calculator ──────────────────────────────────────────────
exports.getHlvCalculator = (query) => {
    const queryYears = parseInt(query.workingYears);
    const queryRate = parseFloat(query.discountRate);
    const rawRate = Math.max(-99.99, isNaN(queryRate) ? 6.0 : queryRate);
    const discountRate = Math.abs(rawRate) < 0.0001 ? 0 : rawRate;
    const queryInf = parseFloat(query.inflationRate);
    const inflationRate = Math.max(0, isNaN(queryInf) ? 4.0 : queryInf);

    const earnersQuery = nativeDb.prepare("SELECT annualIncome as income, age, id FROM family_members WHERE TRIM(UPPER(role)) IN ('PROVIDER', 'PARTNER')").all();
    let totalTakeHomeIncome = 0;
    let annualIncome = 0;
    let incomeReplacement = 0;
    const earnerIncomeReplacement = {};
    const consumptionDiscount = 0.70;

    const partnerRow = nativeDb.prepare("SELECT COUNT(id) as cnt FROM family_members WHERE TRIM(UPPER(role)) = 'PARTNER'").get();
    const partnerCount = partnerRow ? partnerRow.cnt : 0;
    const adultHeadsQuery = nativeDb.prepare("SELECT COUNT(id) as cnt FROM family_members WHERE TRIM(UPPER(role)) IN ('PROVIDER', 'PARTNER')").get();
    const adultHeads = adultHeadsQuery ? Math.max(1, adultHeadsQuery.cnt) : 1;

    const dependentsForCount = nativeDb.prepare("SELECT id FROM family_members WHERE TRIM(UPPER(role)) IN ('CHILD', 'ELDER', 'DEPENDENT')").all();
    let dependentCount = dependentsForCount.length;

    for (const earner of earnersQuery) {
        const inc = Math.max(0, earner.income || 0);
        annualIncome += inc;
        const taxableIncome = Math.max(0, inc - 75000);
        const tax = calculateTotalIncomeTax(taxableIncome);
        const takeHome = inc - tax;
        totalTakeHomeIncome += takeHome;

        const earnerAge = Math.max(18, Math.min(100, parseInt(earner.age) || 40));
        const earnerWorkingYears = !isNaN(queryYears) ? Math.max(0, queryYears) : Math.max(0, 65 - earnerAge);
        const effectiveIncome = takeHome * consumptionDiscount;

        if (effectiveIncome > 0 && earnerWorkingYears > 0) {
            if (discountRate !== 0 || inflationRate !== 0) {
                const nominalR = discountRate / 100;
                const i = inflationRate / 100;
                const netYield = nominalR > 0 ? nominalR * (1 - 0.15) : nominalR;
                let realR = ((1 + netYield) / (1 + i)) - 1;
                if (Math.abs(realR) < 0.0001) realR = 0.0001;
                const pv = effectiveIncome * ((1 - Math.pow(1 + realR, -earnerWorkingYears)) / realR) * (1 + realR);
                incomeReplacement += pv;
                earnerIncomeReplacement[earner.id] = pv;
            } else {
                const pv = effectiveIncome * earnerWorkingYears;
                incomeReplacement += pv;
                earnerIncomeReplacement[earner.id] = pv;
            }
        }
    }

    const individualDebts = nativeDb.prepare(`
        SELECT entity_id, COALESCE(SUM(COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0)),0) as val 
        FROM ledger_lines WHERE account_class='Liability' GROUP BY entity_id
    `).all();

    let outstandingDebt = 0;
    let overpaidLiabilityAsset = 0;
    for (const row of individualDebts) {
        if (row.val > 0) outstandingDebt += row.val;
        else if (row.val < 0) overpaidLiabilityAsset += Math.abs(row.val);
    }

    const dependents = nativeDb.prepare("SELECT id, age, targetAge, COALESCE(targetCollegeValue, 0) as targetVal FROM family_members WHERE TRIM(UPPER(role)) IN ('CHILD', 'ELDER', 'DEPENDENT')").all();
    let childEducation = 0;
    dependentCount = dependents.length;

    const depIds = dependents.map(d => String(d.id));
    const depIdStr = "SELECT id FROM family_members WHERE TRIM(UPPER(role)) IN ('CHILD', 'ELDER', 'DEPENDENT')";
    const dependentAssetsQuery = nativeDb.prepare(`
        SELECT COALESCE(b.owner_member_id, f.owner_member_id, i.owner_member_id, nps.owner_member_id, s.owner_member_id, g.owner_member_id,
               CASE WHEN ll.account_type='endowment' THEN ll.entity_id ELSE NULL END) as resolved_owner_id,
               LOWER(ll.account_type) as type, 
               COALESCE(SUM(COALESCE(debit_amount, 0) - COALESCE(credit_amount, 0)),0) as val 
        FROM ledger_lines ll
        LEFT JOIN bank_balances b ON ll.entity_id = b.id AND ll.account_type IN ('bank', 'cash', 'checking', 'savings')
        LEFT JOIN fixed_deposits f ON ll.entity_id = f.id AND ll.account_type IN ('fd', 'deposit')
        LEFT JOIN investments i ON ll.entity_id = i.id AND ll.account_type IN ('investment', 'brokerage', 'crypto', 'stocks', 'mutual_fund', 'sip', 'epf', 'ppf')
        LEFT JOIN nps_accounts nps ON ll.entity_id = nps.id AND ll.account_type = 'nps'
        LEFT JOIN sinking_funds s ON ll.entity_id = s.id AND ll.account_type = 'sinking_fund'
        LEFT JOIN gold_holdings g ON ll.entity_id = g.id AND ll.account_type = 'gold'
        WHERE ll.account_class='Asset'
        GROUP BY resolved_owner_id, LOWER(ll.account_type)
        HAVING LOWER(ll.account_type) = 'endowment' OR (resolved_owner_id IS NOT NULL AND resolved_owner_id IN (${depIdStr}))
    `).all();

    const depSafeAssetMap = {};
    const depVolatileAssetMap = {};
    let unassignedEndowment = 0;
    let trustOverdraft = 0;
    const earnerEndowmentsMap = {};
    const safeAssetTypesStr = "'bank', 'cash', 'checking', 'savings', 'fd', 'deposit', 'epf', 'ppf', 'nps', 'sinking_fund'";

    for (const row of dependentAssetsQuery) {
        const eid = String(row.resolved_owner_id);
        const type = row.type;
        const val = row.val;
        const isDep = dependents.find(d => String(d.id) === eid);
        if (isDep) {
            if (safeAssetTypesStr.includes(`'${type}'`)) {
                depSafeAssetMap[eid] = (depSafeAssetMap[eid] || 0) + val;
            } else {
                depVolatileAssetMap[eid] = (depVolatileAssetMap[eid] || 0) + val;
            }
        } else {
            if (!eid || eid === 'null' || eid === 'undefined') {
                if (val < 0) trustOverdraft += Math.abs(val);
                else unassignedEndowment += val;
            } else {
                if (val < 0) trustOverdraft += Math.abs(val);
                else earnerEndowmentsMap[eid] = (earnerEndowmentsMap[eid] || 0) + val;
            }
        }
    }

    const volatileLiquidityHaircut = 0.97 * 0.95;
    let totalDependentEndowment = 0;
    let assignedSurplusEndowment = 0;

    for (const dep of dependents) {
        const rawTarget = Math.max(0, dep.targetVal);
        let safeSaved = depSafeAssetMap[dep.id] || 0;
        let volatileSaved = depVolatileAssetMap[dep.id] || 0;
        if (safeSaved < 0) { trustOverdraft += Math.abs(safeSaved); safeSaved = 0; }
        if (volatileSaved < 0) { trustOverdraft += Math.abs(volatileSaved); volatileSaved = 0; }
        const saved = safeSaved + volatileSaved;
        totalDependentEndowment += saved;

        let pvTarget = rawTarget;
        if (dep.age !== null && dep.targetAge !== null) {
            const horizonYears = Math.max(0, parseInt(dep.targetAge) - parseInt(dep.age));
            if (horizonYears > 0) {
                let specificInf = inflationRate / 100;
                const role = String(dep.role || '').trim().toUpperCase();
                if (role === 'CHILD') specificInf = Math.max(0.07, specificInf + 0.03);
                else if (role === 'ELDER') specificInf = Math.max(0.06, specificInf + 0.02);
                const netYield = discountRate > 0 ? (discountRate / 100) * 0.85 : (discountRate / 100);
                if (role === 'ELDER') {
                    pvTarget = rawTarget;
                } else {
                    pvTarget = rawTarget * Math.pow((1 + specificInf) / (1 + netYield), horizonYears);
                }
            }
        }

        const effectiveSaved = safeSaved + (volatileSaved * volatileLiquidityHaircut);
        const liabilityDiff = pvTarget - effectiveSaved;
        if (liabilityDiff < 0) {
            assignedSurplusEndowment += Math.abs(liabilityDiff) / volatileLiquidityHaircut;
            childEducation += 0;
        } else {
            childEducation += liabilityDiff;
        }
    }

    let educationDeficit = childEducation;
    const effectiveUnassignedEndowment = unassignedEndowment * volatileLiquidityHaircut;
    childEducation = Math.max(0, educationDeficit - effectiveUnassignedEndowment);
    const surplusEndowment = Math.max(0, unassignedEndowment - (educationDeficit / volatileLiquidityHaircut));

    const avgExpQuery = "SELECT COALESCE(SUM(COALESCE(debit_amount, 0) - COALESCE(credit_amount, 0)), 0) as val FROM ledger_lines l JOIN transactions t ON l.transaction_id = t.id WHERE l.account_class='Expense' AND l.account_type='operating' AND TRIM(LOWER(COALESCE(t.category, 'uncategorized'))) NOT IN ('loan', 'insurance', 'subscription', 'loan_interest_accrual', 'credit_card', 'credit card', 'creditcard', 'emi', 'tax', 'taxes', 'income_tax', 'tds', 'advance_tax', 'property_tax', 'capital_gains_tax') AND t.date >= date('now', '-6 months') AND t.date <= date('now')";
    const sumExp = nativeDb.prepare(avgExpQuery).get().val || 0;
    const oldestTxQuery = "SELECT MIN(t.date) as val FROM ledger_lines l JOIN transactions t ON l.transaction_id = t.id WHERE l.account_class='Expense' AND l.account_type='operating' AND TRIM(LOWER(COALESCE(t.category, 'uncategorized'))) NOT IN ('loan', 'insurance', 'subscription', 'loan_interest_accrual', 'credit_card', 'credit card', 'creditcard', 'emi', 'tax', 'taxes', 'income_tax', 'tds', 'advance_tax', 'property_tax', 'capital_gains_tax') AND t.date >= date('now', '-6 months') AND t.date <= date('now')";
    const oldestTxRow = nativeDb.prepare(oldestTxQuery).get();
    let trackedDivisor = 1;
    if (oldestTxRow && oldestTxRow.val) {
        const start = new Date(oldestTxRow.val);
        const now = new Date();
        const diffDays = (now - start) / (1000 * 60 * 60 * 24);
        trackedDivisor = (diffDays / 30.44);
    }
    trackedDivisor = Math.max(0.5, Math.min(6, trackedDivisor));
    const avgExp = sumExp / trackedDivisor;
    const safeAvgExp = Math.max(0, avgExp);

    const loansRaw = nativeDb.prepare("SELECT * FROM reminders WHERE LOWER(category)='loan'").all();
    let reminderPrincipal = 0;
    for (const l of loansRaw) {
        reminderPrincipal += Math.abs(parseFloat(String(l.principalAmount).replace(/,/g, '')) || 0);
    }
    outstandingDebt = Math.max(outstandingDebt, reminderPrincipal);

    let unmappedEmiEmergencyBuffer = 0;
    const emiAnnual = loansRaw.reduce((sum, l) => sum + computeHorizonAmount(l.amount, l.frequency, getRemainingMonths(l)), 0);

    const insRaw = nativeDb.prepare("SELECT * FROM reminders WHERE LOWER(category)='insurance'").all();
    const earnersList = nativeDb.prepare("SELECT id FROM family_members WHERE TRIM(UPPER(role)) IN ('PROVIDER', 'PARTNER')").all();
    const earnerIdSet = new Set(earnersList.map(e => String(e.id)));

    const earnerRebates = {};
    const earnerSurvivingPremiums = {};
    let unearnedPremiumRebate = 0;

    const insAnnualRaw = insRaw.filter(i => {
        const pType = String(i.policyType).toLowerCase();
        if (pType.includes('life') || pType.includes('disability') || pType.includes('long_term_care') || pType.includes('ltc')) {
            const oid = String(i.owner_member_id);
            if (earnerIdSet.has(oid)) {
                const annualizedPremium = computeHorizonAmount(i.amount, i.frequency, 12);
                const freqStr = String(i.frequency || '').trim().toLowerCase();
                let rebate = 0;
                if (freqStr === 'annually' || freqStr === 'yearly') rebate = annualizedPremium * 0.50;
                else if (freqStr === 'semi-annually' || freqStr === 'half-yearly' || freqStr === 'bi-annually') rebate = annualizedPremium * 0.25;
                else if (freqStr === 'quarterly') rebate = annualizedPremium * 0.125;
                const actualRemaining = getRemainingMonths(i);
                const actualRemainingPremium = computeHorizonAmount(i.amount, i.frequency, actualRemaining);
                const finalRebate = Math.min(rebate, actualRemainingPremium);
                earnerRebates[oid] = (earnerRebates[oid] || 0) + finalRebate;
                unearnedPremiumRebate += finalRebate;
                earnerSurvivingPremiums[oid] = (earnerSurvivingPremiums[oid] || 0) + actualRemainingPremium;
                return false;
            } else if (oid === 'null' || oid === 'undefined' || !oid) {
                return true;
            }
        }
        return true;
    }).reduce((sum, i) => sum + computeHorizonAmount(i.amount, i.frequency, getRemainingMonths(i)), 0);

    const insAnnual = insAnnualRaw;
    const subsRaw = nativeDb.prepare("SELECT * FROM reminders WHERE LOWER(category)='subscription'").all();
    const subsAnnualRaw = subsRaw.reduce((sum, s) => sum + computeHorizonAmount(s.amount, s.frequency, getRemainingMonths(s)), 0);
    let subsAnnual = 0;
    if (dependentCount > 0 || adultHeads > 1) { subsAnnual = subsAnnualRaw * 0.80; } else { subsAnnual = 0; }

    let survivalAvgExp = 0;
    if (dependentCount > 0 || adultHeads > 1) { survivalAvgExp = safeAvgExp * consumptionDiscount; } else { survivalAvgExp = safeAvgExp * 0.10; }

    if (outstandingDebt < emiAnnual && unmappedEmiEmergencyBuffer < emiAnnual) { unmappedEmiEmergencyBuffer = emiAnnual; }
    const baseEmergencyFund = Math.max(0, (survivalAvgExp * 12) + insAnnual + subsAnnual + unmappedEmiEmergencyBuffer);

    const isMaturedLocal = (reminder) => getRemainingMonths(reminder) === 0;

    const safeAssetTypes = "'bank', 'cash', 'checking', 'savings', 'fd', 'deposit', 'epf', 'ppf', 'nps', 'sinking_fund'";
    const volatileAssetTypes = "'investment', 'brokerage', 'crypto', 'stocks', 'mutual_fund', 'sip', 'gold'";
    const assetQuery = (types) => `
        SELECT COALESCE(SUM(COALESCE(debit_amount, 0) - COALESCE(credit_amount, 0)),0) as val 
        FROM ledger_lines ll
        LEFT JOIN bank_balances b ON ll.entity_id = b.id AND ll.account_type IN ('bank', 'cash', 'checking', 'savings')
        LEFT JOIN fixed_deposits f ON ll.entity_id = f.id AND ll.account_type IN ('fd', 'deposit')
        LEFT JOIN investments i ON ll.entity_id = i.id AND ll.account_type IN ('investment', 'brokerage', 'crypto', 'stocks', 'mutual_fund', 'sip', 'epf', 'ppf')
        LEFT JOIN nps_accounts nps ON ll.entity_id = nps.id AND ll.account_type = 'nps'
        LEFT JOIN sinking_funds s ON ll.entity_id = s.id AND ll.account_type = 'sinking_fund'
        LEFT JOIN gold_holdings g ON ll.entity_id = g.id AND ll.account_type = 'gold'
        WHERE ll.account_class='Asset' AND LOWER(ll.account_type) IN (${types})
        AND (
            (ll.account_type IN ('bank', 'cash', 'checking', 'savings') AND (b.owner_member_id IS NULL OR b.owner_member_id NOT IN (${depIdStr})))
            OR (ll.account_type IN ('fd', 'deposit') AND (f.owner_member_id IS NULL OR f.owner_member_id NOT IN (${depIdStr})))
            OR (ll.account_type IN ('investment', 'brokerage', 'crypto', 'stocks', 'mutual_fund', 'sip', 'epf', 'ppf') AND (i.owner_member_id IS NULL OR i.owner_member_id NOT IN (${depIdStr})))
            OR (ll.account_type = 'nps' AND (nps.owner_member_id IS NULL OR nps.owner_member_id NOT IN (${depIdStr})))
            OR (ll.account_type = 'sinking_fund' AND (s.owner_member_id IS NULL OR s.owner_member_id NOT IN (${depIdStr})))
            OR (ll.account_type = 'gold' AND (g.owner_member_id IS NULL OR g.owner_member_id NOT IN (${depIdStr})))
            OR (ll.account_type = 'endowment' AND (ll.entity_id IS NULL OR ll.entity_id NOT IN (${depIdStr})))
            OR (ll.account_type NOT IN ('bank', 'cash', 'checking', 'savings', 'fd', 'deposit', 'investment', 'brokerage', 'crypto', 'stocks', 'mutual_fund', 'sip', 'epf', 'ppf', 'nps', 'sinking_fund', 'gold', 'endowment'))
        )
    `;
    const safeAssetRow = nativeDb.prepare(assetQuery(safeAssetTypes)).get();
    const volatileAssetRow = nativeDb.prepare(assetQuery(volatileAssetTypes)).get();

    let safeLiquidRaw = safeAssetRow ? safeAssetRow.val : 0;
    let volatileLiquidRaw = volatileAssetRow ? volatileAssetRow.val : 0;
    safeLiquidRaw += overpaidLiabilityAsset;
    volatileLiquidRaw += surplusEndowment;

    let overdraftDebt = trustOverdraft;
    if (safeLiquidRaw < 0) { overdraftDebt += Math.abs(safeLiquidRaw); safeLiquidRaw = 0; }
    if (volatileLiquidRaw < 0) { overdraftDebt += Math.abs(volatileLiquidRaw); volatileLiquidRaw = 0; }

    const singleStateLiquidAssets = safeLiquidRaw + (volatileLiquidRaw * volatileLiquidityHaircut);
    const rawOutstandingDebt = outstandingDebt + (typeof overdraftDebt !== 'undefined' ? overdraftDebt : 0);

    const activeLifePolicies = nativeDb.prepare("SELECT * FROM reminders WHERE LOWER(category)='insurance' AND (LOWER(policyType) LIKE '%life%' OR LOWER(policyType) LIKE '%ulip%' OR LOWER(policyType) LIKE '%endowment%' OR LOWER(policyType) = 'term' OR LOWER(policyType) LIKE '%term insurance%')").all();
    const activePolicies = activeLifePolicies.filter(p => !isMaturedLocal(p));

    const unassignedPolicies = [];
    const memberPolicyTotals = {};
    const earners = nativeDb.prepare("SELECT id, lifeInsuranceCoverage FROM family_members WHERE TRIM(UPPER(role)) IN ('PROVIDER', 'PARTNER')").all();
    const earnerIds = new Set(earners.map(e => String(e.id)));

    for (const p of activePolicies) {
        const id = String(p.owner_member_id);
        const amt = Math.abs(parseFloat(String(p.principalAmount).replace(/,/g, '')) || 0);
        if (id !== 'null' && id !== 'undefined' && id !== '') {
            if (earnerIds.has(id)) { memberPolicyTotals[id] = (memberPolicyTotals[id] || 0) + amt; }
        } else {
            unassignedPolicies.push(amt);
        }
    }

    let totalCoverageGap = 0;
    let aggregateHlv = 0;
    let aggregateExistingCoverage = 0;
    let aggregateIncomeReplacement = 0;
    let aggregateOutstandingDebt = 0;
    let aggregateChildEducation = 0;
    let aggregateEmergencyFund = 0;
    let aggregateSurvivingPremiums = 0;

    let unassignedPool = Math.max(0, unassignedPolicies.reduce((a, b) => a + b, 0));
    const totalHouseholdPV = earners.reduce((sum, f) => sum + (earnerIncomeReplacement[String(f.id)] || 0), 0);
    const sharedCapitalLiabilities = (rawOutstandingDebt * 1.02) + childEducation;

    const earnerStates = earners.map(f => {
        const id = String(f.id);
        const pv = earnerIncomeReplacement[id] || 0;
        const incomeProportion = totalHouseholdPV > 0 ? (pv / totalHouseholdPV) : (1 / adultHeads);
        const proportionalCapitalLiabilities = sharedCapitalLiabilities * incomeProportion;
        const proportionalStateAssets = singleStateLiquidAssets * incomeProportion;
        let survivingPremiums = 0;
        for (const [eid, val] of Object.entries(earnerSurvivingPremiums)) {
            if (String(eid) !== id) survivingPremiums += val;
        }
        const target = pv + proportionalCapitalLiabilities + baseEmergencyFund + survivingPremiums;
        let survivingEndowments = 0;
        for (const [eid, val] of Object.entries(earnerEndowmentsMap)) {
            if (String(eid) !== id) survivingEndowments += val;
        }
        const rebate = earnerRebates[id] || 0;
        const stateAssets = proportionalStateAssets + (survivingEndowments * volatileLiquidityHaircut) + rebate;
        let specificCoverage = 0;
        if (memberPolicyTotals[id] !== undefined) {
            specificCoverage = memberPolicyTotals[id];
        } else {
            specificCoverage = Math.abs(parseFloat(String(f.lifeInsuranceCoverage).replace(/,/g, '')) || 0);
        }
        const rawGap = Math.max(0, target - (stateAssets + specificCoverage));
        return { id, pv, incomeProportion, survivingPremiums, target, stateAssets, specificCoverage, rawGap };
    });

    earnerStates.sort((a, b) => b.rawGap - a.rawGap);
    for (const state of earnerStates) {
        let gap = state.rawGap;
        if (gap > 0 && unassignedPool > 0) {
            const applied = Math.min(gap, unassignedPool);
            unassignedPool -= applied;
            gap -= applied;
            state.specificCoverage += applied;
        }
        totalCoverageGap += gap;
        aggregateHlv += state.target;
        aggregateExistingCoverage += state.specificCoverage + state.stateAssets;
        aggregateIncomeReplacement += state.pv;
        aggregateOutstandingDebt += (rawOutstandingDebt * 1.02) * state.incomeProportion;
        aggregateChildEducation += childEducation * state.incomeProportion;
        aggregateEmergencyFund += baseEmergencyFund;
        aggregateSurvivingPremiums += state.survivingPremiums;
    }

    aggregateExistingCoverage += unassignedPool;
    const hlv = aggregateHlv;
    const coverageGap = totalCoverageGap;
    const existingCoverage = aggregateExistingCoverage;
    const coverageRatio = hlv > 0 ? Math.round((existingCoverage / hlv) * 100) : 100;

    let recommendation = '';
    if (coverageGap > 10000) {
        recommendation = `You have a coverage shortfall of ₹${(coverageGap / 100000).toFixed(1)}L. Consider acquiring additional term life insurance to protect your dependents.`;
    } else if (coverageGap > 0) {
        recommendation = `You have a minor coverage shortfall of ₹${Math.round(coverageGap)}. Consider acquiring additional term life insurance.`;
    } else {
        const covStr = existingCoverage >= 10000 ? `₹${(existingCoverage / 100000).toFixed(1)}L` : `₹${Math.round(existingCoverage)}`;
        recommendation = `Excellent. Your existing coverage of ${covStr} fully satisfies the actuarial requirement.`;
    }

    return {
        hlv: Math.round(hlv),
        coverageGap: Math.round(coverageGap),
        existingCoverage: Math.round(existingCoverage),
        coverageRatio,
        recommendation,
        dependentCount,
        components: {
            incomeReplacement: Math.round(aggregateIncomeReplacement),
            outstandingDebt: Math.round(aggregateOutstandingDebt),
            childEducation: Math.round(aggregateChildEducation),
            emergencyFund: Math.round(aggregateEmergencyFund),
            survivingPremiums: Math.round(aggregateSurvivingPremiums),
            liquidAssets: Math.round(singleStateLiquidAssets)
        }
    };
};

// ─── Stress Test ──────────────────────────────────────────────────
exports.runStressTest = (body) => {
    const { scenario, duration, severity } = body;
    const monthsToSimulate = duration || 6;
    const severityPct = (severity || 100) / 100;

    let liquidReserves = 0;
    try { liquidReserves = getFreeCash(); } catch (e) {}

    let liquidInvTotal = 0;
    let volatileLiquidInvTotal = 0;
    let maxIndividualRent = 0;
    try {
        const investments = nativeDb.prepare("SELECT currentAmount, latestNav, totalUnits, schemeCode, category FROM investments").all();
        investments.forEach(inv => {
            const val = (inv.schemeCode && inv.latestNav && inv.totalUnits) ? (inv.latestNav * inv.totalUnits) : (parseFloat(inv.currentAmount) || 0);
            let cat = (inv.category || '').toLowerCase();
            let isLocked = cat.includes('ppf') || cat.includes('epf') || cat.includes('nps') || cat.includes('ssy') || cat.includes('sukanya') || cat.includes('nsc') || cat.includes('post office');
            if (!isLocked) {
                liquidInvTotal += val;
                let isSafe = cat.includes('debt') || cat.includes('liquid') || cat.includes('arbitrage') || cat.includes('bond') || cat.includes('sgb') || cat.includes('gold');
                if (!isSafe) volatileLiquidInvTotal += val;
            }
        });
        const fds = nativeDb.prepare("SELECT principal, maturityAmount FROM fixed_deposits").all();
        let fdTotal = fds.reduce((sum, fd) => sum + (parseFloat(fd.principal) || 0), 0);
        const ccs = nativeDb.prepare("SELECT currentBalance FROM credit_cards").all();
        let ccDebt = ccs.reduce((sum, c) => sum + (parseFloat(String(c.currentBalance).replace(/,/g, '')) || 0), 0);
        liquidReserves += liquidInvTotal + fdTotal - ccDebt;
    } catch (e) {}

    const originalLiquid = liquidReserves;

    const members = nativeDb.prepare("SELECT annualIncome FROM family_members").all();
    let maxIndividualNetMonthly = 0;
    let monthlyIncome = members.reduce((sum, m) => {
        let inc = parseFloat(String(m.annualIncome).replace(/,/g, '')) || 0;
        if (inc === 0) return sum;
        const taxableIncome = Math.max(0, inc - 75000);
        let tax = 0;
        if (taxableIncome > 700000) {
            let rem = taxableIncome; let baseTax = 0;
            if (rem > 1500000) { baseTax += (rem - 1500000) * 0.30; rem = 1500000; }
            if (rem > 1200000) { baseTax += (rem - 1200000) * 0.20; rem = 1200000; }
            if (rem > 900000) { baseTax += (rem - 900000) * 0.15; rem = 900000; }
            if (rem > 600000) { baseTax += (rem - 600000) * 0.10; rem = 600000; }
            if (rem > 300000) { baseTax += (rem - 300000) * 0.05; }
            const excessOver7L = taxableIncome - 700000;
            if (baseTax > excessOver7L && taxableIncome <= 750000) baseTax = excessOver7L;
            tax = baseTax;
        }
        tax += tax * 0.04;
        const netIncome = inc - tax;
        const netMonthly = netIncome / 12;
        if (netMonthly > maxIndividualNetMonthly) maxIndividualNetMonthly = netMonthly;
        return sum + netMonthly;
    }, 0);

    const budgets = nativeDb.prepare("SELECT monthlyLimit FROM budgets").all();
    let monthlyExpenses = budgets.reduce((sum, b) => sum + (parseFloat(String(b.monthlyLimit).replace(/,/g, '')) || 0), 0);
    try {
        const reminders = nativeDb.prepare("SELECT amount, frequency FROM reminders WHERE category IN ('insurance', 'subscription', 'other')").all();
        let additionalBurn = reminders.reduce((sum, r) => {
            let amt = parseFloat(String(r.amount).replace(/,/g, '')) || 0;
            let freq = (r.frequency || '').toLowerCase();
            let annual = 0;
            if (freq === 'yearly' || freq === 'annual' || freq === 'annually') annual = amt;
            else if (freq === 'half-yearly' || freq === 'semi-annually' || freq === 'bi-annually') annual = amt * 2;
            else if (freq === 'quarterly') annual = amt * 4;
            else if (freq === 'monthly') annual = amt * 12;
            else if (freq === 'bi-weekly') annual = amt * 26;
            else if (freq === 'weekly') annual = amt * 52;
            else if (freq === 'daily') annual = amt * 365;
            else if (freq === 'once') annual = amt;
            else annual = amt * 12;
            return sum + (annual / 12);
        }, 0);
        monthlyExpenses += additionalBurn;
    } catch (e) {}

    let monthlyEmi = 0;
    try {
        const loans = nativeDb.prepare("SELECT amount FROM reminders WHERE category = 'loan'").all();
        monthlyEmi = loans.reduce((sum, l) => sum + (parseFloat(String(l.amount).replace(/,/g, '')) || 0), 0);
    } catch (e) {}

    let scenarioDesc = '';
    let currentMonthlyIncome = monthlyIncome;
    let currentMonthlyExpenses = monthlyExpenses + monthlyEmi;

    if (scenario === 'job_loss') {
        const incomeLoss = maxIndividualNetMonthly * severityPct;
        currentMonthlyIncome -= incomeLoss;
        scenarioDesc = `Job loss scenario: Primary breadwinner's income reduced by ${Math.round(severityPct * 100)}%.`;
    } else if (scenario === 'medical_emergency') {
        const emergencyCost = 500000 * severityPct;
        let totalHealthCover = 0;
        try {
            const activeHealthPolicies = nativeDb.prepare("SELECT * FROM reminders WHERE LOWER(category)='insurance' AND LOWER(policyType) LIKE '%health%'").all();
            totalHealthCover = activeHealthPolicies.reduce((sum, p) => sum + (parseFloat(String(p.principalAmount).replace(/,/g, '')) || 0), 0);
        } catch (e) {}
        const outOfPocket = Math.max(0, emergencyCost - totalHealthCover);
        const insuranceCovered = emergencyCost - outOfPocket;
        liquidReserves -= outOfPocket;
        if (insuranceCovered > 0) {
            scenarioDesc = `Medical emergency of ₹${emergencyCost.toLocaleString('en-IN')}. Insurance covered ₹${insuranceCovered.toLocaleString('en-IN')}. Out of pocket drain: ₹${outOfPocket.toLocaleString('en-IN')}.`;
        } else {
            scenarioDesc = `Medical emergency: Instant upfront drain of ₹${emergencyCost.toLocaleString('en-IN')} from liquid assets.`;
        }
    } else if (scenario === 'rate_hike') {
        const emiIncrease = monthlyEmi * (0.20 * severityPct);
        currentMonthlyExpenses += emiIncrease;
        scenarioDesc = `Rate hike: Monthly EMIs increased by ₹${emiIncrease.toLocaleString('en-IN')}.`;
    } else if (scenario === 'tenant_default') {
        const rentLoss = maxIndividualRent * severityPct;
        currentMonthlyIncome -= rentLoss;
        scenarioDesc = `Tenant default: Primary rental income reduced by ${Math.round(severityPct * 100)}%.`;
    } else if (scenario === 'market_crash') {
        const drop = 0.30 * severityPct;
        const marketLoss = volatileLiquidInvTotal * drop;
        liquidReserves -= marketLoss;
        scenarioDesc = `Market Crash: Volatile equity down ${Math.round(drop * 100)}%. Portfolio wiped by ₹${marketLoss.toLocaleString('en-IN')}.`;
    }

    const monthlyImpact = currentMonthlyIncome - currentMonthlyExpenses;
    let survived = true;
    let survivalMonths = monthsToSimulate;
    let firstCrisisDate = null;
    let timeline = [];
    let requiredBuffer = 0;
    let currentBalance = liquidReserves;

    timeline.push({ month: 0, balance: currentBalance, shockLabel: 'Shock Start' });
    if (currentBalance < 0) { survived = false; survivalMonths = 0; firstCrisisDate = `Day 1`; }

    for (let m = 1; m <= monthsToSimulate; m++) {
        currentBalance += monthlyImpact;
        timeline.push({ month: m, balance: currentBalance, shockLabel: null });
        if (currentBalance < 0 && survived) { survived = false; survivalMonths = m - 1; firstCrisisDate = `Month ${m}`; }
    }

    if (!survived) {
        let minBalance = Math.min(...timeline.map(t => t.balance));
        requiredBuffer = Math.abs(minBalance);
    }

    return {
        survived, survivalMonths, firstCrisisDate, requiredBuffer,
        totalLiquidReserves: originalLiquid,
        scenarioDetails: { description: scenarioDesc, monthlyImpact },
        timeline
    };
};

// ─── Inflation ────────────────────────────────────────────────────
exports.getInflation = (query) => {
    const cpi = parseFloat(query.cpi) || 6;
    const r2 = (num) => Math.round(num * 100) / 100;
    const inflationFactor = 1 + (cpi / 100);

    let totalCashNominal = 0;
    let cashItems = [];
    try {
        const cashRows = nativeDb.prepare("SELECT b.bankName as name, COALESCE(SUM(COALESCE(l.debit_amount, 0) - COALESCE(l.credit_amount, 0)), 0) as bal FROM ledger_lines l LEFT JOIN bank_balances b ON l.entity_id = b.id WHERE l.account_class='Asset' AND l.account_type IN ('bank', 'cash', 'checking', 'savings') GROUP BY b.bankName").all();
        cashRows.forEach(r => {
            if (r.bal > 0) {
                totalCashNominal += r.bal;
                cashItems.push({ name: r.name || 'Other Cash', nominal: r.bal, erosion: r2(r.bal - (r.bal / inflationFactor)) });
            }
        });
    } catch(e) {}

    let totalInvestmentsNominal = 0;
    let invItems = [];
    try {
        const invRows = nativeDb.prepare("SELECT title, currentAmount as bal FROM investments WHERE isClosed=0").all();
        invRows.forEach(r => {
            if (r.bal > 0) {
                totalInvestmentsNominal += r.bal;
                invItems.push({ name: r.title, nominal: r.bal, erosion: 0 });
            }
        });

        const npsRows = nativeDb.prepare("SELECT memberName, tier, currentValue as bal FROM nps_accounts WHERE isClosed=0").all();
        npsRows.forEach(r => {
            if (r.bal > 0) {
                totalInvestmentsNominal += r.bal;
                invItems.push({ name: `NPS ${r.memberName || ''} ${r.tier || ''}`.trim(), nominal: r.bal, erosion: 0 });
            }
        });
    } catch(e) {}

    let totalFdNominal = 0;
    let fdItems = [];
    try {
        const fdRows = nativeDb.prepare("SELECT bankName, principal as bal FROM fixed_deposits WHERE isClosed=0").all();
        fdRows.forEach(r => {
            if (r.bal > 0) {
                totalFdNominal += r.bal;
                fdItems.push({ name: `${r.bankName || 'FD'} Deposit`, nominal: r.bal, erosion: 0 });
            }
        });
    } catch(e) {}

    const nominalWealth = totalCashNominal + totalFdNominal + totalInvestmentsNominal;
    
    // Real value = Nominal / (1 + r)
    const cashReal = totalCashNominal / inflationFactor;
    const cashErosion = totalCashNominal - cashReal;

    const fdReal = totalFdNominal;
    const fdErosion = 0;

    const investReal = totalInvestmentsNominal;
    const investErosion = 0;

    const realWealth = cashReal + fdReal + investReal;
    const erosionThisYear = cashErosion + fdErosion + investErosion;

    const assetBreakdown = [];
    
    if (totalCashNominal > 0) {
        assetBreakdown.push({
            title: 'Cash & Bank Accounts',
            beatsInflation: false,
            nominal: r2(totalCashNominal),
            realValue: r2(cashReal),
            erosion: r2(cashErosion),
            percentageLost: cpi,
            verdict: 'Guaranteed purchasing power loss.',
            items: cashItems
        });
    }

    if (totalFdNominal > 0) {
        assetBreakdown.push({
            title: 'Fixed Deposits',
            beatsInflation: true,
            nominal: r2(totalFdNominal),
            realValue: r2(fdReal),
            erosion: 0,
            percentageLost: 0,
            verdict: 'Typically matches or slightly beats inflation.',
            items: fdItems
        });
    }

    if (totalInvestmentsNominal > 0) {
        assetBreakdown.push({
            title: 'Investments & Growth Assets',
            beatsInflation: true,
            nominal: r2(totalInvestmentsNominal),
            realValue: r2(investReal),
            erosion: 0,
            percentageLost: 0,
            verdict: 'Expected to beat inflation over long term.',
            items: invItems
        });
    }

    if (assetBreakdown.length === 0) {
        assetBreakdown.push({
            title: 'No Assets Found',
            beatsInflation: false,
            nominal: 0,
            realValue: 0,
            erosion: 0,
            percentageLost: 0,
            verdict: 'No data to analyze.',
            items: []
        });
    }

    return {
        erosionThisYear: r2(erosionThisYear),
        erosionPerMonth: r2(erosionThisYear / 12),
        erosionPerDay: r2(erosionThisYear / 365.25),
        nominalWealth: r2(nominalWealth),
        realWealth: r2(realWealth),
        totalErosion: r2(erosionThisYear),
        assetBreakdown
    };
};

// ─── Lifestyle Creep ──────────────────────────────────────────────
exports.getLifestyleCreep = () => {
    const expensesRaw = nativeDb.prepare(`
        SELECT 
            strftime('%Y-%m', t.date) as month,
            TRIM(LOWER(COALESCE(t.category, 'uncategorized'))) as category,
            SUM(COALESCE(l.debit_amount, 0) - COALESCE(l.credit_amount, 0)) as total
        FROM ledger_lines l
        JOIN transactions t ON l.transaction_id = t.id
        WHERE l.account_class='Expense' 
          AND t.date >= date('now', 'start of month', '-5 months')
        GROUP BY month, category
        ORDER BY category, month
    `).all();

    const catMap = {};
    expensesRaw.forEach(row => {
        if (row.total <= 0) return; 
        if (!catMap[row.category]) catMap[row.category] = { category: row.category, monthlyDataMap: {} };
        catMap[row.category].monthlyDataMap[row.month] = row.total;
    });

    const monthsArray = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        monthsArray.push(`${yyyy}-${mm}`);
    }

    const rawData = Object.values(catMap).map(cat => {
        const monthlyData = monthsArray.map(m => ({
            month: m,
            total: cat.monthlyDataMap[m] || 0
        }));
        
        const nonZeroMonths = monthlyData.filter(m => m.total > 0).length;
        if (nonZeroMonths < 2) return null;

        const first = monthlyData[0].total;
        const last = monthlyData[monthlyData.length - 1].total;
        const months = monthlyData.length - 1; 
        
        let slope = 0;
        let changePct = 0;
        let alert = 'stable';

        if (first > 0) {
            slope = Math.round((last - first) / months);
            changePct = Math.round(((last - first) / first) * 100);
            
            if (changePct >= 20) alert = 'critical';
            else if (changePct > 5) alert = 'creeping';
            else alert = 'stable';
        }
        
        const annualProjectedIncrease = slope * 12;

        return {
            category: cat.category,
            alert,
            monthlyData,
            slope,
            changePct,
            annualProjectedIncrease
        };
    }).filter(c => c !== null);

    rawData.sort((a, b) => b.changePct - a.changePct);

    return { data: rawData };
};

