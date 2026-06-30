import { useMemo, useCallback } from 'react';
import { parseToPaiseBigInt } from '../utils/bigIntMath';



const toDollars = (paiseBigInt) => Number(paiseBigInt) / 100;

export const useAmortizationEngine = (loans, payments) => {
  const calculateAmortizationEngine = useCallback((loan) => {
    const loanPayments = payments.filter(p => p.linked_loan_id === loan.id || p.loan_id === loan.id);
    const liveBalancePaise = parseToPaiseBigInt(loan.principalAmount);
    const originalBalancePaise = parseToPaiseBigInt(loan.originalPrincipal || loan.principalAmount);
    
    const rParts = String(loan.interestRate || '0').split('.');
    const rWhole = rParts[0] || '0';
    let rFrac = rParts[1] || '';
    while (rFrac.length < 4) rFrac += '0';
    rFrac = rFrac.substring(0, 4);
    const rRate = BigInt(rWhole + rFrac); 
    
    const originalTotalMonths = Number(loan.termYears) * 12;
    const emiPaise = parseToPaiseBigInt(loan.amount);
    
    let startDate = loan.startDate ? new Date(loan.startDate) : (loan.dueDate ? new Date(loan.dueDate) : new Date());
    if (isNaN(startDate.getTime())) startDate = new Date();
    startDate.setDate(1); 
    const now = new Date();
    let currentMonthsElapsed = (now > startDate ? ((now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth())) : 0);
    if (currentMonthsElapsed < 0) currentMonthsElapsed = 0;

    const SCALE = 10000000000n;
    const R = (rRate * SCALE) / 12000000n; 

    if (rRate === 0n) {
      const safeRemaining = liveBalancePaise < 0n ? 0n : liveBalancePaise;
      let progRatio = 100;
      if (originalBalancePaise > 0n) {
          progRatio = Number((originalBalancePaise - safeRemaining) * 10000n / originalBalancePaise) / 100;
      }
      const totalPaidPaise = originalBalancePaise - safeRemaining;
      
      return {
        remainingBalance: toDollars(safeRemaining),
        progressRatio: progRatio,
        isPaidOff: safeRemaining <= 0n,
        monthsShavedOff: 0,
        interestSaved: 0,
        totalPrepaid: toDollars(totalPaidPaise),
        curveData: { labels: [], interest: [], principal: [], balance: [] },
        aiRecommendation: safeRemaining <= 0n ? "🏆 Loan Defeated." : "✅ Zero-interest loan. Pay at your pace."
      };
    }

    let standardBalancePaise = originalBalancePaise; 
    let standardTotalInterestPaise = 0n;
    for(let i=0; i < originalTotalMonths; i++) { 
        if (standardBalancePaise <= 0n) break;
        const iChargePaise = (standardBalancePaise * R) / SCALE;
        let principalForMonthPaise = emiPaise - iChargePaise;
        if (principalForMonthPaise <= 0n) break; 
        if (principalForMonthPaise > standardBalancePaise) principalForMonthPaise = standardBalancePaise;
        standardBalancePaise -= principalForMonthPaise; 
        standardTotalInterestPaise += iChargePaise; 
    }

    let expectedStandardBalancePaise = originalBalancePaise;
    for(let i=0; i < currentMonthsElapsed; i++) { 
        if (expectedStandardBalancePaise <= 0n) break;
        const iChargePaise = (expectedStandardBalancePaise * R) / SCALE;
        let principalForMonthPaise = emiPaise - iChargePaise;
        if (principalForMonthPaise <= 0n) break; 
        if (principalForMonthPaise > expectedStandardBalancePaise) principalForMonthPaise = expectedStandardBalancePaise;
        expectedStandardBalancePaise -= principalForMonthPaise; 
    }

    const actualPrincipalPaidPaise = originalBalancePaise - liveBalancePaise;
    const expectedPrincipalPaidPaise = originalBalancePaise - expectedStandardBalancePaise;
    let totalPrepaidPaise = actualPrincipalPaidPaise - expectedPrincipalPaidPaise;
    if (totalPrepaidPaise < 0n) totalPrepaidPaise = 0n;

    let interestPaidTotalPaise = 0n;
    const curveData = { labels: [], interest: [], principal: [], balance: [] };
    let currentBalanceSimPaise = liveBalancePaise; 
    let actualMonthsRun = 0;

    const maxIterations = originalTotalMonths * 2; 
    for(let i=0; i <= maxIterations; i++) { 
      if(currentBalanceSimPaise <= 0n) break; 
      actualMonthsRun++;
      
      const interestForMonthPaise = (currentBalanceSimPaise * R) / SCALE;
      interestPaidTotalPaise += interestForMonthPaise;
      
      let principalForMonthPaise = emiPaise - interestForMonthPaise;
      if (principalForMonthPaise <= 0n) break;
      if (principalForMonthPaise > currentBalanceSimPaise) principalForMonthPaise = currentBalanceSimPaise;
      
      currentBalanceSimPaise -= principalForMonthPaise; 
      
      if (i % 6 === 0 || currentBalanceSimPaise <= 0n) { 
          curveData.labels.push(`Y${((i - (i % 12)) / 12)} M${i%12}`); 
          curveData.interest.push(toDollars(interestForMonthPaise)); 
          curveData.principal.push(toDollars(principalForMonthPaise)); 
      }
    }

    let progRatio = 0;
    if (originalBalancePaise > 0n) {
        let diff = originalBalancePaise - liveBalancePaise;
        if (diff < 0n) diff = 0n;
        progRatio = Number(diff * 10000n / originalBalancePaise) / 100;
        if (progRatio > 100) progRatio = 100;
    }

    let sumOfAllPaymentsPaise = 0n;
    loanPayments.forEach(p => sumOfAllPaymentsPaise += parseToPaiseBigInt(p.amount));
    
    let interestPaidSoFarPaise = sumOfAllPaymentsPaise - actualPrincipalPaidPaise;
    if (interestPaidSoFarPaise < 0n) interestPaidSoFarPaise = 0n;
    
    const projectedTotalInterestPaise = interestPaidSoFarPaise + interestPaidTotalPaise;
    const interestSavedPaise = standardTotalInterestPaise - projectedTotalInterestPaise;
    const finalInterestSaved = interestSavedPaise < 0n ? 0n : interestSavedPaise;
    
    const standardRemainingMonths = originalTotalMonths - currentMonthsElapsed;
    let monthsShavedOff = standardRemainingMonths > actualMonthsRun ? standardRemainingMonths - actualMonthsRun : 0;
    if (monthsShavedOff < 0) monthsShavedOff = 0;

    return {
      remainingBalance: toDollars(liveBalancePaise),
      progressRatio: progRatio,
      isPaidOff: liveBalancePaise <= 0n,
      monthsShavedOff: monthsShavedOff,
      interestSaved: toDollars(finalInterestSaved),
      totalPrepaid: toDollars(totalPrepaidPaise),
      curveData,
      aiRecommendation: liveBalancePaise <= 0n ? "🏆 Loan Defeated." : ((liveBalancePaise * R) / SCALE > (emiPaise / 2n)) ? "🔥 Aggressive Prepayment Recommended to shatter compounding curve." : "✅ Cash Coasting Phase. Interest ratio destroyed."
    };
  }, [payments]);

  const enriched = useMemo(() => loans.map(loan => {
    return {
      id: loan.id,
      title: loan.title,
      principalAmount: loan.principalAmount,
      interestRate: loan.interestRate,
      termYears: loan.termYears,
      amount: loan.amount,
      dueDate: loan.dueDate,
      frequency: loan.frequency,
      category: loan.category,
      engine: calculateAmortizationEngine(loan)
    };
  }), [loans, calculateAmortizationEngine]);

  const activeLoans = useMemo(() => enriched.filter(l => !l.engine.isPaidOff), [enriched]);
  const defeatedLoans = useMemo(() => enriched.filter(l => l.engine.isPaidOff), [enriched]);

  const metrics = useMemo(() => {
      let totalOutPaise = 0n;
      let totalEMIPaise = 0n;
      activeLoans.forEach(l => {
          totalOutPaise += parseToPaiseBigInt(l.engine.remainingBalance);
          totalEMIPaise += parseToPaiseBigInt(l.amount);
      });
      
      let totalIntSavedPaise = 0n;
      let totalPrepaidPaise = 0n;
      enriched.forEach(l => {
          totalIntSavedPaise += parseToPaiseBigInt(l.engine.interestSaved);
          totalPrepaidPaise += parseToPaiseBigInt(l.engine.totalPrepaid);
      });

      return {
          totalOutstanding: toDollars(totalOutPaise),
          totalEMI: toDollars(totalEMIPaise),
          totalInterestSaved: toDollars(totalIntSavedPaise),
          totalPrepaid: toDollars(totalPrepaidPaise)
      };
  }, [activeLoans, enriched]);

  const metricsPaise = useMemo(() => {
      let totalOutPaise = 0n;
      let totalEMIPaise = 0n;
      activeLoans.forEach(l => {
          totalOutPaise += parseToPaiseBigInt(l.engine.remainingBalance);
          totalEMIPaise += parseToPaiseBigInt(l.amount);
      });
      return { totalOutPaise, totalEMIPaise };
  }, [activeLoans]);

  return { activeLoans, defeatedLoans, metrics, metricsPaise, calculateAmortizationEngine, enriched };
};
