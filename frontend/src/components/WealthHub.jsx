 
import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { parseToPaiseBigInt } from '../utils/bigIntMath';
import {
  TrendingUp, Home, Coins, Landmark, PiggyBank, Target,
  Wallet, BarChart3, Gem, ShieldCheck
} from 'lucide-react';
import Investments from './Investments';
import RealEstate from './RealEstate';
import GoldTracker from './GoldTracker';
import NPSTracker from './NPSTracker';
import FDLadder from './FDLadder';
import SinkingFunds from './SinkingFunds';
import BucketStrategy from './BucketStrategy';

function WealthHub() {
  const [activeTab, setActiveTab] = useState('equities');

  const tabs = useMemo(() => [
    { id: 'equities', label: 'Equities & MFs', icon: <TrendingUp size={16} /> },
    { id: 'realestate', label: 'Real Estate', icon: <Home size={16} /> },
    { id: 'gold', label: 'Gold & SGB', icon: <Coins size={16} /> },
    { id: 'nps', label: 'NPS', icon: <Landmark size={16} /> },
    { id: 'fd', label: 'Fixed Deposits', icon: <PiggyBank size={16} /> },
    { id: 'sinking', label: 'Sinking Funds', icon: <Target size={16} /> },
  ], []);

  const { data: investRes, isLoading: l1 } = useQuery({ queryKey: ['investments'], queryFn: () => fetch('/api/investments').then(r => r.json()) });
  const { data: reRes, isLoading: l2 } = useQuery({ queryKey: ['real-estate'], queryFn: () => fetch('/api/real-estate').then(r => r.json()) });
  const { data: goldRes, isLoading: l3 } = useQuery({ queryKey: ['gold-portfolio'], queryFn: () => fetch('/api/gold-holdings/portfolio').then(r => r.json()) });
  const { data: npsRes, isLoading: l4 } = useQuery({ queryKey: ['nps-projection'], queryFn: () => fetch('/api/nps-projection?currentAge=30&retirementAge=60').then(r => r.json()) });
  const { data: fdRes, isLoading: l5 } = useQuery({ queryKey: ['fd-ladder'], queryFn: () => fetch('/api/fixed-deposits').then(r => r.json()) });
  const { data: sfRes, isLoading: l6 } = useQuery({ queryKey: ['sinking-funds'], queryFn: () => fetch('/api/sinking-funds').then(r => r.json()) });

  const loading = l1 || l2 || l3 || l4 || l5 || l6;

  const summaryData = useMemo(() => {
    // Equity AUM
    const investments = investRes?.data || [];
    const equityValue = investments.reduce((sum, inv) => {
      if (inv.schemeCode && inv.totalUnits) {
          const nav = parseFloat(inv.latestNav);
          if (!isNaN(nav)) return sum + (inv.totalUnits * nav);
      }
      return sum + (Number(parseToPaiseBigInt(inv.currentAmount || '0')) / 100);
    }, 0);

    // Real Estate AUM
    const properties = reRes?.data || [];
    const realEstateValue = properties.reduce((sum, p) => sum + (Number(parseToPaiseBigInt(p.currentMarketValue || p.baseValue || '0')) / 100), 0);

    // Gold AUM
    const goldValue = (Number(goldRes?.totalCurrentValue) || 0);

    // NPS
    const npsValue = Number(npsRes?.totalCurrent) || 0;

    // FD (Including accrued interest)
    const fdValue = (Number(fdRes?.totalInvested) || 0) + (fdRes?.fds || []).reduce((sum, fd) => sum + (Number(fd.interestEarned) || 0), 0);

    // Sinking Funds
    const sfunds = sfRes?.data || [];
    const sinkingValue = sfunds.reduce((sum, f) => sum + (Number(parseToPaiseBigInt(f.currentAmount || '0')) / 100), 0);

    const totalPortfolio = equityValue + realEstateValue + goldValue + npsValue + fdValue + sinkingValue;

    return {
      totalPortfolio,
      equityValue,
      realEstateValue,
      fixedIncomeValue: fdValue + npsValue + sinkingValue,
      goldValue,
    };
  }, [investRes, reRes, goldRes, npsRes, fdRes, sfRes]);

  const handleKeyDown = useCallback((e) => {
    const currentIdx = tabs.findIndex(t => t.id === activeTab);
    let nextIdx = currentIdx;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIdx = (currentIdx + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIdx = (currentIdx - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIdx = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIdx = tabs.length - 1;
    }
    if (nextIdx !== currentIdx) setActiveTab(tabs[nextIdx].id);
  }, [activeTab, tabs]);

  const fmt = (v) => v >= 10000000 ? `₹${(v / 10000000).toFixed(2)} Cr` : v >= 100000 ? `₹${(v / 100000).toFixed(2)} L` : `₹${(v || 0).toLocaleString('en-IN')}`;

  return (
    <div className="wealth-hub animate-fade-in">
      <div className="section-header">
        <div>
          <h2>Wealth Portfolio Hub</h2>
          <p>Consolidated asset terminal — equities, real estate, gold, retirement, and goal-based savings.</p>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="stat-grid" style={{ marginBottom: '28px' }}>
        <div className="stat-card" style={{ '--stat-accent': 'var(--accent-emerald)', '--stat-color': 'var(--accent-emerald)' }}>
          <div className="stat-card-icon"><Gem size={20} /></div>
          <div className="stat-card-label">Total Portfolio</div>
          <div className="stat-card-value">{loading ? '...' : fmt(summaryData?.totalPortfolio)}</div>
          <div className="stat-card-sub">All asset classes</div>
        </div>
        <div className="stat-card" style={{ '--stat-accent': 'var(--accent-sapphire)', '--stat-color': 'var(--accent-sapphire)' }}>
          <div className="stat-card-icon"><TrendingUp size={20} /></div>
          <div className="stat-card-label">Equity AUM</div>
          <div className="stat-card-value">{loading ? '...' : fmt(summaryData?.equityValue)}</div>
          <div className="stat-card-sub">SIPs, Stocks, PPF, EPF</div>
        </div>
        <div className="stat-card" style={{ '--stat-accent': '#f59e0b', '--stat-color': '#f59e0b' }}>
          <div className="stat-card-icon"><Home size={20} /></div>
          <div className="stat-card-label">Real Estate + Gold</div>
          <div className="stat-card-value">{loading ? '...' : fmt((summaryData?.realEstateValue || 0) + (summaryData?.goldValue || 0))}</div>
          <div className="stat-card-sub">Illiquid assets</div>
        </div>
        <div className="stat-card" style={{ '--stat-accent': '#8b5cf6', '--stat-color': '#8b5cf6' }}>
          <div className="stat-card-icon"><ShieldCheck size={20} /></div>
          <div className="stat-card-label">Fixed Income</div>
          <div className="stat-card-value">{loading ? '...' : fmt(summaryData?.fixedIncomeValue)}</div>
          <div className="stat-card-sub">FDs, NPS, Sinking Funds</div>
        </div>
      </div>

      {/* Accessible Tab Bar */}
      <div className="debt-tab-bar" role="tablist" aria-label="Wealth Portfolio Tabs" onKeyDown={handleKeyDown}>
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`debt-tab-btn${activeTab === t.id ? ' active' : ''}`}
            role="tab"
            id={`wealth-tab-${t.id}`}
            aria-selected={activeTab === t.id}
            aria-controls={`wealth-panel-${t.id}`}
            tabIndex={activeTab === t.id ? 0 : -1}
            onClick={() => setActiveTab(t.id)}
          >
            <span className="tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div
        className="tab-contents"
        role="tabpanel"
        id={`wealth-panel-${activeTab}`}
        aria-labelledby={`wealth-tab-${activeTab}`}
      >
        {activeTab === 'equities' && (
          <div>
            <BucketStrategy />
            <Investments />
          </div>
        )}
        {activeTab === 'realestate' && <RealEstate />}
        {activeTab === 'gold' && <GoldTracker />}
        {activeTab === 'nps' && <NPSTracker />}
        {activeTab === 'fd' && <FDLadder />}
        {activeTab === 'sinking' && <SinkingFunds />}
      </div>
    </div>
  );
}

export default WealthHub;
