// eslint-disable-next-line no-unused-vars
import React, { useState, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  LayoutDashboard, WalletCards, ShieldAlert, Settings, Plus,
  Briefcase, Shield, Brain, Gem, Wallet, TrendingUp, TrendingDown, CheckCircle,
  Calendar
} from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler } from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';
import { motion, AnimatePresence } from 'framer-motion';

import AuthLock from './components/AuthLock';

const AlertModal = React.lazy(() => import('./components/AlertModal'));
const TransactionModal = React.lazy(() => import('./components/TransactionModal'));
const Ledger = React.lazy(() => import('./components/Ledger'));
const Sentinel = React.lazy(() => import('./components/Sentinel'));
const WealthHub = React.lazy(() => import('./components/WealthHub'));
const DebtHub = React.lazy(() => import('./components/DebtHub'));
const ProtectionHub = React.lazy(() => import('./components/ProtectionHub'));
const AnalyticsEngine = React.lazy(() => import('./components/AnalyticsEngine'));
const SettingsView = React.lazy(() => import('./components/Settings'));
const SystemSentinelBanner = React.lazy(() => import('./components/SystemSentinelBanner'));
const AssetCategories = React.lazy(() => import('./components/AssetCategories'));

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler);

/* ── Chart.js global dark-mode defaults ── */
ChartJS.defaults.color = '#a4a9c6';
ChartJS.defaults.font.family = "'Outfit', sans-serif";
ChartJS.defaults.borderColor = 'rgba(130, 140, 220, 0.04)';
ChartJS.defaults.plugins.legend.labels.usePointStyle = true;
ChartJS.defaults.plugins.legend.labels.pointStyleWidth = 8;
ChartJS.defaults.plugins.legend.labels.padding = 16;
ChartJS.defaults.plugins.tooltip.backgroundColor = 'rgba(10, 11, 20, 0.95)';
ChartJS.defaults.plugins.tooltip.borderColor = 'rgba(130, 140, 220, 0.1)';
ChartJS.defaults.plugins.tooltip.borderWidth = 1;
ChartJS.defaults.plugins.tooltip.cornerRadius = 16;
ChartJS.defaults.plugins.tooltip.padding = 16;
ChartJS.defaults.plugins.tooltip.titleFont = { family: "'Outfit', sans-serif", weight: '600', size: 13 };
ChartJS.defaults.plugins.tooltip.bodyFont = { family: "'Outfit', sans-serif", size: 13 };
ChartJS.defaults.interaction = { mode: 'index', intersect: false };

const listContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};
const listItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 25 } }
};

/* ── Page transition spring ── */
const pageTransition = {
  initial: { opacity: 0, y: 16, scale: 0.99 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -12, scale: 0.99 },
  transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }
};

