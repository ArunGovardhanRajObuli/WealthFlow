import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layers } from 'lucide-react';

function AssetCategories() {
  const { data: bankRes } = useQuery({ queryKey: ['reconciliation'], queryFn: () => fetch('/api/reconciliation').then(r => r.json()).catch(() => ({computedFreeCash: 0})) });
  const { data: invRes } = useQuery({ queryKey: ['investments'], queryFn: () => fetch('/api/investments').then(r => r.json()).catch(() => ({data: []})) });
  const { data: sfRes } = useQuery({ queryKey: ['sinking-funds'], queryFn: () => fetch('/api/sinking-funds').then(r => r.json()).catch(() => ({data: []})) });
  const { data: npsRes } = useQuery({ queryKey: ['nps-projection'], queryFn: () => fetch('/api/nps-projection?currentAge=30&retirementAge=60').then(r => r.json()).catch(() => ({accounts: []})) });
  const { data: goldRes } = useQuery({ queryKey: ['gold-portfolio'], queryFn: () => fetch('/api/gold-holdings/portfolio').then(r => r.json()).catch(() => ({totalCurrentValue: 0})) });
  const { data: fdRes } = useQuery({ queryKey: ['fd-ladder'], queryFn: () => fetch('/api/fixed-deposits').then(r => r.json()).catch(() => ({data: []})) });
  const { data: reRes } = useQuery({ queryKey: ['real-estate'], queryFn: () => fetch('/api/real-estate').then(r => r.json()).catch(() => ({data: []})) });

  const { breakdown, totalWealth } = useMemo(() => {
    let bank = Number(bankRes?.computedFreeCash || 0);
    let fd = 0;
    if (fdRes?.fds) {
      fd = fdRes.fds.reduce((sum, f) => sum + Number(f.principal || 0) + Number(f.interestEarned || 0), 0);
    } else if (fdRes?.data) {
      fd = fdRes.data.reduce((sum, f) => sum + Number(f.principal || 0) + Number(f.interestEarned || 0), 0);
    }
    let sf = sfRes?.data ? sfRes.data.reduce((sum, s) => sum + Number(s.currentAmount || 0), 0) : 0;
    let nps = npsRes?.accounts ? npsRes.accounts.reduce((sum, a) => sum + Number(a.currentValue || 0), 0) : 0;
    let gold = Number(goldRes?.totalCurrentValue || 0);
    let realEstate = reRes?.data ? reRes.data.reduce((sum, r) => sum + Number(r.currentMarketValue || 0), 0) : 0;

    let equityLiquid = 0;
    let equityIlliquid = 0;
    
    if (invRes?.data) {
        invRes.data.forEach(inv => {
            const cat = (inv.category || '').toLowerCase();
            const title = (inv.title || '').toLowerCase();
            const liveValue = (inv.schemeCode && inv.latestNav > 0 && inv.totalUnits > 0) 
                              ? (Number(inv.latestNav) * Number(inv.totalUnits)) 
                              : Number(inv.currentAmount || 0);
            if (cat.includes('ppf') || cat.includes('epf') || cat.includes('lock') || title.includes('ppf') || title.includes('epf')) {
                equityIlliquid += liveValue;
            } else {
                equityLiquid += liveValue;
            }
        });
    }

    const total = bank + fd + sf + nps + gold + realEstate + equityLiquid + equityIlliquid;

    return {
      breakdown: {
        'Bank Balances': bank,
        'Equities & MFs': equityLiquid,
        'Fixed Deposits': fd,
        'Sinking Funds': sf,
        'PPF / EPF': equityIlliquid,
        'NPS (Retirement)': nps,
        'Gold Portfolio': gold,
        'Real Estate': realEstate
      },
      totalWealth: total
    };
  }, [bankRes, invRes, sfRes, fdRes, npsRes, goldRes, reRes]);

  const formatCurrency = (val) => `₹${Math.round(val).toLocaleString('en-IN')}`;

  if (totalWealth === 0) return null;

  return (
    <div className="glass-panel hover-pop-card" style={{ padding: '24px', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={20} color="var(--accent-sapphire)" />
            Asset Categories
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Your total mapped wealth broken down by asset class.
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Mapped Wealth</span>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{formatCurrency(totalWealth)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {Object.entries(breakdown).map(([key, val]) => {
              if (val === 0) return null;
              return (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{key}</span>
                      <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{formatCurrency(val)}</span>
                  </div>
              );
          })}
      </div>
    </div>
  );
}

export default AssetCategories;
