const { nativeDb } = require('../../database');
const { getFreeCash } = require('../utils/analyticsUtils');

exports.getDebtStrategy = () => {
    const getBal = nativeDb.prepare("SELECT SUM(COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0)) as principal_bal FROM ledger_lines WHERE account_class='Liability' AND account_type='loan' AND entity_id=?");
    const loansRaw = nativeDb.prepare("SELECT id, amount as emi, interestRate FROM reminders WHERE LOWER(category)='loan' AND frequency='monthly'").all();
    
    let loans = loansRaw.map(l => {
        const balRow = getBal.get(l.id);
        return {
            id: l.id,
            emi: Math.max(0, Number(String(l.emi).replace(/,/g, '')) || 0),
            rate: Math.max(0, Number(String(l.interestRate).replace(/,/g, '')) || 0),
            balance: balRow ? Math.max(0, Number(balRow.principal_bal)) : 0
        };
    }).filter(l => l.balance > 0);

    const trueOutstandingTotal = loans.reduce((acc, l) => acc + l.balance, 0);
    
    const freeCash = getFreeCash();
    
    const avgDailyExpenseQuery = "SELECT SUM(COALESCE(debit_amount, 0) - COALESCE(credit_amount, 0)) as val FROM ledger_lines l JOIN transactions t ON l.transaction_id = t.id WHERE l.account_class='Expense' AND l.account_type='operating' AND TRIM(LOWER(COALESCE(t.category, 'uncategorized'))) NOT IN ('loan', 'insurance', 'subscription', 'loan_interest_accrual', 'credit_card', 'credit card', 'creditcard', 'emi', 'tax', 'taxes', 'income_tax', 'tds', 'advance_tax', 'property_tax', 'capital_gains_tax') AND t.date >= date('now', '-90 days')";
    const sumBurn = nativeDb.prepare(avgDailyExpenseQuery).get().val || 0;
    const daysTrackedRaw = nativeDb.prepare("SELECT CAST(julianday('now') - julianday(MIN(t.date)) AS INTEGER) as days FROM ledger_lines l JOIN transactions t ON l.transaction_id = t.id WHERE l.account_class='Expense' AND l.account_type='operating' AND TRIM(LOWER(COALESCE(t.category, 'uncategorized'))) NOT IN ('loan', 'insurance', 'subscription', 'loan_interest_accrual', 'credit_card', 'credit card', 'creditcard', 'emi', 'tax', 'taxes', 'income_tax', 'tds', 'advance_tax', 'property_tax', 'capital_gains_tax') AND t.date >= date('now', '-90 days')").get().days;
    const trackedDaysDivisor = Math.max(30, Math.min(90, daysTrackedRaw || 30));
    const sumBurnSafe = Math.max(0, sumBurn);
    const dailyBurn = sumBurnSafe / trackedDaysDivisor;
    const avgExp = dailyBurn * 30; // 30 days of expenses in Rupees
    
    const insRows = nativeDb.prepare("SELECT * FROM reminders WHERE LOWER(category)='insurance'").all();
    const subRows = nativeDb.prepare("SELECT * FROM reminders WHERE LOWER(category)='subscription'").all();
    const loansRows = nativeDb.prepare("SELECT * FROM reminders WHERE LOWER(category)='loan'").all();

    const { getMonthlyEquivalent } = require('../utils/financialUtils');

    const ins = insRows.reduce((acc, i) => acc + getMonthlyEquivalent(i.amount, i.frequency), 0);

    const ccDebtPaise = nativeDb.prepare("SELECT COALESCE(SUM(COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0)),0) as val FROM ledger_lines WHERE account_class='Liability' AND account_type='credit_card'").get().val || 0;
    const monthlyIncome = nativeDb.prepare("SELECT COALESCE(SUM(annualIncome)/12, 0) as val FROM family_members WHERE role IN ('Provider','Partner')").get().val || 0;
    const expectedRent = nativeDb.prepare("SELECT COALESCE(SUM(expectedRent),0) as val FROM real_estate WHERE occupancyStatus='rented'").get().val || 0;
    
    const monthlyObligations = loansRows.reduce((acc, l) => acc + getMonthlyEquivalent(l.amount, l.frequency), 0) + 
                               subRows.reduce((acc, s) => acc + getMonthlyEquivalent(s.amount, s.frequency), 0) +
                               ins + avgExp; // MUST include survival expenses
    
    const netCashflow = monthlyIncome + expectedRent - monthlyObligations;
    const extraMonthlyPayment = netCashflow > 0 ? Math.round(netCashflow * 0.20) : 0;

    const simulate = (strategy) => {
        let currentLoans = loans.map(l => ({ ...l }));
        let month = 0;
        let totalInterest = 0;
        let timeline = [{ month: 0, totalRemaining: trueOutstandingTotal }];
        
        const totalMonthlyDebtBudget = currentLoans.reduce((acc, l) => acc + l.emi, 0) + extraMonthlyPayment;
        
        while (currentLoans.length > 0 && month < 600) { 
            month++;
            
            if (strategy === 'avalanche') {
                currentLoans.sort((a, b) => b.rate - a.rate);
            } else {
                currentLoans.sort((a, b) => a.balance - b.balance);
            }
            
            let cashPool = totalMonthlyDebtBudget;
            
            currentLoans.forEach(l => {
                const r = (l.rate / 100) / 12;
                const interest = l.balance * r;
                totalInterest += interest;
                l.balance += interest;
                
                let payment = Math.min(l.emi, l.balance);
                l.balance -= payment;
                cashPool -= payment;
            });
            
            if (cashPool > 0) {
                for (let l of currentLoans) {
                    if (l.balance <= 0) continue;
                    if (cashPool >= l.balance) {
                        cashPool -= l.balance;
                        l.balance = 0;
                    } else {
                        l.balance -= cashPool;
                        cashPool = 0;
                        break;
                    }
                }
            }
            
            currentLoans = currentLoans.filter(l => l.balance > 0.01);
            const currentRemaining = currentLoans.reduce((acc, l) => acc + l.balance, 0);
            timeline.push({ month, totalRemaining: Math.round(currentRemaining) });
            
            if (month > 12 && timeline[month].totalRemaining >= timeline[month - 1].totalRemaining) {
                return { isDebtTrap: true, months: 'Infinity', totalInterest: Infinity, timeline };
            }
        }
        
        return { isDebtTrap: false, months: month, totalInterest: Math.round(totalInterest), timeline };
    };

    const avalanche = simulate('avalanche');
    const snowball = simulate('snowball');
    const winner = avalanche.totalInterest <= snowball.totalInterest ? 'avalanche' : 'snowball';

    return {
        winner,
        loanCount: loans.length,
        trueOutstandingTotal: Math.round(trueOutstandingTotal),
        extraMonthlyPayment,
        avalanche,
        snowball
    };
};

