const Decimal = require('decimal.js');

function getLocalYYYYMMDD(dateObj = new Date()) {
    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) return null;
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(dateObj);
}

function calculateYearsElapsed(startDateStr, maturityDateStr) {
    const start = new Date(startDateStr);
    if (isNaN(start.getTime())) return 0;
    
    const nowStr = getLocalYYYYMMDD();
    let endDate = new Date(nowStr);
    
    if (maturityDateStr) {
        const mDate = new Date(maturityDateStr);
        if (!isNaN(mDate.getTime()) && mDate < endDate) {
            endDate = mDate;
        }
    }
    
    if (endDate < start) return 0;
    return new Decimal(endDate.getTime() - start.getTime()).dividedBy(1000 * 60 * 60 * 24 * 365.25);
}

function computeFdAccruedInterest(fd) {
    if (!fd.interestRate || !fd.startDate) return 0;
    const rate = new Decimal(String(fd.interestRate).replace(/,/g, '') || 0).dividedBy(100);
    const principal = new Decimal(String(fd.principal).replace(/,/g, '') || 0);
    
    const years = calculateYearsElapsed(fd.startDate, fd.maturityDate);
    if (years.isZero()) return 0;
    
    // Quarterly compounding: amount = principal * (1 + rate / 4)^(4 * years)
    const base = new Decimal(1).plus(rate.dividedBy(4));
    const exponent = years.times(4);
    const amount = principal.times(base.pow(exponent));
    
    const interest = amount.minus(principal);
    return interest.isNegative() ? 0 : interest.toNumber();
}

function computeSgbInterest(g) {
    if (!g.purchaseDate) return 0;
    const rate = new Decimal(g.interestRate || 2.5).dividedBy(100);
    
    const years = calculateYearsElapsed(g.purchaseDate, g.maturityDate);
    if (years.isZero()) return 0;
    
    // Simple interest on nominal issue value
    const principal = new Decimal(g.weightGrams || 0).times(new Decimal(g.purchasePricePerGram || 0)); 
    const interest = principal.times(rate).times(years);
    
    return interest.isNegative() ? 0 : interest.toNumber();
}

function getMonthlyEquivalent(amount, frequency) {
    const a = Math.abs(parseFloat(String(amount).replace(/,/g, '')) || 0);
    let f = (frequency || '').toString().trim().toLowerCase();
    if (!f) f = 'monthly';
    switch (f) {
        case 'daily': return (a * 365.25) / 12;
        case 'weekly': return (a * 52.0) / 12;
        case 'biweekly':
        case 'fortnightly':
        case 'bi-weekly': return (a * 26.0) / 12;
        case 'monthly': return a;
        case 'quarterly': return a / 3;
        case 'semi-annually':
        case 'half-yearly':
        case 'bi-annually': return a / 6;
        case 'annual':
        case 'annually':
        case 'yearly': return a / 12;
        case 'once': return 0;
        default: return a;
    }
}

function calculateIncomeTax(income) {
    if (income <= 700000) return 0;
    let tax = 0; let rem = income;
    if (rem > 1500000) { tax += (rem - 1500000) * 0.30; rem = 1500000; }
    if (rem > 1200000) { tax += (rem - 1200000) * 0.20; rem = 1200000; }
    if (rem > 900000) { tax += (rem - 900000) * 0.15; rem = 900000; }
    if (rem > 600000) { tax += (rem - 600000) * 0.10; rem = 600000; }
    if (rem > 300000) { tax += (rem - 300000) * 0.05; }
    const excessOver7L = income - 700000;
    if (tax > excessOver7L && income <= 750000) { tax = excessOver7L; }
    return tax;
}

