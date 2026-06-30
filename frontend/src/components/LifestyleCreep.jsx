import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, AlertTriangle, Check, PackageOpen } from 'lucide-react';

function LifestyleCreep() {
  const { data: queryData } = useQuery({
    queryKey: ['lifestyle-creep'],
    queryFn: async () => {
      const res = await fetch('/api/lifestyle-creep');
      if (!res.ok) throw new Error('Failed to load lifestyle creep data');
      return res.json();
    }
  });

  const data = queryData?.data || (Array.isArray(queryData) ? queryData : []);

  const getAlertConfig = (alert) => {
    switch (alert) {
      case 'critical': return { color: 'var(--accent-coral)', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', label: 'CREEP DETECTED', icon: <AlertTriangle size={18} color="#ef4444" /> };
      case 'creeping': return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)', label: 'DRIFTING', icon: <TrendingUp size={18} color="#f59e0b" /> };
      default: return { color: 'var(--accent-emerald)', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.3)', label: 'STABLE', icon: <Check size={18} color="#10b981" /> };
    }
  };

  const creepCount = data.filter(d => d.alert !== 'stable').length;

  return (
    <div className="animate-fade-in">
      <div className="section-header">
        <div>
          <h2>Lifestyle Creep Detector</h2>
          <p>6-Month Expenditure Drift Analysis — Catches silent spending inflation</p>
        </div>
        {creepCount > 0 && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '8px 20px', borderRadius: '99px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-coral)' }}>{creepCount} {creepCount === 1 ? 'Category' : 'Categories'} Drifting</span>
          </div>
        )}
      </div>

      {data.length === 0 && (
        <div className="empty-state glass-panel">
          <PackageOpen size={48} style={{opacity:0.3,marginBottom:'12px'}}/>
          <h4>Insufficient Data</h4>
          <p>Need at least 2 months of expense data to detect lifestyle creep patterns.</p>
        </div>
      )}

      <div className="grid-2" style={{ gap: '24px' }}>
        {data.map((cat, idx) => {
          const config = getAlertConfig(cat.alert);
          const monthlyData = cat.monthlyData || [];
          const maxVal = Math.max(...monthlyData.map(d => d.total || 0), 1);

          return (
            <div key={idx} className="glass-panel" style={{ borderLeft: `4px solid ${config.color}` }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', textTransform: 'capitalize' }}>{cat.category}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: config.bg, border: `1px solid ${config.border}`, padding: '4px 12px', borderRadius: '99px' }}>
                  {config.icon}
                  <span style={{ fontSize: '11px', fontWeight: 700, color: config.color, letterSpacing: '1px' }}>{config.label}</span>
                </div>
              </div>

              {/* Mini Sparkline Bar Chart */}
              <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '60px', marginBottom: '16px' }}>
                {monthlyData.map((d, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div style={{
                      width: '100%', borderRadius: '4px 4px 0 0',
                      height: `${Math.max(8, ((d.total || 0) / maxVal) * 60)}px`,
                      background: i === monthlyData.length - 1
                        ? (cat.alert !== 'stable' ? config.color : 'var(--accent-emerald)')
                        : 'rgba(255,255,255,0.1)',
                      transition: 'height 0.5s ease'
                    }}></div>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{(d.month || '').split('-')[1]}</span>
                  </div>
                ))}
              </div>

              {/* Metrics */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '10px', flex: 1, minWidth: '100px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Monthly Drift</span>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: (cat.slope || 0) > 0 ? config.color : 'var(--accent-emerald)' }}>
                    {(cat.slope || 0) > 0 ? '+' : ''}₹{(cat.slope || 0).toLocaleString('en-IN')}/mo
                  </span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '10px', flex: 1, minWidth: '100px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>6-Month Change</span>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: (cat.changePct || 0) > 0 ? config.color : 'var(--accent-emerald)' }}>
                    {(cat.changePct || 0) > 0 ? '+' : ''}{(cat.changePct || 0)}%
                  </span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '10px', flex: 1, minWidth: '100px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Annual Impact</span>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: (cat.annualProjectedIncrease || 0) > 0 ? config.color : 'var(--accent-emerald)' }}>
                    {(cat.annualProjectedIncrease || 0) > 0 ? '+' : ''}₹{(cat.annualProjectedIncrease || 0).toLocaleString('en-IN')}/yr
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LifestyleCreep;
