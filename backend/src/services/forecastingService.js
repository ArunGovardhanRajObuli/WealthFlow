const { nativeDb } = require('../../database');
const { computeFdAccruedInterest, calculateTotalIncomeTax, getMonthlyEquivalent } = require('../utils/financialUtils');
const { isMatured, getTrueAmortizedDebt, getFreeCash, getLocalYYYYMMDD } = require('../utils/analyticsUtils');

function fetchActiveObligations() {
    const allLoanBalances = nativeDb.prepare("SELECT entity_id, SUM(COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0)) as principal_bal FROM ledger_lines WHERE account_class='Liability' AND account_type='loan' GROUP BY entity_id").all();
    const loanBalMap = {};
    for (const r of allLoanBalances) loanBalMap[r.entity_id] = r.principal_bal;
    
    const loansRaw = nativeDb.prepare("SELECT * FROM reminders WHERE LOWER(category)='loan'").all();
    const loans = loansRaw.filter(l => {
        if (isMatured(l.dueDate, l.termYears, l.frequency)) return false;
        const balRaw = loanBalMap[l.id];
        const balance = balRaw !== undefined ? Math.max(0, Number(balRaw)) : 0;
        if (balance <= 0) return false;
        l.simulatedBalance = balance;
        return true;
    });
    const insuranceRaw = nativeDb.prepare("SELECT * FROM reminders WHERE LOWER(category)='insurance'").all();
    const insurance = insuranceRaw.filter(i => !isMatured(i.dueDate, i.termYears, i.frequency));
    const subsRaw = nativeDb.prepare("SELECT * FROM reminders WHERE LOWER(category)='subscription'").all();
    const subs = subsRaw.filter(s => !isMatured(s.dueDate, s.termYears, s.frequency));
    return { loans, insurance, subs };
}

