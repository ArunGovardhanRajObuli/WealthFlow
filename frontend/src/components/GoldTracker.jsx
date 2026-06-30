import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Plus, X, Trash2, Clock, TrendingUp, Scale, Banknote, BarChart3, PackageOpen, AlertTriangle } from 'lucide-react';
import { parseToPaiseBigInt, formatBigIntToDecimalString } from '../utils/bigIntMath';
import ConfirmationModal from './ConfirmationModal';
import CustomSelect from './ui/CustomSelect';

function GoldTracker() {
  const queryClient = useQueryClient();
  const { data: goldRes, isLoading: l1, error: e1 } = useQuery({ queryKey: ['gold-portfolio'], queryFn: () => fetch('/api/gold-holdings/portfolio').then(r=>r.json()) });
  const { data: famRes, isLoading: l2 } = useQuery({ queryKey: ['family-members'], queryFn: () => fetch('/api/family-members').then(r=>r.json()) });
  const { data: bankRes, isLoading: l3 } = useQuery({ queryKey: ['bank-balances'], queryFn: () => fetch('/api/bank-balances').then(r=>r.json()) });

  const loading = l1 || l2 || l3;
  const error = e1 ? 'Failed to load gold portfolio.' : null;
  const data = goldRes;
  const familyMembers = famRes?.data || [];
  const bankBalances = bankRes?.data || [];

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type:'Physical', title:'', weightGrams:'', purchasePricePerGram:'', purchaseDate:'', interestRate:'2.5', maturityDate:'', owner_member_id: '', joint_owner_member_id: '', owner_split_percent: '100', source_bank_id: '', joint_bank_id: '', split_amount: '' });
  const [isHistorical, setIsHistorical] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncInfo, setSyncInfo] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, id: null });
  const [deleteError, setDeleteError] = useState(null);

  const syncMut = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/gold-holdings/sync', { method: 'POST' });
      const d = await r.json();
      if (!d.success) throw new Error(d.error || 'Unknown error');
      return d;
    },
    onSuccess: (d) => {
      setSyncInfo(d);
      queryClient.invalidateQueries({ queryKey: ['gold-portfolio'] });
      setSyncing(false);
    },
    onError: (e) => {
      alert('Sync error: ' + e.message);
      setSyncing(false);
    }
  });

  const addMut = useMutation({
    mutationFn: (newGold) => fetch('/api/gold-holdings', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(newGold) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gold-portfolio'] });
      queryClient.invalidateQueries({ queryKey: ['bank-balances'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['family-estate-ledger'] });
      setShowForm(false);
      setForm({ type:'Physical', title:'', weightGrams:'', purchasePricePerGram:'', purchaseDate:'', interestRate:'2.5', maturityDate:'', owner_member_id: '', joint_owner_member_id: '', owner_split_percent: '100', source_bank_id: '', joint_bank_id: '', split_amount: '' });
      setIsHistorical(false);
    }
  });

  const delMut = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/gold-holdings/${id}`, { method: 'DELETE', headers: { 'Accept': 'application/json' } });
      if (!res.ok) { let e; try { e = await res.json(); } catch (err) { throw new Error(`Network or server error (${res.status})`, { cause: err }); } throw new Error(e?.error || 'Failed to delete gold holding'); }
      if (res.status === 204) return null;
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gold-portfolio'] });
      queryClient.invalidateQueries({ queryKey: ['bank-balances'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['family-estate-ledger'] });
      setConfirmDelete({ isOpen: false, id: null });
      setDeleteError(null);
    },
    onError: (err) => setDeleteError(err.message)
  });

  const handleSync = () => {
    setSyncing(true);
    syncMut.mutate();
  };

  const handleAdd = () => {
    if (!form.title || !form.weightGrams) return;
    
    const safeWeight = Math.round(parseFloat(form.weightGrams) * 1000) / 1000;
    const safeBuyPricePaise = parseToPaiseBigInt(form.purchasePricePerGram);
    const safeInterest = form.type === 'SGB' ? (parseFloat(form.interestRate) || 2.5) : 0;
    const safeSplit = Math.max(0, Math.min(100, parseFloat(form.owner_split_percent) || 100));

    if (isNaN(safeWeight) || safeWeight <= 0 || safeBuyPricePaise < 0n) {
        alert("Invalid weight or purchase price.");
        return;
    }

    const safeBuyPriceStr = formatBigIntToDecimalString(safeBuyPricePaise);

    addMut.mutate({
      ...form, 
      weightGrams: safeWeight, 
      purchasePricePerGram: safeBuyPriceStr,
      currentPricePerGram: (syncInfo?.livePrice > 0 ? formatBigIntToDecimalString(parseToPaiseBigInt(syncInfo.livePrice)) : safeBuyPriceStr),
      interestRate: safeInterest, 
      isHistorical,
      owner_member_id: form.owner_member_id || null, 
      joint_owner_member_id: form.joint_owner_member_id || null, 
      owner_split_percent: safeSplit,
      source_bank_id: form.source_bank_id || null,
      joint_bank_id: form.joint_bank_id || null,
      split_amount: form.split_amount ? formatBigIntToDecimalString(parseToPaiseBigInt(form.split_amount)) : "0"
    });
  };

  const handleDelete = (id) => { setConfirmDelete({ isOpen: true, id }); };

  if (loading) return <div className="glass-panel animate-fade-in"><p style={{color:'var(--text-muted)'}}>Loading gold portfolio...</p></div>;

  const typeColors = { Physical: '#f59e0b', SGB: '#10b981', 'Digital Gold': '#8b5cf6', 'Gold ETF': '#3b82f6' };
  const typeIcons = { Physical: '🪙', SGB: '🏛️', 'Digital Gold': '💎', 'Gold ETF': '📈' };
  const inputStyle = { padding:'10px', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border-color)', borderRadius:'8px', color:'var(--text-primary)', fontSize:'13px', width:'100%' };
  const isSGB = form.type === 'SGB';

  return (
    <div className="animate-fade-in">
      <ConfirmationModal
          isOpen={confirmDelete.isOpen}
          title="Delete Gold Holding"
          message={deleteError ? <span style={{color: '#ef4444', fontWeight: 500}}>{deleteError}</span> : "Are you sure you want to delete this gold holding? This will also remove any linked ledger transactions."}
          confirmText="Delete"
          confirmStyle="danger"
          onCancel={() => { setConfirmDelete({ isOpen: false, id: null }); setDeleteError(null); }}
          onConfirm={() => {
              setDeleteError(null);
              if (confirmDelete.id) delMut.mutate(confirmDelete.id);
          }}
          keepOpenOnConfirm={true}
      />
      {error && <div className="alert-banner danger" style={{marginBottom:'20px'}}><AlertTriangle size={16}/> {error}</div>}

      {/* Header */}
      <div className="section-header">
        <div>
          <h2>Gold & SGB Vault</h2>
          <p>Live Market · SGB Interest Accrual · Maturity Tracking</p>
        </div>
        <div style={{display:'flex', gap:'12px'}}>
          <button onClick={handleSync} disabled={syncing} className="btn" style={{padding:'10px 20px', background: syncing ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.1)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'10px', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:'8px'}}>
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing...' : 'Sync Gold Price'}
          </button>
          <button className="btn btn-gold" onClick={() => setShowForm(!showForm)}>
            {showForm ? <><X size={16} style={{marginRight:'6px'}} /> Cancel Gold Addition</> : <><Plus size={16} style={{marginRight:'6px'}} /> Add Gold</>}
          </button>
        </div>
      </div>

      {/* Live Price Ticker */}
      {syncInfo && (
        <div className="animate-fade-in" style={{padding:'14px 20px', background:'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(217,119,6,0.05))', borderRadius:'12px', border:'1px solid rgba(245,158,11,0.2)', marginBottom:'24px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div style={{display:'flex', gap:'24px', alignItems:'center'}}>
            <div><span style={{fontSize:'11px', color:'var(--text-muted)'}}>Live Gold (24K)</span><div style={{fontSize:'20px', fontWeight:800, color:'#f59e0b'}}>₹{syncInfo.livePrice?.toLocaleString('en-IN')}/g</div></div>
            <div><span style={{fontSize:'11px', color:'var(--text-muted)'}}>COMEX</span><div style={{fontSize:'14px', fontWeight:600}}>${syncInfo.usdPerOz}/oz</div></div>
            <div><span style={{fontSize:'11px', color:'var(--text-muted)'}}>USD/INR</span><div style={{fontSize:'14px', fontWeight:600}}>₹{syncInfo.inrPerUsd}</div></div>
          </div>
          <div style={{fontSize:'11px', color:'var(--text-muted)', textAlign:'right'}}>
            <div>{syncInfo.updatedRows} holdings updated</div>
            <div>{new Date(syncInfo.syncedAt).toLocaleTimeString('en-IN')}</div>
          </div>
        </div>
      )}

      {/* Add Form */}
      {showForm && (
        <div className="glass-panel animate-fade-in" style={{padding:'24px', marginBottom:'24px', borderLeft:'4px solid #f59e0b'}}>
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:'16px'}}>
            <h3 style={{margin:0}}>Add Gold Holding</h3>
            <button onClick={()=>setShowForm(false)} style={{background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer'}}><X size={18}/></button>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px'}}>
            <CustomSelect value={form.type} onChange={e=>setForm({...form, type:e.target.value})} style={inputStyle}>
              <option value="Physical">🪙 Physical Gold</option><option value="SGB">🏛️ Sovereign Gold Bond</option><option value="Digital Gold">💎 Digital Gold</option><option value="Gold ETF">📈 Gold ETF</option>
            </CustomSelect>
            <input placeholder="Title (e.g. SGB 2024-25 Series I)" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} style={inputStyle} />
            <input type="number" step="0.01" placeholder="Weight (grams)" value={form.weightGrams} onChange={e=>setForm({...form,weightGrams:e.target.value})} style={inputStyle} />
            <input type="number" placeholder="Purchase Price/gram (₹)" value={form.purchasePricePerGram} onChange={e=>setForm({...form,purchasePricePerGram:e.target.value})} style={inputStyle} />
            <input type="date" value={form.purchaseDate} onChange={e=>setForm({...form,purchaseDate:e.target.value})} style={inputStyle} title="Purchase Date" />
            
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

            {isSGB && <input type="number" step="0.1" placeholder="Interest Rate (% p.a.)" value={form.interestRate} onChange={e=>setForm({...form,interestRate:e.target.value})} style={inputStyle} />}
            {isSGB && <input type="date" value={form.maturityDate} onChange={e=>setForm({...form,maturityDate:e.target.value})} style={inputStyle} title="Maturity Date" />}
            <div style={{display:'flex', alignItems:'center', gap:'8px', gridColumn: '1 / -1'}}>
              <input type="checkbox" id="goldHistorical" checked={isHistorical} onChange={e=>setIsHistorical(e.target.checked)} />
              <label htmlFor="goldHistorical" style={{fontSize:'12px', color:'var(--text-muted)'}}>Existing holding (won't debit ledger)</label>
            </div>
            
            {!isHistorical && (
                <>
                  <CustomSelect value={form.source_bank_id} onChange={e => setForm({...form, source_bank_id: e.target.value})} style={{...inputStyle, appearance:'none', gridColumn: 'span 1'}}>
                      <option value="">-- Funding Bank Account --</option>
                      {bankBalances.map(b => <option key={b.id} value={b.id}>{b.bankName}{b.accountNumber ? ` (...${b.accountNumber.slice(-4)})` : ''} - ₹{(b.ledgerBalance || 0).toLocaleString('en-IN')}</option>)}
                    </CustomSelect>
                  {form.joint_owner_member_id && (
                     <>
                        <CustomSelect value={form.joint_bank_id} onChange={e => setForm({...form, joint_bank_id: e.target.value})} style={{...inputStyle, appearance:'none', gridColumn: 'span 1'}}>
                            <option value="">-- Joint Owner Funding Bank --</option>
                            {bankBalances.map(b => <option key={b.id} value={b.id}>{b.bankName}{b.accountNumber ? ` (...${b.accountNumber.slice(-4)})` : ''}</option>)}
                        </CustomSelect>
                        <input type="number" placeholder="Actual Joint Amount Paid" value={form.split_amount} onChange={e => setForm({...form, split_amount: e.target.value})} style={{...inputStyle, gridColumn: 'span 1'}} />
                     </>
                  )}
                </>
            )}
            
            <div style={{gridColumn: '1 / -1'}}>
              <button onClick={handleAdd} style={{width:'100%', padding:'12px', background:'#f59e0b', border:'none', borderRadius:'8px', color:'#000', fontWeight:600, cursor:'pointer'}}>Save Holding</button>
            </div>
          </div>
        </div>
      )}

      {data && (
        <>
          {/* Portfolio Summary */}
          <div className="stat-grid" style={{marginBottom:'24px'}}>
            <div className="stat-card" style={{'--stat-accent':'#f59e0b','--stat-color':'#f59e0b'}}>
              <div className="stat-card-icon"><Scale size={20}/></div>
              <div className="stat-card-label">Total Weight</div>
              <div className="stat-card-value">{data.totalWeightGrams}g</div>
            </div>
            <div className="stat-card" style={{'--stat-accent':'var(--text-secondary)','--stat-color':'var(--text-secondary)'}}>
              <div className="stat-card-icon"><Banknote size={20}/></div>
              <div className="stat-card-label">Total Invested</div>
              <div className="stat-card-value">₹{Number(data.totalInvested || 0).toLocaleString('en-IN')}</div>
            </div>
            <div className="stat-card" style={{'--stat-accent':'var(--accent-emerald)','--stat-color':'var(--accent-emerald)'}}>
              <div className="stat-card-icon"><TrendingUp size={20}/></div>
              <div className="stat-card-label">Live Value</div>
              <div className="stat-card-value">₹{Number(data.totalCurrentValue || 0).toLocaleString('en-IN')}</div>
            </div>
            <div className="stat-card" style={{'--stat-accent':data.unrealizedGain>=0?'#10b981':'#ef4444','--stat-color':data.unrealizedGain>=0?'#10b981':'#ef4444'}}>
              <div className="stat-card-icon"><BarChart3 size={20}/></div>
              <div className="stat-card-label">Unrealized P&L</div>
              <div className="stat-card-value">{data.unrealizedGain>=0?'+':''}₹{Number(data.unrealizedGain || 0).toLocaleString('en-IN')}</div>
              <div className="stat-card-sub">{data.returnPct>=0?'+':''}{data.returnPct}%</div>
            </div>
          </div>

          {/* SGB Interest Card */}
          {data.totalSGBInterestAccrued > 0 && (
            <div style={{padding:'16px 20px', background:'rgba(16,185,129,0.05)', borderRadius:'12px', border:'1px solid rgba(16,185,129,0.2)', marginBottom:'24px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div>
                <div style={{fontSize:'13px', fontWeight:600, color:'var(--accent-emerald)'}}>🏛️ SGB Interest Accrued (Paid Semi-Annually)</div>
                <div style={{fontSize:'11px', color:'var(--text-muted)', marginTop:'2px'}}>2.5% p.a. on initial investment value, paid to your bank every 6 months</div>
              </div>
              <div style={{fontSize:'20px', fontWeight:800, color:'var(--accent-emerald)'}}>₹{Number(data.totalSGBInterestAccrued || 0).toLocaleString('en-IN')}</div>
            </div>
          )}

          {/* Type Breakdown */}
          {Object.keys(data.byType || {}).length > 1 && (
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'12px', marginBottom:'24px'}}>
              {Object.entries(data.byType).map(([type, d]) => (
                <div key={type} style={{padding:'16px', background:'rgba(255,255,255,0.02)', borderRadius:'12px', borderLeft:`3px solid ${typeColors[type]||'#6b7280'}`}}>
                  <div style={{fontSize:'13px', fontWeight:600, marginBottom:'8px'}}>{typeIcons[type]||'🪙'} {type}</div>
                  <div style={{fontSize:'12px', color:'var(--text-muted)'}}>
                    <div>{d.count} holding{d.count>1?'s':''} · {d.weight.toFixed(1)}g</div>
                    <div style={{marginTop:'4px'}}>Invested: ₹{Math.round(d.invested).toLocaleString('en-IN')}</div>
                    <div style={{color: d.gain >= 0 ? '#10b981' : '#ef4444', fontWeight:600, marginTop:'2px'}}>
                      P&L: {d.gain>=0?'+':''}₹{Math.round(d.gain).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Holdings List */}
          {data.holdings?.length > 0 ? (
            <div className="glass-panel" style={{padding:'24px'}}>
              <h3 style={{marginBottom:'16px'}}>Holdings ({data.holdings.length})</h3>
              {data.holdings.map(h => (
                <div key={h.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px', background:'rgba(255,255,255,0.02)', borderRadius:'12px', marginBottom:'10px', borderLeft:`3px solid ${typeColors[h.type]||'#6b7280'}`}}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                      <h4 style={{fontSize:'14px',marginBottom:'2px', margin:0}}>{h.title || h.type}</h4>
                      <span style={{fontSize:'10px', padding:'2px 8px', borderRadius:'8px', background:`${typeColors[h.type]}20`, color:typeColors[h.type], fontWeight:600}}>{h.type}</span>
                    </div>
                    <p style={{fontSize:'11px',color:'var(--text-muted)',margin:'4px 0 0'}}>
                      {h.weightGrams}g · Buy: ₹{Number(h.purchasePricePerGram || 0).toLocaleString('en-IN')}/g · CMP: ₹{Number(h.currentPricePerGram || 0).toLocaleString('en-IN')}/g
                      {h.yearsHeld > 0 ? ` · ${h.yearsHeld}yr` : ''}
                    </p>
                    {h.type === 'SGB' && (
                      <div style={{display:'flex', gap:'16px', marginTop:'6px', fontSize:'11px'}}>
                        {h.sgbInterestAccrued > 0 && <span style={{color:'var(--accent-emerald)'}}>Interest Accrued: ₹{Number(h.sgbInterestAccrued).toLocaleString('en-IN')}</span>}
                        {h.daysToMaturity !== null && (
                          <span style={{color: h.daysToMaturity < 365 ? '#f59e0b' : 'var(--text-muted)', display:'flex', alignItems:'center', gap:'4px'}}>
                            <Clock size={10}/> {h.daysToMaturity > 0 ? `${h.daysToMaturity} days to maturity` : '✅ Matured!'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{textAlign:'right', marginRight:'12px'}}>
                    <div style={{fontSize:'15px',fontWeight:700}}>₹{Math.round(h.currentVal).toLocaleString('en-IN')}</div>
                    <div style={{fontSize:'12px', color:h.gain>=0?'#10b981':'#ef4444', display:'flex', alignItems:'center', justifyContent:'flex-end', gap:'4px'}}>
                      <TrendingUp size={10}/> {h.gain>=0?'+':''}₹{Math.round(h.gain).toLocaleString('en-IN')} ({h.gainPct}%)
                    </div>
                    <div style={{fontSize:'11px', color:'var(--text-muted)'}}>Invested: ₹{Math.round(h.invested).toLocaleString('en-IN')}</div>
                  </div>
                  <button className="icon-btn danger" onClick={()=>handleDelete(h.id)}  title="Delete"><Trash2 size={14}/></button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state glass-panel"><PackageOpen size={48} style={{opacity:0.3,marginBottom:'12px'}}/><h4>No Gold Holdings</h4><p>Click "Add Gold" to start tracking your precious metals.</p></div>
          )}
        </>
      )}


    </div>
  );
}
export default GoldTracker;
