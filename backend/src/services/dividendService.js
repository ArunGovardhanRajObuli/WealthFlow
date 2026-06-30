const { nativeDb } = require('../../database');

exports.getDividendTracker = () => {
    const investments = nativeDb.prepare("SELECT * FROM investments WHERE category != 'epf' AND category != 'ppf'").all();
    const history = nativeDb.prepare("SELECT * FROM transactions WHERE category = 'dividend' ORDER BY date DESC LIMIT 10").all();

    let totalValue = 0;
    let totalAnnualReturn = 0;
    let validInvestments = [];

    for (const inv of investments) {
        const yieldPct = parseFloat(inv.dividendYield) || 0;
        if (yieldPct > 0) {
            const amount = parseFloat(inv.currentAmount) || 0;
            const annual = amount * (yieldPct / 100);
            inv.annualReturn = annual;
            
            totalValue += amount;
            totalAnnualReturn += annual;
            validInvestments.push(inv);
        }
    }

    const totalMonthlyReturn = totalAnnualReturn / 12;
    const weightedYield = totalValue > 0 ? ((totalAnnualReturn / totalValue) * 100).toFixed(2) : 0;

    return {
        investments: validInvestments,
        totalAnnualReturn,
        totalMonthlyReturn,
        weightedYield,
        weightedROI: weightedYield, // fallback for UI compatibility if needed
        history
    };
};
