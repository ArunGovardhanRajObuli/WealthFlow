import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layers, Clock, TrendingUp, Shield, HelpCircle } from 'lucide-react';

function BucketStrategy() {
  const { data: bankRes } = useQuery({ queryKey: ['reconciliation'], queryFn: () => fetch('/api/reconciliation').then(r => r.json()).catch(() => ({computedFreeCash: 0})) });
  const { data: invRes } = useQuery({ queryKey: ['investments'], queryFn: () => fetch('/api/investments').then(r => r.json()).catch(() => ({data: []})) });
  const { data: sfRes } = useQuery({ queryKey: ['sinking-funds'], queryFn: () => fetch('/api/sinking-funds').then(r => r.json()).catch(() => ({data: []})) });
  const { data: npsRes } = useQuery({ queryKey: ['nps-projection'], queryFn: () => fetch('/api/nps-projection?currentAge=30&retirementAge=60').then(r => r.json()).catch(() => ({accounts: []})) });
  const { data: goldRes } = useQuery({ queryKey: ['gold-portfolio'], queryFn: () => fetch('/api/gold-holdings/portfolio').then(r => r.json()).catch(() => ({summary: {totalCurrentValue: 0}})) });
  const { data: fdRes } = useQuery({ queryKey: ['fd-ladder'], queryFn: () => fetch('/api/fixed-deposits').then(r => r.json()).catch(() => ({data: []})) });
  const { data: reRes } = useQuery({ queryKey: ['real-estate'], queryFn: () => fetch('/api/real-estate').then(r => r.json()).catch(() => ({data: []})) });

  const { data, total } = useMemo(() => {
    let short = 0; // Cash, Bank, Emergency, Liquid Funds
    let medium = 0; // Debt MFs, Bonds, Sinking Funds
    let long = 0; // Equity, Real Estate

    // 1. Bank Balances (Always Short Term - true ledger balance)
    if (bankRes) {
        short += Number(bankRes.computedFreeCash || 0);
    }

    // 2. Sinking Funds (Usually Medium Term for specific goals)
    if (sfRes?.data) {
        medium += sfRes.data.reduce((sum, s) => sum + Number(s.currentAmount || 0), 0);
    }

    // 3. Investments (Split by category)
    if (invRes?.data) {
        invRes.data.forEach(inv => {
            const cat = (inv.category || '').toLowerCase();
            const liveValue = (inv.schemeCode && inv.latestNav > 0 && inv.totalUnits > 0) 
                              ? (Number(inv.latestNav) * Number(inv.totalUnits)) 
                              : Number(inv.currentAmount || 0);
            if (cat.includes('fd') || cat.includes('liquid') || cat.includes('cash')) {
                short += liveValue;
            } else if (cat.includes('debt') || cat.includes('bond')) {
                medium += liveValue;
            } else {
                long += liveValue;
            }
        });
    }

    // 4. Fixed Deposits (Always Short Term Bucket 1)
    if (fdRes?.data) {
        short += fdRes.data.reduce((sum, f) => sum + Number(f.principal || 0) + Number(f.interestEarned || 0), 0);
    }

    // 5. NPS (Always Long Term Bucket 3)
    if (npsRes?.accounts) {
        long += npsRes.accounts.reduce((sum, a) => sum + Number(a.currentValue || 0), 0);
    }

    // 6. Gold (Always Long Term Bucket 3)
    if (goldRes?.totalCurrentValue) {
        long += Number(goldRes.totalCurrentValue || 0);
    }

    // 7. Real Estate (Always Long Term Bucket 3)
    if (reRes?.data) {
        long += reRes.data.reduce((sum, r) => sum + Number(r.currentMarketValue || 0), 0);
    }

    return { 
      data: { shortTerm: short, mediumTerm: medium, longTerm: long }, 
      total: short + medium + long 
    };
  }, [bankRes, invRes, sfRes, fdRes, npsRes, goldRes, reRes]);

  const formatCurrency = (val) => `₹${Math.round(val).toLocaleString('en-IN')}`;
  
  const getPct = (val) => total > 0 ? Math.round((val / total) * 100) : 0;

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '24px', marginBottom: '32px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={20} color="var(--accent-sapphire)" />
            Temporal Bucket Strategy
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0', maxWidth: '600px' }}>
            Institutional wealth is managed in buckets based on time horizon. This engine automatically categorizes your net worth to ensure you have liquidity for the short term and growth for the long term.
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
           <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>Total Mapped Wealth</span>
           <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
             {formatCurrency(total)}
           </span>
        </div>
      </div>

      <div className="grid-3" style={{ gap: '20px' }}>
          {/* Bucket 1 */}
          <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '12px', borderTop: '4px solid var(--accent-coral)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Shield size={18} color="var(--accent-coral)" />
                      <h4 style={{ margin: 0 }}>Bucket 1: Safety</h4>
                  </div>
                  <span style={{ fontWeight: 'bold', fontSize: '18px' }}>{getPct(data.shortTerm)}%</span>
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: 'var(--accent-coral)' }}>
                  {formatCurrency(data.shortTerm)}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  <strong>Horizon: 0-3 Years.</strong> Auto-mapped from Bank Balances, FDs, and Liquid Mutual Funds. 
                  Used for emergencies and near-term liabilities. Never exposed to equity markets.
              </p>
          </div>

          {/* Bucket 2 */}
          <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '12px', borderTop: '4px solid #f59e0b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={18} color="#f59e0b" />
                      <h4 style={{ margin: 0 }}>Bucket 2: Stability</h4>
                  </div>
                  <span style={{ fontWeight: 'bold', fontSize: '18px' }}>{getPct(data.mediumTerm)}%</span>
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: '#f59e0b' }}>
                  {formatCurrency(data.mediumTerm)}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  <strong>Horizon: 3-7 Years.</strong> Auto-mapped from Sinking Funds, Debt Mutual Funds, and Bonds. 
                  Outpaces inflation without extreme volatility. Placed in tax-efficient instruments.
              </p>
          </div>

          {/* Bucket 3 */}
          <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '12px', borderTop: '4px solid var(--accent-emerald)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <TrendingUp size={18} color="var(--accent-emerald)" />
                      <h4 style={{ margin: 0 }}>Bucket 3: Growth</h4>
                  </div>
                  <span style={{ fontWeight: 'bold', fontSize: '18px' }}>{getPct(data.longTerm)}%</span>
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: 'var(--accent-emerald)' }}>
                  {formatCurrency(data.longTerm)}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  <strong>Horizon: 7+ Years.</strong> Auto-mapped from Equity MFs, Stocks, PPF, EPF, Real Estate, and Gold. 
                  Aggressive growth engine meant to absorb market shocks over long periods.
              </p>
          </div>
      </div>

      {total > 0 && (
          <div style={{ marginTop: '24px', height: '12px', borderRadius: '6px', display: 'flex', overflow: 'hidden' }}>
              <div style={{ width: `${getPct(data.shortTerm)}%`, background: 'var(--accent-coral)' }}></div>
              <div style={{ width: `${getPct(data.mediumTerm)}%`, background: '#f59e0b' }}></div>
              <div style={{ width: `${getPct(data.longTerm)}%`, background: 'var(--accent-emerald)' }}></div>
          </div>
      )}
    </div>
  );
}

export default BucketStrategy;
