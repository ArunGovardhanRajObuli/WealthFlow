import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Trash2, Clock, Shield, TrendingUp, Landmark, Percent, BarChart3, AlertTriangle, PackageOpen } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import { parseToPaiseBigInt, formatBigIntToDecimalString } from '../utils/bigIntMath';
import CustomSelect from './ui/CustomSelect';

function FDLadder() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({bankName:'',principal:'',interestRate:'',tenureMonths:'12',startDate:new Date().toISOString().split('T')[0],isAutoRenew:false,isTaxSaver:false,isHistorical:false,owner_member_id:'',joint_owner_member_id:'',owner_split_percent:'100',source_bank_id:''});
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  const { data: fdRes, isLoading: l1, error: e1 } = useQuery({ queryKey: ['fd-ladder'], queryFn: () => fetch('/api/fixed-deposits').then(r=>r.json()) });
  const { data: famRes, isLoading: l2 } = useQuery({ queryKey: ['family-members'], queryFn: () => fetch('/api/family-members').then(r=>r.json()) });
  const { data: bankRes, isLoading: l3 } = useQuery({ queryKey: ['bank-balances'], queryFn: () => fetch('/api/bank-balances').then(r=>r.json()) });

  const loading = l1 || l2 || l3;
  const error = e1 ? 'Failed to load FD data.' : null;
  const rawFds = fdRes?.fds || fdRes?.data || [];
  const totalInv = fdRes?.totalInvested ?? rawFds.reduce((s, f) => s + Number(f.principal || 0), 0);
  const data = {
    ...fdRes,
    fds: rawFds,
    totalInvested: totalInv
  };
  const familyMembers = famRes?.data || [];

  const banks = bankRes?.data || [];

  const addMut = useMutation({
    mutationFn: (newFd) => fetch('/api/fixed-deposits', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(newFd) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fd-ladder'] });
      queryClient.invalidateQueries({ queryKey: ['bank-balances'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['family-estate-ledger'] });
      setShowForm(false);
      setForm({bankName:'',principal:'',interestRate:'',tenureMonths:'12',startDate:new Date().toISOString().split('T')[0],isAutoRenew:false,isTaxSaver:false,isHistorical:false,owner_member_id:'',joint_owner_member_id:'',owner_split_percent:'100',source_bank_id:''});
    }
  });

  const delMut = useMutation({
    mutationFn: (id) => fetch(`/api/fixed-deposits/${id}`,{method:'DELETE'}),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['fd-ladder'] });
        queryClient.invalidateQueries({ queryKey: ['bank-balances'] });
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['family-estate-ledger'] });
    }
  });

  const handleAdd = () => {
    if (!form.bankName || !form.principal) return;
    const principalPaise = parseToPaiseBigInt(form.principal);
    if (principalPaise < 0n) return;
    const principalStr = formatBigIntToDecimalString(principalPaise);
    
    let interestRate = parseFloat(form.interestRate);
    interestRate = isNaN(interestRate) || interestRate < 0 ? 0 : Math.round(interestRate * 100) / 100;
    
    const tenureMonths = parseInt(form.tenureMonths);
    let owner_split_percent = parseFloat(form.owner_split_percent);
    owner_split_percent = isNaN(owner_split_percent) || owner_split_percent < 0 ? 100 : Math.round(owner_split_percent * 100) / 100;

    if (isNaN(tenureMonths) || tenureMonths < 0) return;
    if (!form.isHistorical && !form.source_bank_id) return;

    addMut.mutate({...form, principal: principalStr, interestRate, tenureMonths, isHistorical: form.isHistorical, owner_member_id: form.owner_member_id || null, joint_owner_member_id: form.joint_owner_member_id || null, owner_split_percent, source_bank_id: form.source_bank_id || null});
  };
  const handleDelete = (id) => {
    setConfirmModal({
        isOpen: true,
        title: 'Delete FD',
        message: 'Delete this fixed deposit?',
        onConfirm: () => {
            delMut.mutate(id);
            setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });
        }
    });
  };

  if (loading) return <div className="glass-panel animate-fade-in"><p style={{color:'var(--text-muted)'}}>Loading FD Ladder...</p></div>;

  const inputStyle = { padding:'10px', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border-color)', borderRadius:'8px', color:'var(--text-primary)', fontSize:'13px', width:'100%' };

  const statusConfig = {
    matured: { color:'#10b981', label:'✅ Matured', bg:'rgba(16,185,129,0.1)' },
    maturing_soon: { color:'#ef4444', label:'🔴 <30 days', bg:'rgba(239,68,68,0.1)' },
    maturing_quarter: { color:'#f59e0b', label:'🟡 <90 days', bg:'rgba(245,158,11,0.1)' },
    active: { color:'#3b82f6', label:'🔵 Active', bg:'rgba(59,130,246,0.05)' }
  };

  return (
    <div className="animate-fade-in">
      {error && <div className="alert-banner danger" style={{marginBottom:'20px'}}><AlertTriangle size={16}/> {error}</div>}

      <div className="section-header">
        <div>
          <h2>FD Ladder Engine</h2>
          <p>Quarterly Compounding · Maturity Schedule · Liquidity Gap Detection</p>
        </div>
        <button className="btn btn-purple" onClick={() => setShowForm(!showForm)}>
          {showForm ? <><X size={16} style={{marginRight:'6px'}} /> Cancel FD Addition</> : <><Plus size={16} style={{marginRight:'6px'}} /> Add FD</>}
        </button>
      </div>

      {showForm && (
        <div className="glass-panel animate-fade-in" style={{padding:'24px',marginBottom:'24px', borderLeft:'4px solid #8b5cf6'}}>
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:'16px'}}>
            <h3 style={{margin:0}}>New Fixed Deposit</h3>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px'}}>
            <input placeholder="Bank / Institution" value={form.bankName} onChange={e=>setForm({...form,bankName:e.target.value})} style={inputStyle} />
            <input type="number" placeholder="Principal (₹)" value={form.principal} onChange={e=>setForm({...form,principal:e.target.value})} style={inputStyle} />
            <input type="number" step="0.1" placeholder="Interest Rate (%)" value={form.interestRate} onChange={e=>setForm({...form,interestRate:e.target.value})} style={inputStyle} />
            <input type="number" placeholder="Tenure (months)" value={form.tenureMonths} onChange={e=>setForm({...form,tenureMonths:e.target.value})} style={inputStyle} />
            <input type="date" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})} style={inputStyle} title="Start Date" />
            
            <CustomSelect value={form.owner_member_id} onChange={e => setForm({...form, owner_member_id: e.target.value})} style={{...inputStyle, appearance:'none'}}>
               <option value="">-- Primary Owner --</option>
               {familyMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </CustomSelect>
            <CustomSelect value={form.joint_owner_member_id} onChange={e => setForm({...form, joint_owner_member_id: e.target.value})} style={{...inputStyle, appearance:'none'}}>
               <option value="">-- Joint Owner --</option>
               {familyMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </CustomSelect>
            <div style={{display:'flex', alignItems:'center', gap:'4px', background:'rgba(255,255,255,0.05)', borderRadius:'8px', paddingRight:'12px', border: '1px solid var(--border-color)'}}>
               <input type="number" min="0" max="100" placeholder="Split %" value={form.owner_split_percent} onChange={e => setForm({...form, owner_split_percent: e.target.value})} style={{...inputStyle, background:'none', border:'none'}} />
               <span style={{color:'var(--text-muted)', fontSize:'12px'}}>%</span>
            </div>

            <div style={{display:'flex', gap:'16px', alignItems:'center', gridColumn:'span 3'}}>
              <label style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',color:'var(--text-muted)'}}>
                <input type="checkbox" checked={form.isAutoRenew} onChange={e=>setForm({...form,isAutoRenew:e.target.checked})} /> Auto-Renew
              </label>
              <label style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',color:'var(--text-muted)'}}>
                <input type="checkbox" checked={form.isTaxSaver} onChange={e=>setForm({...form,isTaxSaver:e.target.checked})} /> Tax Saver (80C)
              </label>
              <label style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',color:'var(--text-muted)'}}>
                <input type="checkbox" checked={form.isHistorical} onChange={e=>{
                    setForm({...form,isHistorical:e.target.checked, source_bank_id: e.target.checked ? '' : form.source_bank_id});
                }} /> Existing FD (won't debit ledger)
              </label>
            </div>
            
            {!form.isHistorical && (
                <div style={{gridColumn: 'span 3'}}>
                    <CustomSelect required value={form.source_bank_id} onChange={e => setForm({...form, source_bank_id: e.target.value})} style={{...inputStyle, appearance:'none', width: '32.5%'}}>
                        <option value="" disabled>-- Funding Bank Account --</option>
                        {banks.map(b => <option key={b.id} value={b.id}>{b.bankName}{b.accountNumber ? ` (...${b.accountNumber.slice(-4)})` : ''} - ₹{(b.ledgerBalance || 0).toLocaleString('en-IN')}</option>)}
                    </CustomSelect>
                </div>
            )}
          </div>
          <button onClick={handleAdd} style={{marginTop:'16px', padding:'12px', background:'#8b5cf6', border:'none', borderRadius:'8px', color:'#fff', fontWeight:600, cursor:'pointer', width:'100%'}}>Save Fixed Deposit</button>
        </div>
      )}

      {data && (
        <>
          {/* Summary Cards */}
          <div className="stat-grid" style={{marginBottom:'24px'}}>
            <div className="stat-card" style={{'--stat-accent':'var(--text-secondary)','--stat-color':'var(--text-secondary)'}}>
              <div className="stat-card-icon"><Landmark size={20}/></div>
              <div className="stat-card-label">Total Invested</div>
              <div className="stat-card-value">₹{Number(data.totalInvested||0).toLocaleString('en-IN')}</div>
              <div className="stat-card-sub">{data.fds?.length || 0} deposits</div>
            </div>
            <div className="stat-card" style={{'--stat-accent':'#10b981','--stat-color':'#10b981'}}>
              <div className="stat-card-icon"><TrendingUp size={20}/></div>
              <div className="stat-card-label">Maturity Value</div>
              <div className="stat-card-value">₹{Number(data.totalMaturity||0).toLocaleString('en-IN')}</div>
            </div>
            <div className="stat-card" style={{'--stat-accent':'#f59e0b','--stat-color':'#f59e0b'}}>
              <div className="stat-card-icon"><Percent size={20}/></div>
              <div className="stat-card-label">Interest Earned</div>
              <div className="stat-card-value">₹{Number(data.totalInterest||0).toLocaleString('en-IN')}</div>
            </div>
            <div className="stat-card" style={{'--stat-accent':'#8b5cf6','--stat-color':'#8b5cf6'}}>
              <div className="stat-card-icon"><BarChart3 size={20}/></div>
              <div className="stat-card-label">Weighted Avg Rate</div>
              <div className="stat-card-value">{data.weightedAvgRate||0}%</div>
              <div className="stat-card-sub">Simple: {data.avgRate||0}%</div>
            </div>
          </div>

          {/* Alert Banners */}
          {data.maturedCount > 0 && (
            <div className="alert-banner success" style={{marginBottom:'16px'}}>
              <span>✅ {data.maturedCount} FD(s) have matured — collect or reinvest</span>
            </div>
          )}
          {data.maturingSoonCount > 0 && (
            <div className="alert-banner warning" style={{marginBottom:'16px'}}>
              <span>⏰ {data.maturingSoonCount} FD(s) maturing within 90 days</span>
            </div>
          )}
          {data.taxSaverTotal > 0 && (
            <div className="alert-banner info" style={{marginBottom:'16px'}}>
              <span><Shield size={14} style={{marginRight:'6px', verticalAlign:'middle'}}/>Tax Saver FDs (Sec 80C): ₹{Number(data.taxSaverTotal||0).toLocaleString('en-IN')} locked</span>
            </div>
          )}

          {/* Liquidity Gap Warning */}
          {data.liquidityGaps?.length > 18 && (
            <div className="alert-banner danger" style={{marginBottom:'16px'}}>
              <span><AlertTriangle size={14} style={{marginRight:'6px', verticalAlign:'middle'}}/>⚠ Poor ladder coverage — {data.liquidityGaps.length}/24 months have no maturing FDs. Consider staggering tenures.</span>
            </div>
          )}

          {/* FD List */}
          {data.fds?.length > 0 ? (
            <div className="glass-panel" style={{padding:'24px'}}>
              <h3 style={{marginBottom:'16px'}}>FD Portfolio ({data.fds.length} deposits)</h3>
              <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                {data.fds.map(fd => {
                  const sc = statusConfig[fd.status] || statusConfig.active;
                  return (
                    <div key={fd.id} style={{padding:'18px', background:sc.bg, borderRadius:'14px', borderLeft:`3px solid ${sc.color}`}}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px'}}>
                        <div>
                          <div style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px'}}>
                            <h4 style={{fontSize:'15px', margin:0}}>{fd.bankName}</h4>
                            <span className={`urgency-badge ${fd.status === 'matured' ? 'safe' : fd.status === 'maturing_soon' ? 'critical' : fd.status === 'maturing_quarter' ? 'warning' : 'info'}`}>{sc.label}</span>
                            {fd.isAutoRenew ? <span className="urgency-badge info">♻ Auto</span> : null}
                            {fd.isTaxSaver ? <span className="urgency-badge info" style={{background:'rgba(139,92,246,0.15)', color:'#a78bfa'}}>🛡 80C</span> : null}
                          </div>
                          <p style={{fontSize:'11px',color:'var(--text-muted)',margin:0}}>
                            ₹{Number(fd.principal||0).toLocaleString('en-IN')} @ {fd.interestRate}% · {fd.tenureMonths}mo · Started {fd.startDate}
                          </p>
                        </div>
                        <button className="icon-btn danger" onClick={()=>handleDelete(fd.id)}  title="Delete"><Trash2 size={14}/></button>
                      </div>
                      
                      {/* Progress Bar */}
                      <div style={{marginBottom:'10px'}}>
                        <div style={{display:'flex', justifyContent:'space-between', fontSize:'11px', color:'var(--text-muted)', marginBottom:'4px'}}>
                          <span>{fd.elapsedPct}% elapsed</span>
                          <span style={{display:'flex', alignItems:'center', gap:'4px'}}>
                            <Clock size={10}/>
                            {fd.status === 'matured' ? 'Matured!' : `${fd.daysToMaturity} days left`}
                          </span>
                        </div>
                        <div style={{width:'100%', height:'6px', background:'rgba(255,255,255,0.05)', borderRadius:'3px', overflow:'hidden'}}>
                          <div style={{width:`${fd.elapsedPct}%`, height:'100%', background:`linear-gradient(90deg, ${sc.color}, ${sc.color}88)`, borderRadius:'3px', transition:'width 0.3s ease'}}></div>
                        </div>
                      </div>

                      {/* Value Row */}
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                        <div style={{display:'flex', gap:'24px', fontSize:'13px'}}>
                          <div><span style={{color:'var(--text-muted)', fontSize:'11px'}}>Maturity Value</span><div style={{fontWeight:700, color:'#10b981'}}>₹{Number(fd.maturityAmount||0).toLocaleString('en-IN')}</div></div>
                          <div><span style={{color:'var(--text-muted)', fontSize:'11px'}}>Interest</span><div style={{fontWeight:700, color:'#f59e0b'}}>+₹{Number(fd.interestEarned||0).toLocaleString('en-IN')}</div></div>
                          <div><span style={{color:'var(--text-muted)', fontSize:'11px'}}>Matures</span><div style={{fontWeight:600}}>{fd.maturityDate}</div></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="empty-state glass-panel"><PackageOpen size={48} style={{opacity:0.3,marginBottom:'12px'}}/><h4>No FDs Yet</h4><p>Add your first fixed deposit to build your liquidity ladder.</p></div>
          )}
        </>
      )}
      <ConfirmationModal 
        isOpen={confirmModal.isOpen} 
        title={confirmModal.title} 
        message={confirmModal.message} 
        onConfirm={confirmModal.onConfirm} 
        onCancel={() => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null })} 
      />
    </div>
  );
}
export default FDLadder;