function calculateTotalIncomeTax(income) {
    const baseTax = calculateIncomeTax(income);
    let surchargeMultiplier = 1.0;
    if (income > 20000000) surchargeMultiplier = 1.25;
    else if (income > 10000000) surchargeMultiplier = 1.15;
    else if (income > 5000000) surchargeMultiplier = 1.10;
    
    let taxWithSurcharge = baseTax * surchargeMultiplier;
    
    // Marginal relief for surcharge boundaries
    const thresholds = [5000000, 10000000, 20000000];
    for (const T of thresholds) {
        if (income > T && income < T + 2000000) {
            let maxTax = calculateIncomeTax(T);
            let tSurchargeMult = 1.0;
            if (T === 5000000) tSurchargeMult = 1.0;
            else if (T === 10000000) tSurchargeMult = 1.10;
            else if (T === 20000000) tSurchargeMult = 1.15;
            maxTax = maxTax * tSurchargeMult + (income - T);
            if (taxWithSurcharge > maxTax) taxWithSurcharge = maxTax;
        }
    }
    
    return taxWithSurcharge * 1.04; // add 4% health & education cess
}


function parseToPaiseBigInt(str) {
    if (str === null || str === undefined) return 0n;
    str = String(str).trim().replace(/,/g, '');
    if (str === '') return 0n;
    const isNeg = str.startsWith('-');
    if (isNeg || str.startsWith('+')) str = str.slice(1);
    const parts = str.split('.');
    if (parts.length > 2) throw new Error("Invalid number format: multiple decimal points");
    let whole = parts[0] || '0';
    let frac = parts[1] || '';
    if (frac.length > 2) throw new Error("More than 2 decimal places not allowed");
    else if (frac.length === 1) frac += '0';
    else if (frac.length === 0) frac = '00';
    const paiseStr = whole + frac;
    try {
        let result = BigInt(paiseStr);
        return isNeg ? -result : result;
    } catch {
        throw new Error("Invalid number format");
    }
}

function formatBigIntToDecimalString(bigIntVal) {
    let str = bigIntVal.toString();
    const isNeg = str.startsWith('-');
    if (isNeg) str = str.substring(1);
    while (str.length < 3) str = '0' + str;
    const whole = str.substring(0, str.length - 2);
    const frac = str.substring(str.length - 2);
    return (isNeg ? '-' : '') + whole + '.' + frac;
}

function validateAmount(amount, allowZero = false) {
    if (amount === undefined || amount === null || String(amount).trim() === '') return null;
    if (/e/i.test(String(amount))) return null;
    try {
        const paise = parseToPaiseBigInt(amount);
        if (paise < 0n || paise > 99999999900n) return null;
        if (!allowZero && paise === 0n) return null;
        return formatBigIntToDecimalString(paise);
    } catch {
        return null;
    }
}

function validateDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const str = dateStr.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
    const d = new Date(str);
    if (isNaN(d.getTime())) return null;
    if (d.toISOString().split('T')[0] !== str) return null;
    const minDate = new Date('2000-01-01');
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 100);
    if (d < minDate || d > maxDate) return null;
    return str;
}

function validateString(str, maxLen = 200) {
    if (!str || typeof str !== 'string') return null;
    return str.trim().slice(0, maxLen);
}

function validateTitle(str) {
    if (!str || typeof str !== 'string') return null;
    const trimmed = str.trim().replace(/[^\p{L}\p{N}\s\-,.!?'"()&]/gu, '').slice(0, 200);
    if (trimmed.length === 0) return null;
    return trimmed;
}

function validateReceiptUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim().slice(0, 500);
    if (trimmed.length === 0) return null;
    // Strictly only allow our local uploads directory to prevent SSRF and XSS
    if (/^\/uploads\/[\w\-. ]+$/.test(trimmed)) {
        return trimmed;
    }
    return null;
}

function validateFk(id) {
    if (id === null || id === undefined || id === '') return null;
    return /^[1-9]\d*$/.test(String(id)) ? String(id) : null;
}

function parseStrictAmount(val) { 
    const res = validateAmount(val); 
    return res !== null ? Number(res) : null; 
}

module.exports = {
    computeFdAccruedInterest,
    computeSgbInterest,
    calculateYearsElapsed,
    getMonthlyEquivalent,
    calculateIncomeTax,
    calculateTotalIncomeTax,
    parseToPaiseBigInt,
    formatBigIntToDecimalString,
    validateAmount,
    validateDate,
    validateString,
    validateTitle,
    validateReceiptUrl,
    validateFk,
    parseStrictAmount,
    getLocalYYYYMMDD
};
