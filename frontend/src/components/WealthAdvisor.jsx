import React, { useMemo } from 'react';
import { useQuery,  } from '@tanstack/react-query';
import { Brain, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function WealthAdvisor() {
  

  const fetcher = async (url) => { const r = await fetch(url); return r.json(); };
  
  const now = new Date();
  const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const fyStart = `${fyStartYear}-04-01`;
  const fyEnd = `${fyStartYear + 1}-03-31`;

  const { data: banksRes } = useQuery({ queryKey: ['family-estate-ledger'], queryFn: () => fetcher('/api/family-estate-ledger') });
  const { data: txRes } = useQuery({ queryKey: ['transactions-fy-advisor', fyStart, fyEnd], queryFn: () => fetcher(`/api/transactions?limit=0&startDate=${fyStart}&endDate=${fyEnd}`) });
  const { data: loansListRes } = useQuery({ queryKey: ['loans-list'], queryFn: () => fetcher('/api/loans-list') });
  const { data: familyRes } = useQuery({ queryKey: ['family-members'], queryFn: () => fetcher('/api/family-members') });
  const { data: invRes } = useQuery({ queryKey: ['investments'], queryFn: () => fetcher('/api/investments') });
  const { data: fdsRes } = useQuery({ queryKey: ['fixed-deposits'], queryFn: () => fetcher('/api/fixed-deposits') });
  const { data: npsRes } = useQuery({ queryKey: ['nps-accounts'], queryFn: () => fetcher('/api/nps-accounts') });
  const { data: sfRes } = useQuery({ queryKey: ['sinking-funds'], queryFn: () => fetcher('/api/sinking-funds') });

  const banks = useMemo(() => banksRes?.data || [], [banksRes?.data]);
  const investments = useMemo(() => invRes?.data || [], [invRes?.data]);
  const loans = useMemo(() => loansListRes?.data || [], [loansListRes?.data]);
  const transactions = useMemo(() => txRes?.data || [], [txRes?.data]);
  const family = useMemo(() => familyRes?.data || [], [familyRes?.data]);
  const fds = useMemo(() => fdsRes?.data || [], [fdsRes?.data]);
  const npsAccounts = useMemo(() => npsRes?.data || [], [npsRes?.data]);
  const sinkingFunds = useMemo(() => sfRes?.data || [], [sfRes?.data]);

  const alerts = useMemo(() => {
    const generatedAlerts = [];
    
    // 1. Idle Cash vs High-Interest Debt
    const totalIdleCash = banks.filter(b => b.type === 'Bank Account').reduce((acc, b) => acc + (b.ledgerBalance || 0), 0);
    const highInterestLoans = loans.filter(l => l.interestRate > 8 && l.principalAmount > 0);
    let effectiveIdleCash = totalIdleCash;
    
    if (totalIdleCash > 100000 && highInterestLoans.length > 0) {
      const targetLoan = highInterestLoans.sort((a, b) => b.interestRate - a.interestRate)[0];
      const maxPrepayment = Math.min(Math.floor(totalIdleCash * 0.3), targetLoan.principalAmount);
      effectiveIdleCash -= maxPrepayment;
      generatedAlerts.push({
        type: 'warning',
        icon: <AlertCircle size={20} className="text-coral" />,
        title: 'Interest Arbitrage Leak Detected',
        message: `You have ₹${totalIdleCash.toLocaleString('en-IN')} sitting idle in 0-4% savings accounts while bleeding ${targetLoan.interestRate}% APR on "${targetLoan.title}".`,
        action: `Recommendation: Deploy up to ₹${maxPrepayment.toLocaleString('en-IN')} from savings to prepay the loan principal. This guarantees a risk-free return of ${targetLoan.interestRate}%.`
      });
    }
    
    if (effectiveIdleCash > 500000) {
      generatedAlerts.push({
        type: 'info',
        icon: <TrendingUp size={20} className="text-sapphire" />,
        title: 'Excessive Free Cash Liquidity',
        message: `You are holding ₹${effectiveIdleCash.toLocaleString('en-IN')} in highly liquid savings. Inflation is eroding this value.`,
        action: 'Recommendation: Sweep any amount above 6 months expenses into a liquid mutual fund or an arbitrage fund for better tax-adjusted returns.'
      });
    }

    // 2. Sovereign Vault Limit Optimization (PPF/SSY)
    const sovereignAccounts = investments.filter(i => i.category === 'ppf' || (i.title || '').toLowerCase().includes('sukanya'));
    
    sovereignAccounts.forEach(account => {
        const contributionThisYear = transactions
            .filter(tx => tx.type === 'expense' && (tx.investment_id === account.id || (tx.title || '').toLowerCase().includes((account.title || 'ppf').toLowerCase())))
            .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
            
        if (contributionThisYear < 150000) {
            const remaining = 150000 - contributionThisYear;
            generatedAlerts.push({
                type: 'info',
                icon: <CheckCircle2 size={20} className="text-emerald" />,
                title: `Sovereign Headroom: ${account.title}`,
                message: `Your account "${account.title}" has only received ₹${contributionThisYear.toLocaleString('en-IN')} this FY.`,
                action: `Recommendation: Deploy ₹${remaining.toLocaleString('en-IN')} to max out the ₹1.5L tax-free EEE limit before March 31st.`
            });
        }
    });

    // 3. Equity Allocation Check
    let totalEquity = investments.filter(i => {
        if (i.assetClass && i.assetClass.toLowerCase() !== 'equity' && ['debt', 'sovereign'].includes(i.assetClass.toLowerCase())) return false;
        if (i.assetClass && i.assetClass.toLowerCase() === 'equity') return true;
        return ['sip', 'stock'].includes(i.category);
    }).reduce((acc, curr) => {
        let val = curr.currentAmount || 0;
        if (curr.totalUnits && curr.latestNav) {
            const nav = parseFloat(curr.latestNav);
            if (!isNaN(nav)) val = curr.totalUnits * nav;
        }
        return acc + val;
    }, 0);
    
    // Add NPS Equity portion
    totalEquity += npsAccounts.reduce((acc, curr) => {
        const eqPct = curr.equityPct !== undefined ? curr.equityPct : 50;
        return acc + ((curr.currentValue || 0) * (eqPct / 100));
    }, 0);
    
    let totalDebt = investments.filter(i => {
        if (i.assetClass && ['debt', 'sovereign'].includes(i.assetClass.toLowerCase())) return true;
        if (i.assetClass && i.assetClass.toLowerCase() === 'equity') return false;
        return ['ppf', 'epf', 'fd'].includes(i.category);
    }).reduce((acc, curr) => acc + (curr.currentAmount || 0), 0) + totalIdleCash;

    // Add FDs, Sinking Funds, and NPS Debt portion
    totalDebt += fds.reduce((acc, curr) => acc + (curr.principal || 0), 0);
    totalDebt += sinkingFunds.reduce((acc, curr) => acc + (curr.currentAmount || 0), 0);
    totalDebt += npsAccounts.reduce((acc, curr) => {
        const eqPct = curr.equityPct !== undefined ? curr.equityPct : 50;
        const debtPct = 100 - eqPct;
        return acc + ((curr.currentValue || 0) * (debtPct / 100));
    }, 0);
    
    if (totalEquity > 0 || totalDebt > 0) {
        const equityPct = (totalEquity / (totalEquity + totalDebt)) * 100;
        const providers = family.filter(f => f.role === 'Provider');
        let calculatedAge = 35;
        let ageLabel = 'your age (35)';
        
        if (providers.length === 1) {
            calculatedAge = providers[0].age || 35;
            ageLabel = `${providers[0].name}'s age (${calculatedAge})`;
        } else if (providers.length > 1) {
            const totalIncome = providers.reduce((sum, p) => sum + (p.annualIncome || 0), 0);
            if (totalIncome > 0) {
                const weightedAgeSum = providers.reduce((sum, p) => sum + ((p.annualIncome || 0) * (p.age || 35)), 0);
                calculatedAge = Math.round(weightedAgeSum / totalIncome);
                ageLabel = `the family's income-weighted average age (${calculatedAge})`;
            } else {
                const ageSum = providers.reduce((sum, p) => sum + (p.age || 35), 0);
                calculatedAge = Math.round(ageSum / providers.length);
                ageLabel = `the family's average provider age (${calculatedAge})`;
            }
        }

        const targetEquityPct = Math.max(20, Math.min(80, 100 - calculatedAge)); // Rule of 100, bounded between 20-80
        
        if (equityPct < targetEquityPct - 15) {
            generatedAlerts.push({
                type: 'warning',
                icon: <AlertCircle size={20} className="text-coral" />,
                title: 'Defensive Portfolio Imbalance',
                message: `Your portfolio has ${equityPct.toFixed(1)}% equity. Based on ${ageLabel}, this is too conservative.`,
                action: `Recommendation: Consider increasing SIP velocity to shift towards your target ${targetEquityPct}% equity allocation to combat inflation.`
            });
        } else if (equityPct > targetEquityPct + 15) {
            generatedAlerts.push({
                type: 'warning',
                icon: <AlertCircle size={20} className="text-coral" />,
                title: 'Aggressive Portfolio Imbalance (Sequence Risk)',
                message: `Your portfolio has ${equityPct.toFixed(1)}% equity. Based on ${ageLabel}, this high exposure exposes you to sequence-of-return risk.`,
                action: `Recommendation: Consider rebalancing your portfolio towards safer debt instruments to bring equity closer to your ${targetEquityPct}% target.`
            });
        } else {
            generatedAlerts.push({
                type: 'success',
                icon: <CheckCircle2 size={20} className="text-emerald" />,
                title: 'Asset Allocation Optimal',
                message: `Your Equity-to-Debt ratio is standing at ${equityPct.toFixed(1)}% / ${(100 - equityPct).toFixed(1)}%, perfectly aligned with your age profile.`,
                action: 'Engine Status: Balanced. Continue current accumulation velocity.'
            });
        }
    }

    return generatedAlerts;
  }, [banks, investments, loans, transactions, family, fds, npsAccounts, sinkingFunds]);

  if (alerts.length === 0) return null;

  return (
    <div className="wealth-advisor" style={{ marginBottom: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <Brain size={24} className="text-sapphire" />
          <h3 style={{ margin: 0 }}>Wealth Advisor Intelligence</h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {alerts.map((alert, idx) => (
              <motion.div 
                  initial={{ opacity: 0, x: -10 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  transition={{ delay: idx * 0.1 }}
                  key={idx} 
                  className="glass-panel" 
                  style={{ 
                      padding: '20px', 
                      borderLeft: `4px solid ${alert.type === 'warning' ? 'var(--accent-coral)' : alert.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-sapphire)'}`,
                      background: 'rgba(255,255,255,0.02)'
                  }}
              >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                      <div style={{ marginTop: '2px' }}>{alert.icon}</div>
                      <div>
                          <h4 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>{alert.title}</h4>
                          <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>{alert.message}</p>
                          <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.05)' }}>
                              {alert.action}
                          </div>
                      </div>
                  </div>
              </motion.div>
          ))}
      </div>
    </div>
  );
}
