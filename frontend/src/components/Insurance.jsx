import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, X, Check, Trash2, Shield, HeartPulse, Car, Activity, AlertTriangle, PackageOpen, CreditCard, Layers, Clock, CheckCircle } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import { parseToPaiseBigInt, formatBigIntToDecimalString } from '../utils/bigIntMath';
import CustomSelect from './ui/CustomSelect';

function Insurance() {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  
  const [editingId, setEditingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [quickPayId, setQuickPayId] = useState(null);
  const [quickPayFormData, setQuickPayFormData] = useState({ amount: '', sourceBankId: '' });

  const [formData, setFormData] = useState({ title: '', amount: '', dueDate: '', category: 'insurance', policyType: 'Life', termYears: 7, frequency: 'yearly', principalAmount: '', maturityAmount: '', owner_member_id: '' });

  const { data: remRes, isLoading: loadingReminders, error: err1 } = useQuery({ queryKey: ['reminders'], queryFn: () => fetch('/api/reminders').then(res => res.json()) });
  const { data: famRes, isLoading: loadingFamily, error: err2 } = useQuery({ queryKey: ['family-members'], queryFn: () => fetch('/api/family-members').then(res => res.json()) });
  const { data: banksRes, isLoading: loadingBanks } = useQuery({ queryKey: ['banks'], queryFn: () => fetch('/api/bank-balances').then(r => r.json()) });

  const reminders = useMemo(() => (remRes?.data || []).filter(r => r.category === 'insurance'), [remRes]);
  const familyMembers = famRes?.data || [];
  const banks = banksRes?.data || [];
  const loading = loadingReminders || loadingFamily || loadingBanks;
  const error = err1 || err2 ? 'Failed to load insurance data.' : null;

  const addMutation = useMutation({
    mutationFn: async (payload) => {
      await fetch('/api/reminders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      setIsAdding(false);
      setFormData({ title: '', amount: '', dueDate: '', category: 'insurance', policyType: 'Life', termYears: 7, frequency: 'yearly', principalAmount: '', maturityAmount: '', owner_member_id: '' });
    }
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      await fetch(`/api/reminders/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      setEditingId(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      setConfirmDelete(null);
    }
  });

  const payMutation = useMutation({
    mutationFn: async ({ id, transactionData, reminderData }) => {
      const txRes = await fetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(transactionData) });
      if (!txRes.ok) { const err = await txRes.json(); throw new Error(err.error || 'Failed to post transaction'); }
      const remRes = await fetch(`/api/reminders/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reminderData) });
      if (!remRes.ok) { const err = await remRes.json(); throw new Error(err.error || 'Failed to update due date'); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      queryClient.invalidateQueries({ queryKey: ['banks'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setQuickPayId(null);
    }
  });

  const handleQuickPayInit = (ins) => {
    setQuickPayId(ins.id);
    setQuickPayFormData({ amount: ins.amount, sourceBankId: banks.length > 0 ? String(banks[0].id) : '' });
  };

  const handleQuickPaySubmit = (e, ins) => {
    e.preventDefault();
    const payAmtPaise = parseToPaiseBigInt(quickPayFormData.amount);
    if (payAmtPaise <= 0n) return;
    
    if (!quickPayFormData.sourceBankId) { alert("Please select a valid bank."); return; }
    const selectedBank = banks.find(b => String(b.id) === String(quickPayFormData.sourceBankId));
    if (!selectedBank) { alert("Please select a valid bank."); return; }
    if (parseToPaiseBigInt(selectedBank.ledgerBalance) < payAmtPaise) {
      alert("Insufficient funds in the selected bank account."); return;
    }

    const currentDue = new Date(ins.dueDate);
    const nextDue = new Date(currentDue);
    if (ins.frequency === 'monthly') nextDue.setMonth(nextDue.getMonth() + 1);
    else if (ins.frequency === 'quarterly') nextDue.setMonth(nextDue.getMonth() + 3);
    else if (ins.frequency === 'yearly') nextDue.setFullYear(nextDue.getFullYear() + 1);
    else if (ins.frequency === 'once') return; // Don't auto-advance one-off. Maybe just log tx?
    
    payMutation.mutate({
      id: ins.id,
      transactionData: {
        source_bank_id: parseInt(quickPayFormData.sourceBankId),
        amount: formatBigIntToDecimalString(payAmtPaise),
        type: 'expense',
        category: 'insurance',
        title: `Premium Paid: ${ins.title}`,
        insurance_id: ins.id,
        date: new Date().toISOString().split('T')[0]
      },
      reminderData: {
        ...ins,
        dueDate: ins.frequency === 'once' ? ins.dueDate : nextDue.toISOString().split('T')[0]
      }
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const amtPaise = parseToPaiseBigInt(formData.amount);
    const princPaise = parseToPaiseBigInt(formData.principalAmount);
    const matPaise = parseToPaiseBigInt(formData.maturityAmount);
    if(amtPaise < 0n) return;
    if(princPaise < 0n) return;
    if(matPaise < 0n) return;
    addMutation.mutate({ ...formData, amount: formatBigIntToDecimalString(amtPaise), principalAmount: formatBigIntToDecimalString(princPaise), maturityAmount: formatBigIntToDecimalString(matPaise), owner_member_id: formData.owner_member_id || null, title: `[${formData.policyType}] ${formData.title}` });
  };

  const handleEditInit = (ins) => {
      setEditingId(ins.id);
      setEditFormData({ title: ins.title, amount: ins.amount, dueDate: ins.dueDate, termYears: ins.termYears, frequency: ins.frequency, principalAmount: ins.principalAmount, maturityAmount: ins.maturityAmount, owner_member_id: ins.owner_member_id || '', policyType: ins.policyType });
  };
  
  const handleEditSave = (e, ins) => {
      e.preventDefault();
      const amtPaise = parseToPaiseBigInt(editFormData.amount);
      const princPaise = parseToPaiseBigInt(editFormData.principalAmount);
      const matPaise = parseToPaiseBigInt(editFormData.maturityAmount);
      const termYrs = parseInt(editFormData.termYears);
      if(amtPaise < 0n) return;
      if(princPaise < 0n) return;
      if(matPaise < 0n) return;
      if(isNaN(termYrs) || termYrs < 0) return;
      
      editMutation.mutate({
          id: ins.id,
          payload: { 
              title: editFormData.title, amount: formatBigIntToDecimalString(amtPaise), 
              dueDate: editFormData.dueDate, termYears: termYrs, 
              frequency: editFormData.frequency, principalAmount: formatBigIntToDecimalString(princPaise), 
              maturityAmount: formatBigIntToDecimalString(matPaise),
              owner_member_id: editFormData.owner_member_id || null, interestRate: ins.interestRate,
              policyType: editFormData.policyType
          }
      });
  };

  const handleDelete = (id) => {
    setConfirmDelete(id);
  };

  const calculateNextDue = (startDate, frequency, termYears) => {
    let nextDate = new Date(startDate);
    const now = new Date(); now.setHours(0,0,0,0);
    let endDate = new Date(startDate);
    if (termYears > 0) endDate.setFullYear(endDate.getFullYear() + parseInt(termYears));
    else endDate.setFullYear(endDate.getFullYear() + 100);

    if (frequency === 'once') return { date: nextDate, isMatured: false };

    while (nextDate < now && nextDate < endDate) {
       if (frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
       else if (frequency === 'quarterly') nextDate.setMonth(nextDate.getMonth() + 3);
       else if (frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
       else break;
    }

    if (nextDate >= endDate && endDate < now) return { date: endDate, isMatured: true };
    return { date: nextDate, isMatured: false };
  };

  const getDaysRemaining = (targetDate) => { return Math.ceil((targetDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24)); };

  // Dashboard Metrics
  const { activePolicies, totalAnnualPremium, nextDue, daysToNextDue } = React.useMemo(() => {
    const active = reminders.filter(r => !calculateNextDue(r.dueDate, r.frequency, r.termYears).isMatured);
    const totalAnnualPremium = active.reduce((sum, p) => {
      const amt = Number(p.amount);
      return sum + (p.frequency === 'monthly' ? amt * 12 : p.frequency === 'quarterly' ? amt * 4 : p.frequency === 'yearly' ? amt : 0);
    }, 0);
    
    // Calculate dates once per active policy
    const policiesWithDates = active.map(p => ({
      ...p,
      nextDate: calculateNextDue(p.dueDate, p.frequency, p.termYears).date
    }));

    const sorted = [...policiesWithDates].sort((a,b) => a.nextDate - b.nextDate);
    const nextP = sorted.length > 0 ? sorted[0] : null;
    const nextDDate = nextP ? nextP.nextDate : null;
    const daysToDue = nextDDate ? getDaysRemaining(nextDDate) : null;

    return {
      activePolicies: active,
      totalAnnualPremium,
      nextDue: nextP,
      daysToNextDue: daysToDue
    };
  }, [reminders]);

  const getPolicyIcon = (title) => {
    if (title.toLowerCase().includes('health') || title.toLowerCase().includes('mediclaim')) return <HeartPulse size={20} color="#ec4899" />;
    if (title.toLowerCase().includes('motor') || title.toLowerCase().includes('car') || title.toLowerCase().includes('bike')) return <Car size={20} color="#3b82f6" />;
    if (title.toLowerCase().includes('general') || title.toLowerCase().includes('home')) return <Activity size={20} color="#f59e0b" />;
    return <Shield size={20} color="#8b5cf6" />; // Default Life
  };

  const getPolicyColor = (title) => {
    if (title.toLowerCase().includes('health') || title.toLowerCase().includes('mediclaim')) return '#ec4899';
    if (title.toLowerCase().includes('motor') || title.toLowerCase().includes('car') || title.toLowerCase().includes('bike')) return '#3b82f6';
    if (title.toLowerCase().includes('general') || title.toLowerCase().includes('home')) return '#f59e0b';
    return '#8b5cf6'; 
  };

  return (
    <div className="animate-fade-in">
      {error && <div className="alert-banner danger" style={{marginBottom:'20px'}}><AlertTriangle size={16}/> {error}</div>}
      <div className="section-header">
        <div>
          <h2>Insurance Vault</h2>
          <p>Centralized Policy Tracking & Maturity Automation</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? <><X size={16} style={{marginRight:'6px'}} /> Cancel Policy Logging</> : <><Plus size={16} style={{marginRight:'6px'}} /> Log Policy</>}
        </button>
      </div>

      {isAdding && (
         <div className="glass-panel animate-fade-in" style={{ marginBottom: '24px', borderLeft:'4px solid #a855f7' }}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px'}}>
              <h2 style={{margin:0}}>Register Policy</h2>
            </div>
            <form onSubmit={handleSubmit} className="grid-2">
                <div className="field-group">
                  <label>Policy Type</label>
                  <CustomSelect value={formData.policyType} onChange={e=>setFormData({...formData, policyType:e.target.value})} className="field-input">
                      <option value="Life">Life Insurance (Term/Endowment)</option>
                      <option value="Health">Health / Mediclaim</option>
                      <option value="Motor">Motor / Vehicle</option>
                      <option value="General">General / Home / Other</option>
                  </CustomSelect>
                </div>
                <div className="field-group">
                  <label>Policy Name</label>
                  <input required placeholder="e.g. HDFC Term" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="field-input" />
                </div>
                <div className="field-group">
                  <label>Policy Owner (Insured Person)</label>
                  <CustomSelect required value={formData.owner_member_id} onChange={e=>setFormData({...formData, owner_member_id:e.target.value})} className="field-input">
                      <option value="">Select Family Member...</option>
                      {familyMembers.map(fm => <option key={fm.id} value={fm.id}>{fm.name} ({fm.role})</option>)}
                  </CustomSelect>
                </div>
                <div className="field-group">
                  <label>Premium Amount (₹)</label>
                  <input required type="number" step="0.01" placeholder="0.00" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="field-input" />
                </div>
                <div className="field-group">
                  <label>Sum Assured / Coverage (₹)</label>
                  <input required type="number" step="0.01" placeholder="0.00" value={formData.principalAmount} onChange={e => setFormData({...formData, principalAmount: e.target.value})} className="field-input" />
                </div>
                <div className="field-group">
                  <label>Expected Maturity Value (₹)</label>
                  <input type="number" step="0.01" placeholder="0.00" value={formData.maturityAmount} onChange={e => setFormData({...formData, maturityAmount: e.target.value})} className="field-input" />
                </div>
                <div className="field-group">
                  <label>Next Due / Start Date</label>
                  <input required type="date" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} className="field-input" />
                </div>
                <div className="field-group">
                  <label>Term (Years)</label>
                  <input required type="number" min="1" placeholder="7" value={formData.termYears} onChange={e => setFormData({...formData, termYears: e.target.value})} className="field-input" />
                </div>
                <div className="field-group">
                  <label>Frequency</label>
                  <CustomSelect value={formData.frequency} onChange={e => setFormData({...formData, frequency: e.target.value})} className="field-input">
                      <option value="yearly">Yearly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="once">One-Time</option>
                  </CustomSelect>
                </div>
                <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <button type="submit" className="btn btn-success" style={{ width: '100%', padding: '12px' }}>Save Policy</button>
                </div>
            </form>
         </div>
      )}

      {/* Portfolio Dashboard */}
      {reminders.length > 0 && (
        <div className="stat-grid" style={{marginBottom:'24px'}}>
          <div className="stat-card" style={{'--stat-accent':'#ec4899','--stat-color':'#ec4899'}}>
            <div className="stat-card-icon"><CreditCard size={20}/></div>
            <div className="stat-card-label">Annual Premium Outlay</div>
            <div className="stat-card-value">₹{Number(totalAnnualPremium).toLocaleString('en-IN')}</div>
            <div className="stat-card-sub">Across all active policies</div>
          </div>
          <div className="stat-card" style={{'--stat-accent':'#8b5cf6','--stat-color':'#8b5cf6'}}>
            <div className="stat-card-icon"><Layers size={20}/></div>
            <div className="stat-card-label">Active Policies</div>
            <div className="stat-card-value">{activePolicies.length}</div>
            <div className="stat-card-sub">Total logged: {reminders.length}</div>
          </div>
          <div className="stat-card" style={{'--stat-accent': nextDue && daysToNextDue <= 7 ? '#ef4444' : '#10b981','--stat-color': nextDue && daysToNextDue <= 7 ? '#ef4444' : '#10b981'}}>
            <div className="stat-card-icon"><Clock size={20}/></div>
            <div className="stat-card-label">Next Premium Due</div>
            {nextDue ? (
              <>
                <div className="stat-card-value">
                  {daysToNextDue < 0 ? 'Overdue!' : daysToNextDue === 0 ? 'Today' : `in ${daysToNextDue} Days`}
                </div>
                <div className="stat-card-sub">{nextDue.title.replace(/\[.*?\]\s*/, '')}</div>
              </>
            ) : (
              <div className="stat-card-value" style={{fontSize:'16px', color:'var(--text-muted)', marginTop:'8px'}}>All clear</div>
            )}
          </div>
        </div>
      )}


      {loading ? (
        <div style={{ color: 'var(--text-muted)' }}>Loading vault...</div>
      ) : reminders.length === 0 && !isAdding ? (
        <div className="empty-state glass-panel"><PackageOpen size={48} style={{opacity:0.3,marginBottom:'12px'}}/><h4>Vault Empty</h4><p>Log your life and health policies to track coverage and due dates.</p></div>
      ) : (
        <div className="grid-2" style={{gap:'20px'}}>
          {reminders.map(insurance => {
             const termInfo = calculateNextDue(insurance.dueDate, insurance.frequency, insurance.termYears);
             const daysLeft = getDaysRemaining(termInfo.date);
             const isEditing = editingId === insurance.id;
             const pColor = getPolicyColor(insurance.title);
             const cleanTitle = insurance.title.replace(/\[.*?\]\s*/, '');
             
             return (
              <div key={insurance.id} className="glass-panel" style={{ borderTop: `3px solid ${termInfo.isMatured ? '#10b981' : pColor}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div style={{display:'flex', gap:'12px'}}>
                      <div style={{width:'40px', height:'40px', borderRadius:'10px', background:`${pColor}15`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                        {getPolicyIcon(insurance.title)}
                      </div>
                      <div>
                        {isEditing ? (
                            <input required value={editFormData.title} onChange={e=>setEditFormData({...editFormData, title:e.target.value})} className="field-input" style={{marginBottom:'8px', fontWeight: 'bold'}}/>
                        ) : (
                            <h3 style={{ fontSize: '16px', margin: '0 0 4px 0' }}>{cleanTitle}</h3>
                        )}
                        {!isEditing && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {insurance.termYears > 0 ? `${insurance.termYears}y Term` : 'No Term'} • {insurance.frequency.charAt(0).toUpperCase() + insurance.frequency.slice(1)}
                              {Number(insurance.maturityAmount) > 0 && ` • Maturity: ₹${Number(insurance.maturityAmount).toLocaleString('en-IN')}`}
                            </div>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {!isEditing && <div style={{ fontSize:'20px', fontWeight:800, color: termInfo.isMatured ? '#10b981' : 'var(--text-primary)' }}>₹{Number(insurance.amount).toLocaleString('en-IN')}</div>}
                        {!isEditing ? (
                          <>
                            {!termInfo.isMatured && (
                              <button style={{background:'none',border:'none',color:'var(--accent-emerald)',cursor:'pointer',padding:'2px'}} onClick={() => handleQuickPayInit(insurance)} title="Quick Pay & Renew"><CheckCircle size={15}/></button>
                            )}
                            <button className="icon-btn" onClick={() => handleEditInit(insurance)} title="Edit"><Edit2 size={14}/></button>
                            <button className="icon-btn danger" onClick={() => handleDelete(insurance.id)} title="Delete"><Trash2 size={14}/></button>
                          </>
                        ) : (
                            <button style={{background:'none',border:'none',color:'var(--text-secondary)',cursor:'pointer',padding:'2px'}} onClick={() => setEditingId(null)}><X size={14} /></button>
                        )}
                    </div>
                </div>

                {isEditing ? (
                     <form onSubmit={(e) => handleEditSave(e, insurance)} style={{ background: 'rgba(0,0,0,0.2)', padding:'14px', borderRadius: '12px' }}>
                           <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'16px'}}>
                             <div className="field-group"><label>Premium (₹)</label><input required type="number" step="0.01" value={editFormData.amount} onChange={e=>setEditFormData({...editFormData, amount:e.target.value})} className="field-input"/></div>
                             <div className="field-group"><label>Policy Start</label><input required type="date" value={editFormData.dueDate} onChange={e=>setEditFormData({...editFormData, dueDate:e.target.value})} className="field-input"/></div>
                             <div className="field-group"><label>Maturity Value (₹)</label><input type="number" step="0.01" value={editFormData.maturityAmount} onChange={e=>setEditFormData({...editFormData, maturityAmount:e.target.value})} className="field-input"/></div>
                             <div className="field-group"><label>Term (Yrs)</label><input required type="number" value={editFormData.termYears} onChange={e=>setEditFormData({...editFormData, termYears:e.target.value})} className="field-input"/></div>
                             <div className="field-group">
                                 <label>Frequency</label>
                                 <CustomSelect value={editFormData.frequency} onChange={e=>setEditFormData({...editFormData, frequency:e.target.value})} className="field-input">
                                     <option value="yearly">Yearly</option>
                                     <option value="monthly">Monthly</option>
                                     <option value="quarterly">Quarterly</option>
                                     <option value="once">Once</option>
                                 </CustomSelect>
                             </div>
                           </div>
                           <button type="submit" className="btn btn-success" style={{width:'100%', padding:'10px'}}><Check size={14} style={{display:'inline', marginRight:'4px'}}/> Update Policy</button>
                     </form>
                ) : (
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems:'center' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{termInfo.isMatured ? 'Status' : 'Next Payment'}</span>
                        <div style={{textAlign:'right'}}>
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>{termInfo.isMatured ? 'Matured 🎉' : termInfo.date.toISOString().split('T')[0]}</div>
                          {!termInfo.isMatured && (
                            <div style={{ marginTop: '4px' }}>
                               <span className={`urgency-badge ${daysLeft < 0 ? 'critical' : daysLeft === 0 ? 'warning' : daysLeft <= 7 ? 'warning' : 'safe'}`}>
                                 {daysLeft < 0 ? 'Overdue!' : daysLeft === 0 ? 'Due Today' : `${daysLeft} days left`}
                               </span>
                            </div>
                          )}
                        </div>
                    </div>
                )}

                {quickPayId === insurance.id && !isEditing && !termInfo.isMatured && (
                   <form onSubmit={(e) => handleQuickPaySubmit(e, insurance)} style={{ background: 'rgba(16, 185, 129, 0.05)', padding:'14px', borderRadius: '12px', marginTop: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--accent-emerald)', marginBottom: '12px' }}>
                           <CheckCircle size={16} /> Quick Pay & Renew
                         </div>
                         <div style={{display:'grid', gridTemplateColumns:'1fr 2fr', gap:'16px', marginBottom:'16px'}}>
                           <div className="field-group"><label>Amount (₹)</label><input required type="number" step="0.01" value={quickPayFormData.amount} onChange={e=>setQuickPayFormData({...quickPayFormData, amount:e.target.value})} className="field-input"/></div>
                           <div className="field-group">
                               <label>Source Bank</label>
                               <CustomSelect required value={quickPayFormData.sourceBankId} onChange={e=>setQuickPayFormData({...quickPayFormData, sourceBankId:e.target.value})} className="field-input">
                                   <option value="">-- Select Bank --</option>
                                   {banks.map(b => <option key={b.id} value={b.id}>{b.bankName} (Bal: ₹{(b.ledgerBalance || 0).toLocaleString('en-IN')})</option>)}
                               </CustomSelect>
                           </div>
                         </div>
                         <div style={{display:'flex', gap:'8px'}}>
                           <button type="submit" className="btn btn-success" style={{flex:1, padding:'10px'}} disabled={payMutation.isLoading}>{payMutation.isLoading ? 'Processing...' : 'Confirm'}</button>
                           <button type="button" className="btn" style={{padding:'10px'}} onClick={() => setQuickPayId(null)}>Cancel</button>
                         </div>
                   </form>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {confirmDelete && (
        <ConfirmationModal
          isOpen={true}
          title="Delete Policy"
          message="Are you sure you want to delete this insurance policy?"
          onConfirm={() => { deleteMutation.mutate(confirmDelete); setConfirmDelete(null); }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
export default Insurance;

