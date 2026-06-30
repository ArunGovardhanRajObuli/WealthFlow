import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { PackageOpen, Layers, BarChart, AlertTriangle } from 'lucide-react';

function MFOverlap() {
  const { data, isLoading: loading } = useQuery({
    queryKey: ['mf-overlap'],
    queryFn: async () => {
      const res = await fetch('/api/mf-overlap');
      if (!res.ok) throw new Error('Failed to load MF overlap data');
      return res.json();
    }
  });

  if (loading) return <div className="glass-panel animate-fade-in"><p style={{color:'var(--text-muted)'}}>Analyzing fund overlap...</p></div>;
  if (!data || data.totalFunds === 0) return <div className="empty-state glass-panel"><PackageOpen size={48} style={{opacity:0.3,marginBottom:'12px'}}/><h4>No Mutual Funds</h4><p>Add SIP/MF investments to detect overlap.</p></div>;

  const severityColors = { clean:'#10b981', moderate:'#f59e0b', high:'#ef4444' };

  return (
    <div className="animate-fade-in">
      <div className="section-header">
        <div>
          <h2>MF Overlap Detector</h2>
          <p>Identify redundant funds in your portfolio</p>
        </div>
        <div style={{
          padding:'8px 16px',
          textAlign:'center', 
          background:`${severityColors[data.severity]}22`,
          border:`1px solid ${severityColors[data.severity]}44`,
          borderRadius:'100px'
        }}>
          <div style={{fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'2px'}}>Status</div>
          <div style={{fontSize:'14px',fontWeight:700,color:severityColors[data.severity],textTransform:'capitalize'}}>{data.severity}</div>
        </div>
      </div>

      <div className={`alert-banner ${data.severity === 'high' ? 'danger' : data.severity === 'moderate' ? 'warning' : 'safe'}`} style={{marginBottom:'24px'}}>
        <AlertTriangle size={24}/>
        <div style={{marginLeft:'12px'}}>
          <p style={{fontSize:'13px',margin:0}}>{data.recommendation}</p>
        </div>
      </div>

      <div className="stat-grid" style={{marginBottom:'24px'}}>
        <div className="stat-card">
          <div className="stat-card-icon"><Layers size={20}/></div>
          <div className="stat-card-label">Total MF Funds</div>
          <div className="stat-card-value">{data.totalFunds}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><BarChart size={20}/></div>
          <div className="stat-card-label">Total MF Value</div>
          <div className="stat-card-value">₹{(data.totalMFValue || 0).toLocaleString('en-IN')}</div>
        </div>
        <div className="stat-card" style={{'--stat-accent': data.overlapCount>0?'#ef4444':'#10b981', '--stat-color': data.overlapCount>0?'#ef4444':'#10b981'}}>
          <div className="stat-card-icon"><AlertTriangle size={20}/></div>
          <div className="stat-card-label">Overlapping Classes</div>
          <div className="stat-card-value">{data.overlapCount}</div>
        </div>
      </div>

      {(data.overlaps || []).map((o, i) => (
        <div key={i} className="glass-panel" style={{padding:'24px',marginBottom:'16px',borderLeft:`3px solid ${o.isOverlapping?'#ef4444':'#10b981'}`}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'12px'}}>
            <h4>{o.assetClass} <span style={{fontSize:'12px',color:'var(--text-muted)',fontWeight:400}}>({o.fundCount || 0} funds)</span></h4>
            <span style={{fontSize:'13px',fontWeight:600,color:(o.concentration || 0)>40?'#ef4444':'var(--text-primary)'}}>{o.concentration || 0}% concentration</span>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
            {(o.funds || []).map((f,j) => (
              <div key={j} style={{display:'flex',justifyContent:'space-between',padding:'8px 12px',background:'rgba(255,255,255,0.02)',borderRadius:'8px',fontSize:'13px'}}>
                <span>{f.name}</span>
                <span>₹{(f.value || 0).toLocaleString('en-IN')} <span style={{color:'var(--text-muted)'}}>({f.roi || 0}%)</span></span>
              </div>
            ))}
          </div>
          {o.isOverlapping && <p style={{fontSize:'11px',color:'#f59e0b',marginTop:'8px',marginBottom:0}}>⚠️ High overlap — consider consolidating into fewer funds.</p>}
        </div>
      ))}
    </div>
  );
}
export default MFOverlap;