exports.getEmiModeler = (skipMonthsQuery) => {
    const skipMonths = Math.max(0, parseInt(skipMonthsQuery) || 0);
    
    const loansRaw = nativeDb.prepare("SELECT id, title, principalAmount, amount as emi, interestRate, termYears * 12 as termMonths FROM reminders WHERE LOWER(category)='loan' AND frequency='monthly'").all();
    const getBal = nativeDb.prepare("SELECT SUM(COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0)) as principal_bal FROM ledger_lines WHERE account_class='Liability' AND account_type='loan' AND entity_id=?");

    let totalExtraEMICost = 0;
    let totalExtraTenureCost = 0;
    const processedLoans = [];

    for (let l of loansRaw) {
        const balRow = getBal.get(l.id);
        const P = balRow && balRow.principal_bal !== null ? parseFloat(balRow.principal_bal) : parseFloat(String(l.principalAmount).replace(/,/g, ''));
        if (P <= 0.01) continue;
        
        const r = (parseFloat(String(l.interestRate).replace(/,/g, '')) || 0) / 12 / 100;
        const E = parseFloat(String(l.emi).replace(/,/g, '')) || 0;
        const term = parseInt(l.termMonths) || 0;

        if (E <= 0 || term <= 0) continue;

        const k = skipMonths;
        let P_new = P;
        if (r > 0) {
            P_new = P * Math.pow(1 + r, k);
        }
        
        const accruedInterest = P_new - P;

        let n = 0;
        if (r > 0) {
            if (E > P * r) {
                n = Math.log(E / (E - P * r)) / Math.log(1 + r);
            } else {
                n = term;
            }
        } else {
            n = P / E;
        }
        if (!isFinite(n) || n < 1) n = term || 1;

        let E_new = E;
        if (r > 0) {
            E_new = (P_new * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        } else {
            E_new = P_new / n;
        }
        
        const emiIncrease = E_new - E;
        const extraCostA = Math.max(0, (E_new - E) * n);

        let n_new = n;
        let extraCostB = 0;
        let tenureExtension = 0;
        let optionB_possible = true;

        if (r > 0) {
            if (E > P_new * r) {
                n_new = Math.log(E / (E - P_new * r)) / Math.log(1 + r);
                tenureExtension = Math.max(0, n_new - n);
                extraCostB = Math.max(0, (n_new - n) * E);
            } else {
                optionB_possible = false;
            }
        } else {
            n_new = P_new / E;
            tenureExtension = Math.max(0, n_new - n);
            extraCostB = Math.max(0, (n_new - n) * E);
        }

        if (!optionB_possible) {
            extraCostB = extraCostA * 1.5; 
            tenureExtension = 999;
        }

        totalExtraEMICost += extraCostA;
        totalExtraTenureCost += extraCostB;

        let recommendation = '';
        if (!optionB_possible) {
            recommendation = "Extended tenure is impossible (interest exceeds EMI). You must choose Higher EMI.";
        } else if (extraCostA < extraCostB) {
            recommendation = "Opt for a Higher EMI to save on total interest.";
        } else {
            recommendation = "Extending tenure is cheaper, though both add significant cost.";
        }

        processedLoans.push({
            loanId: l.id,
            loan: l.title,
            principal: Math.round(P * 100),
            currentEMI: Math.round(E * 100),
            interestRate: parseFloat(String(l.interestRate).replace(/,/g, '')) || 0,
            skipScenario: {
                accruedInterest: Math.round(accruedInterest * 100),
                newEMI: Math.round(E_new * 100),
                emiIncrease: Math.round(emiIncrease * 100),
                totalExtraCost: Math.round(extraCostA * 100)
            },
            tenureScenario: {
                emiUnchanged: Math.round(E * 100),
                tenureExtension: Math.ceil(tenureExtension),
                totalExtraCost: Math.round(extraCostB * 100)
            },
            newPrincipal: Math.round(P_new * 100),
            recommendation
        });
    }

    return {
        totalExtraEMICost: Math.round(totalExtraEMICost * 100),
        totalExtraTenureCost: Math.round(totalExtraTenureCost * 100),
        loans: processedLoans
    };
};
