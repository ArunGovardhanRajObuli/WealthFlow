const { validateAmount, validateTitle, validateDate, validateFk } = require('../utils/financialUtils');
const fixedDepositService = require('../services/fixedDepositService');

function getLocalYYYYMMDD() {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
    return formatter.format(new Date());
}

exports.getAll = (req, res, next) => {
    try {
        const rows = fixedDepositService.getAllFixedDeposits();
        
        let totalInvested = 0;
        let totalMaturity = 0;
        let totalInterest = 0;
        let sumWeightedRate = 0;
        let sumRate = 0;
        let maturedCount = 0;
        let maturingSoonCount = 0;
        let taxSaverTotal = 0;
        
        const now = new Date();
        const currentMonth = now.getFullYear() * 12 + now.getMonth();
        
        const fds = rows.map(fd => {
            const principal = parseFloat(fd.principal || 0);
            const rate = parseFloat(fd.interestRate || 0);
            const tenure = parseInt(fd.tenureMonths || 12);
            
            const periods = 4;
            const years = tenure / 12;
            const maturityAmount = principal * Math.pow(1 + (rate / 100) / periods, periods * years);
            const interestEarned = maturityAmount - principal;
            
            const start = new Date(fd.startDate);
            let maturity = fd.maturityDate ? new Date(fd.maturityDate) : new Date(start.getTime());
            if (!fd.maturityDate) maturity.setMonth(maturity.getMonth() + tenure);
            
            const totalDays = (maturity - start) / (1000 * 60 * 60 * 24);
            let elapsedDays = (now - start) / (1000 * 60 * 60 * 24);
            if (elapsedDays < 0) elapsedDays = 0;
            
            let elapsedPct = totalDays > 0 ? Math.round((elapsedDays / totalDays) * 100) : 100;
            if (elapsedPct > 100) elapsedPct = 100;
            
            const daysToMaturity = Math.ceil((maturity - now) / (1000 * 60 * 60 * 24));
            
            let status = 'active';
            if (daysToMaturity <= 0) {
                status = 'matured';
                maturedCount++;
            } else if (daysToMaturity <= 30) {
                status = 'maturing_soon';
                maturingSoonCount++;
            } else if (daysToMaturity <= 90) {
                status = 'maturing_quarter';
            }
            
            totalInvested += principal;
            totalMaturity += maturityAmount;
            totalInterest += interestEarned;
            sumWeightedRate += (principal * rate);
            sumRate += rate;
            
            if (fd.isTaxSaver) taxSaverTotal += principal;
            
            return {
                ...fd,
                computedMaturityDate: maturity.toISOString(),
                maturityDate: maturity.toISOString().split('T')[0],
                maturityAmount: maturityAmount.toFixed(2),
                interestEarned: interestEarned.toFixed(2),
                elapsedPct,
                daysToMaturity,
                status
            };
        });
        
        const weightedAvgRate = totalInvested > 0 ? (sumWeightedRate / totalInvested).toFixed(2) : 0;
        const avgRate = fds.length > 0 ? (sumRate / fds.length).toFixed(2) : 0;
        
        const liquidityGaps = [];
        for (let i = 0; i < 24; i++) {
            const m = currentMonth + i;
            const hasMaturity = fds.some(fd => {
                if (fd.status === 'matured') return false; 
                const fdM = new Date(fd.computedMaturityDate);
                return fdM.getFullYear() * 12 + fdM.getMonth() === m;
            });
            if (!hasMaturity) liquidityGaps.push(m);
        }

        res.json({
            fds,
            totalInvested: totalInvested.toFixed(2),
            totalMaturity: totalMaturity.toFixed(2),
            totalInterest: totalInterest.toFixed(2),
            weightedAvgRate,
            avgRate,
            maturedCount,
            maturingSoonCount,
            taxSaverTotal: taxSaverTotal.toFixed(2),
            liquidityGaps
        });
    } catch (err) {
        next(err);
    }
};

exports.create = (req, res, next) => {
    let { bankName, principal = '0', interestRate, tenureMonths, startDate, maturityDate, isAutoRenew, isTaxSaver, owner_member_id = null, joint_owner_member_id = null, owner_split_percent = 100, source_bank_id = null, isHistorical = false } = req.body;
    
    const safeBankName = validateTitle(bankName) || 'Bank';
    principal = validateAmount(principal, true) || '0.00'; 
    interestRate = parseFloat(interestRate) || 0; 
    
    const safeTenure = parseInt(tenureMonths) || 12;
    const safeStartDate = validateDate(startDate) || getLocalYYYYMMDD();
    const safeMaturityDate = validateDate(maturityDate) || null;
    
    const safeOwnerId = validateFk(owner_member_id);
    const safeJointOwnerId = validateFk(joint_owner_member_id);
    const safeSourceBankId = validateFk(source_bank_id);
    
    const rawSplit = parseFloat(owner_split_percent);
    const safeSplitPercent = (!isNaN(rawSplit) && rawSplit >= 0 && rawSplit <= 100) ? rawSplit : 100;
    
    isAutoRenew = isAutoRenew ? 1 : 0; 
    isTaxSaver = isTaxSaver ? 1 : 0;
    
    try {
        if (!isHistorical && !safeSourceBankId && parseFloat(principal) > 0) {
            throw new Error("Valid Source Bank Account is required for non-historical Fixed Deposits.");
        }

        const newId = fixedDepositService.createFixedDeposit({
            safeBankName, principal, interestRate, safeTenure, safeStartDate, safeMaturityDate, isAutoRenew, isTaxSaver, safeOwnerId, safeJointOwnerId, safeSplitPercent, safeSourceBankId, isHistorical
        });

        res.json({ id: newId });
    } catch (err) {
        next(err);
    }
};

exports.remove = (req, res, next) => {
    const id = req.params.id;
    try {
        fixedDepositService.removeFixedDeposit(id);
        res.json({ success: true, ledgerEntriesReversed: true });
    } catch (err) {
        if (err.message.startsWith('Cannot delete')) {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
};