/* ── Date greeting helper ── */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate() {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/* ═══════════════════════════════════════════
   DASHBOARD VIEW
   ═══════════════════════════════════════════ */
// eslint-disable-next-line no-unused-vars
function DashboardView({ summaryPeriod, setSummaryPeriod, setIsModalOpen }) {
  const queryClient = useQueryClient();
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['summary', summaryPeriod],
    queryFn: () => fetch(`/api/summary?period=${summaryPeriod}`).then(res => res.json())
  });
  const summary = summaryData?.data || [];

  const { data: netWorthData, isLoading: nwLoading } = useQuery({
    queryKey: ['netWorth'],
    queryFn: () => fetch('/api/net-worth').then(res => res.json())
  });
  const netWorthHistory = netWorthData?.data || [];

  // eslint-disable-next-line no-unused-vars
  const { data: liquidity, isLoading: liqLoading } = useQuery({
    queryKey: ['liquidity'],
    queryFn: () => fetch('/api/liquidity').then(res => res.json())
  });

  const { data: upcoming, isLoading: upcomingLoading } = useQuery({
    queryKey: ['upcoming'],
    queryFn: async () => {
      const [remsRes, cardsRes] = await Promise.allSettled([
        fetch('/api/reminders').then(r => r.ok ? r.json() : { data: [] }),
        fetch('/api/credit-cards').then(r => r.ok ? r.json() : { data: [] })
      ]);

      const rems = remsRes.status === 'fulfilled' ? remsRes.value : { data: [] };
      const cards = cardsRes.status === 'fulfilled' ? cardsRes.value : { data: [] };
      
      const items = [];
      const now = new Date();
      const nowTime = now.getTime();
      now.setHours(0,0,0,0);
      if (rems.data) {
          rems.data.forEach(r => {
              let nextD = new Date(r.dueDate);
              if (r.frequency === 'yearly') while (nextD < now) nextD.setFullYear(nextD.getFullYear() + 1);
              else if (r.frequency === 'quarterly') while (nextD < now) nextD.setMonth(nextD.getMonth() + 3);
              else if (r.frequency === 'monthly') while (nextD < now) nextD.setMonth(nextD.getMonth() + 1);
              const days = Math.ceil((nextD.getTime() - nowTime)/(1000*3600*24));
              items.push({ id: `rem_${r.id}`, title: r.title, amount: r.amount, days, type: r.category });
          });
      }
      if (cards.data) {
          cards.data.forEach(c => {
              let nextD = new Date(c.dueDate);
              while (nextD < now) nextD.setMonth(nextD.getMonth() + 1);
              const days = Math.ceil((nextD.getTime() - nowTime)/(1000*3600*24));
              if (c.currentBalance > 0) items.push({ id: `cc_${c.id}`, title: `${c.name} Statement`, amount: c.currentBalance, days, type: 'credit' });
          });
      }
      items.sort((a,b) => a.days - b.days);
      return items.filter(i => i.days >= -5 && i.days <= 14).slice(0, 4);
    }
  });

  const formatCurrency = (val) => {
    if (val === undefined || val === null) return '₹0';
    const num = Number(val);
    const sign = num < 0 ? '-' : '';
    return `${sign}₹${Math.abs(num).toLocaleString('en-IN', {maximumFractionDigits: 0})}`;
  };

  const totalIncome = summary.find(s => s.type === 'income')?.total || 0;
  const totalExpense = summary.find(s => s.type === 'expense')?.total || 0;
  const netCashFlow = totalIncome - totalExpense;
  
  const currentNetWorth = liquidity ? (() => {
    const freeCash = liquidity.freeLiquidity || 0;
    const totalAssets = freeCash + (liquidity.sinking || 0) + (liquidity.endow || 0) + (liquidity.invest || 0) + (liquidity.realEstate || 0) + (liquidity.goldValue || 0) + (liquidity.fdPrincipal || 0) + (liquidity.npsValue || 0);
    const outstandingLoans = Math.max(0, (liquidity.loanPrincipal || 0));
    const totalLiabilities = outstandingLoans + (liquidity.ccBalance || 0);
    return totalAssets - totalLiabilities;
  })() : 0;

  const lockSnapshotMut = useMutation({
    mutationFn: () => fetch('/api/net-worth/snapshot', {method:'POST'}),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ['netWorth']})
  });

  const doughnutData = {
    labels: ['Expenses', 'Free Cash flow'],
    datasets: [{
      data: [totalExpense, Math.max(0, netCashFlow)],
      backgroundColor: ['rgba(244, 63, 94, 0.85)', 'rgba(52, 211, 153, 0.85)'],
      borderWidth: 0,
      hoverOffset: 6,
      borderRadius: 4
    }]
  };

  const lineData = {
    labels: netWorthHistory.map(n => n.snapshotDate).concat(['Current']),
    datasets: [{
      label: 'Net Worth',
      data: netWorthHistory.map(n => n.assets - n.liabilities).concat([Math.round(currentNetWorth)]),
      borderColor: 'rgba(97, 150, 255, 1)',
      backgroundColor: (ctx) => {
        if (!ctx.chart.chartArea) return 'rgba(97, 150, 255, 0.1)';
        const gradient = ctx.chart.ctx.createLinearGradient(0, ctx.chart.chartArea.top, 0, ctx.chart.chartArea.bottom);
        gradient.addColorStop(0, 'rgba(97, 150, 255, 0.15)');
        gradient.addColorStop(1, 'rgba(97, 150, 255, 0.01)');
        return gradient;
      },
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointHoverRadius: 7,
      pointBackgroundColor: 'rgba(97, 150, 255, 1)',
      pointBorderColor: '#050510',
      pointBorderWidth: 2,
      borderWidth: 2.5
    }]
  };

  return (
    <motion.div key="dashboard" {...pageTransition}>
      {/* Section header + period selector */}
      <div className="section-header">
        <div>
          <h2>Financial Overview</h2>
          <p>Cash flow and net worth trajectory across your portfolio.</p>
        </div>
        <select 
          value={summaryPeriod} 
          onChange={e => setSummaryPeriod(e.target.value)}
          className="field-input"
          style={{
            width: 'auto',
            background: 'var(--surface-input)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '10px 16px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)'
          }}
        >
          <option value="mtd">Month to Date</option>
          <option value="qtd">Quarter to Date</option>
          <option value="ytd">Year to Date</option>
          <option value="fy">Financial Year</option>
          <option value="all">All Time</option>
        </select>
      </div>
      
      {/* KPI Stat Cards */}
      <div className="stat-grid">
        <div className="stat-card" style={{'--stat-accent':'var(--accent-sapphire)','--stat-accent-dim':'var(--accent-sapphire-dim)','--stat-color':'var(--text-primary)'}}>
          <div className="stat-card-icon"><Wallet size={20} style={{color:'var(--accent-sapphire)'}}/></div>
          <div className="stat-card-label">Net Cash Flow</div>
          <div className="stat-card-value">
            {summaryLoading ? <div className="skeleton skeleton-text" style={{width:'80%', height:'28px', marginTop:'4px'}}/> : formatCurrency(netCashFlow)}
          </div>
        </div>
        <div className="stat-card" style={{'--stat-accent':'var(--accent-emerald)','--stat-accent-dim':'var(--accent-emerald-dim)','--stat-color':'var(--accent-emerald)'}}>
          <div className="stat-card-icon"><TrendingUp size={20} style={{color:'var(--accent-emerald)'}}/></div>
          <div className="stat-card-label">Total Income</div>
          <div className="stat-card-value">
            {summaryLoading ? <div className="skeleton skeleton-text" style={{width:'80%', height:'28px', marginTop:'4px'}}/> : formatCurrency(totalIncome)}
          </div>
        </div>
        <div className="stat-card" style={{'--stat-accent':'var(--accent-coral)','--stat-accent-dim':'var(--accent-coral-dim)','--stat-color':'var(--accent-coral)'}}>
          <div className="stat-card-icon"><TrendingDown size={20} style={{color:'var(--accent-coral)'}}/></div>
          <div className="stat-card-label">Total Expenses</div>
          <div className="stat-card-value">
            {summaryLoading ? <div className="skeleton skeleton-text" style={{width:'80%', height:'28px', marginTop:'4px'}}/> : formatCurrency(totalExpense)}
          </div>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginBottom: '24px', alignItems: 'stretch' }}>
        {/* Asset Categories Breakdown */}
        <AssetCategories />

        {/* Upcoming Payments */}
        <div className="glass-panel hover-pop-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>Upcoming Payments & Reminders</h3>
        </div>
        {upcomingLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{height:'60px', borderRadius:'var(--radius-md)'}}/>)}
          </div>
        ) : (!upcoming || upcoming.length === 0) ? (
          <div style={{ textAlign:'center', padding:'24px 16px', color:'var(--text-muted)' }}>
            <CheckCircle size={36} style={{color:'var(--accent-emerald)',opacity:0.5,marginBottom:'10px'}}/>
            <div style={{ fontSize:'14px', fontWeight:600, color:'var(--text-secondary)', marginBottom:'4px' }}>All clear!</div>
            <div style={{ fontSize:'12px' }}>No payments due in the next 14 days</div>
          </div>
        ) : (
          <motion.div variants={listContainer} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {upcoming.map(item => (
              <motion.div variants={listItem} key={item.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 18px',
                background: 'rgba(160, 160, 220, 0.02)',
                borderRadius: 'var(--radius-md)',
                borderLeft: `3px solid ${item.days < 0 ? 'var(--accent-coral)' : (item.days <= 3 ? 'var(--accent-amber)' : 'var(--border-color)')}`,
                transition: 'background 0.2s'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <h4 style={{ fontSize: '14px', margin: 0, fontWeight: 600 }}>{item.title}</h4>
                    <span className={`urgency-badge ${item.days < 0 ? 'critical' : item.days === 0 ? 'warning' : 'info'}`}>
                        {item.days < 0 ? 'Overdue!' : (item.days === 0 ? 'Due Today' : `Due in ${item.days} days`)}
                    </span>
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: '15px', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(item.amount)}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
      </div>

      {/* Charts Grid */}
      <div className="grid-3" style={{ gap: '24px' }}>
        <div className="glass-panel" style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3>Net Worth Trajectory</h3>
            <button
              className="btn btn-ghost"
              style={{ fontSize: '12px', padding: '7px 14px' }}
              onClick={() => lockSnapshotMut.mutate()}
              disabled={lockSnapshotMut.isPending}
            >
              {lockSnapshotMut.isPending ? 'Locking...' : 'Lock Snapshot'}
            </button>
          </div>
          <div style={{ height: '240px' }}>
            {nwLoading ? (
              <div className="skeleton skeleton-chart" style={{height:'100%'}}/>
            ) : (
              <Line data={lineData} options={{
                maintainAspectRatio: false,
                scales: {
                  x: { grid: { color: 'rgba(160, 160, 220, 0.04)' }, ticks: { font: { size: 11 } } },
                  y: { grid: { color: 'rgba(160, 160, 220, 0.04)' }, ticks: { font: { size: 11 } } }
                }
              }} />
            )}
          </div>
        </div>
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '24px' }}>Cash Flow</h3>
          <div style={{ height: '200px', flex: 1 }}>
            {summaryLoading ? (
              <div className="skeleton skeleton-chart" style={{height:'100%', borderRadius:'50%', width:'200px', margin:'0 auto'}}/>
            ) : (totalIncome === 0 && totalExpense === 0)
              ? <p style={{color:'var(--text-muted)', textAlign:'center', marginTop:'40px'}}>No data for this period</p>
              : <Doughnut data={doughnutData} options={{
                  maintainAspectRatio: false,
                  cutout: '72%',
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: { padding: 20, font: { size: 12 } }
                    }
                  }
                }} />
            }
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   APP SHELL
   ═══════════════════════════════════════════ */
