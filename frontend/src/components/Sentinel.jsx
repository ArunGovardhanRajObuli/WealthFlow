import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, AlertTriangle, ShieldCheck, Zap, AlertOctagon } from 'lucide-react';
import AuditTrail from './AuditTrail';

function Sentinel() {
  const { data: diagnosticsData } = useQuery({
    queryKey: ['sentinel-diagnostics'],
    queryFn: async () => {
      const res = await fetch('/api/sentinel/diagnostics');
      if (!res.ok) throw new Error('Failed to load diagnostics');
      return res.json();
    }
  });

  const diagnostics = diagnosticsData?.data || { alerts: [], structuralDeficit: false };

  const getSystemStatus = () => {
      const hasCritical = diagnostics?.alerts?.some(a => a.type === 'critical');
      const hasWarning = diagnostics?.alerts?.some(a => a.type === 'warning');
      
      if (hasCritical) return { color: 'var(--accent-coral)', text: 'SYSTEM COMPROMISED: CRITICAL PARADOX', icon: <AlertOctagon size={48} className="text-coral" /> };
      if (hasWarning) return { color: 'var(--accent-sapphire)', text: 'SUB-OPTIMAL: ANOMALIES DETECTED', icon: <AlertTriangle size={48} className="text-sapphire" /> };
      return { color: 'var(--accent-emerald)', text: 'SYSTEM NOMINAL: PERFECT INTEGRITY', icon: <ShieldCheck size={48} className="text-emerald" /> };
  };

  const status = getSystemStatus();

  return (
    <div className="animate-fade-in">
      <div className="flex-between mb-8" style={{ marginBottom: '24px' }}>
        <div>
           <h2 className="text-gradient">Sentinel Operations</h2>
           <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Autonomous Liquid Asset Auditing Engine</p>
        </div>
      </div>

      <div className="glass-panel" style={{ textAlign: 'center', marginBottom: '40px', padding: '40px 24px', border: `1px solid ${status.color}`, background: 'var(--bg-secondary)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: status.color, boxShadow: `0 0 20px ${status.color}` }}></div>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
             {status.icon}
          </div>
          <h2 style={{ color: status.color, letterSpacing: '2px', fontSize: '24px', marginBottom: '8px', textTransform: 'uppercase' }}>{status.text}</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto' }}>
              Sentinel continuously queries your budgets, ledgers, liabilities, and investments simultaneously. It executes cross-matrix calculations to mathematically prove or disprove your liquidity state.
          </p>
      </div>

      <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={20} className="text-sapphire" />
          Active Diagnostic Logs ({diagnostics?.alerts?.length || 0})
      </h3>
      
      <div className="grid-2" style={{ gap: '24px' }}>
          {(diagnostics?.alerts || []).map((alert, index) => (
             <div key={index} className="glass-panel" style={{ borderLeft: `4px solid ${alert.type === 'critical' ? 'var(--accent-coral)' : (alert.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-sapphire)')}` }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                         {alert.type === 'critical' ? <ShieldAlert size={20} className="text-coral" /> : (alert.type === 'success' ? <ShieldCheck size={20} className="text-emerald" /> : <AlertTriangle size={20} className="text-sapphire" />)}
                         <h4 style={{ margin: 0, fontSize: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>{alert.title}</h4>
                     </div>
                     <div style={{ fontSize: '10px', background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '4px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                         Priority: {alert.type}
                     </div>
                 </div>
                 
                 <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '24px' }}>
                     {alert.message}
                 </p>

                 {alert.type !== 'success' && (
                     <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Suggested Resolution:</span>
                         <button className="btn" style={{ fontSize: '12px', padding: '6px 12px', background: alert.type === 'critical' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)', color: alert.type === 'critical' ? 'var(--accent-coral)' : 'var(--accent-sapphire)' }}>
                            {alert.action}
                         </button>
                     </div>
                 )}
             </div>
          ))}
      </div>

      <div style={{ marginTop: '40px' }}>
          <AuditTrail />
      </div>
    </div>
  );
}

export default Sentinel;
