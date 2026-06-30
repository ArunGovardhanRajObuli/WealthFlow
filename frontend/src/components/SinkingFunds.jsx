import React, { useState, useMemo } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Target, PiggyBank, Edit2, Check, X, Trash2, AlertTriangle, CalendarClock, PackageOpen } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import { parseToPaiseBigInt, formatBigIntToDecimalString } from '../utils/bigIntMath';
import CustomSelect from './ui/CustomSelect';

function SinkingFunds() {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [formData, setFormData] = useState({ title: '', targetAmount: '', currentAmount: '', targetDate: new Date().toISOString().split('T')[0], owner_member_id: '', joint_owner_member_id: '', owner_split_percent: 100 });
  const [fundingId, setFundingId] = useState(null);
  const [addAmount, setAddAmount] = useState('');
  const [sourceBankId, setSourceBankId] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  const inputStyle = { padding:'12px 16px', background:'rgba(20,20,20,0.8)', border:'1px solid var(--border-color)', borderRadius:'12px', color:'var(--text-primary)', fontSize:'14px', width:'100%', outline:'none', boxShadow:'inset 0 2px 4px 0 rgba(0, 0, 0, 0.4)', transition:'all 0.2s' };

  const { data: sfRes, isLoading: l1, error: e1 } = useQuery({ queryKey: ['sinking-funds'], queryFn: () => fetch('/api/sinking-funds').then(r=>r.json()) });
  const { data: bRes, isLoading: l2 } = useQuery({ queryKey: ['bank-balances'], queryFn: () => fetch('/api/bank-balances').then(r=>r.json()) });
  const { data: fmRes, isLoading: l3 } = useQuery({ queryKey: ['family-members'], queryFn: () => fetch('/api/family-members').then(r=>r.json()) });

  const funds = useMemo(() => sfRes?.data || [], [sfRes?.data]);
  const banks = useMemo(() => bRes?.data || [], [bRes?.data]);
  const familyMembers = useMemo(() => fmRes?.data || [], [fmRes?.data]);
  const error = e1 ? 'Failed to load sinking funds.' : null;

  const addMut = useMutation({
    mutationFn: (newFund) => fetch('/api/sinking-funds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newFund) }),
    onSuccess: () => { queryClient.invalidateQueries(['sinking-funds']); setIsAdding(false); setFormData({ title: '', targetAmount: '', currentAmount: '', targetDate: new Date().toISOString().split('T')[0], owner_member_id: '', joint_owner_member_id: '', owner_split_percent: 100 }); }
  });

  const editMut = useMutation({
    mutationFn: ({ id, data }) => fetch(`/api/sinking-funds/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries(['sinking-funds']); setEditingId(null); }
  });

  const fundMut = useMutation({
    mutationFn: ({ id, data }) => fetch(`/api/sinking-funds/${id}/fund`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['sinking-funds'] }); 
      queryClient.invalidateQueries({ queryKey: ['banks'] }); 
      queryClient.invalidateQueries({ queryKey: ['transactions'] }); 
      setFundingId(null); 
      setAddAmount(''); 
    }
  });

  const delMut = useMutation({
    mutationFn: (id) => fetch(`/api/sinking-funds/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries(['sinking-funds'])
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const tAmtPaise = parseToPaiseBigInt(formData.targetAmount);
    const cAmtPaise = parseToPaiseBigInt(formData.currentAmount || '0');
    if (tAmtPaise < 0n || cAmtPaise < 0n) return;
    addMut.mutate({ title: formData.title, targetAmount: formatBigIntToDecimalString(tAmtPaise), currentAmount: formatBigIntToDecimalString(cAmtPaise), targetDate: formData.targetDate, source_bank_id: sourceBankId || null, owner_member_id: formData.owner_member_id || null, joint_owner_member_id: formData.joint_owner_member_id || null, owner_split_percent: formData.owner_split_percent });
  };

  const handleEditInit = (fund) => { setEditingId(fund.id); setEditFormData({ title: fund.title, targetAmount: fund.targetAmount, targetDate: fund.targetDate, owner_member_id: fund.owner_member_id, joint_owner_member_id: fund.joint_owner_member_id, owner_split_percent: fund.owner_split_percent }); };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    const tAmtPaise = parseToPaiseBigInt(editFormData.targetAmount);
    if (tAmtPaise < 0n) return;
    editMut.mutate({ id: editingId, data: { title: editFormData.title, targetAmount: formatBigIntToDecimalString(tAmtPaise), targetDate: editFormData.targetDate, owner_member_id: editFormData.owner_member_id || null, joint_owner_member_id: editFormData.joint_owner_member_id || null, owner_split_percent: editFormData.owner_split_percent } });
  };

  const submitFundAddition = (e, id) => {
    e.preventDefault();
    const amtPaise = parseToPaiseBigInt(addAmount);
    if (!sourceBankId) {
      alert("Please select a valid bank.");
      return;
    }
    const selectedBank = banks.find(b => String(b.id) === String(sourceBankId));
    if (!selectedBank) {
      alert("Please select a valid bank.");
      return;
    }
    if (parseToPaiseBigInt(selectedBank.ledgerBalance) < amtPaise) {
      alert("Insufficient funds in the selected bank account.");
      return;
    }
    fundMut.mutate({ id, data: { amount: formatBigIntToDecimalString(amtPaise), source_bank_id: sourceBankId || null } });
  };

  const handleDelete = (id) => {
    setConfirmModal({
        isOpen: true,
        title: 'Delete Sinking Fund',
        message: 'Delete this sinking fund? Capital will remain in ledger.',
        onConfirm: () => {
            delMut.mutate(id);
            setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });
        }
    });
  };

  const calculateRequiredMonthly = (fund) => {
    const now = new Date();
    const target = new Date(fund.targetDate);
    let monthsLeft = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
    if (monthsLeft <= 0) monthsLeft = 1;
    const shortfall = parseToPaiseBigInt(fund.targetAmount) - parseToPaiseBigInt(fund.currentAmount);
    return shortfall <= 0n ? 0 : Number(shortfall) / 100 / monthsLeft;
  };

  const getDaysLeft = (targetDate) => {
    const days = Math.ceil((new Date(targetDate) - new Date()) / (24*60*60*1000));
    return Math.max(0, days);
  };

  const getUrgencyColor = (fund) => {
    const days = getDaysLeft(fund.targetDate);
    const targetPaise = parseToPaiseBigInt(fund.targetAmount);
    const currentPaise = parseToPaiseBigInt(fund.currentAmount);
    if (targetPaise === 0n) return 'safe';
    const pct = Number((currentPaise * 10000n) / targetPaise) / 100;
    if (pct >= 100) return 'safe';
    if (days <= 30 && pct < 80) return 'critical';
    if (days <= 90 && pct < 60) return 'warning';
    return 'info';
  };

  const metrics = useMemo(() => {
    const totalTarget = funds.reduce((s, f) => s + parseToPaiseBigInt(f.targetAmount), 0n);
    const totalFunded = funds.reduce((s, f) => s + parseToPaiseBigInt(f.currentAmount), 0n);
    const totalShortfall = totalTarget > totalFunded ? totalTarget - totalFunded : 0n;
    const fullyFundedCount = funds.filter(f => parseToPaiseBigInt(f.currentAmount) >= parseToPaiseBigInt(f.targetAmount)).length;
    const urgentCount = funds.filter(f => getDaysLeft(f.targetDate) <= 90 && parseToPaiseBigInt(f.currentAmount) < parseToPaiseBigInt(f.targetAmount)).length;
    const totalReqMonthly = funds.reduce((s, f) => s + calculateRequiredMonthly(f), 0);
    return { 
      totalTarget: Number(totalTarget) / 100, 
      totalFunded: Number(totalFunded) / 100, 
      totalShortfall: Number(totalShortfall) / 100, 
      fullyFundedCount, 
      urgentCount, 
      totalReqMonthly 
    };
  }, [funds]);


  if (l1 || l2 || l3) return <div className="p-8 text-center text-[var(--text-secondary)]">Loading Sinking Funds...</div>;

  return (
    <div className="animate-fade-in">
      {error && <div className="alert-banner danger" style={{marginBottom:'20px'}}><AlertTriangle size={16}/> {error}</div>}

      <div className="section-header">
        <div>
          <h2>Sinking Fund Command Center</h2>
          <p>Pre-fund anticipated shocks · Zero-surprise financial planning</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? <><X size={16} style={{marginRight:'6px'}} /> Cancel Fund Addition</> : <><Plus size={16} style={{marginRight:'6px'}} /> New Fund</>}
        </button>
      </div>

      {funds.length > 0 && (
        <div className="stat-grid" style={{ marginBottom: '24px' }}>
          <div className="stat-card" style={{'--stat-accent':'var(--text-secondary)','--stat-color':'var(--text-secondary)'}}>
            <div className="stat-card-icon"><Target size={20}/></div>
            <div className="stat-card-label">Total Targets</div>
            <div className="stat-card-value">₹{metrics.totalTarget.toLocaleString('en-IN')}</div>
            <div className="stat-card-sub">{funds.length} fund{funds.length > 1 ? 's' : ''}</div>
          </div>
          <div className="stat-card" style={{'--stat-accent':'var(--accent-emerald)','--stat-color':'var(--accent-emerald)'}}>
            <div className="stat-card-icon"><PiggyBank size={20}/></div>
            <div className="stat-card-label">Total Funded</div>
            <div className="stat-card-value">₹{metrics.totalFunded.toLocaleString('en-IN')}</div>
            <div className="stat-card-sub">{metrics.fullyFundedCount}/{funds.length} complete</div>
          </div>
          <div className="stat-card" style={{'--stat-accent':metrics.totalShortfall > 0 ? '#f59e0b' : '#10b981','--stat-color':metrics.totalShortfall > 0 ? '#f59e0b' : '#10b981'}}>
            <div className="stat-card-icon"><AlertTriangle size={20}/></div>
            <div className="stat-card-label">Remaining Shortfall</div>
            <div className="stat-card-value">₹{metrics.totalShortfall.toLocaleString('en-IN')}</div>
          </div>
          <div className="stat-card" style={{'--stat-accent':'#3b82f6','--stat-color':'#3b82f6'}}>
            <div className="stat-card-icon"><CalendarClock size={20}/></div>
            <div className="stat-card-label">Required Monthly Bleed</div>
            <div className="stat-card-value">₹{Math.round(metrics.totalReqMonthly).toLocaleString('en-IN')}</div>
            <div className="stat-card-sub">to stay on track</div>
          </div>
        </div>
      )}

      {metrics.urgentCount > 0 && (
        <div className="alert-banner danger" style={{marginBottom:'16px'}}>
          <span><AlertTriangle size={16} style={{marginRight:'6px', verticalAlign:'middle'}} /> {metrics.urgentCount} fund(s) underfunded with deadline within 90 days</span>
        </div>
      )}

      {isAdding && (
        <div className="glass-panel animate-fade-in" style={{ padding:'24px', marginBottom:'24px', borderLeft:'4px solid var(--accent-sapphire)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ margin: 0 }}>Add New Sinking Fund</h2>
          </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group mb-4">
                <label style={{fontSize:'12px', color:'var(--text-muted)'}}>Fund Title</label>
                <input required type="text" placeholder="e.g. Car Downpayment" value={formData.title} onChange={e=>setFormData({...formData, title: e.target.value})} style={inputStyle} />
              </div>
              
              <div className="grid-2 mb-4" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
                <div className="form-group">
                  <label style={{fontSize:'12px', color:'var(--text-muted)'}}>Target Amount (₹)</label>
                  <input required type="number" step="0.01" placeholder="0.00" value={formData.targetAmount} onChange={e=>setFormData({...formData, targetAmount: e.target.value})} style={inputStyle} />
                </div>
                <div className="form-group">
                  <label style={{fontSize:'12px', color:'var(--text-muted)'}}>Initial Funding (Optional)</label>
                  <input type="number" step="0.01" placeholder="0.00" value={formData.currentAmount} onChange={e=>setFormData({...formData, currentAmount: e.target.value})} style={inputStyle} />
                </div>
              </div>

              {formData.currentAmount > 0 && (
                <div className="form-group mb-4">
                  <label style={{fontSize:'12px', color:'var(--text-muted)'}}>Funding Bank Account</label>
                  <CustomSelect value={sourceBankId} onChange={e=>setSourceBankId(e.target.value)} style={inputStyle} required>
                    <option value="">-- Funding Bank Account --</option>
                    {banks.map(b => <option key={b.id} value={b.id}>{b.bankName} (₹{b.ledgerBalance?.toLocaleString('en-IN')})</option>)}
                  </CustomSelect>
                </div>
              )}

              <div className="form-group mb-4">
                <label style={{fontSize:'12px', color:'var(--text-muted)'}}>Target Date</label>
                <input required type="date" value={formData.targetDate} onChange={e=>setFormData({...formData, targetDate: e.target.value})} style={inputStyle} />
              </div>
              
              <div className="form-group mb-4">
                <label style={{fontSize:'12px', color:'var(--text-muted)'}}>Owner</label>
                <CustomSelect required value={formData.owner_member_id} onChange={e=>setFormData({...formData, owner_member_id: e.target.value})} style={inputStyle}>
                    <option value="">-- Select Owner --</option>
                    {familyMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </CustomSelect>
              </div>
              
              <div className="grid-2 mb-4" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
                <div className="form-group">
                  <label style={{fontSize:'12px', color:'var(--text-muted)'}}>Joint Owner (Optional)</label>
                  <CustomSelect value={formData.joint_owner_member_id} onChange={e=>setFormData({...formData, joint_owner_member_id: e.target.value})} style={inputStyle}>
                      <option value="">-- Select Joint Owner --</option>
                      {familyMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </CustomSelect>
                </div>
                <div className="form-group">
                  <label style={{fontSize:'12px', color:'var(--text-muted)'}}>Owner Split (%)</label>
                  <input type="number" min="0" max="100" value={formData.owner_split_percent} onChange={e=>setFormData({...formData, owner_split_percent: e.target.value})} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Create Fund</button>
              </div>
            </form>
          </div>
      )}

      <div className="grid-2">
        {funds.map(fund => {
          const targetPaise = parseToPaiseBigInt(fund.targetAmount);
          const currentPaise = parseToPaiseBigInt(fund.currentAmount);
          const reqMonthly = calculateRequiredMonthly(fund);
          const progressRatio = targetPaise > 0n ? Math.min(100, Number((currentPaise * 10000n) / targetPaise) / 100) : 100;
          const isFunded = currentPaise >= targetPaise;
          const isEditing = editingId === fund.id;
          const urgColor = getUrgencyColor(fund);
          const daysLeft = getDaysLeft(fund.targetDate);
          
          return (
            <div key={fund.id} className="glass-panel" style={{ borderLeft: `4px solid ${urgColor}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>{fund.title}</h3>
                  {isFunded && <span className="urgency-badge safe">✅ Funded</span>}
                  {!isFunded && daysLeft <= 30 && <span className="urgency-badge critical">🔴 Urgent</span>}
                </div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {!isEditing && (
                    <>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}><Target size={12} style={{marginRight:'4px', verticalAlign:'middle'}} />{daysLeft > 0 ? `${daysLeft}d left` : 'Past due'}</span>
                      <button className="icon-btn" onClick={() => handleEditInit(fund)}><Edit2 size={14} /></button>
                      <button className="icon-btn danger" onClick={() => handleDelete(fund.id)} title="Delete"><Trash2 size={14} /></button>
                    </>
                  )}
                  {isEditing && <button style={{ background:'none', border:'none', color:'var(--text-secondary)', cursor:'pointer', padding:'4px' }} onClick={() => setEditingId(null)}><X size={14} /></button>}
                </div>
              </div>

              {isEditing ? (
                <form onSubmit={(e) => handleEditSubmit(e)} style={{ background: 'rgba(0,0,0,0.2)', padding:'14px', borderRadius: '12px', marginBottom: '16px' }}>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px'}}>
                            <input required type="text" value={editFormData.title} onChange={e=>setEditFormData({...editFormData, title: e.target.value})} style={inputStyle} />
                            <input required type="number" step="0.01" value={editFormData.targetAmount} onChange={e=>setEditFormData({...editFormData, targetAmount: e.target.value})} style={inputStyle} />
                            <input required type="date" value={editFormData.targetDate || ''} onChange={e=>setEditFormData({...editFormData, targetDate: e.target.value})} style={inputStyle} />
                            <CustomSelect required value={editFormData.owner_member_id} onChange={e=>setEditFormData({...editFormData, owner_member_id: e.target.value})} style={inputStyle}>
                                <option value="">-- Select Owner --</option>
                                {familyMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </CustomSelect>
                            <CustomSelect value={editFormData.joint_owner_member_id} onChange={e=>setEditFormData({...editFormData, joint_owner_member_id: e.target.value})} style={inputStyle}>
                                <option value="">-- Select Joint Owner --</option>
                                {familyMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </CustomSelect>
                            <input type="number" min="0" max="100" value={editFormData.owner_split_percent} onChange={e=>setEditFormData({...editFormData, owner_split_percent: e.target.value})} style={inputStyle} />
                            <div style={{ display: 'flex', gap: '8px', gridColumn: 'span 2' }}> 
                              <button type="submit" style={{width:'100%', padding:'8px', background:'var(--accent-emerald)', border:'none', borderRadius:'6px', color:'#fff', fontWeight:600, cursor:'pointer', fontSize:'13px'}}><Check size={14} style={{marginRight:'4px', verticalAlign:'middle'}}/>Save</button>
                            </div>
                  </div>
                </form>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>Funded Pipeline</span>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: urgColor }}>
                      ₹{Number(formatBigIntToDecimalString(currentPaise)).toLocaleString('en-IN', {minimumFractionDigits: 2})} 
                      <span style={{fontSize: '14px', color:'var(--text-muted)', fontWeight:400}}> / ₹{Number(formatBigIntToDecimalString(targetPaise)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                    </div>
                  </div>
                  {!isFunded && (
                    <div style={{ background: `${urgColor}10`, padding: '8px 14px', borderRadius: '8px', border: `1px solid ${urgColor}30`, textAlign:'right' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>Required Bleed</span>
                      <span style={{ fontSize: '16px', fontWeight: 700, color: urgColor }}>₹{Math.round(reqMonthly).toLocaleString('en-IN')}/mo</span>
                    </div>
                  )}
                </div>
              )}

              {!isEditing && (
                <>
                  {/* Progress Bar */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{display:'flex', justifyContent:'space-between', fontSize:'11px', color:'var(--text-muted)', marginBottom:'4px'}}>
                      <span>{progressRatio.toFixed(0)}% funded</span>
                      <span>Deadline: {fund.targetDate ? new Date(fund.targetDate).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'}) : 'Not set'}</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${progressRatio}%`, height: '100%', background: isFunded ? 'var(--accent-emerald)' : `linear-gradient(90deg, ${urgColor}, ${urgColor}88)`, transition: 'width 0.3s ease' }}></div>
                    </div>
                  </div>

                  {/* Fund Button */}
                  {fundingId === fund.id ? (
                    <form onSubmit={(e) => submitFundAddition(e, fund.id)} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input autoFocus required type="number" placeholder="Amount (₹)" value={addAmount} onChange={e=>setAddAmount(e.target.value)} style={{...inputStyle, flex:1}} />
                        <CustomSelect required value={sourceBankId} onChange={e=>setSourceBankId(e.target.value)} style={{...inputStyle, flex:1}}>
                          <option value="">-- Source Bank --</option>
                          {banks.map(b => <option key={b.id} value={b.id}>{b.bankName} (₹{b.ledgerBalance?.toLocaleString('en-IN')})</option>)}
                        </CustomSelect>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="submit" style={{flex: 1, padding:'10px 16px', background:'var(--accent-emerald)', border:'none', borderRadius:'8px', color:'#fff', fontWeight:600, cursor:'pointer'}}>Save</button>
                        <button type="button" onClick={() => setFundingId(null)} style={{padding:'10px', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border-color)', borderRadius:'8px', color:'var(--text-muted)', cursor:'pointer'}}><X size={14}/></button>
                      </div>
                    </form>
                  ) : (
                    <button disabled={isFunded} onClick={() => setFundingId(fund.id)} style={{ width: '100%', padding: '10px', background: isFunded ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isFunded ? 'rgba(16,185,129,0.2)' : 'var(--border-color)'}`, borderRadius: '8px', color: isFunded ? '#10b981' : 'var(--text-primary)', cursor: isFunded ? 'default' : 'pointer', fontWeight:600, fontSize:'13px', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                      <PiggyBank size={16} /> {isFunded ? '🎉 Fully Funded' : 'Contribute Capital'}
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {funds.length === 0 && !isAdding && (
        <div className="empty-state glass-panel"><PackageOpen size={48} style={{opacity:0.3,marginBottom:'12px'}}/><h4>No Sinking Funds</h4><p>Pre-fund anticipated expenses like car downpayments, home repairs, or vacations.</p></div>
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
export default SinkingFunds;

