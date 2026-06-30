import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, CheckCircle, AlertTriangle } from 'lucide-react';
import TaxLimitsTracker from './TaxLimitsTracker';
import AdvanceTaxEstimator from './AdvanceTaxEstimator';
import HraCalculator from './HraCalculator';
import AisReconciliation from './AisReconciliation';
import Schedule112A from './Schedule112A';
import CustomSelect from './ui/CustomSelect';

function TaxVault() {
  // FY Scoping Logic
  const now = new Date();
  const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const fyStart = `${fyStartYear}-04-01`;
  const fyEnd = `${fyStartYear + 1}-03-31`;

  const handleSecureDownload = async (url, filename) => {
    try {
      // Strips hardcoded localhost if present
      const cleanUrl = url.replace(/^http:\/\/localhost:\d+/, '');
      const res = await fetch(cleanUrl);
      if (!res.ok) throw new Error('Download failed or Unauthorized');
      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename || 'receipt';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(objectUrl);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Secure download error:', err);
      alert('Secure download failed. Please ensure you are authenticated.');
    }
  };

  const { data: allTxsRes, error: e1 } = useQuery({ 
      queryKey: ['transactions-fy', fyStart, fyEnd], 
      queryFn: () => fetch(`/api/transactions?limit=0&startDate=${fyStart}&endDate=${fyEnd}`).then(r => r.json()) 
  });
  const { data: fmRes } = useQuery({ queryKey: ['family-members'], queryFn: () => fetch('/api/family-members').then(r => r.json()) });
  // C5 FIX: User-configurable tax slab rate for debt fund gain taxation
  const [taxSlab, setTaxSlab] = useState(30);
  const { data: thRes } = useQuery({ queryKey: ['tax-harvest', taxSlab], queryFn: () => fetch(`/api/tax-harvest?taxSlab=${taxSlab}`).then(r => r.json()) });

  const allTxs = useMemo(() => allTxsRes?.data || [], [allTxsRes?.data]);
  const error = e1 ? 'Failed to fetch tax data' : null;
  
  const taxMath = useMemo(() => {
    // Calculate actual Ledger Income for the FY (ignoring non-taxable cashflows and capital gains which are handled separately)
    const ledgerIncome = allTxs
      .filter(tx => tx.type === 'income' && !['capital_retrieval', 'refund', 'realized_stcg', 'realized_ltcg', 'realized_stcg_debt'].includes(tx.category))
      .reduce((sum, tx) => sum + Number(tx.amount), 0);

    const rentalIncome = allTxs
      .filter(tx => tx.type === 'income' && (tx.category === 'rent' || tx.category === 'rental_income' || /\brent\b/i.test(tx.title || '')))
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    const rentalPortion = ledgerIncome > 0 ? rentalIncome : 0;
    const section24aDeduction = rentalPortion * 0.30;

    // Fallback to static family income if the user hasn't logged any ledger income yet
    const staticIncome = fmRes?.data?.reduce((sum, m) => sum + Number(m.annualIncome || 0), 0) || 0;
    const income = ledgerIncome > 0 ? (ledgerIncome - section24aDeduction) : staticIncome;
    
    // Determine Salary Portion for Standard Deduction (Std Deduction is strictly for Salary/Pension)
    const salaryIncome = allTxs
      .filter(tx => tx.type === 'income' && tx.category === 'salary')
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    const salaryPortion = ledgerIncome > 0 ? salaryIncome : staticIncome;

    const dividendIncome = allTxs
      .filter(tx => tx.type === 'income' && (tx.category === 'dividend' || (tx.title || '').toLowerCase().includes('dividend')))
      .reduce((sum, tx) => sum + Number(tx.amount), 0);

    const capitalGains = {
      stcg: Number(thRes?.data?.realizedSTCG || 0),
      stcl: Number(thRes?.data?.realizedSTCL || 0),
      ltcg: Number(thRes?.data?.realizedLTCG || 0) - Number(thRes?.data?.realizedLTCL || 0),
      debtGains: Number(thRes?.data?.realizedDebtGains || 0)
    };

    let section80C = 0;
    let section80D_insurance = 0;
    let section80D_checkup = 0;
    let section24b = 0;
    let section80CCD = 0;
    let section80G_100 = 0;
    let section80G_50 = 0;

    const potentialDeductions = allTxs.filter(tx => tx.type === 'expense' && (tx.isTaxDeductible === 1 || ['investment', 'fd_investment', 'nps_investment', 'insurance', 'loan', 'donation'].includes(tx.category)));
    const validReceipts = [];

    potentialDeductions.forEach(tx => {
      const amt = Number(tx.amount);
      const title = (tx.title || '').toLowerCase();
      let isValid = false;
      
      if (tx.category === 'nps_investment' || title.includes('nps') || title.includes('national pension')) {
        section80CCD += amt;
        isValid = true;
      } else if (tx.category === 'donation' || title.includes('donation') || title.includes('charity') || title.includes('pm cares')) {
        if (title.includes('pm cares') || title.includes('cm relief') || title.includes('national defence') || title.includes('prime minister')) {
            section80G_100 += amt;
        } else {
            section80G_50 += amt;
        }
        isValid = true;
      } else if (tx.category === 'insurance') {
        if (title.includes('checkup') || title.includes('preventive')) {
            section80D_checkup += amt;
            isValid = true;
        } else if (title.includes('health') || title.includes('medical') || title.includes('mediclaim')) {
            section80D_insurance += amt;
            isValid = true;
        } else if (title.includes('life') || title.includes('term')) {
            section80C += amt;
            isValid = true;
        } else if (tx.isTaxDeductible === 1) {
            section80C += amt; // fallback if explicitly marked
            isValid = true;
        }
      } else if (tx.category === 'loan') {
        if (title.includes('home') || title.includes('housing')) {
            if (title.includes('principal')) {
                section80C += amt;
            } else if (title.includes('interest')) {
                section24b += amt;
            } else {
                // Approximate EMI split: 20% principal (80C), 80% interest (24b) for a generic active loan
                section80C += amt * 0.20;
                section24b += amt * 0.80;
            }
            isValid = true;
        } else if (tx.isTaxDeductible === 1) {
            section80C += amt;
            isValid = true;
        }
      } else if (tx.category === 'fd_investment') {
          if (title.includes('tax') || tx.isTaxDeductible === 1) {
              section80C += amt;
              isValid = true;
          }
      } else if (tx.category === 'investment') {
          if (title.includes('elss') || title.includes('ppf') || title.includes('epf') || tx.isTaxDeductible === 1) {
              section80C += amt;
              isValid = true;
          }
      } else if (tx.category === 'medical' || tx.category === 'health' || title.includes('medical') || title.includes('hospital') || title.includes('pharmacy') || title.includes('surgery')) {
          if (tx.isTaxDeductible === 1) {
              section80D_insurance += amt; // treating as 80D/80DDB medical expenditure
              isValid = true;
          }
      } else if (tx.category === 'rent' || title.includes('rent')) {
          // Rent goes towards HRA or 80GG, do not map to 80C even if explicitly marked deductible
      } else if (tx.isTaxDeductible === 1) {
        section80C += amt;
        isValid = true;
      }
      
      if (isValid) {
          validReceipts.push(tx);
      }
    });
    
    const deductions = validReceipts;

    // NPS 80CCD(1B) gives an additional 50k deduction. Anything above 50k overflows to 80C limit.
    if (section80CCD > 50000) {
        section80C += (section80CCD - 50000);
        section80CCD = 50000;
    }

    let estimatedHraExemption = 0;
    const rentPaid = allTxs.filter(tx => tx.type === 'expense' && (tx.category === 'rent' || (tx.title||'').toLowerCase().includes('rent'))).reduce((sum, tx) => sum + Number(tx.amount), 0);
    
    if (salaryPortion > 0 && rentPaid > 0) {
        // Red Team Note: We use Annual Aggregation here because a ledger only shows cash-flows, not occupancy periods.
        // Grouping by tx.date.getMonth() would catastrophically vaporize HRA for users who pay rent in advance (lumpy payments).
        // While Annual Aggregation technically allows minor cross-period offsets if a user moves mid-year, it is the safest 
        // mathematical compromise for an automated estimator. Users must use HraCalculator for precision.
        const basic = salaryPortion * 0.50;
        const hraReceived = basic * 0.40;
        const rentMinus10 = Math.max(0, rentPaid - (basic * 0.10));
        const rawHra = Math.min(hraReceived, basic * 0.50, rentMinus10);
        
        // Ensure Salary deductions (Std Ded + HRA) do not create an artificial loss that spills to other income heads
        const standardDeductionOld = 50000;
        const stdDedCap = Math.min(salaryPortion, standardDeductionOld);
        estimatedHraExemption = Math.min(rawHra, Math.max(0, salaryPortion - stdDedCap));
    }

    // Identify primary user's age for Senior Citizen exemptions
    const primaryEarner = fmRes?.data?.find(m => (m.role || '').toLowerCase() === 'provider' || (m.role || '').toLowerCase() === 'partner') || fmRes?.data?.[0];
    const userAge = primaryEarner ? Number(primaryEarner.age || 30) : 30;

    const max80D = userAge >= 60 ? 100000 : 75000;

    // Calculate 80TTA / 80TTB (Interest Deductions)
    const savingsInterest = allTxs
      .filter(tx => tx.type === 'income' && tx.category === 'interest' && !(tx.title || '').toLowerCase().includes('fd') && !(tx.title || '').toLowerCase().includes('fixed'))
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    const fdInterest = allTxs
      .filter(tx => tx.type === 'income' && tx.category === 'interest' && ((tx.title || '').toLowerCase().includes('fd') || (tx.title || '').toLowerCase().includes('fixed')))
      .reduce((sum, tx) => sum + Number(tx.amount), 0);

    let section80TTA;
    if (userAge >= 60) {
       // 80TTB: Up to 50k on all interest (Savings + FD)
       section80TTA = Math.min(savingsInterest + fdInterest, 50000);
    } else {
       // 80TTA: Up to 10k on savings interest only
       section80TTA = Math.min(savingsInterest, 10000);
    }

    // Apply strict legal caps
    const capped80C = Math.min(section80C, 150000);
    const allowedCheckup = Math.min(section80D_checkup, 5000);
    const section80D = section80D_insurance + allowedCheckup;
    const capped80D = Math.min(section80D, max80D);
    
    // Dynamic Section 24(b) set-off logic
    const netRental = Math.max(0, rentalPortion - section24aDeduction);
    const oldAllowed24b = Math.min(section24b, netRental) + Math.min(Math.max(0, section24b - netRental), 200000);
    const newAllowed24b = Math.min(section24b, netRental);
    const capped24b = oldAllowed24b; // Fallback variable for UI display

    let oldExemptionLimit = 250000;
    if (userAge >= 80) oldExemptionLimit = 500000; // Super Senior Citizen
    else if (userAge >= 60) oldExemptionLimit = 300000; // Senior Citizen

    const getNormalSurchargeRate = (normalInc, totalInc, isNewRegime, dividendInc) => {
        // Surcharge rate of 37% was abolished ONLY in the New Tax Regime (max 25%).
        // Surcharge on Dividend is strictly capped at 15%. Thus, 37% / 25% applies ONLY if 
        // Normal Income (excluding Dividend) itself crosses the high-income thresholds.
        const pureNormalInc = normalInc - (dividendInc || 0);
        
        if (!isNewRegime && pureNormalInc > 50000000) return 0.37;
        if (pureNormalInc > 20000000) return 0.25;
        
        // If Pure Normal Income <= 2 Cr, but Total Income crosses thresholds due to Dividend or Capital Gains, cap surcharge at 15%
        if (totalInc > 10000000) return 0.15;
        if (totalInc > 5000000) return 0.10;
        return 0;
    };
    
    const getCgSurchargeRate = (inc) => inc > 10000000 ? 0.15 : inc > 5000000 ? 0.10 : 0;

    const applyExemptionSetOff = (normalInc, exemptionLimit, stcg, ltcg) => {
        let unexhausted = Math.max(0, exemptionLimit - normalInc);
        let remStcg = stcg;
        let remLtcg = ltcg;
        if (unexhausted > 0) {
            const stcgSetoff = Math.min(unexhausted, remStcg);
            remStcg -= stcgSetoff;
            unexhausted -= stcgSetoff;
            remLtcg -= Math.min(unexhausted, remLtcg);
        }
        return { remStcg, remLtcg };
    };

    const computeRawTax = (normalInc, stcg, ltcg, isNewRegime, dividendInc = 0) => {
        const totalInc = normalInc + stcg + ltcg;
        let baseT = 0;
        let breakdown = [];
        
        if (isNewRegime) {
            if (normalInc > 300000) {
                const amt = Math.min(normalInc - 300000, 400000);
                const tax = Math.round(amt * 0.05);
                baseT += tax;
                breakdown.push({ label: '5% Slab (₹3L - ₹7L)', amount: tax });
            }
            if (normalInc > 700000) {
                const amt = Math.min(normalInc - 700000, 300000);
                const tax = Math.round(amt * 0.10);
                baseT += tax;
                breakdown.push({ label: '10% Slab (₹7L - ₹10L)', amount: tax });
            }
            if (normalInc > 1000000) {
                const amt = Math.min(normalInc - 1000000, 200000);
                const tax = Math.round(amt * 0.15);
                baseT += tax;
                breakdown.push({ label: '15% Slab (₹10L - ₹12L)', amount: tax });
            }
            if (normalInc > 1200000) {
                const amt = Math.min(normalInc - 1200000, 300000);
                const tax = Math.round(amt * 0.20);
                baseT += tax;
                breakdown.push({ label: '20% Slab (₹12L - ₹15L)', amount: tax });
            }
            if (normalInc > 1500000) {
                const amt = normalInc - 1500000;
                const tax = Math.round(amt * 0.30);
                baseT += tax;
                breakdown.push({ label: '30% Slab (> ₹15L)', amount: tax });
            }
        } else {
            if (normalInc > oldExemptionLimit) {
                const amt = Math.min(normalInc - oldExemptionLimit, 500000 - oldExemptionLimit);
                const tax = Math.round(amt * 0.05);
                baseT += tax;
                breakdown.push({ label: `5% Slab (₹${oldExemptionLimit/100000}L - ₹5L)`, amount: tax });
            }
            if (normalInc > 500000) {
                const amt = Math.min(normalInc - 500000, 500000);
                const tax = Math.round(amt * 0.20);
                baseT += tax;
                breakdown.push({ label: '20% Slab (₹5L - ₹10L)', amount: tax });
            }
            if (normalInc > 1000000) {
                const amt = normalInc - 1000000;
                const tax = Math.round(amt * 0.30);
                baseT += tax;
                breakdown.push({ label: '30% Slab (> ₹10L)', amount: tax });
            }
        }

        const exLim = isNewRegime ? 300000 : oldExemptionLimit;
        const exRem = applyExemptionSetOff(normalInc, exLim, stcg, ltcg);
        let stcgT = Math.round(exRem.remStcg * 0.20);
        let ltcgT = Math.round(Math.max(0, exRem.remLtcg - 125000) * 0.125);

        if (stcgT > 0) breakdown.push({ label: 'STCG Tax (20%)', amount: stcgT });
        if (ltcgT > 0) breakdown.push({ label: 'LTCG Tax (12.5%)', amount: ltcgT });

        // 87A Rebate
        const rebateLimit = isNewRegime ? 700000 : 500000;
        const maxRebate = isNewRegime ? 25000 : 12500;
        let rebateApplied = 0;
        if (totalInc <= rebateLimit) {
            let rebateRem = maxRebate;
            const r1 = Math.min(baseT, rebateRem);
            baseT -= r1; rebateRem -= r1;
            rebateApplied += r1;
            
            // Section 115BAC Proviso: 87A Rebate is NOT allowed against STCG u/s 111A or LTCG under New Regime
            if (!isNewRegime) {
                const r2 = Math.min(stcgT, rebateRem);
                stcgT -= r2;
                rebateApplied += r2;
            }
            if (rebateApplied > 0) {
                breakdown.push({ label: 'Sec 87A Rebate', amount: -rebateApplied });
            }
        }

        let totalTax = baseT + stcgT + ltcgT;
        
        // Surcharge
        let cgSurcharge = stcgT * getCgSurchargeRate(totalInc) + ltcgT * getCgSurchargeRate(totalInc);
        let surchargeRate = getNormalSurchargeRate(normalInc, totalInc, isNewRegime, dividendInc);
        
        let surcharge;
        if (dividendInc > 0 && normalInc > 0) {
            const effectiveDividend = Math.min(dividendInc, normalInc);
            const taxOnDividend = baseT * (effectiveDividend / normalInc);
            const taxOnOther = baseT - taxOnDividend;
            surcharge = (taxOnDividend * Math.min(0.15, surchargeRate)) + (taxOnOther * surchargeRate);
        } else {
            surcharge = baseT * surchargeRate;
        }
        
        surcharge += cgSurcharge;
        if (surcharge > 0) breakdown.push({ label: 'Surcharge', amount: surcharge });
                        
        return {
            totalTax: totalTax + surcharge,
            cgTax: stcgT + ltcgT + cgSurcharge,
            breakdown
        };
    };

    const applyMarginalRelief = (normalInc, stcg, ltcg, isNewRegime, dividendInc = 0, unabsorbedLoss = 0) => {
        // Step 1: Inter-Head Set-off (Section 71)
        let actualStcg = stcg;
        let actualLtcg = ltcg;
        let remLoss = unabsorbedLoss;
        if (remLoss > 0) {
            const stcgSetoff = Math.min(remLoss, actualStcg);
            actualStcg -= stcgSetoff;
            remLoss -= stcgSetoff;
            actualLtcg -= Math.min(remLoss, actualLtcg);
        }
        
        const totalInc = normalInc + actualStcg + actualLtcg;
        let rawTaxObj = computeRawTax(normalInc, actualStcg, actualLtcg, isNewRegime, dividendInc);
        let actualTax = rawTaxObj.totalTax;
        let actualCgTax = rawTaxObj.cgTax;
        let breakdown = [...rawTaxObj.breakdown];
        let reliefApplied = 0;
        
        // Thresholds where marginal relief applies (87A and Surcharges)
        const thresholds = isNewRegime ? [700000, 5000000, 10000000, 20000000] : [5000000, 10000000, 20000000, 50000000];
        
        for (let threshold of thresholds) {
            if (totalInc > threshold && totalInc < threshold + 5000000) {
                // Proportional trimming to hit threshold exactly without destroying tax bias
                const totalTrim = normalInc + actualStcg + actualLtcg;
                let trimmedNormal = normalInc;
                let trimmedStcg = actualStcg;
                let trimmedLtcg = actualLtcg;
                
                if (totalTrim > 0) {
                    const excess = totalInc - threshold;
                    trimmedNormal -= excess * (normalInc / totalTrim);
                    trimmedStcg -= excess * (actualStcg / totalTrim);
                    trimmedLtcg -= excess * (actualLtcg / totalTrim);
                }
                
                const trimmedDividend = normalInc > 0 ? dividendInc * (trimmedNormal / normalInc) : 0;
                const taxAtThreshold = computeRawTax(trimmedNormal, trimmedStcg, trimmedLtcg, isNewRegime, trimmedDividend).totalTax;
                const maxAllowedTax = taxAtThreshold + (totalInc - threshold);
                
                if (maxAllowedTax < actualTax) {
                    // Distribute relief proportionally to CG tax
                    if (actualTax > 0) {
                        const reliefRatio = maxAllowedTax / actualTax;
                        actualCgTax = actualCgTax * reliefRatio;
                    }
                    reliefApplied = actualTax - maxAllowedTax;
                    actualTax = maxAllowedTax;
                }
            }
        }
        
        if (reliefApplied > 0) breakdown.push({ label: 'Marginal Relief', amount: -reliefApplied });
        
        const cess = actualTax * 0.04;
        if (cess > 0) breakdown.push({ label: 'Health & Education Cess (4%)', amount: cess });
        
        return {
            finalTax: actualTax + cess,
            finalCgTax: actualCgTax * 1.04,
            breakdown
        };
    };

    // Capital Gains Set-Off Engine (Intra-Head Set-Off under Section 70)
    let stcgEquity = capitalGains.stcg;
    let stcgDebt = capitalGains.debtGains;
    let ltcgEquity = capitalGains.ltcg;
    let remainingStcl = capitalGains.stcl;

    // 1. LTCL can only offset LTCG. (Pre-handled in initialization, ensure no negative leakage)
    if (ltcgEquity < 0) { ltcgEquity = 0; } 

    // 2. Dynamic STCL Offset Routing
    // We estimate if the user is in a >20% marginal bracket to optimize the offset order.
    // Red Team Fix: Must include stcgDebt because Debt STCG pushes the user into higher marginal slabs!
    // Since this runs before the regime is selected, we use a generic 15L threshold which indicates a high tax bracket in both regimes.
    const estTaxable = Math.max(0, income + stcgDebt - 200000); 
    const marginalExceeds20 = estTaxable > 1500000;

    const offsetDebt = () => {
        if (remainingStcl > 0 && stcgDebt > 0) {
            let offset = Math.min(remainingStcl, stcgDebt);
            remainingStcl -= offset; stcgDebt -= offset;
        }
    };
    const offsetEquity = () => {
        if (remainingStcl > 0 && stcgEquity > 0) {
            let offset = Math.min(remainingStcl, stcgEquity);
            remainingStcl -= offset; stcgEquity -= offset;
        }
    };

    // 3 & 4. Execute Optimal Arbitrage
    if (marginalExceeds20) {
        offsetDebt();   // Saves up to 30% first
        offsetEquity(); // Saves 20% second
    } else {
        offsetEquity(); // Saves 20% first
        offsetDebt();   // Saves <20% second
    }

    // 5. Offset remaining STCL against LTCG(Equity) -> Lowest ROI (saves 12.5%)
    if (remainingStcl > 0 && ltcgEquity > 0) {
        let offset = Math.min(remainingStcl, ltcgEquity);
        remainingStcl -= offset; ltcgEquity -= offset;
    }

    const finalStcg = stcgEquity;
    const finalDebtGains = stcgDebt;
    const finalLtcg = ltcgEquity;

    // Exclude Section 10 Exemptions from Gross Income BEFORE computing GTI
    const oldExemptIncome = income - estimatedHraExemption;

    // Calculate Adjusted Gross Total Income for 80G Limit (now that finalDebtGains is available)
    const chapterVIA_excluding80G = capped80C + section80CCD + capped80D + section80TTA;
    const adjustedGTI = Math.max(0, oldExemptIncome + finalDebtGains - oldAllowed24b - chapterVIA_excluding80G);
    const qualifyingLimit = adjustedGTI * 0.10;
    const allowed80G_50 = Math.min(section80G_50, qualifyingLimit) * 0.50;
    const section80G = section80G_100 + allowed80G_50;
    
    const oldChapterVIA = chapterVIA_excluding80G + section80G;

    // NEW REGIME MATH
    const standardDeductionNew = 75000;
    const allowedStdDedNew = Math.min(salaryPortion, standardDeductionNew);
    const newNetIncome = Math.max(0, income - allowedStdDedNew + finalDebtGains - newAllowed24b);
    let newResult = applyMarginalRelief(newNetIncome, finalStcg, finalLtcg, true, dividendIncome);
    let newTax = newResult.finalTax;
    const newCgTax = newResult.finalCgTax;

    // OLD REGIME MATH
    const standardDeductionOld = 50000;
    const allowedStdDedOld = Math.min(salaryPortion, standardDeductionOld);
    
    const gtiOld = oldExemptIncome - allowedStdDedOld + finalDebtGains - oldAllowed24b;
    let unabsorbedLossOld = 0;
    let oldNetIncome = 0;
    
    if (gtiOld < 0) {
        unabsorbedLossOld = Math.abs(gtiOld);
    } else {
        oldNetIncome = Math.max(0, gtiOld - oldChapterVIA);
    }
    
    let oldResult = applyMarginalRelief(oldNetIncome, finalStcg, finalLtcg, false, dividendIncome, unabsorbedLossOld);
    let oldTax = oldResult.finalTax;
    const oldCgTax = oldResult.finalCgTax;

    const winner = newTax <= oldTax ? 'New Regime' : 'Old Regime';
    const savings = Math.abs(oldTax - newTax);

    const unabsorbedStcl = remainingStcl > 0 ? remainingStcl : 0;
    const unabsorbedLtcl = capitalGains.ltcg < 0 ? Math.abs(capitalGains.ltcg) : 0;
    
    // RED TEAM MITIGATION: Detect Grandfathering Ledger FMV Blindness
    const hasFmvBlindness = allTxs.some(tx => tx.category === 'realized_ltcg' && (tx.title || '').includes('[NEEDS FMV ADJUSTMENT]'));

    return { income, newTax, oldTax, newBreakdown: newResult.breakdown, oldBreakdown: oldResult.breakdown, capped80C, capped80D, capped24b, section80TTA, section80G, section80CCD, estimatedHraExemption, newCgTax, oldCgTax, deductions, winner, savings, capitalGains, userAge, unabsorbedStcl, unabsorbedLtcl, hasFmvBlindness };
  }, [allTxs, fmRes, thRes]);

  const { income, newTax, oldTax, newBreakdown, oldBreakdown, capped80C, capped80D, capped24b, section80TTA, section80G, section80CCD, estimatedHraExemption, newCgTax, oldCgTax, deductions, winner, savings, capitalGains, userAge, unabsorbedStcl, unabsorbedLtcl, hasFmvBlindness } = taxMath;

  return (
    <div className="animate-fade-in">
      {error && <div className="alert-banner danger" style={{marginBottom:'20px'}}><AlertTriangle size={16}/> {error}</div>}
      <div className="section-header">
        <div>
           <h2>Indian Tax Strategy Dashboard</h2>
           <p>Proactive FY 2025-26 Regime Optimization based on Ledger Income</p>
        </div>
       {/* C5 FIX: Configurable tax slab selector */}
       <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
         <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Your Tax Slab:</label>
         <CustomSelect value={taxSlab} onChange={e => setTaxSlab(Number(e.target.value))} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '6px 12px', fontSize: '13px' }}>
           <option value={0}>0% (Below ₹2.5L)</option>
           <option value={5}>5% (₹2.5L – ₹5L)</option>
           <option value={20}>20% (₹5L – ₹10L)</option>
           <option value={30}>30% (Above ₹10L)</option>
         </CustomSelect>
       </div>
       </div>

       {(unabsorbedStcl > 0 || unabsorbedLtcl > 0) && (
         <div style={{ marginTop: '24px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderLeft: '4px solid var(--accent-sapphire)', padding: '16px', borderRadius: '8px' }}>
           <h4 style={{ margin: '0 0 8px 0', color: 'var(--accent-sapphire)', display: 'flex', alignItems: 'center', gap: '8px' }}>
             <AlertTriangle size={16}/> Schedule CFL (Carry Forward Losses) Detected
           </h4>
           <p style={{ fontSize: '13px', margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
             You have unabsorbed capital losses that could not be set off this year. You MUST report these in <strong>Schedule CFL</strong> when filing your ITR-2 to legally carry them forward for 8 Assessment Years.
             <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
               {unabsorbedStcl > 0 && <li><strong>Short-Term Capital Loss (STCL):</strong> ₹{Math.round(unabsorbedStcl).toLocaleString('en-IN')}</li>}
               {unabsorbedLtcl > 0 && <li><strong>Long-Term Capital Loss (LTCL):</strong> ₹{Math.round(unabsorbedLtcl).toLocaleString('en-IN')}</li>}
             </ul>
           </p>
         </div>
       )}
         
        {hasFmvBlindness && (
          <div style={{ marginTop: '24px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderLeft: '4px solid var(--accent-amber)', padding: '16px', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 8px 0', color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16}/> Ledger FMV Blindness Detected
            </h4>
            <p style={{ fontSize: '13px', margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              You recently sold a <strong>Grandfathered Asset</strong> (acquired before Jan 31, 2018). Because the system cannot automatically fetch historical FMV prices, the auto-generated LTCG transaction in your ledger is heavily inflated. 
              <br/><br/>
              <strong>Action Required:</strong> Locate the <code>[NEEDS FMV ADJUSTMENT]</code> transaction in the Ledger, and manually edit the amount to reflect your true taxable gain using the Jan 31, 2018 FMV. Until you do this, your Total Tax estimate will be falsely inflated and your ₹1.25L tax-free harvest limit will appear prematurely exhausted.
            </p>
          </div>
        )}
      <div className="grid-3" style={{ marginBottom: '40px', gap: '24px' }}>
          <div className="glass-panel" style={{ gridColumn: 'span 1', border: winner === 'Old Regime' ? '1px solid var(--accent-emerald)' : '1px solid rgba(255,255,255,0.05)' }}>
              <h3>Old Tax Regime</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Utilizes 80C, 80D, 24b</p>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                  <span>Gross Income:</span><span>₹{(income + capitalGains.debtGains).toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: 'var(--accent-coral)' }}>
                  <span>Sec 80C (Max ₹1.5L):</span><span>-₹{Math.round(capped80C).toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: 'var(--accent-coral)' }}>
                  <span>Sec 80D (Health):</span><span>-₹{Math.round(capped80D).toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: 'var(--accent-coral)' }}>
                  <span>Sec 24b (Interest):</span><span>-₹{Math.round(capped24b).toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: 'var(--accent-coral)' }}>
                  <span>Sec {userAge >= 60 ? '80TTB' : '80TTA'} (Interest):</span><span>-₹{Math.round(section80TTA).toLocaleString('en-IN')}</span>
              </div>
              {section80CCD > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: 'var(--accent-coral)' }}>
                    <span>Sec 80CCD(1B) (NPS):</span><span>-₹{Math.round(section80CCD).toLocaleString('en-IN')}</span>
                </div>
              )}
              {section80G > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: 'var(--accent-coral)' }}>
                    <span>Sec 80G (Donations):</span><span>-₹{Math.round(section80G).toLocaleString('en-IN')}</span>
                </div>
              )}
              {estimatedHraExemption > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: 'var(--accent-coral)' }}>
                    <span>Sec 10(13A) (HRA):</span><span>-₹{Math.round(estimatedHraExemption).toLocaleString('en-IN')}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: 'var(--accent-coral)' }}>
                  <span>Standard Deduction:</span><span>-₹50,000</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '14px', color: 'var(--accent-coral)' }}>
                  <span>Capital Gains Tax:</span><span>+₹{Math.round(oldCgTax).toLocaleString('en-IN')}</span>
              </div>
              
              {oldBreakdown && oldBreakdown.length > 0 && (
                <details style={{ marginBottom: '16px', fontSize: '13px', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', userSelect: 'none', fontWeight: 500 }}>View Calculation Breakdown</summary>
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {oldBreakdown.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                                <span>{item.label}:</span>
                                <span>{item.amount < 0 ? '-' : ''}₹{Math.abs(Math.round(item.amount)).toLocaleString('en-IN')}</span>
                            </div>
                        ))}
                    </div>
                </details>
              )}
              
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>Estimated Tax:</span>
                  <span style={{ fontWeight: 700, fontSize: '20px' }}>₹{Math.round(oldTax).toLocaleString('en-IN')}</span>
              </div>
          </div>

          <div className="glass-panel" style={{ gridColumn: 'span 1', border: winner === 'New Regime' ? '1px solid var(--accent-emerald)' : '1px solid rgba(255,255,255,0.05)' }}>
              <h3>New Tax Regime</h3>
               <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Budget 2025 Slabs (No 80C/80D) • 87A Rebate up to ₹12L</p>
               
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                   <span>Gross Income:</span><span>₹{(income + capitalGains.debtGains).toLocaleString('en-IN')}</span>
               </div>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: 'var(--accent-coral)' }}>
                   <span>Standard Deduction:</span><span>-₹75,000</span>
              </div>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '14px', color: 'var(--accent-coral)' }}>
                   <span>Capital Gains Tax:</span><span>+₹{Math.round(newCgTax).toLocaleString('en-IN')}</span>
              </div>
              
              {newBreakdown && newBreakdown.length > 0 && (
                <details style={{ marginBottom: '16px', fontSize: '13px', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', userSelect: 'none', fontWeight: 500 }}>View Calculation Breakdown</summary>
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {newBreakdown.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                                <span>{item.label}:</span>
                                <span>{item.amount < 0 ? '-' : ''}₹{Math.abs(Math.round(item.amount)).toLocaleString('en-IN')}</span>
                            </div>
                        ))}
                    </div>
                </details>
              )}
              
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>Estimated Tax:</span>
                  <span style={{ fontWeight: 700, fontSize: '20px' }}>₹{Math.round(newTax).toLocaleString('en-IN')}</span>
              </div>
          </div>

          <div className="glass-panel" style={{ gridColumn: 'span 1', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
              <ArrowLeftRight size={32} style={{ marginBottom: '16px', color: 'var(--text-muted)' }} />
              <h4 style={{ marginBottom: '8px' }}>Verdict Recommendation</h4>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>By filing under the <strong style={{color: 'var(--text-primary)'}}>{winner}</strong>, you will legally save:</p>
              <h2 className="text-emerald" style={{ fontSize: '36px' }}>₹{Math.round(savings).toLocaleString('en-IN')}</h2>
          </div>
      </div>

      <h3 style={{ marginBottom: '16px' }}>Section 80C & 80D Receipt Vault</h3>
      <div className="grid-3">
         {deductions.map(item => (
            <div key={item.id} className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '16px' }}>{item.title}</h3>
                  <span style={{ fontWeight: 700, color: 'var(--accent-emerald)'}}>₹{Number(item.amount).toLocaleString('en-IN')}</span>
               </div>
               <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>{item.date}</p>
               {item.receiptUrl ? (
                  <div style={{ marginTop: 'auto', background: 'var(--bg-secondary)', borderRadius: '12px', padding: '8px', textAlign: 'center' }}>
                     <button 
                         onClick={() => handleSecureDownload(item.receiptUrl, `Receipt_${item.title}.pdf`)} 
                         style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-sapphire)', fontSize: '13px', textDecoration: 'none', fontWeight: 600 }}>
                        📄 View Receipt Scan
                     </button>
                  </div>
               ) : (
                  <div style={{ marginTop: 'auto', background: 'rgba(255,0,0,0.05)', borderRadius: '12px', padding: '8px', textAlign: 'center' }}>
                     <span style={{ color: 'var(--accent-coral)', fontSize: '13px' }}>Missing Receipt Proof</span>
                  </div>
               )}
            </div>
         ))}
      </div>

      <h3 style={{ marginTop: '48px', marginBottom: '24px' }}>Filing & Compliance Hub</h3>
      <div className="grid-2" style={{ gap: '24px', marginBottom: '32px' }}>
          <TaxLimitsTracker transactions={allTxs} userAge={userAge} />
          <AdvanceTaxEstimator estimatedTax={Math.min(newTax, oldTax)} userAge={userAge} />
      </div>
      <HraCalculator />
      <Schedule112A />
      <AisReconciliation />

    </div>
  );
}

export default TaxVault;
