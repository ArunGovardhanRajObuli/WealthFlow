import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Calculator, Clock, TrendingUp, Percent, Banknote } from 'lucide-react';
import { parseToPaiseBigInt } from '../utils/bigIntMath';

function formatBigIntPaise(paiseBigInt) {
    const isNeg = paiseBigInt < 0n;
    let absVal = isNeg ? -paiseBigInt : paiseBigInt;
    let str = absVal.toString().padStart(3, '0');
    const intPart = str.slice(0, -2);
    const decPart = str.slice(-2);
    const inFormat = BigInt(intPart).toLocaleString('en-IN');
    return (isNeg ? '-' : '') + inFormat + '.' + decPart;
}

function EMIModeler() {
  const queryClient = useQueryClient();
  const [skipMonths, setSkipMonths] = useState(3);
  const [localSkipMonths, setLocalSkipMonths] = useState(3);
  const [restructuring, setRestructuring] = useState(null); // { loanId, type } while in progress
  const [successMsg, setSuccessMsg] = useState(null);
  
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setSkipMonths(localSkipMonths);
    }, 300);
    return () => clearTimeout(handler);
  }, [localSkipMonths]);

  const { data, isLoading: loading, error: fetchError } = useQuery({
    queryKey: ['emi-modeler', skipMonths],
    queryFn: async () => {
      const res = await fetch(`/api/emi-modeler?skipMonths=${skipMonths}`);
      if (!res.ok) throw new Error('Failed to load EMI scenarios. Please try again.');
      return res.json();
    },
    placeholderData: keepPreviousData
  });

  const restructureMutation = useMutation({
    mutationFn: async ({ loanId, type }) => {
      const res = await fetch(`/api/loans/${loanId}/restructure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, skipMonths })
      });
      if (!res.ok) throw new Error('Restructuring failed on server.');
      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Restructuring operation failed.');
      return result;
    },
    onSuccess: (result) => {
      const r = result.restructured;
      setSuccessMsg(`✅ "${r.title}" restructured: Principal ₹${(r.oldPrincipal||0).toLocaleString('en-IN')} → ₹${(r.newPrincipal||0).toLocaleString('en-IN')}, EMI ₹${(r.oldEMI||0).toLocaleString('en-IN')} → ₹${(r.newEMI||0).toLocaleString('en-IN')}, Term ${r.oldTermYears}yr → ${r.newTermYears}yr`);
      queryClient.invalidateQueries({ queryKey: ['emi-modeler'] });
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    }
  });

  const error = fetchError ? fetchError.message : restructureMutation.error ? restructureMutation.error.message : null;

  const handleRestructure = async (loanId, type) => {
    // Instead of using confirm modal which yields the thread, execute directly
    setRestructuring({ loanId, type });
    try {
      await restructureMutation.mutateAsync({ loanId, type });
    } catch(e) { 
      console.error(e); 
    }
    setRestructuring(null);
  };

  
  if (loading && !data) return (
    <div className="glass-panel animate-fade-in" style={{padding:'48px', textAlign:'center'}}>
      <Calculator size={32} style={{color:'var(--text-muted)', marginBottom:'12px', opacity:0.5}} />
      <p style={{color:'var(--text-muted)'}}>Modeling EMI scenarios...</p>
    </div>
  );
  if (!data || data.loans.length === 0) return (
    <div className="glass-panel">
      <div className="empty-state">
        <div className="empty-state-icon">📊</div>
        <div className="empty-state-title">No Active Loans Found</div>
        <div className="empty-state-desc">Add loans in the Loan Command Center to unlock EMI skip and restructure analysis.</div>
      </div>
    </div>
  );

  const extraEMI = parseToPaiseBigInt(data.totalExtraEMICost || 0);
  const extraTenure = parseToPaiseBigInt(data.totalExtraTenureCost || 0);
  const cheaperOption = extraEMI <= extraTenure ? 'emi' : 'tenure';
  const minExtraCost = extraEMI < extraTenure ? extraEMI : extraTenure;
  const riskLevel = localSkipMonths <= 3 ? 'low' : localSkipMonths <= 6 ? 'moderate' : 'high';

  return (
    <div className="animate-fade-in">
      
      {/* Section Header */}
      <div className="section-header" style={{marginBottom:'24px'}}>
        <h2 style={{background:'linear-gradient(135deg, #f59e0b, #ef4444)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent'}}>EMI Skip & Restructure Modeler</h2>
        <p>What-if analysis · Skip EMIs · Apply restructuring to your loans</p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="alert-banner danger">
          <AlertTriangle size={16} />
          <span style={{fontWeight:600}}>{error}</span>
        </div>
      )}

      {/* Success Banner */}
      {successMsg && (
        <div className="alert-banner success">
          <CheckCircle size={18} style={{flexShrink:0}} />
          <div>
            <span style={{fontWeight:600}}>{successMsg}</span>
            <div style={{fontSize:'11px', color:'var(--text-muted)', marginTop:'2px'}}>The Loan Command Center now reflects the updated terms. This event has been recorded in your ledger.</div>
          </div>
          <button onClick={() => setSuccessMsg(null)} style={{background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', marginLeft:'auto', flexShrink:0}}>✕</button>
        </div>
      )}

      {/* Skip Control — Styled Range Slider */}
      <div className="glass-panel" style={{padding:'24px', marginBottom:'24px'}}>
        <div style={{display:'flex', alignItems:'center', gap:'24px', flexWrap:'wrap'}}>
          <div style={{flex:1, minWidth:'200px'}}>
            <label style={{fontSize:'12px', color:'var(--text-muted)', display:'flex', justifyContent:'space-between', marginBottom:'10px'}}>
              <span style={{display:'flex', alignItems:'center', gap:'6px'}}>
                <Clock size={14} />
                EMI Holiday Duration
              </span>
              <strong style={{color:'#f59e0b', fontSize:'14px'}}>{localSkipMonths} month{localSkipMonths > 1 ? 's' : ''}</strong>
            </label>
            <input
              type="range"
              min="1"
              max="12"
              value={localSkipMonths}
              onChange={e => setLocalSkipMonths(Number(e.target.value))}
              className="range-slider-styled"
              aria-label="EMI Holiday Duration in months"
            />
            <div className="range-slider-ticks">
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => (
                <span key={n} style={{fontWeight: n === localSkipMonths ? 700 : 400, color: n === localSkipMonths ? '#f59e0b' : undefined}}>{n}</span>
              ))}
            </div>
          </div>
          <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'6px'}}>
            <span className={`urgency-badge ${riskLevel === 'high' ? 'critical' : riskLevel === 'moderate' ? 'warning' : 'safe'}`}>
              {riskLevel === 'high' ? '⚠ High Risk' : riskLevel === 'moderate' ? '◆ Moderate Risk' : '● Low Risk'}
            </span>
          </div>
        </div>
      </div>

      {/* Total Portfolio Impact — Two Option Cards */}
      <div className="grid-2" style={{marginBottom:'24px'}}>
        <div className="glass-panel" style={{padding:'20px', borderLeft: cheaperOption === 'emi' ? '4px solid #10b981' : '4px solid transparent'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px'}}>
            <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
              <TrendingUp size={16} style={{color:'#f59e0b'}} />
              <span style={{fontSize:'13px', fontWeight:600}}>Option A: Higher EMI (same tenure)</span>
            </div>
            {cheaperOption === 'emi' && <span className="urgency-badge safe">CHEAPER</span>}
          </div>
          <div style={{fontSize:'28px', fontWeight:800, color: cheaperOption === 'emi' ? '#10b981' : '#ef4444'}}>₹{formatBigIntPaise(parseToPaiseBigInt(data?.totalExtraEMICost))}</div>
          <div style={{fontSize:'11px', color:'var(--text-muted)'}}>Total extra cost across all loans</div>
        </div>
        <div className="glass-panel" style={{padding:'20px', borderLeft: cheaperOption === 'tenure' ? '4px solid #10b981' : '4px solid transparent'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px'}}>
            <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
              <Clock size={16} style={{color:'#3b82f6'}} />
              <span style={{fontSize:'13px', fontWeight:600}}>Option B: Extended Tenure (same EMI)</span>
            </div>
            {cheaperOption === 'tenure' && <span className="urgency-badge safe">CHEAPER</span>}
          </div>
          <div style={{fontSize:'28px', fontWeight:800, color: cheaperOption === 'tenure' ? '#10b981' : '#ef4444'}}>₹{formatBigIntPaise(parseToPaiseBigInt(data?.totalExtraTenureCost))}</div>
          <div style={{fontSize:'11px', color:'var(--text-muted)'}}>Total extra cost across all loans</div>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="alert-banner warning">
        <AlertTriangle size={16} style={{flexShrink:0}} />
        <div>
          <span style={{fontWeight:600}}>
            Skipping {skipMonths} EMI{skipMonths > 1 ? 's' : ''} will cost you an additional ₹{formatBigIntPaise(parseToPaiseBigInt(minExtraCost))} at minimum
          </span>
          <div style={{fontSize:'11px', marginTop:'2px', opacity:0.8}}>
            Interest continues to accrue during the holiday period, increasing your principal balance
          </div>
        </div>
      </div>

      {/* Per-Loan Analysis */}
      {data.loans.map((loan, i) => {
        const loanCheaper = loan.skipScenario.totalExtraCost <= loan.tenureScenario.totalExtraCost ? 'emi' : 'tenure';
        const isRestructuringThis = restructuring?.loanId === loan.loanId;
        return (
          <div key={i} className="glass-panel animate-slide-in" style={{padding:'24px', marginBottom:'16px', borderLeft:'4px solid #f59e0b', animationDelay: `${i * 0.05}s`}}>
            <h3 style={{marginBottom:'14px', fontSize:'15px', display:'flex', alignItems:'center', gap:'8px'}}>
              <Banknote size={16} style={{color:'#f59e0b'}} />
              {loan.loan}
            </h3>
            
            {/* Loan Stats — Responsive Grid */}
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))', gap:'8px', marginBottom:'16px'}}>
              <div style={{padding:'10px', background:'rgba(255,255,255,0.02)', borderRadius:'10px', textAlign:'center'}}>
                <div className="stat-card-label" style={{marginBottom:'2px'}}>Principal</div>
                <div style={{fontWeight:700, fontSize:'13px'}}>₹{formatBigIntPaise(parseToPaiseBigInt(loan.principal))}</div>
              </div>
              <div style={{padding:'10px', background:'rgba(255,255,255,0.02)', borderRadius:'10px', textAlign:'center'}}>
                <div className="stat-card-label" style={{marginBottom:'2px'}}>Current EMI</div>
                <div style={{fontWeight:700, fontSize:'13px'}}>₹{formatBigIntPaise(parseToPaiseBigInt(loan.currentEMI))}</div>
              </div>
              <div style={{padding:'10px', background:'rgba(255,255,255,0.02)', borderRadius:'10px', textAlign:'center'}}>
                <div className="stat-card-label" style={{marginBottom:'2px'}}>Rate</div>
                <div style={{fontWeight:700, fontSize:'13px', display:'flex', alignItems:'center', justifyContent:'center', gap:'4px'}}>
                  <Percent size={12} />{loan.interestRate}%
                </div>
              </div>
              <div style={{padding:'10px', background:'rgba(239,68,68,0.05)', borderRadius:'10px', textAlign:'center', border:'1px solid rgba(239,68,68,0.15)'}}>
                <div className="stat-card-label" style={{marginBottom:'2px'}}>Interest During Skip</div>
                <div style={{fontWeight:700, fontSize:'13px', color:'#ef4444'}}>₹{formatBigIntPaise(parseToPaiseBigInt(loan.skipScenario.accruedInterest))}</div>
              </div>
              <div style={{padding:'10px', background:'rgba(245,158,11,0.05)', borderRadius:'10px', textAlign:'center', border:'1px solid rgba(245,158,11,0.15)'}}>
                <div className="stat-card-label" style={{marginBottom:'2px'}}>New Principal</div>
                <div style={{fontWeight:700, fontSize:'13px', color:'#f59e0b'}}>₹{formatBigIntPaise(parseToPaiseBigInt(loan.newPrincipal))}</div>
              </div>
            </div>

            {/* Option Comparison */}
            <div className="grid-2" style={{gap:'16px'}}>
              <div style={{padding:'18px', background: loanCheaper === 'emi' ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.04)', borderRadius:'16px', border: loanCheaper === 'emi' ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,255,255,0.05)'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                  <h4 style={{fontSize:'13px', margin:0, color:'#f59e0b'}}>A: Higher EMI</h4>
                  {loanCheaper === 'emi' && <span className="urgency-badge safe" style={{fontSize:'9px'}}>CHEAPER</span>}
                </div>
                <div style={{fontSize:'12px', display:'flex', flexDirection:'column', gap:'6px', marginBottom:'12px'}}>
                  <div style={{display:'flex', justifyContent:'space-between'}}><span>New EMI</span><span style={{fontWeight:600}}>₹{formatBigIntPaise(parseToPaiseBigInt(loan.skipScenario.newEMI))}</span></div>
                  <div style={{display:'flex', justifyContent:'space-between'}}><span>EMI Increase</span><span style={{fontWeight:600, color:'#ef4444'}}>+₹{formatBigIntPaise(parseToPaiseBigInt(loan.skipScenario.emiIncrease))}</span></div>
                  <div style={{display:'flex', justifyContent:'space-between', borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:'6px'}}><span style={{fontWeight:600}}>Extra Cost</span><span style={{fontWeight:700, color:'#ef4444'}}>₹{formatBigIntPaise(parseToPaiseBigInt(loan.skipScenario.totalExtraCost))}</span></div>
                </div>
                <button
                  onClick={() => handleRestructure(loan.loanId, 'higher_emi')}
                  disabled={isRestructuringThis}
                  style={{width:'100%', padding:'10px', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'10px', color:'#f59e0b', fontWeight:600, cursor: isRestructuringThis ? 'not-allowed' : 'pointer', fontSize:'11px', opacity: isRestructuringThis ? 0.6 : 1, transition:'all 0.2s'}}
                >
                  {isRestructuringThis && restructuring.type === 'higher_emi' ? 'Applying...' : '⚡ Apply This Restructuring'}
                </button>
              </div>
              <div style={{padding:'18px', background: loanCheaper === 'tenure' ? 'rgba(16,185,129,0.05)' : 'rgba(59,130,246,0.04)', borderRadius:'16px', border: loanCheaper === 'tenure' ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,255,255,0.05)'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                  <h4 style={{fontSize:'13px', margin:0, color:'#3b82f6'}}>B: Extended Tenure</h4>
                  {loanCheaper === 'tenure' && <span className="urgency-badge safe" style={{fontSize:'9px'}}>CHEAPER</span>}
                </div>
                <div style={{fontSize:'12px', display:'flex', flexDirection:'column', gap:'6px', marginBottom:'12px'}}>
                  <div style={{display:'flex', justifyContent:'space-between'}}><span>EMI Unchanged</span><span style={{fontWeight:600}}>₹{formatBigIntPaise(parseToPaiseBigInt(loan.tenureScenario.emiUnchanged))}</span></div>
                  <div style={{display:'flex', justifyContent:'space-between'}}><span>Extra Months</span><span style={{fontWeight:600, color:'#f59e0b'}}>+{loan.tenureScenario.tenureExtension}</span></div>
                  <div style={{display:'flex', justifyContent:'space-between', borderTop:'1px solid rgba(255,255,255,0.1)', paddingTop:'6px'}}><span style={{fontWeight:600}}>Extra Cost</span><span style={{fontWeight:700, color:'#ef4444'}}>₹{formatBigIntPaise(parseToPaiseBigInt(loan.tenureScenario.totalExtraCost))}</span></div>
                </div>
                <button
                  onClick={() => handleRestructure(loan.loanId, 'extended_tenure')}
                  disabled={isRestructuringThis}
                  style={{width:'100%', padding:'10px', background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.3)', borderRadius:'10px', color:'#3b82f6', fontWeight:600, cursor: isRestructuringThis ? 'not-allowed' : 'pointer', fontSize:'11px', opacity: isRestructuringThis ? 0.6 : 1, transition:'all 0.2s'}}
                >
                  {isRestructuringThis && restructuring.type === 'extended_tenure' ? 'Applying...' : '⚡ Apply This Restructuring'}
                </button>
              </div>
            </div>
            <div style={{marginTop:'12px', padding:'12px 16px', background:'rgba(255,255,255,0.02)', borderRadius:'10px', fontSize:'12px', color:'var(--text-muted)', display:'flex', alignItems:'center', gap:'6px'}}>
              💡 {loan.recommendation}
            </div>
          </div>
        );
      })}
    </div>
  );
}
export default EMIModeler;
