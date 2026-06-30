import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, ShieldAlert, AlertTriangle, HeartPulse } from 'lucide-react';

function EmergencyAdequacy() {
  const { data, error: fetchError } = useQuery({
    queryKey: ['emergency-adequacy'],
    queryFn: async () => {
      const res = await fetch('/api/emergency-adequacy');
      if (!res.ok) throw new Error('Failed to fetch emergency adequacy data');
      return res.json();
    }
  });

  const error = fetchError?.message;

  if (!data) return null;

  const getAdequacyConfig = () => {
    switch (data.adequacy) {
      case 'platinum': return { color: '#a78bfa', label: 'PLATINUM', icon: <ShieldCheck size={56} color="#a78bfa" />, bg: 'rgba(167, 139, 250, 0.1)', border: 'rgba(167, 139, 250, 0.3)', message: 'Fortress-level reserves. You can weather any storm.' };
      case 'gold': return { color: '#f59e0b', label: 'GOLD', icon: <ShieldCheck size={56} color="#f59e0b" />, bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)', message: 'Excellent buffer. You exceed the standard 6-month recommendation.' };
      case 'secure': return { color: 'var(--accent-emerald)', label: 'SECURE', icon: <ShieldCheck size={56} color="#10b981" />, bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.3)', message: 'Meets the industry 6-month standard. Maintain this level.' };
      case 'warning': return { color: '#f59e0b', label: 'WARNING', icon: <AlertTriangle size={56} color="#f59e0b" />, bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)', message: 'Below recommended threshold. Prioritize building reserves.' };
      default: return { color: 'var(--accent-coral)', label: 'CRITICAL', icon: <ShieldAlert size={56} color="#ef4444" />, bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', message: 'Dangerously low reserves. One shock could cause financial collapse.' };
    }
  };

  const config = getAdequacyConfig();
  const ringPct = Math.min(((data.survivalMonths || 0) / 12) * 100, 100);
  const circumference = 2 * Math.PI * 80;
  const strokeDashoffset = circumference - (ringPct / 100) * circumference;

  return (
    <div className="animate-fade-in">
      {error && <div className="alert-banner danger" style={{marginBottom:'20px'}}><AlertTriangle size={16}/> {error}</div>}
      <div className="section-header">
        <div>
          <h2>Emergency Fund Adequacy</h2>
          <p>Survival Capacity Analysis — How long can you last without income?</p>
        </div>
      </div>

      {/* Main Status Ring */}
      <div className="glass-panel" style={{ textAlign: 'center', marginBottom: '40px', padding: '48px 24px', border: `1px solid ${config.border}`, background: config.bg, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: config.color, boxShadow: `0 0 20px ${config.color}` }}></div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px', position: 'relative' }}>
          <svg width="200" height="200" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
            <circle cx="100" cy="100" r="80" fill="none" stroke={config.color} strokeWidth="12"
              strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
              strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
          </svg>
          <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
            <span style={{ fontSize: '48px', fontWeight: 800, color: config.color }}>{data.survivalMonths || 0}</span>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>Months</span>
          </div>
        </div>

        <div style={{ display: 'inline-block', background: config.bg, border: `1px solid ${config.border}`, padding: '6px 20px', borderRadius: '99px', marginBottom: '16px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: config.color, letterSpacing: '2px' }}>{config.label}</span>
        </div>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 16px' }}>{config.message}</p>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', fontSize: '12px', background: 'rgba(255,255,255,0.02)', padding: '8px 16px', borderRadius: '8px', width: 'fit-content', margin: '0 auto' }}>
          <span style={{ color: 'var(--text-muted)' }}>Calculation:</span>
          <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>₹{(data.totalLiquidReserves || 0).toLocaleString('en-IN')} (Liquid)</span>
          <span style={{ color: 'var(--text-muted)' }}>÷</span>
          <span style={{ color: 'var(--accent-coral)', fontWeight: 600 }}>₹{(data.totalMonthlyObligation || 0).toLocaleString('en-IN')} / mo</span>
        </div>
      </div>

      {/* Breakdown Cards */}
      <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <HeartPulse size={20} className="text-coral" />
        Monthly Survival Burn Rate
      </h3>
      <div className="grid-3" style={{ marginBottom: '40px', gap: '24px' }}>
        <div className="glass-panel">
          <span className="form-label" style={{ marginBottom: '16px', display: 'block' }}>Total Monthly Obligation</span>
          <h2 className="text-coral" style={{ fontSize: '36px', marginBottom: '24px' }}>₹{(data.totalMonthlyObligation || 0).toLocaleString('en-IN')}</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Avg Monthly Expenses</span>
              <span style={{ fontWeight: 600 }}>₹{((data.breakdown || {}).avgExpense || 0).toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Loan EMIs</span>
              <span style={{ fontWeight: 600 }}>₹{((data.breakdown || {}).emi || 0).toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Insurance Premiums</span>
              <span style={{ fontWeight: 600 }}>₹{((data.breakdown || {}).insurance || 0).toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Subscriptions</span>
              <span style={{ fontWeight: 600 }}>₹{((data.breakdown || {}).subscriptions || 0).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="form-label" style={{ marginBottom: '16px', display: 'block' }}>Total Liquid Reserves</span>
          <h2 className="text-emerald" style={{ fontSize: '36px', marginBottom: '24px' }}>₹{(data.totalLiquidReserves || 0).toLocaleString('en-IN')}</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Bank & Cash</span>
              <span style={{ fontWeight: 600 }}>₹{((data.reservesBreakdown || {}).freeCash || 0).toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Debt Funds</span>
              <span style={{ fontWeight: 600 }}>₹{((data.reservesBreakdown || {}).debtFundsAmount || 0).toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Liquid FDs</span>
              <span style={{ fontWeight: 600 }}>₹{((data.reservesBreakdown || {}).liquidFdValue || 0).toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Less: CC & Matured Debt</span>
              <span style={{ fontWeight: 600, color: 'var(--text-coral)' }}>- ₹{(((data.reservesBreakdown || {}).ccDebt || 0) + ((data.reservesBreakdown || {}).maturedDebt || 0)).toLocaleString('en-IN')}</span>
            </div>
          </div>

          {(data.targetGap || 0) > 0 && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(239, 68, 68, 0.2)', marginTop: 'auto' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Gap to 6-Month Safety</p>
              <h3 className="text-coral" style={{ fontSize: '28px', margin: 0 }}>₹{(data.targetGap || 0).toLocaleString('en-IN')}</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>You need this much more in liquid reserves to hit the recommended 6-month survival buffer.</p>
            </div>
          )}
          {(data.targetGap || 0) === 0 && (
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.2)', marginTop: 'auto' }}>
              <p style={{ fontSize: '14px', color: 'var(--accent-emerald)', fontWeight: 600 }}>✅ 6-Month Target Achieved</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Your liquid reserves fully cover the recommended emergency buffer.</p>
            </div>
          )}
        </div>

        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="form-label" style={{ marginBottom: '16px', display: 'block' }}>Illiquid / Breakable Reserves</span>
          <h2 className="text-emerald" style={{ fontSize: '36px', marginBottom: '24px' }}>₹{(data.breakableReserves || 0).toLocaleString('en-IN')}</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Physical Gold</span>
              <span style={{ fontWeight: 600 }}>₹{((data.illiquidBreakdown || {}).liquidGoldTotal || 0).toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>SGB (50% Haircut)</span>
              <span style={{ fontWeight: 600 }}>₹{((data.illiquidBreakdown || {}).sgbHaircut || 0).toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Endowments (50%)</span>
              <span style={{ fontWeight: 600 }}>₹{((data.illiquidBreakdown || {}).endowmentHaircut || 0).toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Equity (50% Haircut)</span>
              <span style={{ fontWeight: 600 }}>₹{((data.illiquidBreakdown || {}).equityHaircut || 0).toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>EPF & Sinking Funds</span>
              <span style={{ fontWeight: 600 }}>₹{(((data.illiquidBreakdown || {}).epfBreakable || 0) + ((data.illiquidBreakdown || {}).liquidSinking || 0)).toLocaleString('en-IN')}</span>
            </div>
          </div>
          
          <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)', marginTop: 'auto' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>These are assets you can liquidate in an extreme emergency, but with delays, penalties, or heavy price fluctuations.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmergencyAdequacy;
