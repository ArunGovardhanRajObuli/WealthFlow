export function parseToPaiseBigInt(val) {
    if (val === null || val === undefined) return 0n;
    if (typeof val === 'bigint') return val;
    let str = String(val).trim().replace(/,/g, '');
    if (str === '' || str === '0') return 0n;
    if (str.length > 50) return 0n;
    const isNeg = str.startsWith('-');
    if (isNeg) str = str.substring(1);
    const parts = str.split('.');
    let whole = parts[0] || '0';
    let frac = parts[1] || '';
    if (frac.length > 2) frac = frac.substring(0, 2);
    else if (frac.length === 1) frac += '0';
    else if (frac.length === 0) frac = '00';
    const paiseStr = whole + frac;
    try {
        let result = BigInt(paiseStr);
        return isNeg ? -result : result;
    } catch {
        return 0n;
    }
}

export function formatBigIntToDecimalString(bigIntVal) {
    let str = bigIntVal.toString();
    const isNeg = str.startsWith('-');
    if (isNeg) str = str.substring(1);
    while (str.length < 3) str = '0' + str;
    const whole = str.substring(0, str.length - 2);
    const frac = str.substring(str.length - 2);
    return (isNeg ? '-' : '') + whole + '.' + frac;
}

export function formatBigIntPaise(paiseVal) {
    const absPaise = paiseVal < 0n ? -paiseVal : paiseVal;
    const wholeBigInt = absPaise / 100n;
    let wholeStr = wholeBigInt.toString();
    let result = '';
    let count = 0;
    for (let i = wholeStr.length - 1; i >= 0; i--) {
        if (count === 3 || (count > 3 && (count - 3) % 2 === 0)) {
            result = ',' + result;
        }
        result = wholeStr[i] + result;
        count++;
    }
    return `${paiseVal < 0n ? '-' : ''}${result}`;
}

export function calculateEMIBigInt(pPaise, rString, nYearsStr) {
    const p = BigInt(pPaise);
    const rParts = String(rString || '0').split('.');
    const rWhole = rParts[0] || '0';
    let rFrac = rParts[1] || '';
    while (rFrac.length < 4) rFrac += '0';
    rFrac = rFrac.substring(0, 4);
    const rRate = BigInt(rWhole + rFrac); 
    const months = BigInt(Math.round(Number(nYearsStr || '0') * 12));
    if (p <= 0n || rRate <= 0n || months <= 0n) return 0n;
    const SCALE = 10000000000n;
    const R = (rRate * SCALE) / 12000000n; 
    let pow = SCALE;
    for (let i = 0n; i < months; i++) {
        pow = (pow * (SCALE + R)) / SCALE;
    }
    if (pow <= SCALE) return 0n;
    const num = p * R * pow;
    const den = (pow - SCALE) * SCALE;
    return num / den;
}
