const { nativeDb } = require('../../database');

exports.getMfOverlap = () => {
    const funds = nativeDb.prepare("SELECT * FROM investments WHERE category IN ('sip', 'mutual_fund', 'mf')").all();
    
    // Group funds by assetClass
    let classes = {};
    let totalMFValue = 0;
    
    for (const f of funds) {
        const cls = (f.assetClass || 'unclassified').toLowerCase();
        if (!classes[cls]) classes[cls] = [];
        classes[cls].push({
            name: f.title,
            value: f.currentAmount || 0,
            roi: f.roi || 0
        });
        totalMFValue += (f.currentAmount || 0);
    }

    let overlaps = [];
    let overlapCount = 0;
    let severity = 'clean';
    let recommendation = 'Your mutual fund portfolio is well diversified.';

    for (const [cls, classFunds] of Object.entries(classes)) {
        const fundCount = classFunds.length;
        const classValue = classFunds.reduce((sum, f) => sum + f.value, 0);
        const concentration = totalMFValue > 0 ? (classValue / totalMFValue) * 100 : 0;
        const isOverlapping = fundCount > 1;

        if (isOverlapping) overlapCount++;

        overlaps.push({
            assetClass: cls,
            fundCount,
            concentration: Math.round(concentration),
            isOverlapping,
            funds: classFunds
        });
    }

    if (overlapCount > 2) {
        severity = 'high';
        recommendation = 'High overlap detected! You have multiple funds in the same asset class. Consider consolidating.';
    } else if (overlapCount > 0) {
        severity = 'moderate';
        recommendation = 'Moderate overlap detected. Review funds in overlapping classes to ensure they hold different underlying stocks.';
    }

    return {
        totalFunds: funds.length,
        totalMFValue,
        severity,
        recommendation,
        overlapCount,
        overlaps
    };
};
