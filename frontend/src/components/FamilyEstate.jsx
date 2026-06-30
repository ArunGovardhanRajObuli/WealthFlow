import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ShieldAlert, Shield, GraduationCap, Users, Edit2, Check, X, PiggyBank, Trash2, Landmark, Coins, TrendingUp, AlertTriangle, PackageOpen, Target, Briefcase } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import { parseToPaiseBigInt, formatBigIntToDecimalString } from '../utils/bigIntMath';
import CustomSelect from './ui/CustomSelect';

function FamilyEstate() {
  const queryClient = useQueryClient();
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  
  const [formData, setFormData] = useState({
      name: '', role: 'Provider', age: '', annualIncome: '', 
      collegeSavings: '', targetAge: 18, targetCollegeValue: 150000
  });

  const [showAddBank, setShowAddBank] = useState(null);
  const [bankForm, setBankForm] = useState({ bankName:'', balance:'' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  const { data: membersData, isLoading: membersLoading, error: membersError } = useQuery({
    queryKey: ['family-members'],
    queryFn: async () => {
      const res = await fetch('/api/family-members');
      if (!res.ok) throw new Error('Failed to load family members');
      return res.json();
    }
  });

  const { data: estateLedgerData, isLoading: ledgerLoading, error: ledgerError } = useQuery({
    queryKey: ['family-estate-ledger'],
    queryFn: async () => {
      const res = await fetch('/api/family-estate-ledger');
      if (!res.ok) throw new Error('Failed to load estate ledger');
      return res.json();
    }
  });

  const { data: bankBalancesData } = useQuery({
    queryKey: ['bank-balances'],
    queryFn: async () => {
      const res = await fetch('/api/bank-balances');
      if (!res.ok) throw new Error('Failed to load bank balances');
      return res.json();
    }
  });

  const members = React.useMemo(() => membersData?.data || [], [membersData?.data]);
  const ledger = React.useMemo(() => estateLedgerData?.ledger || [], [estateLedgerData?.ledger]);
  const banks = useMemo(() => bankBalancesData?.data || [], [bankBalancesData]);
  const loading = membersLoading || ledgerLoading;
  const error = membersError?.message || ledgerError?.message;

  const addMemberMutation = useMutation({
    mutationFn: async (newMember) => {
      const res = await fetch('/api/family-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMember)
      });
      if (!res.ok) throw new Error('Failed to add family member');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-members'] });
      setIsAdding(false);
      setFormData({ name: '', role: 'Provider', age: '', annualIncome: '', collegeSavings: '', targetAge: 18, targetCollegeValue: 150000, source_bank_id: '' });
    }
  });

  const editMemberMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`/api/family-members/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update family member');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-members'] });
      setEditingId(null);
    }
  });

  const deleteMemberMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/family-members/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete family member');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-members'] });
    }
  });

  const addBankMutation = useMutation({
    mutationFn: async (bankData) => {
      const res = await fetch('/api/bank-balances', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bankData)
      });
      if (!res.ok) throw new Error('Failed to add bank balance');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-members'] });
      queryClient.invalidateQueries({ queryKey: ['family-estate-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['bank-balances'] });
      queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
      setShowAddBank(null);
      setBankForm({ bankName:'', balance:'' });
    }
  });

  const handleSubmit = (e) => {
      e.preventDefault();
      const age = parseInt(formData.age);
      const targetAge = parseInt(formData.targetAge);
      
      const annualIncomePaise = parseToPaiseBigInt(formData.annualIncome);
      let collegeSavingsPaise = parseToPaiseBigInt(formData.collegeSavings);
      if (formData.role !== 'Child') {
          collegeSavingsPaise = 0n;
      }
      let targetCollegeValuePaise = parseToPaiseBigInt(formData.targetCollegeValue);
      if (targetCollegeValuePaise === 0n) targetCollegeValuePaise = 15000000n; // 150000.00

      addMemberMutation.mutate({ 
          name: formData.name, role: formData.role, 
          age: isNaN(age) ? null : age,
          annualIncome: formatBigIntToDecimalString(annualIncomePaise < 0n ? 0n : annualIncomePaise),
          collegeSavings: formatBigIntToDecimalString(collegeSavingsPaise < 0n ? 0n : collegeSavingsPaise),
          targetAge: isNaN(targetAge) ? 18 : targetAge,
          targetCollegeValue: formatBigIntToDecimalString(targetCollegeValuePaise < 0n ? 15000000n : targetCollegeValuePaise),
          source_bank_id: formData.role === 'Child' ? (formData.source_bank_id || null) : null
      });
  };

  const handleEditInit = (member) => {
      setEditingId(member.id);
      setEditFormData({ 
          age: member.age, annualIncome: member.annualIncome, 
          collegeSavings: member.collegeSavings,
          targetAge: member.targetAge || 18,
          targetCollegeValue: member.targetCollegeValue || 150000
      });
  };

  const handleEditSave = (e, id) => {
      e.preventDefault();
      const age = parseInt(editFormData.age);
      const targetAge = parseInt(editFormData.targetAge);
      
      const annualIncomePaise = parseToPaiseBigInt(editFormData.annualIncome);
      const collegeSavingsPaise = parseToPaiseBigInt(editFormData.collegeSavings);
      let targetCollegeValuePaise = parseToPaiseBigInt(editFormData.targetCollegeValue);
      if (targetCollegeValuePaise === 0n) targetCollegeValuePaise = 15000000n; // 150000.00

      editMemberMutation.mutate({ 
        id, 
        data: {
          age: isNaN(age) ? null : age,
          annualIncome: formatBigIntToDecimalString(annualIncomePaise < 0n ? 0n : annualIncomePaise),
          collegeSavings: formatBigIntToDecimalString(collegeSavingsPaise < 0n ? 0n : collegeSavingsPaise),
          targetAge: isNaN(targetAge) ? 18 : targetAge,
          targetCollegeValue: formatBigIntToDecimalString(targetCollegeValuePaise < 0n ? 15000000n : targetCollegeValuePaise)
        }
      });
  };

  const handleDelete = (id) => {
    setConfirmModal({
        isOpen: true,
        title: 'Remove Entity',
        message: 'Remove this entity from the estate?',
        onConfirm: () => {
            deleteMemberMutation.mutate(id);
            setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });
        }
    });
  };

  const handleAddBank = (e, owner_member_id) => {
      e.preventDefault();
      const balancePaise = parseToPaiseBigInt(bankForm.balance);
      if (balancePaise < 0n) return;
      
      const today = new Date();
      const tzOffsetMs = today.getTimezoneOffset() * 60000;
      const localDate = new Date(today.getTime() - tzOffsetMs).toISOString().split('T')[0];
      
      addBankMutation.mutate({ 
          bankName: bankForm.bankName, 
          balance: formatBigIntToDecimalString(balancePaise), 
          owner_member_id,
          asOfDate: localDate
      });
  };

  const memberSummaries = useMemo(() => {
    return members.map(member => {
      const rawLData = ledger.find(l => l.id === member.id) || { assets: { banks:[], realEstate:[], investments:[], fds:[], gold:[], sinkingFunds:[] }, liabilities: { linkedLoans:[], unlinkedLoans:[], creditCards:[] }, totalGrossAssets: 0, totalLiabilities: 0, totalEstateShare: 0 };
      const lData = { ...rawLData, totalNetWorth: rawLData.totalEstateShare };
      return {
        ...member,
        lData,
        sumRealEstate: lData.assets.realEstate.reduce((s,a)=>s+a.calculatedValue,0),
        sumInvestments: lData.assets.investments.reduce((s,a)=>s+a.calculatedValue,0),
        sumFds: lData.assets.fds.reduce((s,a)=>s+a.calculatedValue,0),
        sumGold: lData.assets.gold.reduce((s,a)=>s+a.calculatedValue,0),
        sumNps: (lData.assets.nps || []).reduce((s,a)=>s+a.calculatedValue,0),
        sumSinkingFunds: (lData.assets.sinkingFunds || []).reduce((s,a)=>s+a.calculatedValue,0),
        sumLiabilities: lData.totalLiabilities || 0,
        sumGrossAssets: lData.totalGrossAssets || 0
      };
    });
  }, [members, ledger]);

  const activeMembers = useMemo(() => memberSummaries.filter(m => !m.isDeceased), [memberSummaries]);
  const deceasedMembers = useMemo(() => memberSummaries.filter(m => m.isDeceased), [memberSummaries]);

  const executeSuccessionMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/succession/execute/${id}`, { method: 'POST' });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to execute succession');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-members'] });
      queryClient.invalidateQueries({ queryKey: ['family-estate-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['bank-balances'] });
    },
    onError: (err) => {
        alert(err.message);
    }
  });

  const handleExecuteSuccession = (member) => {
    setConfirmModal({
        isOpen: true,
        title: 'Execute Succession Plan',
        message: `Are you sure you want to log the end of life for ${member.name}? This will permanently distribute all their assets to their nominees according to the succession plan and archive this member.`,
        onConfirm: () => {
            executeSuccessionMutation.mutate(member.id);
            setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });
        }
    });
  };

  return (
    <div className="animate-fade-in">
      {error && <div className="alert-banner danger" style={{marginBottom:'20px'}}><AlertTriangle size={16}/> {error}</div>}
      <div className="section-header">
        <div>
          <h2>Family Estate Master Ledger</h2>
          <p>Entity-Level Asset Allocation & Ownership</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? <><X size={16} style={{marginRight:'6px'}} /> Cancel Minting</> : <><Plus size={16} style={{marginRight:'6px'}} /> Mint Estate Entity</>}
        </button>
      </div>

      {isAdding && (
         <div className="glass-panel animate-fade-in" style={{ marginBottom: '24px', borderLeft: '4px solid var(--accent-sapphire)' }}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px'}}>
              <h2 style={{margin:0}}>Register Estate Participant</h2>
            </div>
            <form onSubmit={handleSubmit} className="grid-2">
                <div className="field-group"><label>Legal Name</label><input required value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} className="field-input" /></div>
                <div className="field-group">
                    <label>Estate Role</label>
                    <CustomSelect required value={formData.role} onChange={e=>setFormData({...formData, role:e.target.value})} className="field-input">
                        <option value="Provider">Primary Provider / Breadwinner</option>
                        <option value="Partner">Spouse / Partner</option>
                        <option value="Child">Child (Dependent)</option>
                        <option value="Elder">Elder (Dependent / Grandparent)</option>
                        <option value="HUF">HUF (Hindu Undivided Family)</option>
                    </CustomSelect>
                </div>
                {formData.role !== 'HUF' && <div className="field-group"><label>Current Age</label><input required type="number" value={formData.age} onChange={e=>setFormData({...formData, age:e.target.value})} className="field-input" /></div>}
                
                {(formData.role === 'Provider' || formData.role === 'Partner' || formData.role === 'Elder' || formData.role === 'HUF') && (
                    <>
                    <div className="field-group"><label>Annual Income Baseline (₹)</label><input type="number" value={formData.annualIncome} onChange={e=>setFormData({...formData, annualIncome:e.target.value})} className="field-input" /></div>
                    </>
                )}

                {formData.role === 'Child' && (
                    <>
                    <div className="field-group"><label>Initial Endowment (₹)</label><input type="number" value={formData.collegeSavings} onChange={e=>setFormData({...formData, collegeSavings:e.target.value})} className="field-input" /></div>
                    <div className="field-group">
                        <label>Funding Account</label>
                        <CustomSelect value={formData.source_bank_id} onChange={e=>setFormData({...formData, source_bank_id:e.target.value})} className="field-input">
                            <option value="">-- Select Bank or Cash Wallet --</option>
                            {banks.map(b => <option key={b.id} value={b.id}>{b.bankName} (₹{b.ledgerBalance?.toLocaleString('en-IN')})</option>)}
                        </CustomSelect>
                    </div>
                    </>
                )}
                
                <div style={{ gridColumn: 'span 2' }}>
                    <button type="submit" className="btn btn-success" style={{ width:'100%', padding:'12px', background:'linear-gradient(135deg, #3b82f6, #10b981)', border:'none' }}>Commit Entity to Estate</button>
                </div>
            </form>
         </div>
      )}

      {/* Render Entities */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)' }}>Loading estate ledger...</div>
      ) : activeMembers.length === 0 && !isAdding ? (
        <div className="empty-state glass-panel"><PackageOpen size={48} style={{opacity:0.3,marginBottom:'12px'}}/><h4>No Active Entities</h4><p>Mint your first estate entity (e.g., yourself, your spouse, or HUF) to begin allocating assets.</p></div>
      ) : (
      <div style={{display:'flex', flexDirection:'column', gap:'24px'}}>
         {activeMembers.map(member => {
             const isEditing = editingId === member.id;
             const lData = member.lData;
             
             return (
                 <div key={member.id} className="glass-panel" style={{ borderTop: member.role === 'HUF' ? '4px solid #f59e0b' : '4px solid var(--accent-sapphire)' }}>
                     
                     <div className="flex-between" style={{ marginBottom: '16px', paddingBottom:'16px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                         <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                           <div style={{width:'48px', height:'48px', borderRadius:'12px', background: member.role === 'HUF' ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)', display:'flex', alignItems:'center', justifyContent:'center'}}>
                             {member.role === 'HUF' ? <Landmark color="#f59e0b"/> : <Users color="#3b82f6"/>}
                           </div>
                           <div>
                             <h3 style={{ margin: 0, fontSize: '20px' }}>{member.name}</h3>
                             <span style={{fontSize:'12px', color:'var(--text-muted)'}}>{member.role} {member.age ? `• Age ${member.age}` : ''}</span>
                           </div>
                         </div>
                         <div style={{textAlign:'right'}}>
                           <div style={{fontSize:'12px', color:'var(--text-muted)'}}>Individual Net Worth</div>
                           <div style={{fontSize:'24px', fontWeight:800, color: lData.totalNetWorth >= 0 ? '#10b981' : '#ef4444'}}>₹{Number(lData.totalNetWorth).toLocaleString('en-IN')}</div>
                           <div style={{fontSize:'11px', color:'var(--text-muted)', marginTop:'4px'}}>Gross: ₹{Number(member.sumGrossAssets).toLocaleString('en-IN')} | Debt: ₹{Number(member.sumLiabilities).toLocaleString('en-IN')}</div>
                         </div>
                     </div>

                     <div className="grid-2" style={{gap:'24px'}}>
                       {/* Left Column: Accounts & Assets */}
                       <div>
                         <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px'}}>
                           <h4 style={{fontSize:'14px', margin:0}}>Bank Accounts & Cash Wallets</h4>
                           <button onClick={()=>setShowAddBank(member.id)} style={{fontSize:'12px', color:'#3b82f6', background:'none', border:'none', cursor:'pointer'}}>+ Add Account / Cash</button>
                         </div>

                         {showAddBank === member.id && (
                            <form onSubmit={(e)=>handleAddBank(e, member.id)} style={{display:'flex', gap:'8px', marginBottom:'12px'}}>
                               <input required placeholder="Bank Name or 'Cash'" value={bankForm.bankName} onChange={e=>setBankForm({...bankForm, bankName:e.target.value})} className="field-input" style={{flex:2}}/>
                               <input required type="number" step="0.01" placeholder="Balance (₹)" value={bankForm.balance} onChange={e=>setBankForm({...bankForm, balance:e.target.value})} className="field-input" style={{flex:1}}/>
                               <button type="submit" className="btn btn-primary" style={{padding:'8px'}}>Save</button>
                            </form>
                         )}

                         {lData.assets.banks.length === 0 ? (
                           <div style={{padding:'12px', background:'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius:'8px', fontSize:'12px', color:'#ef4444', display: 'flex', gap: '8px', alignItems: 'center'}}>
                               <AlertTriangle size={14} style={{flexShrink: 0}} />
                               <span>Please add a Bank Account or Cash Wallet to start tracking transactions for this member.</span>
                           </div>
                         ) : (
                           lData.assets.banks.map(b => (
                             <div key={b.id} style={{display:'flex', justifyContent:'space-between', padding:'10px 12px', background:'rgba(255,255,255,0.03)', borderRadius:'8px', marginBottom:'8px'}}>
                               <span style={{fontSize:'13px', fontWeight:600}}>{b.bankName}</span>
                               <span style={{fontSize:'13px'}}>₹{Number(b.balance).toLocaleString('en-IN')}</span>
                             </div>
                           ))
                         )}

                         <h4 style={{fontSize:'14px', margin:'20px 0 12px 0'}}>Allocated Assets</h4>
                         <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
                           <div style={{display:'flex', justifyContent:'space-between', padding:'10px 12px', background:'rgba(255,255,255,0.03)', borderRadius:'8px'}}>
                             <div style={{display:'flex', alignItems:'center', gap:'8px'}}><Landmark size={14} color="#8b5cf6"/><span style={{fontSize:'13px'}}>Real Estate ({lData.assets.realEstate.length})</span></div>
                             <span style={{fontSize:'13px'}}>₹{member.sumRealEstate.toLocaleString('en-IN')}</span>
                           </div>
                           <div style={{display:'flex', justifyContent:'space-between', padding:'10px 12px', background:'rgba(255,255,255,0.03)', borderRadius:'8px'}}>
                             <div style={{display:'flex', alignItems:'center', gap:'8px'}}><TrendingUp size={14} color="#3b82f6"/><span style={{fontSize:'13px'}}>Investments ({lData.assets.investments.length})</span></div>
                             <span style={{fontSize:'13px'}}>₹{member.sumInvestments.toLocaleString('en-IN')}</span>
                           </div>
                           <div style={{display:'flex', justifyContent:'space-between', padding:'10px 12px', background:'rgba(255,255,255,0.03)', borderRadius:'8px'}}>
                             <div style={{display:'flex', alignItems:'center', gap:'8px'}}><PiggyBank size={14} color="#10b981"/><span style={{fontSize:'13px'}}>Fixed Deposits ({lData.assets.fds.length})</span></div>
                             <span style={{fontSize:'13px'}}>₹{member.sumFds.toLocaleString('en-IN')}</span>
                           </div>
                           <div style={{display:'flex', justifyContent:'space-between', padding:'10px 12px', background:'rgba(255,255,255,0.03)', borderRadius:'8px'}}>
                             <div style={{display:'flex', alignItems:'center', gap:'8px'}}><Coins size={14} color="#f59e0b"/><span style={{fontSize:'13px'}}>Gold Holdings ({lData.assets.gold.length})</span></div>
                             <span style={{fontSize:'13px'}}>₹{member.sumGold.toLocaleString('en-IN')}</span>
                           </div>
                           <div style={{display:'flex', justifyContent:'space-between', padding:'10px 12px', background:'rgba(255,255,255,0.03)', borderRadius:'8px'}}>
                             <div style={{display:'flex', alignItems:'center', gap:'8px'}}><Target size={14} color="#ec4899"/><span style={{fontSize:'13px'}}>Sinking Funds ({(lData.assets.sinkingFunds || []).length})</span></div>
                             <span style={{fontSize:'13px'}}>₹{member.sumSinkingFunds.toLocaleString('en-IN')}</span>
                           </div>
                           <div style={{display:'flex', justifyContent:'space-between', padding:'10px 12px', background:'rgba(255,255,255,0.03)', borderRadius:'8px'}}>
                             <div style={{display:'flex', alignItems:'center', gap:'8px'}}><Briefcase size={14} color="#06b6d4"/><span style={{fontSize:'13px'}}>NPS Retirement ({(lData.assets.nps || []).length})</span></div>
                             <span style={{fontSize:'13px'}}>₹{member.sumNps.toLocaleString('en-IN')}</span>
                           </div>
                           {Number(member.collegeSavings) > 0 && (
                             <div style={{display:'flex', justifyContent:'space-between', padding:'10px 12px', background:'rgba(255,255,255,0.03)', borderRadius:'8px'}}>
                               <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                                 {member.role === 'Child' ? <GraduationCap size={14} color="#a855f7"/> : <Shield size={14} color="#a855f7"/>}
                                 <span style={{fontSize:'13px'}}>{member.role === 'Child' ? 'College Endowment' : 'Endowment Policies'}</span>
                               </div>
                               <span style={{fontSize:'13px'}}>₹{Number(member.collegeSavings).toLocaleString('en-IN')}</span>
                             </div>
                           )}
                         </div>
                       </div>

                       {/* Right Column: Settings & Insurance */}
                       <div>
                         {isEditing ? (
                             <form onSubmit={(e) => handleEditSave(e, member.id)} style={{ background: 'rgba(0,0,0,0.2)', padding:'16px', borderRadius: '12px' }}>
                                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
                                    {member.role !== 'HUF' && <div className="field-group"><label>Age</label><input type="number" value={editFormData.age} onChange={e=>setEditFormData({...editFormData, age:e.target.value})} className="field-input"/></div>}
                                    <div className="field-group"><label>Income Set (₹)</label><input type="number" value={editFormData.annualIncome} onChange={e=>setEditFormData({...editFormData, annualIncome:e.target.value})} className="field-input"/></div>
                                  </div>
                                  <button type="submit" className="btn btn-success" style={{ width:'100%', padding: '10px', marginTop:'16px' }}>Save Parameters</button>
                             </form>
                         ) : (
                             <>
                             <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', marginBottom:'16px' }}>
                                 <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)' }}>Assigned Income Stream</span>
                                 <span style={{ fontSize: '18px', fontWeight: 600 }}>₹{Number(member.annualIncome||0).toLocaleString('en-IN')}</span>
                             </div>
                             <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', marginBottom:'16px' }}>
                                 <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)' }}>Life Coverage Blanket</span>
                                 <span style={{ fontSize: '18px', fontWeight: 600 }}>₹{Number(member.lifeInsuranceCoverage||0).toLocaleString('en-IN')}</span>
                             </div>
                             </>
                         )}

                         <div style={{display:'flex', gap:'8px', marginTop:'24px', justifyContent:'flex-end'}}>
                           {!isEditing ? (
                              <>
                                {['Provider', 'Partner', 'Elder'].includes(member.role) && (
                                   <button className="icon-btn warning" style={{color: '#f59e0b', borderColor: '#f59e0b'}} onClick={() => handleExecuteSuccession(member)}>Execute Succession</button>
                                )}
                                <button className="icon-btn" onClick={() => handleEditInit(member)}><Edit2 size={14} /> Edit Profile</button>
                                <button className="icon-btn danger" onClick={() => handleDelete(member.id)}><Trash2 size={14} /> Delete</button>
                              </>
                           ) : (
                              <button className="btn" style={{padding:'8px 16px', background:'rgba(255,255,255,0.05)', color:'var(--text-primary)'}} onClick={() => setEditingId(null)}>Cancel</button>
                           )}
                         </div>
                       </div>
                     </div>
                 </div>
              )
         })}
      </div>
      )}

      {/* Render Legacy Archive */}
      {deceasedMembers.length > 0 && (
          <div style={{marginTop: '40px'}}>
              <h3 style={{borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginBottom: '16px'}}>Legacy & Ancestry</h3>
              <div style={{display:'flex', flexDirection:'column', gap:'16px'}}>
                 {deceasedMembers.map(member => (
                     <div key={member.id} className="glass-panel" style={{ borderTop: '4px solid #6b7280', opacity: 0.8 }}>
                         <div className="flex-between" style={{ paddingBottom:'8px' }}>
                             <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                               <div style={{width:'40px', height:'40px', borderRadius:'12px', background: 'rgba(107,114,128,0.2)', display:'flex', alignItems:'center', justifyContent:'center'}}>
                                 <Users color="#9ca3af"/>
                               </div>
                               <div>
                                 <h3 style={{ margin: 0, fontSize: '18px', color: '#9ca3af' }}>{member.name} (Archived)</h3>
                                 <span style={{fontSize:'12px', color:'var(--text-muted)'}}>{member.role} • Succession Plan Executed</span>
                               </div>
                             </div>
                             <div>
                                 <button className="icon-btn danger" onClick={() => handleDelete(member.id)}><Trash2 size={14} /> Remove</button>
                             </div>
                         </div>
                     </div>
                 ))}
              </div>
          </div>
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

export default FamilyEstate;
