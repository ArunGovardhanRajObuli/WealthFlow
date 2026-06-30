import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, X, Check, Trash2, AlertTriangle, CreditCard, ShoppingCart, Banknote, Wallet, Activity } from 'lucide-react';


import { parseToPaiseBigInt, formatBigIntToDecimalString } from '../utils/bigIntMath';
import CustomSelect from './ui/CustomSelect';

function formatBigIntPaise(paiseBigInt) {
    const isNeg = paiseBigInt < 0n;
    let absVal = isNeg ? -paiseBigInt : paiseBigInt;
    let str = absVal.toString().padStart(3, '0');
    const intPart = str.slice(0, -2);
    const decPart = str.slice(-2);
    const inFormat = BigInt(intPart).toLocaleString('en-IN');
    return (isNeg ? '-' : '') + inFormat + '.' + decPart;
}

function CreditCards() {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [formData, setFormData] = useState({ name: '', creditLimit: '', currentBalance: '', dueDate: '', owner_member_id: '' });
    
  // Spend/Pay action state
  const [actionCardId, setActionCardId] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [actionAmount, setActionAmount] = useState('');
  const [actionDesc, setActionDesc] = useState('');
  const [actionDueDate, setActionDueDate] = useState('');
  const [sourceBankId, setSourceBankId] = useState('');
  const [jointBankId, setJointBankId] = useState('');
  const [splitAmount, setSplitAmount] = useState('');

  const { data: cardsData, isLoading: cardsLoading, error: cardsError } = useQuery({
    queryKey: ['credit-cards'],
    queryFn: async () => {
      const res = await fetch('/api/credit-cards');
      if (!res.ok) throw new Error('Failed to load credit cards.');
      return res.json();
    }
  });

  const { data: banksData } = useQuery({
    queryKey: ['bank-balances'],
    queryFn: async () => {
      const res = await fetch('/api/bank-balances');
      if (!res.ok) throw new Error('Failed to load banks.');
      return res.json();
    }
  });

  const { data: familyMembersData } = useQuery({
    queryKey: ['family-members'],
    queryFn: async () => {
      const res = await fetch('/api/family-members');
      if (!res.ok) throw new Error('Failed to load family members.');
      return res.json();
    }
  });

  const cards = useMemo(() => cardsData?.data || [], [cardsData?.data]);
  const banks = useMemo(() => banksData?.data || [], [banksData?.data]);
  const familyMembers = useMemo(() => familyMembersData?.data || [], [familyMembersData?.data]);
  const loading = cardsLoading;

  const addCardMutation = useMutation({
    mutationFn: async (newCard) => {
      const res = await fetch('/api/credit-cards', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCard)
      });
      if (!res.ok) throw new Error('Failed to add credit card.');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
      setIsAdding(false); 
      setFormData({ name: '', creditLimit: '', currentBalance: '', dueDate: '', owner_member_id: '' });
    }
  });

  const editCardMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`/api/credit-cards/${id}`, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update card.');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
      setEditingId(null);
    }
  });

  const deleteCardMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/credit-cards/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete card.');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
    }
  });

  const spendMutation = useMutation({
    mutationFn: async ({ cardId, data }) => {
      const res = await fetch(`/api/credit-cards/${cardId}/spend`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to log spend.');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setActionCardId(null); setActionType(null); setActionAmount(''); setActionDesc('');
    }
  });

  const payMutation = useMutation({
    mutationFn: async ({ cardId, data }) => {
      const res = await fetch(`/api/credit-cards/${cardId}/pay`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to log payment.');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
      queryClient.invalidateQueries({ queryKey: ['bank-balances'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setActionCardId(null); setActionType(null); setActionAmount(''); setActionDesc(''); setSourceBankId(''); setJointBankId(''); setSplitAmount('');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const limit = parseToPaiseBigInt(formData.creditLimit);
    const bal = parseToPaiseBigInt(formData.currentBalance || 0);
    if (limit <= 0n) return;
    addCardMutation.mutate({ name: formData.name, creditLimit: formatBigIntToDecimalString(limit), currentBalance: formatBigIntToDecimalString(bal), dueDate: formData.dueDate, owner_member_id: formData.owner_member_id });
  };

  const handleEditInit = (card) => {
      setEditingId(card.id); 
      setEditFormData({ name: card.name, creditLimit: card.creditLimit, currentBalance: card.currentBalance, dueDate: card.dueDate, owner_member_id: card.owner_member_id || '' }); 
  };
  const handleEditSave = (e, id) => {
    e.preventDefault();
    const limit = parseToPaiseBigInt(editFormData.creditLimit);
    const bal = parseToPaiseBigInt(editFormData.currentBalance);
    if (limit <= 0n) return;
    editCardMutation.mutate({ id, data: { name: editFormData.name, creditLimit: formatBigIntToDecimalString(limit), currentBalance: formatBigIntToDecimalString(bal), dueDate: editFormData.dueDate, owner_member_id: editFormData.owner_member_id } });
  };
  const handleDelete = (id) => { deleteCardMutation.mutate(id); };

  const handleSpend = (e, cardId) => {
    e.preventDefault();
    const amt = parseToPaiseBigInt(actionAmount);
    if (amt <= 0n) return;
    const payload = { amount: formatBigIntToDecimalString(amt), description: actionDesc };
    if (actionDueDate) {
        payload.newDueDate = actionDueDate;
    }
    spendMutation.mutate({ cardId, data: payload });
  };

  const handlePay = (e, cardId) => {
    e.preventDefault();
    const amt = parseToPaiseBigInt(actionAmount);
    if (amt <= 0n || !sourceBankId) return;

    const selectedBank = banks.find(b => String(b.id) === String(sourceBankId));
    if (!selectedBank) {
      alert("Please select a valid bank.");
      return;
    }
    if (parseToPaiseBigInt(selectedBank.ledgerBalance) < amt) {
      alert("Insufficient funds in the primary bank account.");
      return;
    }

    if (jointBankId && splitAmount) {
      const splitPaisePaise = parseToPaiseBigInt(splitAmount);
      const selectedJointBank = banks.find(b => String(b.id) === String(jointBankId));
      if (selectedJointBank && parseToPaiseBigInt(selectedJointBank.ledgerBalance) < splitPaisePaise) {
         alert("Insufficient funds in the joint bank account.");
         return;
      }
    }

    const splitPaise = jointBankId && splitAmount ? parseToPaiseBigInt(splitAmount) : null;
    payMutation.mutate({ cardId, data: { amount: formatBigIntToDecimalString(amt), sourceBankId, joint_bank_id: jointBankId, split_amount: splitPaise ? formatBigIntToDecimalString(splitPaise) : null } });
  };

  const error = cardsError?.message || addCardMutation.error?.message || editCardMutation.error?.message || deleteCardMutation.error?.message || spendMutation.error?.message || payMutation.error?.message;

  const openAction = (cardId, type, currentDueDate = '', currentBalance = 0) => {
    setActionCardId(cardId); setActionType(type); setActionAmount(''); setActionDesc('');
    // If balance is 0, they just paid it off, force them to set the next cycle date by emptying it
    setActionDueDate(currentBalance > 0 ? currentDueDate : ''); 
    setSourceBankId(''); setJointBankId(''); setSplitAmount('');
  };

  // Portfolio metrics
  const { totalLimit, totalUsage, totalAvailable, blendedUtilization, highestUtilCard } = useMemo(() => {
    const tLimit = cards.reduce((s, c) => s + parseToPaiseBigInt(c.creditLimit || 0), 0n);
    const tUsage = cards.reduce((s, c) => s + parseToPaiseBigInt(c.currentBalance || 0), 0n);
    
    const safeLimit = tLimit;
    const safeUsage = tUsage;
    const tAvail = safeLimit - safeUsage;
    const bUtil = safeLimit > 0n ? Number(safeUsage * 10000n / safeLimit) / 100 : 0;
    
    const hCard = cards.length > 0 ? cards.reduce((max, c) => {
        const util = c.creditLimit > 0 ? (c.currentBalance / c.creditLimit) * 100 : 0;
        const maxUtil = max.creditLimit > 0 ? (max.currentBalance / max.creditLimit) * 100 : 0;
        return util > maxUtil ? c : max;
    }, cards[0]) : null;

    return { totalLimit: safeLimit, totalUsage: safeUsage, totalAvailable: tAvail, blendedUtilization: bUtil, highestUtilCard: hCard };
  }, [cards]);
  
  const getDaysUntilDue = (dueDate) => {
    if (!dueDate) return null;
    const diff = (new Date(dueDate) - new Date()) / (24*60*60*1000);
    return diff > 0 ? (diff % 1 === 0 ? diff : (diff - (diff % 1)) + 1) : (diff - (diff % 1));
  };

  const getUtilColor = (pct) => {
    if (pct <= 30) return '#10b981';
    if (pct <= 60) return '#f59e0b';
    return '#ef4444';
  };

  const getCardGradient = (pct) => {
    if (pct <= 30) return 'linear-gradient(180deg, rgba(16,185,129,0.04) 0%, rgba(16,185,129,0) 100%)';
    if (pct <= 60) return 'linear-gradient(180deg, rgba(245,158,11,0.04) 0%, rgba(245,158,11,0) 100%)';
    return 'linear-gradient(180deg, rgba(239,68,68,0.05) 0%, rgba(239,68,68,0) 100%)';
  };

  // Find highest utilization card for CIBIL recommendation
  // Handled in useMemo

  // Circular Gauge Component
  const CircularGauge = ({ percentage, color, size = 88, strokeWidth = 6 }) => {
    const radius = (size - strokeWidth) / 2;
    const PI_APPROX = 3.141592653589793;
    const circumference = 2 * PI_APPROX * radius;
    const minPct = percentage < 100 ? percentage : 100;
    const offset = circumference - (minPct / 100) * circumference;
    return (
      <div className="circular-gauge" style={{width: size, height: size}}>
        <svg width={size} height={size}>
          <circle className="circular-gauge-track" cx={size/2} cy={size/2} r={radius} strokeWidth={strokeWidth} />
          <circle className="circular-gauge-fill" cx={size/2} cy={size/2} r={radius} strokeWidth={strokeWidth}
            stroke={color} strokeDasharray={circumference} strokeDashoffset={offset}
            style={{'--gauge-circumference': circumference}} />
        </svg>
        <div className="circular-gauge-label">
          <span className="gauge-pct" style={{color}}>{percentage.toFixed(0)}%</span>
          <span className="gauge-sub">used</span>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="animate-fade-in">
      <div className="section-header" style={{marginBottom:'24px'}}>
        <h2 style={{background:'linear-gradient(135deg, #8b5cf6, #3b82f6)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent'}}>Credit Card Intelligence</h2>
        <p>Loading card data...</p>
      </div>
      <div className="stat-grid">
        {[1,2,3,4].map(i => <div key={i} className="stat-card" style={{height:'90px', opacity:0.4}}></div>)}
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in">
      
      {/* Section Header */}
      <div className="flex-between" style={{marginBottom:'24px'}}>
        <div className="section-header" style={{marginBottom:0}}>
          <h2 style={{background:'linear-gradient(135deg, #8b5cf6, #3b82f6)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent'}}>Credit Card Intelligence</h2>
          <p>Usage Tracking · Repayment Logging · CIBIL Impact · Payment Countdown</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? <><X size={16} style={{marginRight:'6px'}} /> Cancel Card Addition</> : <><Plus size={16} style={{marginRight:'6px'}} /> Add Card</>}
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="alert-banner danger">
          <AlertTriangle size={16} />
          <span style={{fontWeight:600}}>{error}</span>
          <button onClick={(e) => e.currentTarget.parentElement.style.display = 'none'} style={{background:'none',border:'none',color:'#ef4444',cursor:'pointer',marginLeft:'auto'}}>✕</button>
        </div>
      )}

      {/* Add Card Form */}
      {isAdding && (
        <div className="glass-panel animate-slide-in" style={{ marginBottom: '24px', padding:'24px' }}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'16px'}}>
              <h3 style={{margin:0}}>Register Credit Card</h3>
            </div>
          <form onSubmit={handleSubmit} style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px'}}>
            <div className="field-group">
              <label className="field-label">Card Name</label>
              <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="field-input" placeholder="e.g. HDFC Millennia" />
            </div>
            <div className="field-group">
              <label className="field-label">Credit Limit (₹)</label>
              <input required type="number" value={formData.creditLimit} onChange={e => setFormData({ ...formData, creditLimit: e.target.value })} className="field-input" placeholder="500000" />
            </div>
            <div className="field-group">
              <label className="field-label">Current Outstanding (₹)</label>
              <input type="number" value={formData.currentBalance} onChange={e => setFormData({ ...formData, currentBalance: e.target.value })} className="field-input" placeholder="0" />
            </div>
            <div className="field-group">
              <label className="field-label">Statement Due Date</label>
              <input required type="date" value={formData.dueDate} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} className="field-input" />
            </div>
            <div className="field-group" style={{gridColumn:'span 2'}}>
              <label className="field-label">Primary Owner</label>
              <CustomSelect required value={formData.owner_member_id} onChange={e => setFormData({ ...formData, owner_member_id: e.target.value })} className="field-input">
                <option value="">-- Select Owner --</option>
                {familyMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </CustomSelect>
            </div>
            <button type="submit" style={{gridColumn:'span 2', padding:'12px', background:'linear-gradient(135deg, #8b5cf6, #6d28d9)', border:'none', borderRadius:'12px', color:'#fff', fontWeight:600, cursor:'pointer', fontSize:'14px'}}>Save Card</button>
          </form>
        </div>
      )}

      {/* Portfolio Summary — Stat Cards */}
      {cards.length > 0 && (
        <>
          <div className="stat-grid">
            <div className="stat-card" style={{'--stat-accent':'#8b5cf6','--stat-accent-dim':'rgba(139,92,246,0.1)'}}>
              <div className="stat-card-icon"><CreditCard size={18} style={{color:'#8b5cf6'}} /></div>
              <div className="stat-card-label">Total Credit Limit</div>
              <div className="stat-card-value">₹{formatBigIntPaise(totalLimit)}</div>
              <div className="stat-card-sub">{cards.length} card{cards.length>1?'s':''}</div>
            </div>
            <div className="stat-card" style={{'--stat-accent': totalUsage > 0n ? '#ef4444' : '#10b981','--stat-accent-dim': totalUsage > 0n ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', '--stat-color': totalUsage > 0n ? '#ef4444' : '#10b981'}}>
              <div className="stat-card-icon"><AlertTriangle size={18} style={{color: totalUsage > 0n ? '#ef4444' : '#10b981'}} /></div>
              <div className="stat-card-label">Outstanding Usage</div>
              <div className="stat-card-value">₹{formatBigIntPaise(totalUsage)}</div>
            </div>
            <div className="stat-card" style={{'--stat-accent':'#10b981','--stat-accent-dim':'rgba(16,185,129,0.1)','--stat-color':'#10b981'}}>
              <div className="stat-card-icon"><Wallet size={18} style={{color:'#10b981'}} /></div>
              <div className="stat-card-label">Available Credit</div>
              <div className="stat-card-value">₹{totalAvailable < 0n ? '0.00' : formatBigIntPaise(totalAvailable)}</div>
            </div>
            <div className="stat-card" style={{'--stat-accent': getUtilColor(blendedUtilization),'--stat-accent-dim': `${getUtilColor(blendedUtilization)}18`,'--stat-color': getUtilColor(blendedUtilization)}}>
              <div className="stat-card-icon"><Activity size={18} style={{color: getUtilColor(blendedUtilization)}} /></div>
              <div className="stat-card-label">Blended Utilization</div>
              <div className="stat-card-value">{blendedUtilization.toFixed(1)}%</div>
            </div>
          </div>

          {/* CIBIL Warning — Enhanced */}
          {blendedUtilization > 30 && (
            <div className={`alert-banner ${blendedUtilization > 60 ? 'danger' : 'warning'}`}>
              <AlertTriangle size={16} style={{flexShrink:0}} />
              <div>
                <span style={{fontWeight:600}}>
                  {blendedUtilization > 60 ? '🔴 Critical' : '⚠️ Warning'}: Utilization at {blendedUtilization.toFixed(0)}% — CIBIL recommends staying below 30% for optimal credit score
                </span>
                {highestUtilCard && highestUtilCard.currentBalance > 0 && (
                  <div style={{fontSize:'11px', marginTop:'4px', opacity:0.85}}>
                    📌 Recommended Action: Pay down <strong>{highestUtilCard.name}</strong> first (₹{formatBigIntPaise(parseToPaiseBigInt(highestUtilCard.currentBalance))} outstanding, {((highestUtilCard.currentBalance / highestUtilCard.creditLimit) * 100).toFixed(0)}% utilized)
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Retroactive Interest Penalty Warning (Phase 2 Real-World Audit) */}
          {cards.filter(c => c.currentBalance > 0 && getDaysUntilDue(c.dueDate) !== null && getDaysUntilDue(c.dueDate) <= 5).map(card => {
             // CCs charge ~42% APY, retroactively applied from txn date (approx 35 days if grace period broken)
             const estimatedPenalty = card.currentBalance * (0.42 / 365) * 35;
             return (
               <div key={`penalty-${card.id}`} className="alert-banner danger" style={{ marginTop: '12px' }}>
                 <AlertTriangle size={16} style={{flexShrink:0}} />
                 <div>
                   <span style={{fontWeight:600}}>
                     🚨 Immediate Action Required: {card.name}
                   </span>
                   <div style={{fontSize:'12px', marginTop:'4px', opacity:0.9}}>
                     If you fail to clear the ₹{formatBigIntPaise(parseToPaiseBigInt(card.currentBalance))} balance by {new Date(card.dueDate).toLocaleDateString('en-IN')}, 
                     the bank will revoke the interest-free grace period. You will be hit with an estimated <strong>₹{formatBigIntPaise(parseToPaiseBigInt(estimatedPenalty))}</strong> in retroactive interest charges.
                   </div>
                 </div>
               </div>
             );
          })}
        </>
      )}


      {/* Card Grid */}
      <div className="grid-2" style={{gap:'20px'}}>
        {cards.map(card => {
          const ratio = card.creditLimit > 0 ? (card.currentBalance / card.creditLimit) * 100 : 0;
          const utilColor = getUtilColor(ratio);
          const available = card.creditLimit - card.currentBalance;
          const daysUntilDue = getDaysUntilDue(card.dueDate);
          const isEditing = editingId === card.id;
          const isActioning = actionCardId === card.id;
          
          return (
            <div key={card.id} className="glass-panel" style={{ borderTop:`3px solid ${utilColor}`, background: getCardGradient(ratio) }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
                <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                  <CreditCard size={18} style={{color:utilColor}} />
                  {isEditing ? (
                    <input required value={editFormData.name} onChange={e=>setEditFormData({ ...editFormData, name: e.target.value })} className="field-input" style={{width:'auto', padding:'4px 8px'}} />
                  ) : (
                    <h3 style={{ fontSize: '16px', margin: 0 }}>{card.name}</h3>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {!isEditing && <span className={`urgency-badge ${ratio <= 30 ? 'safe' : ratio <= 60 ? 'warning' : 'critical'}`}>{ratio.toFixed(0)}% used</span>}
                  {!isEditing ? (
                    <>
                      <button className="icon-btn" onClick={() => handleEditInit(card)}><Edit2 size={14}/></button>
                      <button className="icon-btn danger" onClick={() => handleDelete(card.id)}><Trash2 size={14}/></button>
                    </>
                  ) : (
                    <button style={{background:'none',border:'none',color:'var(--text-secondary)',cursor:'pointer',padding:'2px'}} onClick={() => setEditingId(null)}><X size={14}/></button>
                  )}
                </div>
              </div>
              
              {isEditing ? (
                <form onSubmit={(e) => handleEditSave(e, card.id)} style={{ background:'rgba(0,0,0,0.2)', padding:'14px', borderRadius:'12px' }}>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px'}}>
                    <div className="field-group"><label className="field-label">Limit (₹)</label><input required type="number" value={editFormData.creditLimit} onChange={e=>setEditFormData({ ...editFormData, creditLimit: e.target.value })} className="field-input"/></div>
                    <div className="field-group"><label className="field-label">Outstanding (₹)</label><input required type="number" value={editFormData.currentBalance} onChange={e=>setEditFormData({ ...editFormData, currentBalance: e.target.value })} className="field-input"/></div>
                  </div>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px'}}>
                    <div className="field-group"><label className="field-label">Due Date</label><input required type="date" value={editFormData.dueDate} onChange={e=>setEditFormData({ ...editFormData, dueDate: e.target.value })} className="field-input"/></div>
                    <div className="field-group">
                      <label className="field-label">Owner</label>
                      <CustomSelect required value={editFormData.owner_member_id} onChange={e => setEditFormData({ ...editFormData, owner_member_id: e.target.value })} className="field-input">
                        <option value="">-- Select --</option>
                        {familyMembers.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </CustomSelect>
                    </div>
                  </div>
                  <button type="submit" style={{width:'100%', padding:'8px', background:'var(--accent-emerald)', border:'none', borderRadius:'8px', color:'#fff', fontWeight:600, cursor:'pointer'}}><Check size={14} style={{marginRight:'4px',verticalAlign:'middle'}}/>Update</button>
                </form>
              ) : (
                <>
                  {/* Circular Gauge + Stats */}
                  <div style={{display:'flex', alignItems:'center', gap:'20px', marginBottom:'16px'}}>
                    <CircularGauge percentage={ratio} color={utilColor} />
                    <div style={{flex:1, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px'}}>
                      <div style={{textAlign:'center'}}>
                        <div style={{fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em'}}>Usage</div>
                        <div style={{fontSize:'16px', fontWeight:700, color: card.currentBalance > 0 ? '#ef4444' : '#10b981'}}>₹{formatBigIntPaise(parseToPaiseBigInt(card.currentBalance))}</div>
                      </div>
                      <div style={{textAlign:'center'}}>
                        <div style={{fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em'}}>Limit</div>
                        <div style={{fontSize:'16px', fontWeight:600}}>₹{formatBigIntPaise(parseToPaiseBigInt(card.creditLimit))}</div>
                      </div>
                      <div style={{textAlign:'center'}}>
                        <div style={{fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em'}}>Available</div>
                        <div style={{fontSize:'16px', fontWeight:700, color:'#10b981'}}>₹{available < 0 ? '0.00' : formatBigIntPaise(parseToPaiseBigInt(available))}</div>
                      </div>
                    </div>
                  </div>

                  {/* Secondary Progress Bar */}
                  <div style={{marginBottom:'16px'}}>
                    <div style={{width:'100%', height:'4px', background:'rgba(255,255,255,0.05)', borderRadius:'2px', overflow:'hidden'}}>
                      <div style={{width:`${ratio < 100 ? ratio : 100}%`, height:'100%', background:utilColor, borderRadius:'2px', transition:'width 0.3s ease'}}></div>
                    </div>
                  </div>

                  {/* Due Date */}
                  <div style={{ padding:'10px 14px', background:'rgba(255,255,255,0.02)', borderRadius:'12px', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Payment Due</span>
                    <div style={{textAlign:'right', display:'flex', alignItems:'center', gap:'8px'}}>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{card.dueDate ? new Date(card.dueDate).toLocaleDateString('en-IN', {year:'numeric', month:'short', day:'numeric'}) : '—'}</div>
                      {card.currentBalance <= 0 ? (
                        <span className="urgency-badge safe" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                          ✅ Settled
                        </span>
                      ) : daysUntilDue !== null ? (
                        <span className={`urgency-badge ${daysUntilDue <= 0 ? 'critical' : daysUntilDue <= 3 ? 'critical' : daysUntilDue <= 7 ? 'warning' : 'safe'}`}>
                          {daysUntilDue <= 0 ? '🔴 Overdue' : daysUntilDue === 1 ? '⚠️ Tomorrow' : `${daysUntilDue}d left`}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {isActioning ? (
                    <form onSubmit={(e) => actionType === 'spend' ? handleSpend(e, card.id) : handlePay(e, card.id)} style={{display:'flex', flexDirection:'column', gap:'8px'}}>
                      <div style={{display:'flex', gap:'8px'}}>
                        <input autoFocus required type="number" placeholder={actionType === 'spend' ? 'Spend amount (₹)' : 'Payment amount (₹)'} value={actionAmount} onChange={e => setActionAmount(e.target.value)} className="field-input" style={{flex:1}} />
                        {actionType === 'spend' && (
                          <input placeholder="Description (optional)" value={actionDesc} onChange={e => setActionDesc(e.target.value)} className="field-input" style={{flex:1}} />
                        )}
                        {actionType === 'pay' && (
                          <CustomSelect className="field-input" style={{ flex: 1 }} value={String(sourceBankId || '')} onChange={e => setSourceBankId(e.target.value)}>
                            <option value="">-- Primary Bank --</option>
                            {banks.map(b => <option key={b.id} value={String(b.id)} selected={String(b.id) === String(sourceBankId)}>{b.bankName} (₹{formatBigIntPaise(parseToPaiseBigInt(b.ledgerBalance))})</option>)}
                          </CustomSelect>
                        )}
                      </div>
                      {actionType === 'spend' && (
                        <div style={{display:'flex', gap:'8px'}}>
                           <input required type="date" value={actionDueDate} onChange={e => setActionDueDate(e.target.value)} className="field-input" style={{flex:1}} title="Next Statement Due Date" />
                           <div style={{flex:2, display:'flex', alignItems:'center', fontSize:'11px', color:'var(--text-muted)'}}>If this is the first spend of the new billing cycle, please update your Next Statement Due Date.</div>
                        </div>
                      )}
                      {actionType === 'pay' && (
                        <div style={{display:'flex', gap:'8px'}}>
                          <CustomSelect className="field-input" style={{ flex: 2 }} value={String(jointBankId || '')} onChange={e => { setJointBankId(e.target.value); if(!e.target.value) setSplitAmount(''); }}>
                            <option value="">-- No Joint Split --</option>
                            {banks.map(b => <option key={b.id} value={String(b.id)}>{b.bankName} (₹{formatBigIntPaise(parseToPaiseBigInt(b.ledgerBalance))})</option>)}
                          </CustomSelect>
                          <input type="number" step="0.01" placeholder="Split Amount" value={splitAmount} onChange={e => setSplitAmount(e.target.value)} disabled={!jointBankId} required={!!jointBankId} className="field-input" style={{flex: 1}} title="Amount from Joint Account" />
                        </div>
                      )}
                      {actionType === 'pay' && card.currentBalance > 0 && (
                        <button type="button" onClick={() => setActionAmount(card.currentBalance.toString())} style={{padding:'6px', background:'rgba(16,185,129,0.05)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:'8px', color:'#10b981', fontSize:'11px', cursor:'pointer', fontWeight:600}}>
                          Pay Full Outstanding: ₹{formatBigIntPaise(parseToPaiseBigInt(card.currentBalance))}
                        </button>
                      )}
                      <div style={{display:'flex', gap:'8px'}}>
                        <button type="submit" style={{flex:1, padding:'10px', background: actionType === 'spend' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #10b981, #059669)', border:'none', borderRadius:'10px', color:'#fff', fontWeight:600, cursor:'pointer'}}>
                          {actionType === 'spend' ? 'Log Spend' : 'Log Payment'}
                        </button>
                        <button type="button" onClick={() => { setActionCardId(null); setActionType(null); }} style={{padding:'10px 16px', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border-color)', borderRadius:'10px', color:'var(--text-muted)', cursor:'pointer'}}><X size={14}/></button>
                      </div>
                    </form>
                  ) : (
                    <div style={{display:'flex', gap:'8px'}}>
                      <button onClick={() => openAction(card.id, 'spend', card.dueDate, parseToPaiseBigInt(card.currentBalance || 0))} style={{flex:1, padding:'10px', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:'10px', color:'#f59e0b', fontWeight:600, cursor:'pointer', fontSize:'12px', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', transition:'all 0.2s'}}>
                        <ShoppingCart size={14}/> Log Spend
                      </button>
                      <button onClick={() => openAction(card.id, 'pay')} disabled={card.currentBalance <= 0} style={{flex:1, padding:'10px', background: card.currentBalance > 0 ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)', border: card.currentBalance > 0 ? '1px solid rgba(16,185,129,0.2)' : '1px solid var(--border-color)', borderRadius:'10px', color: card.currentBalance > 0 ? '#10b981' : 'var(--text-muted)', fontWeight:600, cursor: card.currentBalance > 0 ? 'pointer' : 'default', fontSize:'12px', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', transition:'all 0.2s'}}>
                        <Banknote size={14}/> Pay Bill
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {cards.length === 0 && !isAdding && (
        <div className="glass-panel">
          <div className="empty-state">
            <div className="empty-state-icon">💳</div>
            <div className="empty-state-title">No Credit Cards Registered</div>
            <div className="empty-state-desc">Add your credit cards to track utilization, monitor due dates, and protect your CIBIL score.</div>
          </div>
        </div>
      )}
    </div>
  );
}
export default CreditCards;

