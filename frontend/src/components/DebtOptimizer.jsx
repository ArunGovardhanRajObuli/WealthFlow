import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Zap, Trophy, TrendingDown, Landmark, Flame, Percent, Rocket, AlertTriangle } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';


ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);



function DebtOptimizer() {
  const { data: debtData, error: debtError } = useQuery({
    queryKey: ['debt-strategy'],
    queryFn: async () => {
      const res = await fetch('/api/debt-strategy');
      if (!res.ok) throw new Error('Failed to load debt strategy.');
      return res.json();
    }
  });

  const { data: loansListData } = useQuery({
    queryKey: ['loans-list'],
    queryFn: async () => {
      const res = await fetch('/api/loans-list');
      if (!res.ok) throw new Error('Failed to load loans list');
      return res.json();
    }
  });

  const loanDetails = loansListData?.data || [];

  // Memoize sorting and calculations to prevent render-loop thrashing
  const memoizedCalculations = useMemo(() => {
    if (!debtData?.data) return { avalancheOrder: [], snowballOrder: [], weightedRate: 0, totalDebt: 0, totalEMI: 0 };
    const d = debtData.data;
    
    const parseNum = (val) => Number(String(val || '0').replace(/,/g, ''));
    let weightSum = 0;
    let tDebt = 0;
    let tEMI = 0;

    const avalanche = [...loanDetails].sort((a, b) => parseNum(b.interestRate) - parseNum(a.interestRate));
    const snowball = [...loanDetails].sort((a, b) => parseNum(a.principalAmount) - parseNum(b.principalAmount));

    loanDetails.forEach(l => {
      const p = parseNum(l.principalAmount);
      const r = parseNum(l.interestRate);
      const e = parseNum(l.amount);
      if (p > 0) {
        tDebt += p;
        tEMI += e;
        if (r > 0) weightSum += (p * r);
      }
    });

    const backendDebt = d.trueOutstandingTotal > 0 ? d.trueOutstandingTotal : tDebt;
    const wRate = backendDebt > 0 ? (weightSum / tDebt) : 0;

    return { avalancheOrder: avalanche, snowballOrder: snowball, weightedRate: wRate, totalDebt: backendDebt, totalEMI: tEMI };
  }, [loanDetails, debtData]);

  const error = debtError?.message;
  const data = debtData || null;

  if (!data) return null;
  if (!data.data) return (
    <div className="animate-fade-in">
      <div className="section-header" style={{marginBottom:'16px'}}>
        <h2 style={{background:'linear-gradient(135deg, #ef4444, #f59e0b)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent'}}>Debt Payoff Optimizer</h2>
      </div>
      <div className="glass-panel">
        <div className="empty-state">
          <div className="empty-state-icon">⚡</div>
          <div className="empty-state-title">No Active Loans Found</div>
          <div className="empty-state-desc">Add loans in the Loan Command Center to unlock Avalanche vs Snowball strategy analysis.</div>
        </div>
      </div>
    </div>
  );

  const d = data.data;
  const isAvalanche = d.winner === 'avalanche';
  const { avalancheOrder, snowballOrder, weightedRate, totalDebt, totalEMI } = memoizedCalculations;

  const monthsDiff = (d.avalanche.months === 'Infinity' || d.snowball.months === 'Infinity') ? 0 : 
    (d.avalanche.months > d.snowball.months ? d.avalanche.months - d.snowball.months : d.snowball.months - d.avalanche.months);

  // Interest savings comparison for savings meter
  const winnerInterest = isAvalanche ? d.avalanche.totalInterest : d.snowball.totalInterest;
  const loserInterest = isAvalanche ? d.snowball.totalInterest : d.avalanche.totalInterest;
  const interestDiff = loserInterest === Infinity ? 0 : Math.max(0, loserInterest - winnerInterest);
  const savingsPercentage = loserInterest > 0 && loserInterest !== Infinity ? ((loserInterest - winnerInterest) / loserInterest * 100) : 0;

  // Total costs (principal + interest)
  const avalancheTotalCost = totalDebt + d.avalanche.totalInterest;
  const snowballTotalCost = totalDebt + d.snowball.totalInterest;

  const maxMonths = d.avalanche.timeline.length > d.snowball.timeline.length ? d.avalanche.timeline.length : d.snowball.timeline.length;
  const longestTimeline = d.avalanche.timeline.length === maxMonths ? d.avalanche.timeline : d.snowball.timeline;

  const chartData = {
    labels: longestTimeline.map(t => `M${t.month}`),
    datasets: [
      { label: 'Avalanche (Highest Rate First)', data: longestTimeline.map((_, i) => d.avalanche.timeline[i]?.totalRemaining ?? 0), borderColor: 'rgba(239, 68, 68, 1)', backgroundColor: 'rgba(239, 68, 68, 0.05)', fill: true, tension: 0.4, pointRadius: 2 },
      { label: 'Snowball (Smallest Balance First)', data: longestTimeline.map((_, i) => d.snowball.timeline[i]?.totalRemaining ?? 0), borderColor: 'rgba(59, 130, 246, 1)', backgroundColor: 'rgba(59, 130, 246, 0.05)', fill: true, tension: 0.4, pointRadius: 2 }
    ]
  };
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } },
    scales: {
      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', callback: v => `₹${(v / 100000).toFixed(1)}L` } },
      x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Section Header */}
      <div className="section-header" style={{marginBottom:'24px'}}>
        <h2 style={{background:'linear-gradient(135deg, #ef4444, #f59e0b)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent'}}>Debt Payoff Optimizer</h2>
        <p>Avalanche vs Snowball — Dual strategy simulation across {d.loanCount} active loan{d.loanCount !== 1 ? 's' : ''}</p>
      </div>

      {/* Error */}
      {error && (
        <div className="alert-banner danger">
          <span style={{fontWeight:600}}>{error}</span>
          <button onClick={(e) => e.currentTarget.parentElement.style.display = 'none'} style={{background:'none',border:'none',color:'#ef4444',cursor:'pointer',marginLeft:'auto'}}>✕</button>
        </div>
      )}

      {/* Debt Trap Alert */}
      {(d.avalanche.isDebtTrap || d.snowball.isDebtTrap) && (
        <div className="alert-banner danger" style={{ marginBottom: '24px', border: '1px solid #ef4444', display: 'flex', gap: '16px', padding: '16px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)' }}>
          <AlertTriangle size={24} color="#ef4444" style={{ flexShrink: 0 }} />
          <div>
            <h4 style={{ margin: '0 0 4px 0', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '1px' }}>Mathematical Debt Trap Detected</h4>
            <p style={{ fontSize: '13px', margin: 0, color: 'var(--text-primary)' }}>
              Your current minimum payments plus free cash flow are <strong>not enough to cover the monthly interest</strong> generated by your loans. Your principal balance will grow infinitely. You must immediately increase your monthly payments or restructure your debt!
            </p>
          </div>
        </div>
      )}

      {/* Debt Snapshot — Stat Cards */}
      <div className="stat-grid">
        <div className="stat-card" style={{'--stat-accent':'#ef4444','--stat-accent-dim':'rgba(239,68,68,0.1)','--stat-color':'#ef4444'}}>
          <div className="stat-card-icon"><Landmark size={18} style={{color:'#ef4444'}} /></div>
          <div className="stat-card-label">Total Debt</div>
          <div className="stat-card-value">₹{Number(totalDebt).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
        </div>
        <div className="stat-card" style={{'--stat-accent':'#f59e0b','--stat-accent-dim':'rgba(245,158,11,0.1)','--stat-color':'#f59e0b'}}>
          <div className="stat-card-icon"><Flame size={18} style={{color:'#f59e0b'}} /></div>
          <div className="stat-card-label">Monthly EMI Burn</div>
          <div className="stat-card-value">₹{totalEMI.toLocaleString('en-IN')}</div>
        </div>
        <div className="stat-card" style={{'--stat-accent':'var(--accent-sapphire)','--stat-accent-dim':'rgba(59,130,246,0.1)'}}>
          <div className="stat-card-icon"><Percent size={18} style={{color:'var(--accent-sapphire)'}} /></div>
          <div className="stat-card-label">Weighted Avg Rate</div>
          <div className="stat-card-value">{weightedRate.toFixed(1)}%</div>
        </div>
        <div className="stat-card" style={{'--stat-accent':'#8b5cf6','--stat-accent-dim':'rgba(139,92,246,0.1)','--stat-color':'#3b82f6'}}>
          <div className="stat-card-icon"><Rocket size={18} style={{color:'#8b5cf6'}} /></div>
          <div className="stat-card-label">Extra Monthly Deploy</div>
          <div className="stat-card-value">₹{d.extraMonthlyPayment.toLocaleString('en-IN')}</div>
        </div>
      </div>

      {/* Winner Banner — Fixed text bug */}
      <div className="glass-panel" style={{ marginBottom: '24px', textAlign: 'center', padding: '28px', background: isAvalanche ? 'rgba(239,68,68,0.06)' : 'rgba(59,130,246,0.06)', border: `1px solid ${isAvalanche ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)'}` }}>
        <Trophy size={32} color={isAvalanche ? '#ef4444' : '#3b82f6'} style={{ marginBottom: '10px' }} />
        <h3 style={{ color: isAvalanche ? '#ef4444' : '#3b82f6', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>
          {d.winner} Wins
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          {(d.avalanche.isDebtTrap || d.snowball.isDebtTrap) ? (
            <span style={{ color: '#ef4444', fontWeight: 600 }}>Both strategies result in a debt trap.</span>
          ) : (
            monthsDiff > 0 
              ? `Saves ${monthsDiff} month${monthsDiff > 1 ? 's' : ''} and ₹${interestDiff.toLocaleString('en-IN')} in interest`
              : `Saves ₹${interestDiff.toLocaleString('en-IN')} in interest`
          )}
        </p>
        <h2 style={{background:'linear-gradient(135deg, #10b981, #3b82f6)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', fontSize: '42px', margin:0}}>₹{interestDiff.toLocaleString('en-IN')}</h2>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>in total interest payments</p>
        
        {/* Savings Meter */}
        {savingsPercentage > 0 && (
          <div style={{marginTop:'16px', maxWidth:'320px', margin:'16px auto 0'}}>
            <div style={{display:'flex', justifyContent:'space-between', fontSize:'10px', color:'var(--text-muted)', marginBottom:'4px'}}>
              <span>Interest Savings</span>
              <span style={{fontWeight:700, color:'#10b981'}}>{savingsPercentage.toFixed(1)}% less interest</span>
            </div>
            <div style={{width:'100%', height:'6px', background:'rgba(255,255,255,0.05)', borderRadius:'3px', overflow:'hidden'}}>
              <div style={{width:`${savingsPercentage > 100 ? 100 : savingsPercentage}%`, height:'100%', background:'linear-gradient(90deg, #10b981, #3b82f6)', borderRadius:'3px', transition:'width 0.6s ease'}}></div>
            </div>
          </div>
        )}
      </div>

      {/* Strategy Cards */}
      <div className="grid-2" style={{ marginBottom: '24px', gap: '20px' }}>
        {/* Avalanche */}
        <div className="glass-panel" style={{ borderLeft: `4px solid ${isAvalanche ? '#ef4444' : 'rgba(255,255,255,0.1)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ margin: 0 }}>⚡ Avalanche</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Highest interest rate first — mathematically optimal</p>
            </div>
            {isAvalanche && <span className="urgency-badge critical" style={{animationDuration:'3s'}}>WINNER</span>}
          </div>
          <div style={{ display: 'flex', gap: '12px', marginBottom:'14px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', flex: 1, textAlign:'center' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', textTransform:'uppercase', letterSpacing:'0.04em' }}>Months to Freedom</span>
              <span style={{ fontSize: '20px', fontWeight: 700 }}>{d.avalanche.months}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', flex: 1, textAlign:'center' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', textTransform:'uppercase', letterSpacing:'0.04em' }}>Total Interest</span>
              <span style={{ fontSize: '20px', fontWeight: 700, color: '#ef4444' }}>₹{d.avalanche.totalInterest.toLocaleString('en-IN')}</span>
            </div>
          </div>
          {/* Total Cost */}
          <div style={{ background: 'rgba(239,68,68,0.04)', padding: '10px 14px', borderRadius: '10px', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', border:'1px solid rgba(239,68,68,0.1)' }}>
            <span style={{fontSize:'11px', color:'var(--text-muted)', fontWeight:600}}>Total Cost (Principal + Interest)</span>
            <span style={{fontSize:'14px', fontWeight:700}}>{d.avalanche.isDebtTrap ? '∞' : `₹${avalancheTotalCost.toLocaleString('en-IN')}`}</span>
          </div>
          {/* Attack Order */}
          <div style={{fontSize:'12px'}}>
            <div style={{fontSize:'11px', color:'var(--text-muted)', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.04em', fontWeight:600}}>Attack Order</div>
            {avalancheOrder.map((l,i) => (
              <div key={l.id} style={{display:'flex', alignItems:'center', gap:'8px', padding:'6px 0', borderBottom: i < avalancheOrder.length-1 ? '1px solid rgba(255,255,255,0.03)' : 'none'}}>
                <span style={{width:'22px', height:'22px', borderRadius:'50%', background:'rgba(239,68,68,0.15)', color:'#ef4444', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', fontWeight:700, flexShrink:0}}>{i+1}</span>
                <span style={{flex:1}}>{l.title}</span>
                <span style={{color:'#ef4444', fontWeight:600}}>{l.interestRate}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Snowball */}
        <div className="glass-panel" style={{ borderLeft: `4px solid ${!isAvalanche ? '#3b82f6' : 'rgba(255,255,255,0.1)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ margin: 0 }}>🎯 Snowball</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Smallest balance first — psychologically rewarding</p>
            </div>
            {!isAvalanche && <span className="urgency-badge info" style={{fontWeight:700}}>WINNER</span>}
          </div>
          <div style={{ display: 'flex', gap: '12px', marginBottom:'14px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', flex: 1, textAlign:'center' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', textTransform:'uppercase', letterSpacing:'0.04em' }}>Months to Freedom</span>
              <span style={{ fontSize: '20px', fontWeight: 700 }}>{d.snowball.months}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', flex: 1, textAlign:'center' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', textTransform:'uppercase', letterSpacing:'0.04em' }}>Total Interest</span>
              <span style={{ fontSize: '20px', fontWeight: 700, color: '#3b82f6' }}>₹{d.snowball.totalInterest.toLocaleString('en-IN')}</span>
            </div>
          </div>
          {/* Total Cost */}
          <div style={{ background: 'rgba(59,130,246,0.04)', padding: '10px 14px', borderRadius: '10px', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', border:'1px solid rgba(59,130,246,0.1)' }}>
            <span style={{fontSize:'11px', color:'var(--text-muted)', fontWeight:600}}>Total Cost (Principal + Interest)</span>
            <span style={{fontSize:'14px', fontWeight:700}}>{d.snowball.isDebtTrap ? '∞' : `₹${snowballTotalCost.toLocaleString('en-IN')}`}</span>
          </div>
          {/* Attack Order */}
          <div style={{fontSize:'12px'}}>
            <div style={{fontSize:'11px', color:'var(--text-muted)', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.04em', fontWeight:600}}>Attack Order</div>
            {snowballOrder.map((l,i) => (
              <div key={l.id} style={{display:'flex', alignItems:'center', gap:'8px', padding:'6px 0', borderBottom: i < snowballOrder.length-1 ? '1px solid rgba(255,255,255,0.03)' : 'none'}}>
                <span style={{width:'22px', height:'22px', borderRadius:'50%', background:'rgba(59,130,246,0.15)', color:'#3b82f6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', fontWeight:700, flexShrink:0}}>{i+1}</span>
                <span style={{flex:1}}>{l.title}</span>
                <span style={{color:'var(--text-muted)', fontWeight:600}}>₹{(l.principalAmount||0).toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payoff Curve Chart */}
      <div className="glass-panel" style={{padding:'24px'}}>
        <h3 style={{ marginBottom: '20px' }}>Remaining Balance Over Time</h3>
        <div style={{ height: '280px' }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
}
export default DebtOptimizer;
