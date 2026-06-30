import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAmortizationEngine } from '../hooks/useAmortizationEngine';
import { parseToPaiseBigInt } from '../utils/bigIntMath';
import {
  Repeat, Landmark, CreditCard, Zap, Calculator,
  Wallet, CalendarClock, CreditCard as CardIcon, Flame, AlertTriangle
} from 'lucide-react';
import Loans from './Loans';
import CreditCards from './CreditCards';
import DebtOptimizer from './DebtOptimizer';
import EMIModeler from './EMIModeler';
import Subscriptions from './Subscriptions';

const EMPTY_ARRAY = [];

function DebtHub() {
  const [activeTab, setActiveTab] = useState('loans');
  const { data: remRes, isLoading: l1, isError: e1 } = useQuery({ queryKey: ['reminders'], queryFn: () => fetch('/api/reminders').then(r => { if (!r.ok) throw new Error('API Error'); if (r.status === 204) return { data: [] }; return r.json(); }) });
  const { data: ccRes, isLoading: l2, isError: e2 } = useQuery({ queryKey: ['credit-cards'], queryFn: () => fetch('/api/credit-cards').then(r => { if (!r.ok) throw new Error('API Error'); if (r.status === 204) return { data: [] }; return r.json(); }) });
  const { data: payRes, isLoading: l3, isError: e3 } = useQuery({ queryKey: ['loan-payments'], queryFn: () => fetch('/api/loan-payments').then(r => { if (!r.ok) throw new Error('API Error'); if (r.status === 204) return { data: [] }; return r.json(); }) });
  const { data: loansRes, isLoading: l4, isError: e4 } = useQuery({ queryKey: ['loans-list'], queryFn: () => fetch('/api/loans-list').then(r => { if (!r.ok) throw new Error('API Error'); if (r.status === 204) return { data: [] }; return r.json(); }) });

  const loading = l1 || l2 || l3 || l4;
  const isError = e1 || e2 || e3 || e4;

  const topLevelLoans = useMemo(() => loansRes?.data || EMPTY_ARRAY, [loansRes]);
  const engineData = useAmortizationEngine(topLevelLoans, payRes?.data || EMPTY_ARRAY);
  const { metricsPaise: amMetricsPaise } = engineData;
  const summaryData = useMemo(() => {
    if (!remRes?.data || !ccRes?.data || !loansRes?.data) return null;

    const reminders = remRes.data || [];
    const cards = ccRes.data || [];
    const loans = loansRes.data || [];

    // totalDebtPaise and monthlyEMIPaise are now calculated from the hook output outside useMemo
    const totalDebtPaise = amMetricsPaise?.totalOutPaise || 0n;
    const monthlyEMIPaise = amMetricsPaise?.totalEMIPaise || 0n;

    // Credit cards
    const cardsOutstandingPaise = cards.reduce((s, c) => s + parseToPaiseBigInt(c.currentBalance), 0n);

    // Subscriptions
    const subs = reminders.filter(r => r.category === 'subscription');
    let subMonthlyPaise = 0n;
    subs.forEach(s => {
      const amtPaise = parseToPaiseBigInt(s.amount);
      if (s.frequency === 'monthly') subMonthlyPaise += amtPaise;
      else if (s.frequency === 'quarterly') subMonthlyPaise += (amtPaise / 3n);
      else if (s.frequency === 'yearly') subMonthlyPaise += (amtPaise / 12n);
      else if (s.frequency === 'weekly') subMonthlyPaise += (amtPaise * 52n) / 12n;
      else if (s.frequency === 'daily') subMonthlyPaise += (amtPaise * 365n) / 12n;
      else if (s.frequency === 'half-yearly') subMonthlyPaise += (amtPaise / 6n);
      else subMonthlyPaise += amtPaise; // Fallback for unrecognized frequencies to prevent phantom burn
    });
    
    return {
      totalDebtPaise: totalDebtPaise + cardsOutstandingPaise,
      monthlyObligationsPaise: monthlyEMIPaise + subMonthlyPaise,
      cardsOutstandingPaise: cardsOutstandingPaise,
      subscriptionBurnPaise: subMonthlyPaise,
      loanCount: loans.length,
      cardCount: cards.length,
      subCount: subs.length,
    };
  }, [remRes, ccRes, loansRes, amMetricsPaise]);

  const tabs = useMemo(() => [
    { id: 'loans',         label: 'Loan Portfolio',  icon: Landmark },
    { id: 'cards',         label: 'Credit Cards',    icon: CreditCard },
    { id: 'subscriptions', label: 'Subscriptions',   icon: Repeat },
    { id: 'optimizer',     label: 'Debt Optimizer',  icon: Zap },
    { id: 'emi',           label: 'EMI Modeler',     icon: Calculator },
  ], []);
  const handleTabKey = useCallback((e, idx) => {
    let nextIdx;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + tabs.length) % tabs.length;
    else return;
    e.preventDefault();
    setActiveTab(tabs[nextIdx].id);
    // Focus the next tab button
    const nextBtn = e.currentTarget.parentElement.children[nextIdx];
    if (nextBtn) nextBtn.focus();
  }, [tabs]);

  const formatCurrency = useCallback((paiseVal) => {
      const absPaise = paiseVal < 0n ? -paiseVal : paiseVal;
      const wholeBigInt = absPaise / 100n;
      const fractionStr = (absPaise % 100n).toString().padStart(2, '0');
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
      return `₹${paiseVal < 0n ? '-' : ''}${result}.${fractionStr}`;
  }, []);

  const kpiCards = useMemo(() => {
    if (!summaryData) return [];
    return [
      {
        label: 'Total Debt Exposure',
        value: formatCurrency(summaryData.totalDebtPaise),
        sub: `${summaryData.loanCount} loan${summaryData.loanCount !== 1 ? 's' : ''} + ${summaryData.cardCount} card${summaryData.cardCount !== 1 ? 's' : ''}`,
        accent: 'var(--accent-coral)',
        accentDim: 'var(--accent-coral-dim)',
        color: 'var(--accent-coral)',
        Icon: Wallet,
      },
      {
        label: 'Monthly Obligations',
        value: formatCurrency(summaryData.monthlyObligationsPaise),
        sub: 'EMIs + subscriptions',
        accent: '#f59e0b',
        accentDim: 'rgba(245,158,11,0.1)',
        color: '#f59e0b',
        Icon: CalendarClock,
      },
      {
        label: 'Cards Outstanding',
        value: formatCurrency(summaryData.cardsOutstandingPaise),
        sub: `${summaryData.cardCount} active card${summaryData.cardCount !== 1 ? 's' : ''}`,
        accent: 'var(--accent-purple)',
        accentDim: 'rgba(139,92,246,0.1)',
        color: 'var(--accent-purple)',
        Icon: CardIcon,
      },
      {
        label: 'Subscription Burn',
        value: formatCurrency(summaryData.subscriptionBurnPaise),
        sub: `${summaryData.subCount} active service${summaryData.subCount !== 1 ? 's' : ''}/mo`,
        accent: 'var(--accent-sapphire)',
        accentDim: 'var(--accent-sapphire-dim)',
        color: 'var(--accent-sapphire)',
        Icon: Flame,
      },
    ];
  }, [summaryData, formatCurrency]);

  return (
    <div className="debt-hub animate-fade-in">
      {/* ── Section Header ── */}
      <div className="section-header">
        <h2>Liabilities &amp; Debt Hub</h2>
        <p>Manage loans, track credit utilization, and optimize payoffs.</p>
      </div>

      {isError && (
        <div className="alert-banner danger" role="alert" style={{ marginBottom: '24px' }}>
          <AlertTriangle size={24} />
          <div style={{ marginLeft: '12px' }}>
            <h3 style={{ margin: 0 }}>Partial System Outage</h3>
            <p style={{ margin: '4px 0 0' }}>Some debt data failed to load. Displayed metrics may be incomplete.</p>
          </div>
        </div>
      )}

      {/* ── Summary KPI Strip ── */}
      {!loading && summaryData && (
        <div className="stat-grid animate-slide-in" role="region" aria-label="Debt summary">
          {kpiCards.map((kpi) => (
            <div
              key={kpi.label}
              className="stat-card"
              style={{
                '--stat-accent': kpi.accent,
                '--stat-accent-dim': kpi.accentDim,
                '--stat-color': kpi.color,
              }}
            >
              <div className="stat-card-icon">
                <kpi.Icon size={18} style={{ color: kpi.accent }} />
              </div>
              <div className="stat-card-label">{kpi.label}</div>
              <div className="stat-card-value">{kpi.value}</div>
              <div className="stat-card-sub">{kpi.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tab Bar ── */}
      <div
        className="debt-tab-bar"
        role="tablist"
        aria-label="Debt hub sections"
        style={{ marginBottom: '24px' }}
      >
        {tabs.map((t, idx) => {
          const TabIcon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              id={`debt-tab-${t.id}`}
              aria-selected={isActive}
              aria-controls={`debt-panel-${t.id}`}
              tabIndex={isActive ? 0 : -1}
              className={`debt-tab-btn${isActive ? ' active' : ''}`}
              onClick={() => setActiveTab(t.id)}
              onKeyDown={(e) => handleTabKey(e, idx)}
            >
              <TabIcon size={15} className="tab-icon" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Panels ── */}
      <div
        id={`debt-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`debt-tab-${activeTab}`}
        className="tab-contents"
      >
        {activeTab === 'loans' && <Loans engineData={engineData} />}
        {activeTab === 'cards' && <CreditCards />}
        {activeTab === 'subscriptions' && <Subscriptions />}
        {activeTab === 'optimizer' && <DebtOptimizer />}
        {activeTab === 'emi' && <EMIModeler />}
      </div>
    </div>
  );
}

export default DebtHub;
