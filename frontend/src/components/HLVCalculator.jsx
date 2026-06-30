import React, { useState, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { SlidersHorizontal, AlertTriangle, ShieldCheck, Activity, Target } from 'lucide-react';

function HLVCalculator() {
  const [workingYears, setWorkingYears] = useState(25);
  const [discountRate, setDiscountRate] = useState(6); // 6%

  const [debouncedWorkingYears, setDebouncedWorkingYears] = useState(25);
  const [debouncedDiscountRate, setDebouncedDiscountRate] = useState(6);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedWorkingYears(workingYears);
      setDebouncedDiscountRate(discountRate);
    }, 300);
    return () => clearTimeout(handler);
  }, [workingYears, discountRate]);

  const { data, isLoading: loading, error: fetchError } = useQuery({
    queryKey: ['hlv-calculator', debouncedWorkingYears, debouncedDiscountRate],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/hlv-calculator?workingYears=${debouncedWorkingYears}&discountRate=${debouncedDiscountRate}`);
        if (!res.ok) throw new Error('Failed to compute actuarial data.');
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        return d;
      } catch (err) {
        console.error("HLV Fetch Error:", err);
        throw err;
      }
    },
    placeholderData: keepPreviousData
  });

  const error = fetchError?.message;

  if (loading && !data) return <div className="glass-panel animate-fade-in"><p style={{color:'var(--text-muted)'}}>Calculating Actuarial Life Value...</p></div>;
  if (error || (!data && !loading)) return <div className="alert-banner danger animate-fade-in"><AlertTriangle size={16}/> {error || 'Unable to calculate HLV. Ensure your Family Estate is configured.'}</div>;

  const gapColor = (data.coverageGap || 0) > 0 ? '#ef4444' : '#10b981';
  const comps = data.components || {};

  return (
    <div className="animate-fade-in">
      <div className="section-header">
        <div>
          <h2>Human Life Value Engine</h2>
          <p>Actuarial calculation of required family protection</p>
        </div>
      </div>

      {/* Dynamic Sliders */}
      <div className="glass-panel" style={{padding:'20px', marginBottom:'24px'}}>
        <div style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'16px'}}>
          <SlidersHorizontal size={16} color="#3b82f6" />
          <h3 style={{margin:0, fontSize:'14px'}}>Macro-Economic Assumptions</h3>
        </div>
        <div className="grid-2" style={{gap:'24px'}}>
          <div>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'8px', fontSize:'12px'}}>
              <span style={{color:'var(--text-muted)'}}>Years Until Retirement</span>
              <span style={{fontWeight:700, color:'#3b82f6'}}>{workingYears} Years</span>
            </div>
            <input type="range" min="0" max="45" value={workingYears} onChange={e => setWorkingYears(parseInt(e.target.value))} style={{width:'100%', accentColor:'#3b82f6'}} />
            <p style={{fontSize:'10px', color:'var(--text-muted)', marginTop:'4px'}}>How long your income needs to be replaced</p>
          </div>
          <div>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'8px', fontSize:'12px'}}>
              <span style={{color:'var(--text-muted)'}}>Discount Rate (Inflation - Return)</span>
              <span style={{fontWeight:700, color:'#8b5cf6'}}>{discountRate}%</span>
            </div>
            <input type="range" min="1" max="12" step="0.5" value={discountRate} onChange={e => setDiscountRate(parseFloat(e.target.value))} style={{width:'100%', accentColor:'#8b5cf6'}} />
            <p style={{fontSize:'10px', color:'var(--text-muted)', marginTop:'4px'}}>Expected yield on insurance payout after inflation</p>
          </div>
        </div>
      </div>

      {/* Main Stats */}
      <div className="stat-grid" style={{marginBottom:'24px'}}>
        <div className="stat-card" style={{'--stat-accent':'#3b82f6','--stat-color':'#3b82f6'}}>
          <div className="stat-card-icon"><Target size={20}/></div>
          <div className="stat-card-label">Required Life Value</div>
          <div className="stat-card-value">₹{((data.hlv || 0)/100000).toFixed(1)}L</div>
        </div>
        <div className="stat-card" style={{'--stat-accent':'#10b981','--stat-color':'#10b981'}}>
          <div className="stat-card-icon"><ShieldCheck size={20}/></div>
          <div className="stat-card-label">Active Coverage</div>
          <div className="stat-card-value">₹{((data.existingCoverage || 0)/100000).toFixed(1)}L</div>
          <div className="stat-card-sub">{data.coverageRatio || 0}% of Requirement</div>
        </div>
        <div className="stat-card" style={{'--stat-accent': gapColor, '--stat-color': gapColor}}>
          <div className="stat-card-icon"><Activity size={20}/></div>
          <div className="stat-card-label">Insurance Shortfall</div>
          <div className="stat-card-value">₹{((data.coverageGap || 0)/100000).toFixed(1)}L</div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="glass-panel" style={{padding:'28px',marginBottom:'24px'}}>
        <h3 style={{marginBottom:'20px'}}>Requirement Composition</h3>
        {[
          {label:`Income Replacement (${workingYears}yrs @ ${discountRate}%)`, val:comps.incomeReplacement || 0, color:'#3b82f6'},
          {label:'Outstanding Debt Clearance', val:comps.outstandingDebt || 0, color:'#ef4444'},
          {label:`Dependents Corpus (${data.dependentCount || 0} dependents)`, val:comps.childEducation || 0, color:'#8b5cf6'},
          {label:'Emergency Liquidity (1yr per Earner)', val:comps.emergencyFund || 0, color:'#f59e0b'},
          {label:'Surviving Premium Liabilities', val:comps.survivingPremiums || 0, color:'#ec4899'}
        ].filter(c => c.val > 0).map((c,i)=>{
          const pct = (data.hlv || 0) > 0 ? (c.val / data.hlv)*100 : 0;
          return (
            <div key={i} style={{marginBottom:'16px'}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'13px',marginBottom:'6px'}}>
                <span style={{color:'var(--text-secondary)'}}>{c.label}</span>
                <span style={{fontWeight:600}}>₹{(c.val/100000).toFixed(1)}L</span>
              </div>
              <div style={{height:'8px',background:'rgba(255,255,255,0.05)',borderRadius:'4px',overflow:'hidden'}}>
                <div style={{width:`${pct}%`,height:'100%',background:c.color,borderRadius:'4px',transition:'width 0.5s ease'}} />
              </div>
            </div>
          );
        })}
      </div>

      <div className={`alert-banner ${(data.coverageGap || 0) > 0 ? 'danger' : 'safe'}`}>
        {(data.coverageGap || 0) > 0 ? <AlertTriangle size={24}/> : <ShieldCheck size={24}/>}
        <div style={{marginLeft:'12px'}}>
          <h4 style={{margin:'0 0 4px 0'}}>{(data.coverageGap || 0) > 0 ? 'Critical Shortfall Detected' : 'Fully Protected Estate'}</h4>
          <p style={{fontSize:'13px',margin:0}}>{data.recommendation}</p>
        </div>
      </div>
    </div>
  );
}
export default HLVCalculator;
