import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, Clock, FileText, Activity } from 'lucide-react';

function AuditTrail() {
  const { data: logsData, isLoading: loading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const res = await fetch('/api/audit-logs');
      if (!res.ok) throw new Error('Failed to load audit logs');
      return res.json();
    }
  });

  const logs = logsData?.data || [];

  const formatAction = (action) => {
    switch (action) {
      case 'IMPORT': return <span style={{ color: 'var(--accent-sapphire)', fontWeight: 600 }}>IMPORT</span>;
      case 'CREATE': return <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>CREATE</span>;
      case 'UPDATE': return <span style={{ color: '#f59e0b', fontWeight: 600 }}>UPDATE</span>;
      case 'DELETE': return <span style={{ color: 'var(--accent-coral)', fontWeight: 600 }}>DELETE</span>;
      default: return <span>{action}</span>;
    }
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '24px', marginBottom: '32px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={20} color="var(--accent-emerald)" />
          Institutional Audit Trail
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
          Immutable ledger of system modifications. High-security environments require strict traceability.
        </p>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)' }}>Loading immutable logs...</div>
      ) : logs.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
          <Activity size={32} color="var(--text-muted)" style={{ marginBottom: '8px' }} />
          <p style={{ color: 'var(--text-secondary)' }}>No audit events recorded yet.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '12px 8px' }}>Timestamp</th>
                <th style={{ padding: '12px 8px' }}>Action</th>
                <th style={{ padding: '12px 8px' }}>Entity</th>
                <th style={{ padding: '12px 8px' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={14} />
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </td>
                  <td style={{ padding: '12px 8px' }}>{formatAction(log.action)}</td>
                  <td style={{ padding: '12px 8px', textTransform: 'capitalize' }}>{log.entity}</td>
                  <td style={{ padding: '12px 8px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AuditTrail;