function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  
  const [isLocked, setIsLocked] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [summaryPeriod, setSummaryPeriod] = useState('ytd');
  const [globalAlert, setGlobalAlert] = useState({ isOpen: false, message: '' });

  React.useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (message) => {
      setGlobalAlert({ isOpen: true, message: String(message) });
    };
    return () => {
      window.alert = originalAlert;
    };
  }, []);

  if (isLocked) {
    return <AuthLock onUnlock={() => setIsLocked(false)} />;
  }

  const mainNavItems = [
    { id: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: '/ledger', label: 'Ledger', icon: <WalletCards size={18} /> },
    { id: '/wealth', label: 'Wealth Portfolio', icon: <Gem size={18} /> },
    { id: '/debt', label: 'Debt & Obligations', icon: <Briefcase size={18} /> },
    { id: '/protection', label: 'Protection & Estate', icon: <Shield size={18} /> },
    { id: '/analytics', label: 'Analytics Engine', icon: <Brain size={18} /> }
  ];

  const handleTransactionSuccess = () => { 
    setIsModalOpen(false); 
    queryClient.invalidateQueries(); 
    setRefreshTrigger(p => p + 1); 
  };

  const isActive = (id) => location.pathname === id || (location.pathname === '/' && id === '/dashboard');

  return (
    <div className="app-container">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        {/* Brand */}
        <div style={{ paddingBottom: '4px' }}>
          <h2 className="text-gradient" style={{ fontSize: '22px', letterSpacing: '-0.04em', marginBottom: '4px' }}>
            WealthFlow
          </h2>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.02em' }}>
            Financial Assistant
          </p>
        </div>
        
        {/* Divider */}
        <div className="divider" style={{ margin: '0' }} />

        {/* Main Nav */}
        <nav className="sidebar-nav">
          {mainNavItems.map(item => (
            <motion.div 
              key={item.id} 
              className={`nav-item ${isActive(item.id) ? 'active' : ''}`} 
              onClick={() => navigate(item.id)}
              whileHover={{ x: 3 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.15 }}
            >
              {item.icon}
              <span>{item.label}</span>
            </motion.div>
          ))}
        </nav>
        
        {/* Bottom Section */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div className="divider" style={{ margin: '0 0 8px 0' }} />
          <motion.div 
            className={`nav-item ${location.pathname === '/sentinel' ? 'active' : ''}`} 
            onClick={() => navigate('/sentinel')} 
            whileHover={{ x: 3 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.15 }}
          >
            <ShieldAlert size={18} className="text-coral" />
            <span>Sentinel</span>
          </motion.div>
          <motion.div 
            className={`nav-item ${location.pathname.includes('/settings') ? 'active' : ''}`}
            whileHover={{ x: 3 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.15 }}
            onClick={() => navigate('/settings')}
          >
            <Settings size={18} />
            <span>Settings</span>
          </motion.div>
        </div>
      </aside>

      <main className="main-content">
        {/* Decorative gradient blobs — these get blurred by glass panels */}
        <div className="ambient-orbs" aria-hidden="true">
          <div className="orb orb-blue" />
          <div className="orb orb-purple" />
          <div className="orb orb-emerald" />
          <div className="orb orb-coral" />
        </div>
        
        <React.Suspense fallback={null}>
          <SystemSentinelBanner />
        </React.Suspense>
        
        {/* Header */}
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '36px'
        }}>
          <div>
            <h1 className="text-gradient" style={{ fontSize: '26px', marginBottom: '4px' }}>
              {getGreeting()}
            </h1>
            <p style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Calendar size={14} />
              {formatDate()}
            </p>
          </div>
          <motion.button 
            className="btn btn-primary" 
            onClick={() => setIsModalOpen(true)}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
          >
            <Plus size={18} /> New Transaction
          </motion.button>
        </header>

        {/* Routes */}
        <React.Suspense fallback={<div style={{ padding: '24px', color: 'var(--text-muted)' }}>Loading module...</div>}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardView summaryPeriod={summaryPeriod} setSummaryPeriod={setSummaryPeriod} />} />
              <Route path="/ledger" element={<motion.div key="ledger" {...pageTransition}><Ledger /></motion.div>} />
              <Route path="/wealth" element={<motion.div key="wealth" {...pageTransition}><WealthHub /></motion.div>} />
              <Route path="/debt" element={<motion.div key="debt" {...pageTransition}><DebtHub /></motion.div>} />
              <Route path="/protection" element={<motion.div key="protection" {...pageTransition}><ProtectionHub /></motion.div>} />
              <Route path="/analytics" element={<motion.div key="analytics" {...pageTransition}><AnalyticsEngine /></motion.div>} />
              <Route path="/sentinel" element={<motion.div key="sentinel" {...pageTransition}><Sentinel /></motion.div>} />
              <Route path="/settings" element={<motion.div key="settings" {...pageTransition}><SettingsView /></motion.div>} />
            </Routes>
          </AnimatePresence>
        </React.Suspense>
      </main>
      <React.Suspense fallback={null}>
        <TransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={handleTransactionSuccess} />
        <AlertModal isOpen={globalAlert.isOpen} message={globalAlert.message} onClose={() => setGlobalAlert({ ...globalAlert, isOpen: false })} />
      </React.Suspense>
    </div>
  );
}

export default App;
