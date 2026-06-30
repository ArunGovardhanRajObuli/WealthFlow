import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Plus, X, Trash2, TrendingUp, Shield, Clock, Wallet, Target, Heart, AlertTriangle, PackageOpen } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import { parseToPaiseBigInt, formatBigIntToDecimalString } from '../utils/bigIntMath';
import CustomSelect from './ui/CustomSelect';

function NPSTracker() {
  const queryClient = useQueryClient();
  const [currentAge, setCurrentAge] = useState(30);
  const [retirementAge, setRetirementAge] = useState(60);
  const [localCurrentAge, setLocalCurrentAge] = useState(30);
  const [localRetirementAge, setLocalRetirementAge] = useState(60);

  useEffect(() => {
    const handler = setTimeout(() => {
      setCurrentAge(localCurrentAge);
      setRetirementAge(localRetirementAge);
    }, 500);
    return () => clearTimeout(handler);
  }, [localCurrentAge, localRetirementAge]);
  const [showForm, setShowForm] = useState(false);
  const [isHistorical, setIsHistorical] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState({ pranNumber:'', memberName:'', tier:'Tier I', currentValue:'', monthlyContribution:'', employerContribution:'0', equityPct:'50', corpBondPct:'30', govtSecPct:'20' });

  const { data, isLoading: loading, error: e1 } = useQuery({ 
    queryKey: ['nps-projection', currentAge, retirementAge], 
    queryFn: () => fetch(`/api/nps-projection?currentAge=${currentAge}&retirementAge=${retirementAge}`).then(r=>r.json()),
    placeholderData: keepPreviousData
  });
  
  const error = e1 ? 'Failed to load NPS data.' : null;

  const addMut = useMutation({
    mutationFn: (newNps) => fetch('/api/nps-accounts', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(newNps) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nps-projection'] });
      queryClient.invalidateQueries({ queryKey: ['bank-balances'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['family-estate-ledger'] });
      setShowForm(false);
      setIsHistorical(false);
    }
  });

  const delMut = useMutation({
    mutationFn: (id) => fetch(`/api/nps-accounts/${id}`,{method:'DELETE'}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nps-projection'] });
      queryClient.invalidateQueries({ queryKey: ['bank-balances'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['family-estate-ledger'] });
    }
  });

  const handleAdd = () => {
    const curValPaise = parseToPaiseBigInt(form.currentValue);
    const moContribPaise = parseToPaiseBigInt(form.monthlyContribution);
    const empContribPaise = parseToPaiseBigInt(form.employerContribution);
    
    if (curValPaise < 0n || moContribPaise < 0n || empContribPaise < 0n) return;
    
    const eq = parseFloat(form.equityPct);
    const cb = parseFloat(form.corpBondPct);
    const gs = parseFloat(form.govtSecPct);
    
    if(isNaN(eq) || isNaN(cb) || isNaN(gs)) return;
    if(eq < 0 || cb < 0 || gs < 0) return;

    addMut.mutate({
      ...form, 
      currentValue: formatBigIntToDecimalString(curValPaise), 
      totalContribution: formatBigIntToDecimalString(curValPaise), 
      monthlyContribution: formatBigIntToDecimalString(moContribPaise), 
      employerContribution: formatBigIntToDecimalString(empContribPaise), 
      equityPct:Math.round(eq * 100) / 100, 
      corpBondPct:Math.round(cb * 100) / 100, 
      govtSecPct:Math.round(gs * 100) / 100, 
      isHistorical
    });
  };
  const handleDelete = (id) => { setConfirmDelete(id); };

  if (loading) return <div className="glass-panel animate-fade-in"><p style={{color:'var(--text-muted)'}}>Loading NPS data...</p></div>;

  const inputStyle = { padding:'10px', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border-color)', borderRadius:'8px', color:'var(--text-primary)', fontSize:'13px', width:'100%' };
  const yearsLeft = localRetirementAge - localCurrentAge;

  // Allocation must sum to 100
  const allocTotal = Math.round((parseFloat(form.equityPct||0) + parseFloat(form.corpBondPct||0) + parseFloat(form.govtSecPct||0)) * 100) / 100;
  const allocValid = allocTotal === 100;

  return (
    <div className="animate-fade-in">
      {error && <div className="alert-banner danger" style={{marginBottom:'20px'}}><AlertTriangle size={16}/> {error}</div>}

      <div className="section-header">
        <div>
          <h2>NPS Retirement Engine</h2>
          <p>National Pension System · Monthly Compounding · Tax Benefit Analysis</p>
        </div>
        <button className="btn btn-sapphire" onClick={() => setShowForm(!showForm)}>
          {showForm ? <><X size={16} style={{marginRight:'6px'}}/> Cancel NPS Addition</> : <><Plus size={16} style={{marginRight:'6px'}}/> Add NPS Account</>}
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="glass-panel animate-fade-in" style={{padding:'24px',marginBottom:'24px', borderLeft:'4px solid #3b82f6'}}>
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:'16px'}}>
            <h3 style={{margin:0}}>New NPS Account</h3>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px'}}>
            <input placeholder="PRAN Number" value={form.pranNumber} onChange={e=>setForm({...form,pranNumber:e.target.value})} style={inputStyle} />
            <input placeholder="Member Name" value={form.memberName} onChange={e=>setForm({...form,memberName:e.target.value})} style={inputStyle} />
            <CustomSelect value={form.tier} onChange={e=>setForm({...form,tier:e.target.value})} style={inputStyle}>
              <option value="Tier I">Tier I (Lock-in till 60)</option>
              <option value="Tier II">Tier II (Flexible)</option>
            </CustomSelect>
            <input type="number" placeholder="Current Corpus Value (₹)" value={form.currentValue} onChange={e=>setForm({...form,currentValue:e.target.value})} style={inputStyle} />
            <input type="number" placeholder="Your Monthly Contribution (₹)" value={form.monthlyContribution} onChange={e=>setForm({...form,monthlyContribution:e.target.value})} style={inputStyle} />
            <input type="number" placeholder="Employer Monthly (₹)" value={form.employerContribution} onChange={e=>setForm({...form,employerContribution:e.target.value})} style={inputStyle} />
          </div>
          <div style={{marginTop:'16px', padding:'16px', background:'rgba(59,130,246,0.05)', borderRadius:'10px', border:'1px solid rgba(59,130,246,0.15)'}}>
            <div style={{fontSize:'13px', fontWeight:600, marginBottom:'12px', color:'var(--accent-sapphire)'}}>Asset Allocation (must total 100%)</div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px'}}>
              <div>
                <label style={{fontSize:'11px', color:'var(--text-muted)'}}>Equity (E) — High Risk</label>
                <input type="number" value={form.equityPct} onChange={e=>setForm({...form,equityPct:e.target.value})} style={{...inputStyle, marginTop:'4px'}} />
              </div>
              <div>
                <label style={{fontSize:'11px', color:'var(--text-muted)'}}>Corp Bonds (C) — Medium</label>
                <input type="number" value={form.corpBondPct} onChange={e=>setForm({...form,corpBondPct:e.target.value})} style={{...inputStyle, marginTop:'4px'}} />
              </div>
              <div>
                <label style={{fontSize:'11px', color:'var(--text-muted)'}}>Govt Securities (G) — Safe</label>
                <input type="number" value={form.govtSecPct} onChange={e=>setForm({...form,govtSecPct:e.target.value})} style={{...inputStyle, marginTop:'4px'}} />
              </div>
            </div>
            <div style={{marginTop:'8px', fontSize:'12px', color: allocValid ? 'var(--accent-emerald)' : 'var(--accent-coral)', fontWeight:600}}>
              Total: {allocTotal}% {allocValid ? '✅' : '— Must equal 100%'}
            </div>
          </div>
          <button onClick={handleAdd} disabled={!allocValid} style={{marginTop:'16px', padding:'12px 24px', background: allocValid ? '#3b82f6' : 'rgba(59,130,246,0.5)', border:'none', borderRadius:'8px', color:'#fff', fontWeight:600, cursor: allocValid ? 'pointer' : 'not-allowed', width:'100%'}}>
            Save NPS Account
          </button>
          <div style={{marginTop:'12px', display:'flex', alignItems:'center', gap:'8px'}}>
            <input type="checkbox" id="npsHistorical" checked={isHistorical} onChange={e=>setIsHistorical(e.target.checked)} />
            <label htmlFor="npsHistorical" style={{fontSize:'12px', color:'var(--text-muted)'}}>Existing account (won't debit ledger)</label>
          </div>
        </div>
      )}

      {data && (
        <>
          {/* Age Sliders */}
          <div className="glass-panel" style={{padding:'20px',marginBottom:'24px'}}>
            <div style={{display:'flex',gap:'32px',alignItems:'center', flexWrap:'wrap'}}>
              <div style={{flex:1, minWidth:'200px'}}>
                <label style={{fontSize:'12px',color:'var(--text-muted)', display:'flex', justifyContent:'space-between', marginBottom:'8px'}}>
                  <span>Current Age</span><strong style={{color:'var(--text-primary)'}}>{localCurrentAge}</strong>
                </label>
                <input type="range" min="20" max="55" value={localCurrentAge} onChange={e=>setLocalCurrentAge(parseInt(e.target.value))} style={{width:'100%', accentColor:'#3b82f6'}} />
              </div>
              <div style={{flex:1, minWidth:'200px'}}>
                <label style={{fontSize:'12px',color:'var(--text-muted)', display:'flex', justifyContent:'space-between', marginBottom:'8px'}}>
                  <span>Retirement Age</span><strong style={{color:'var(--accent-emerald)'}}>{localRetirementAge}</strong>
                </label>
                <input type="range" min="55" max="70" value={localRetirementAge} onChange={e=>setLocalRetirementAge(parseInt(e.target.value))} style={{width:'100%', accentColor:'#10b981'}} />
              </div>
              <div style={{padding:'12px 20px', background:'rgba(59,130,246,0.05)', borderRadius:'10px', border:'1px solid rgba(59,130,246,0.15)', textAlign:'center'}}>
                <div style={{fontSize:'11px', color:'var(--text-muted)'}}>Years to Retire</div>
                <div style={{fontSize:'28px', fontWeight:800, color:'#3b82f6'}}>{yearsLeft}</div>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="stat-grid" style={{marginBottom:'24px'}}>
            <div className="stat-card" style={{'--stat-accent':'var(--text-secondary)','--stat-color':'var(--text-secondary)'}}>
              <div className="stat-card-icon"><Wallet size={20}/></div>
              <div className="stat-card-label">Current Corpus</div>
              <div className="stat-card-value">₹{Number(data.totalCurrent||0).toLocaleString('en-IN')}</div>
              <div className="stat-card-sub">₹{Number(data.totalMonthlyContrib||0).toLocaleString('en-IN')}/mo SIP</div>
            </div>
            <div className="stat-card" style={{'--stat-accent':'#3b82f6','--stat-color':'#3b82f6'}}>
              <div className="stat-card-icon"><Target size={20}/></div>
              <div className="stat-card-label">Projected Corpus @60</div>
              <div className="stat-card-value">₹{Number(data.totalProjected||0).toLocaleString('en-IN')}</div>
            </div>
            <div className="stat-card" style={{'--stat-accent':'#10b981','--stat-color':'#10b981'}}>
              <div className="stat-card-icon"><Heart size={20}/></div>
              <div className="stat-card-label">Monthly Pension</div>
              <div className="stat-card-value">₹{Number(data.totalPension||0).toLocaleString('en-IN')}</div>
              <div className="stat-card-sub">From 40% annuity @6%</div>
            </div>
            <div className="stat-card" style={{'--stat-accent':'#a78bfa','--stat-color':'#a78bfa'}}>
              <div className="stat-card-icon"><Shield size={20}/></div>
              <div className="stat-card-label">Annual Tax Saved</div>
              <div className="stat-card-value">₹{Number(data.annualTaxBenefit||0).toLocaleString('en-IN')}</div>
              <div className="stat-card-sub">80CCD(1B) + 80CCD(2)</div>
            </div>
          </div>

          {/* Tax Breakdown */}
          {data.taxBreakdown && (data.taxBreakdown.section80CCD1B > 0 || data.taxBreakdown.section80CCD2 > 0) && (
            <div style={{display:'flex', gap:'16px', marginBottom:'24px'}}>
              <div style={{flex:1, padding:'14px 18px', background:'rgba(167,139,250,0.05)', borderRadius:'10px', border:'1px solid rgba(167,139,250,0.15)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div><div style={{fontSize:'11px', color:'var(--text-muted)'}}>Section 80CCD(1B)</div><div style={{fontSize:'12px', color:'#a78bfa'}}>Self contribution (max ₹50K extra)</div></div>
                <div style={{fontWeight:700, color:'#a78bfa'}}>₹{Number(data.taxBreakdown.section80CCD1B||0).toLocaleString('en-IN')}</div>
              </div>
              <div style={{flex:1, padding:'14px 18px', background:'rgba(167,139,250,0.05)', borderRadius:'10px', border:'1px solid rgba(167,139,250,0.15)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div><div style={{fontSize:'11px', color:'var(--text-muted)'}}>Section 80CCD(2)</div><div style={{fontSize:'12px', color:'#a78bfa'}}>Employer contribution (no cap)</div></div>
                <div style={{fontWeight:700, color:'#a78bfa'}}>₹{Number(data.taxBreakdown.section80CCD2||0).toLocaleString('en-IN')}</div>
              </div>
            </div>
          )}

          {/* Account Cards */}
          {data.accounts?.length > 0 ? data.accounts.map((acc, i) => (
            <div key={i} className="glass-panel" style={{padding:'24px',marginBottom:'16px', borderLeft:'4px solid #3b82f6'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'16px'}}>
                <div>
                  <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                    <h4 style={{margin:0}}>{acc.memberName || 'NPS Account'}</h4>
                    <span style={{fontSize:'10px', padding:'2px 8px', borderRadius:'8px', background:'rgba(59,130,246,0.15)', color:'#3b82f6', fontWeight:600}}>{acc.tier}</span>
                  </div>
                  <p style={{fontSize:'11px',color:'var(--text-muted)',margin:'4px 0 0'}}>PRAN: {acc.pranNumber || 'N/A'} · Expected Return: {acc.expectedReturn}% p.a.</p>
                </div>
                <button className="icon-btn danger" onClick={()=>handleDelete(acc.id)}  title="Delete"><Trash2 size={14}/></button>
              </div>

              {/* Asset Allocation Bar */}
              <div style={{marginBottom:'16px'}}>
                <div style={{fontSize:'11px', color:'var(--text-muted)', marginBottom:'6px'}}>Asset Allocation</div>
                <div style={{display:'flex', borderRadius:'8px', overflow:'hidden', height:'8px'}}>
                  <div style={{width:`${acc.equityPct}%`, background:'#ef4444'}} title={`Equity ${acc.equityPct}%`}></div>
                  <div style={{width:`${acc.corpBondPct}%`, background:'#f59e0b'}} title={`Corp Bonds ${acc.corpBondPct}%`}></div>
                  <div style={{width:`${acc.govtSecPct}%`, background:'#10b981'}} title={`Govt Sec ${acc.govtSecPct}%`}></div>
                </div>
                <div style={{display:'flex', justifyContent:'space-between', fontSize:'10px', marginTop:'4px', color:'var(--text-muted)'}}>
                  <span style={{color:'#ef4444'}}>E: {acc.equityPct}%</span>
                  <span style={{color:'#f59e0b'}}>C: {acc.corpBondPct}%</span>
                  <span style={{color:'#10b981'}}>G: {acc.govtSecPct}%</span>
                </div>
              </div>

              {/* Projection Grid */}
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'12px', marginBottom:'16px'}}>
                <div style={{padding:'12px',background:'rgba(255,255,255,0.02)',borderRadius:'8px',textAlign:'center'}}>
                  <div style={{fontSize:'11px',color:'var(--text-muted)'}}>Current</div>
                  <div style={{fontWeight:700}}>₹{Number(acc.currentValue||0).toLocaleString('en-IN')}</div>
                </div>
                <div style={{padding:'12px',background:'rgba(255,255,255,0.02)',borderRadius:'8px',textAlign:'center'}}>
                  <div style={{fontSize:'11px',color:'var(--text-muted)'}}>Projected</div>
                  <div style={{fontWeight:700,color:'#3b82f6'}}>₹{Number(acc.projectedCorpus||0).toLocaleString('en-IN')}</div>
                </div>
                <div style={{padding:'12px',background:'rgba(255,255,255,0.02)',borderRadius:'8px',textAlign:'center'}}>
                  <div style={{fontSize:'11px',color:'var(--text-muted)'}}>Wealth Gain</div>
                  <div style={{fontWeight:700,color:'#10b981'}}>₹{Number(acc.wealthGain||0).toLocaleString('en-IN')}</div>
                  <div style={{fontSize:'10px', color:'var(--text-muted)'}}>{acc.wealthMultiplier}x multiplier</div>
                </div>
                <div style={{padding:'12px',background:'rgba(255,255,255,0.02)',borderRadius:'8px',textAlign:'center'}}>
                  <div style={{fontSize:'11px',color:'var(--text-muted)'}}>Monthly Pension</div>
                  <div style={{fontWeight:700,color:'#10b981'}}>₹{Number(acc.monthlyPension||0).toLocaleString('en-IN')}</div>
                </div>
              </div>

              {/* Lumpsum / Annuity Split */}
              <div style={{display:'flex', gap:'12px'}}>
                <div style={{flex:1, padding:'12px', background:'rgba(16,185,129,0.05)', borderRadius:'8px', border:'1px solid rgba(16,185,129,0.15)'}}>
                  <div style={{fontSize:'11px', color:'var(--text-muted)'}}>60% Tax-Free Lumpsum</div>
                  <div style={{fontSize:'15px', fontWeight:700, color:'var(--accent-emerald)'}}>₹{Number(acc.lumpsum||0).toLocaleString('en-IN')}</div>
                </div>
                <div style={{flex:1, padding:'12px', background:'rgba(59,130,246,0.05)', borderRadius:'8px', border:'1px solid rgba(59,130,246,0.15)'}}>
                  <div style={{fontSize:'11px', color:'var(--text-muted)'}}>40% Mandatory Annuity</div>
                  <div style={{fontSize:'15px', fontWeight:700, color:'#3b82f6'}}>₹{Number(acc.annuityCorpus||0).toLocaleString('en-IN')}</div>
                </div>
              </div>

              {/* Growth Timeline */}
              {acc.timeline?.length > 1 && (
                <div style={{marginTop:'16px'}}>
                  <div style={{fontSize:'11px', color:'var(--text-muted)', marginBottom:'8px'}}>Growth Timeline</div>
                  <div style={{display:'flex', gap:'6px', alignItems:'flex-end', height:'60px'}}>
                    {acc.timeline.map((t, j) => {
                      const maxVal = acc.timeline[acc.timeline.length-1].value;
                      const heightPct = maxVal > 0 ? Math.max(5, (t.value / maxVal) * 100) : 5;
                      return (
                        <div key={j} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'4px'}}>
                          <div style={{width:'100%', height:`${heightPct}%`, background:'linear-gradient(180deg, #3b82f6, #06b6d4)', borderRadius:'4px 4px 0 0', minHeight:'4px'}} title={`Year ${t.year}: ₹${Number(t.value||0).toLocaleString('en-IN')}`}></div>
                          <span style={{fontSize:'9px', color:'var(--text-muted)'}}>{t.year}y</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )) : (
            <div className="empty-state glass-panel"><PackageOpen size={48} style={{opacity:0.3,marginBottom:'12px'}}/><h4>No NPS Accounts</h4><p>Add your PRAN to see retirement projections.</p></div>
          )}
        </>
      )}

      {confirmDelete && (
        <ConfirmationModal
          title="Delete NPS Account"
          message="Are you sure you want to delete this NPS account?"
          onConfirm={() => { delMut.mutate(confirmDelete); setConfirmDelete(null); }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
export default NPSTracker;