exports.getForecast = (daysQuery) => {
    let days = parseInt(daysQuery) || 90;
    days = Math.max(1, Math.min(days, 1825)); // Prevents DoS and OOM attacks

    const { loans, insurance, subs } = fetchActiveObligations();
    const annualIncome = nativeDb.prepare("SELECT COALESCE(SUM(annualIncome),0) as val FROM family_members WHERE role IN ('Provider','Partner')").get().val || 0;
    const rents = nativeDb.prepare("SELECT title, expectedRent FROM real_estate WHERE expectedRent > 0 AND occupancyStatus='rented'").all();
    
    const freeCashRaw = getFreeCash();
    const totalSinking = nativeDb.prepare("SELECT COALESCE(SUM(currentAmount),0) as val FROM sinking_funds").get().val || 0;
    const totalEndowments = nativeDb.prepare("SELECT COALESCE(SUM(collegeSavings),0) as val FROM family_members").get().val || 0;
    
    const avgDailyExpenseQuery = "SELECT SUM(COALESCE(debit_amount, 0) - COALESCE(credit_amount, 0)) as val FROM ledger_lines l JOIN transactions t ON l.transaction_id = t.id WHERE l.account_class='Expense' AND l.account_type='operating' AND TRIM(LOWER(COALESCE(t.category, 'uncategorized'))) NOT IN ('loan', 'insurance', 'subscription', 'loan_interest_accrual', 'credit_card', 'credit card', 'creditcard', 'emi', 'tax', 'taxes', 'income_tax', 'tds', 'advance_tax', 'property_tax', 'capital_gains_tax') AND t.date >= date('now', '-90 days')";
    const sumBurn = nativeDb.prepare(avgDailyExpenseQuery).get().val || 0;
    const sumBurnSafe = Math.max(0, sumBurn);
    const dateRangeQuery = nativeDb.prepare("SELECT CAST(julianday('now') - julianday(MIN(t.date)) AS INTEGER) as days FROM ledger_lines l JOIN transactions t ON l.transaction_id = t.id WHERE l.account_class='Expense' AND l.account_type='operating' AND TRIM(LOWER(COALESCE(t.category, 'uncategorized'))) NOT IN ('loan', 'insurance', 'subscription', 'loan_interest_accrual', 'credit_card', 'credit card', 'creditcard', 'emi', 'tax', 'taxes', 'income_tax', 'tds', 'advance_tax', 'property_tax', 'capital_gains_tax') AND t.date >= date('now', '-90 days')").get().days;
    const trackedDaysDivisor = Math.max(30, Math.min(90, dateRangeQuery || 30));
    const dailyBurn = sumBurnSafe / trackedDaysDivisor;

    const today = new Date();
    const timeline = [];
    const events = [];
    const ccDebt = nativeDb.prepare("SELECT COALESCE(SUM(COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0)),0) as val FROM ledger_lines WHERE account_class='Liability' AND account_type='credit_card'").get().val || 0;
    const trueStartingCash = freeCashRaw - totalSinking - totalEndowments - ccDebt;
    let runningBalance = trueStartingCash;
    let estimatedTax = 0;
    let taxableIncome = Math.max(0, annualIncome - 50000);
    estimatedTax = calculateTotalIncomeTax(taxableIncome);
    const monthlyIncome = Math.max(0, annualIncome - estimatedTax) / 12;
    const monthlyRent = rents.reduce((a, r) => a + (Number(String(r.expectedRent).replace(/,/g, '')) || 0), 0);

    for (let d = 0; d < days; d++) {
        const date = new Date(today);
        date.setDate(date.getDate() + d);
        const dayOfMonth = date.getDate();
        const monthIndex = date.getMonth();

        if (d > 0) runningBalance -= dailyBurn;

        if (dayOfMonth === 1 && d > 0) {
            runningBalance += monthlyIncome;
            if (monthlyIncome > 0) events.push({ day: d, date: getLocalYYYYMMDD(date), type: 'income', title: 'Monthly Salary', amount: monthlyIncome });
            if (monthlyRent > 0) {
                runningBalance += monthlyRent;
                events.push({ day: d, date: getLocalYYYYMMDD(date), type: 'income', title: 'Property Rent', amount: monthlyRent });
            }
        }

        const checkActive = (item, currentSimDate) => {
            if (!item.dueDate || !item.termYears || parseFloat(String(item.termYears).replace(/,/g, '')) <= 0) return true;
            const endDate = new Date(item.dueDate + 'T00:00:00');
            endDate.setMonth(endDate.getMonth() + Math.round(parseFloat(String(item.termYears).replace(/,/g, '')) * 12));
            const sim = new Date(currentSimDate);
            sim.setHours(0,0,0,0);
            return sim <= endDate;
        };

        loans.forEach(l => {
            if (l.simulatedBalance <= 0) return;
            if (!checkActive(l, date)) return;
            const parsedDay = parseInt(l.dueDate.split('-')[2], 10);
            const parsedMonth = parseInt(l.dueDate.split('-')[1], 10) - 1;
            const targetDay = Math.min(parsedDay, new Date(date.getFullYear(), monthIndex + 1, 0).getDate());
            
            let emiTriggered = false;
            const freq = String(l.frequency || '').trim().toLowerCase();
            if (freq === 'yearly' && dayOfMonth === targetDay && monthIndex === parsedMonth && d > 0) emiTriggered = true;
            else if (freq === 'monthly' && dayOfMonth === targetDay && d > 0) emiTriggered = true;
            else if (freq === 'quarterly' && (dayOfMonth === targetDay) && (date.getMonth() % 3 === parsedMonth % 3) && d > 0) emiTriggered = true;
            else if (freq === 'once' && getLocalYYYYMMDD(date) === l.dueDate && d > 0) emiTriggered = true;

            if (emiTriggered) {
                const rawEmi = Math.abs(Number(String(l.amount).replace(/,/g, ''))) || 0;
                let interestPayment = 0;
                let principalPayment = rawEmi;
                
                if (l.interestRate) {
                    const rate = parseFloat(l.interestRate) || 0;
                    if (freq === 'monthly') interestPayment = l.simulatedBalance * (rate / 100 / 12);
                    else if (freq === 'yearly') interestPayment = l.simulatedBalance * (rate / 100);
                    else if (freq === 'quarterly') interestPayment = l.simulatedBalance * (rate / 100 / 4);
                    principalPayment = Math.max(0, rawEmi - interestPayment);
                }
                
                const effectiveEmi = l.simulatedBalance < principalPayment ? l.simulatedBalance + interestPayment : rawEmi;
                const effectivePrincipal = l.simulatedBalance < principalPayment ? l.simulatedBalance : principalPayment;
                
                runningBalance -= effectiveEmi;
                l.simulatedBalance -= effectivePrincipal;
                events.push({ day: d, date: getLocalYYYYMMDD(date), type: 'expense', title: `EMI: ${l.title}`, amount: effectiveEmi });
            }
        });

        subs.forEach(s => {
            if (!checkActive(s, date)) return;
            const parsedDay = parseInt(s.dueDate.split('-')[2], 10);
            const parsedMonth = parseInt(s.dueDate.split('-')[1], 10) - 1;
            const targetDay = Math.min(parsedDay, new Date(date.getFullYear(), monthIndex + 1, 0).getDate());
            if (String(s.frequency || '').trim().toLowerCase() === 'yearly' && dayOfMonth === targetDay && monthIndex === parsedMonth && d > 0) {
                const amt = Math.abs(Number(String(s.amount).replace(/,/g, '')) || 0);
                runningBalance -= amt;
                events.push({ day: d, date: getLocalYYYYMMDD(date), type: 'expense', title: `Sub: ${s.title}`, amount: amt });
            } else if (String(s.frequency || '').trim().toLowerCase() === 'monthly' && dayOfMonth === targetDay && d > 0) {
                const amt = Math.abs(Number(String(s.amount).replace(/,/g, '')) || 0);
                runningBalance -= amt;
                events.push({ day: d, date: getLocalYYYYMMDD(date), type: 'expense', title: `Sub: ${s.title}`, amount: amt });
            } else if (String(s.frequency || '').trim().toLowerCase() === 'quarterly' && (dayOfMonth === targetDay) && (date.getMonth() % 3 === parsedMonth % 3) && d > 0) {
                const amt = Math.abs(Number(String(s.amount).replace(/,/g, '')) || 0);
                runningBalance -= amt;
                events.push({ day: d, date: getLocalYYYYMMDD(date), type: 'expense', title: `Sub: ${s.title}`, amount: amt });
            } else if (String(s.frequency || '').trim().toLowerCase() === 'once' && getLocalYYYYMMDD(date) === s.dueDate && d > 0) {
                const amt = Math.abs(Number(String(s.amount).replace(/,/g, '')) || 0);
                runningBalance -= amt;
                events.push({ day: d, date: getLocalYYYYMMDD(date), type: 'expense', title: `Sub: ${s.title}`, amount: amt });
            }
        });

        insurance.forEach(ins => {
            if (!checkActive(ins, date)) return;
            const lastDayOfMonth = new Date(date.getFullYear(), monthIndex + 1, 0).getDate();
            const parsedDay = parseInt(ins.dueDate.split('-')[2], 10);
            const parsedMonth = parseInt(ins.dueDate.split('-')[1], 10) - 1;
            const targetDay = Math.min(parsedDay, lastDayOfMonth);
            if (String(ins.frequency || '').trim().toLowerCase() === 'yearly' && date.getMonth() === parsedMonth && dayOfMonth === targetDay && d > 0) {
                const amt = Math.abs(Number(String(ins.amount).replace(/,/g, '')) || 0);
                runningBalance -= amt;
                events.push({ day: d, date: getLocalYYYYMMDD(date), type: 'expense', title: `Insurance: ${ins.title}`, amount: amt });
            } else if (String(ins.frequency || '').trim().toLowerCase() === 'monthly' && dayOfMonth === targetDay && d > 0) {
                const amt = Math.abs(Number(String(ins.amount).replace(/,/g, '')) || 0);
                runningBalance -= amt;
                events.push({ day: d, date: getLocalYYYYMMDD(date), type: 'expense', title: `Insurance: ${ins.title}`, amount: amt });
            } else if (String(ins.frequency || '').trim().toLowerCase() === 'quarterly' && (dayOfMonth === targetDay) && (date.getMonth() % 3 === parsedMonth % 3) && d > 0) {
                const amt = Math.abs(Number(String(ins.amount).replace(/,/g, '')) || 0);
                runningBalance -= amt;
                events.push({ day: d, date: getLocalYYYYMMDD(date), type: 'expense', title: `Insurance: ${ins.title}`, amount: amt });
            } else if (String(ins.frequency || '').trim().toLowerCase() === 'once' && getLocalYYYYMMDD(date) === ins.dueDate && d > 0) {
                const amt = Math.abs(Number(String(ins.amount).replace(/,/g, '')) || 0);
                runningBalance -= amt;
                events.push({ day: d, date: getLocalYYYYMMDD(date), type: 'expense', title: `Insurance: ${ins.title}`, amount: amt });
            }
        });

        timeline.push({ date: getLocalYYYYMMDD(date), balance: Math.round(runningBalance) });
    }

    const minBalance = Math.min(...timeline.map(t => t.balance));
    const crisisDate = timeline.find(t => t.balance < 0);

    return {
        timeline,
        events: events.sort((a, b) => a.day - b.day),
        startingCash: Math.round(trueStartingCash),
        minProjectedBalance: minBalance,
        crisisDate: crisisDate ? crisisDate.date : null
    };
};


