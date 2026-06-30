import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ShieldAlert, Zap, HeartPulse, TrendingUp, Home, BarChart3 } from 'lucide-react';

const SCENARIOS = [
  { id: 'job_loss', label: 'Job Loss', icon: Zap, color: '#ef4444', desc: 'Complete income disruption' },
  { id: 'medical_emergency', label: 'Medical Emergency', icon: HeartPulse, color: '#f59e0b', desc: 'Major unexpected medical expense' },
  { id: 'rate_hike', label: 'EMI Rate Hike', icon: TrendingUp, color: '#8b5cf6', desc: 'Interest rates increase on all loans' },
  { id: 'tenant_default', label: 'Tenant Default', icon: Home, color: '#3b82f6', desc: 'Rental income stops completely' },
  { id: 'market_crash', label: 'Market Crash', icon: BarChart3, color: '#ec4899', desc: '30%+ portfolio value destruction' },
];

function StressTest() {
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [duration, setDuration] = useState(6);
  const [severity, setSeverity] = useState(100);
  const [localDuration, setLocalDuration] = useState(6);
  const [localSeverity, setLocalSeverity] = useState(100);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDuration(localDuration);
      setSeverity(localSeverity);
    }, 400);
    return () => clearTimeout(handler);
  }, [localDuration, localSeverity]);

  const stressTestMutation = useMutation({
    mutationFn: async (scenarioId) => {
      const res = await fetch('/api/stress-test', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: scenarioId, duration, severity })
      });
      if (!res.ok) throw new Error('Simulation failed');
      return res.json();
    }
  });

  const runTest = (scenarioId) => {
    setSelectedScenario(scenarioId);
    stressTestMutation.mutate(scenarioId);
  };

  React.useEffect(() => {
    if (selectedScenario) {
      stressTestMutation.mutate(selectedScenario);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, severity]);

  const loading = stressTestMutation.isPending;
  const result = stressTestMutation.data;

  return (
    <div className="animate-fade-in">
      <div className="section-header">
        <div>
          <h2>Financial Stress Test Simulator</h2>
          <p>How long can your system survive a catastrophic shock?</p>
        </div>
      </div>

      {/* Controls */}
      <div className="glass-panel" style={{ marginBottom: '24px' }}>
        <div className="grid-2" style={{ gap: '24px', marginBottom: '20px' }}>
          <div className="field-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              Shock Duration (months)
              <span title="How long the financial shock will last. Advisors recommend planning for at least 3-6 months." style={{ cursor: 'help', color: 'var(--text-muted)', fontSize: '12px' }}>ⓘ</span>
            </label>
            <input type="range" min="1" max="24" value={localDuration} onChange={e => setLocalDuration(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-coral)' }} className="field-input" />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop:'8px' }}>
              <span>1 month</span><span style={{ color: 'var(--accent-coral)', fontWeight: 700, fontSize: '14px' }}>{localDuration} months</span><span>24 months</span>
            </div>
          </div>
          <div className="field-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              Severity Level (%)
              <span title="100% means maximum impact (e.g., total job loss). Lower values simulate partial impacts (e.g., pay cut)." style={{ cursor: 'help', color: 'var(--text-muted)', fontSize: '12px' }}>ⓘ</span>
            </label>
            <input type="range" min="10" max="100" value={localSeverity} onChange={e => setLocalSeverity(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-sapphire)' }} className="field-input" />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop:'8px' }}>
              <span>10% mild</span><span style={{ color: 'var(--accent-sapphire)', fontWeight: 700, fontSize: '14px' }}>{localSeverity}%</span><span>100% max</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scenario Cards */}
      <div className="grid-3" style={{ gap: '16px', marginBottom: '32px' }}>
        {SCENARIOS.map(sc => {
          const Icon = sc.icon;
          const isActive = selectedScenario === sc.id;
          return (
            <button key={sc.id} className="glass-panel" onClick={() => runTest(sc.id)}
              style={{ border: isActive ? `2px solid ${sc.color}` : '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.3s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{ background: `${sc.color}22`, padding: '8px', borderRadius: '8px' }}>
                  <Icon size={20} color={sc.color} />
                </div>
                <h4 style={{ margin: 0, fontSize: '14px', color: isActive ? sc.color : 'inherit' }}>{sc.label}</h4>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>{sc.desc}</p>
            </button>
          );
        })}
      </div>

      {loading && !result && <div className="glass-panel animate-fade-in" style={{ textAlign: 'center', padding: '40px' }}>Running simulation...</div>}

      {/* Results */}
      {result && (
        <div className="animate-fade-in" style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s', pointerEvents: loading ? 'none' : 'auto' }}>
          {/* Verdict Banner */}
          <div className="glass-panel" style={{
            background: result.survived
              ? 'linear-gradient(135deg, rgba(16,185,129,0.15), transparent)'
              : 'linear-gradient(135deg, rgba(239,68,68,0.15), transparent)',
            border: `1px solid ${result.survived ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            marginBottom: '24px', textAlign: 'center', padding: '32px'
          }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '28px', color: result.survived ? 'var(--accent-emerald)' : 'var(--accent-coral)' }}>
              {result.survived ? `✅ YOU SURVIVE — ${result.survivalMonths}+ months sustained` : `💀 SYSTEM COLLAPSES AT ${result.firstCrisisDate}`}
            </h2>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
              {result.scenarioDetails?.description}
            </p>
            {!result.survived && result.requiredBuffer > 0 && (
              <p style={{ margin: '12px 0 0 0', fontSize: '14px', color: 'var(--accent-coral)', fontWeight: 600 }}>
                Prescription: Increase liquid reserves by ₹{result.requiredBuffer.toLocaleString('en-IN')} to survive this scenario.
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="stat-grid" style={{ marginBottom: '24px' }}>
            <div className="stat-card">
              <div className="stat-card-label">Survival Duration</div>
              <div className="stat-card-value">{result.survivalMonths} months</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Current Reserves</div>
              <div className="stat-card-value">₹{result.totalLiquidReserves?.toLocaleString('en-IN')}</div>
            </div>
            <div className="stat-card" style={{'--stat-accent': '#ef4444', '--stat-color': '#ef4444'}}>
              <div className="stat-card-label">Monthly Impact</div>
              <div className="stat-card-value">-₹{result.scenarioDetails?.monthlyImpact?.toLocaleString('en-IN')}</div>
            </div>
          </div>

          {/* Timeline */}
          <div className="glass-panel">
            <h4 style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>Survival Timeline</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {result.timeline?.slice(0, 24).map((t, idx) => {
                const maxBal = Math.max(...result.timeline.map(x => Math.abs(x.balance)));
                const pct = maxBal > 0 ? Math.abs(t.balance) / maxBal * 100 : 0;
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '50px', textAlign: 'right' }}>M{t.month}</span>
                    <div style={{ flex: 1, height: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                      <div style={{
                        width: `${Math.min(pct, 100)}%`, height: '100%',
                        background: t.balance >= 0
                          ? 'linear-gradient(90deg, var(--accent-emerald), var(--accent-sapphire))'
                          : 'linear-gradient(90deg, var(--accent-coral), #b91c1c)',
                        borderRadius: '4px', transition: 'width 0.5s ease'
                      }}></div>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 600, width: '100px', textAlign: 'right', color: t.balance >= 0 ? 'var(--accent-emerald)' : 'var(--accent-coral)' }}>
                      {t.balance >= 0 ? '' : '-'}₹{Math.abs(t.balance).toLocaleString('en-IN')}
                    </span>
                    {t.shockLabel && <span style={{ fontSize: '9px', padding: '2px 6px', background: 'rgba(239,68,68,0.2)', color: 'var(--accent-coral)', borderRadius: '4px' }}>{t.shockLabel}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StressTest;
