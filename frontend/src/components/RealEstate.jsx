 
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Home, Building, Map, AlertTriangle, Plus, PenTool, X, Trash2, Edit3, TrendingUp, ChevronDown, Banknote, Percent, PackageOpen } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import { parseToPaiseBigInt, formatBigIntToDecimalString } from '../utils/bigIntMath';
import CustomSelect from './ui/CustomSelect';

function RealEstate() {
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ title: '', propertyType: 'Residential Apartment', baseValue: '', expectedRent: '', currentMarketValue: '', purchaseDate: '', occupancyStatus: 'rented', linkedLoanId: '', owner_member_id: '', joint_owner_member_id: '', owner_split_percent: '100', source_bank_id: '', joint_bank_id: '', split_amount: '' });
  const [logAction, setLogAction] = useState({ id: null, type: null });
  const [logAmount, setLogAmount] = useState('');
  const [logDesc, setLogDesc] = useState('');
  const [logBankId, setLogBankId] = useState('');
  const [logJointBankId, setLogJointBankId] = useState('');
  const [logSplitAmount, setLogSplitAmount] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const queryClient = useQueryClient();
  const { data: reRes, error: e1 } = useQuery({ queryKey: ['real-estate'], queryFn: () => fetch('/api/real-estate').then(r => r.json()) });
  const { data: loanRes } = useQuery({ queryKey: ['loans-list'], queryFn: () => fetch('/api/loans-list').then(r => r.json()) });
  const { data: famRes } = useQuery({ queryKey: ['family-members'], queryFn: () => fetch('/api/family-members').then(r => r.json()) });
  const { data: recData } = useQuery({ queryKey: ['reconciliation'], queryFn: () => fetch('/api/reconciliation').then(r => r.json()) });
  const banks = recData?.banks || [];

  /* const loading = l1 || l2 || l3 || l4; */
  const error = e1 ? 'Failed to load real estate data.' : null;
  const properties = useMemo(() => reRes?.data || [], [reRes?.data]);
  const fyStart = reRes?.fyStart || '';
  const loans = loanRes?.data || [];
  const familyMembers = famRes?.data || [];
  

  const addMut = useMutation({
    mutationFn: async (data) => {
      const res = await fetch('/api/real-estate', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) { let e; try { e = await res.json(); } catch (err) { throw new Error(`Network or server error (${res.status})`, { cause: err }); } throw new Error(e?.error || 'Failed to save asset'); }
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['real-estate'] });
      setShowAddForm(false);
      setAddForm({ title: '', propertyType: 'Residential Apartment', baseValue: '', expectedRent: '', currentMarketValue: '', purchaseDate: '', occupancyStatus: 'rented', linkedLoanId: '', owner_member_id: '', joint_owner_member_id: '', owner_split_percent: '100', source_bank_id: '', joint_bank_id: '', split_amount: '' });
    }
  });

  const txMut = useMutation({
    mutationFn: async (data) => {
      const res = await fetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) { let e; try { e = await res.json(); } catch (err) { throw new Error(`Network or server error (${res.status})`, { cause: err }); } throw new Error(e?.error || 'Failed to save transaction'); }
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['real-estate'] });
      await queryClient.invalidateQueries({ queryKey: ['bank-balances'] });
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      await queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
      setLogAction({ id: null, type: null }); setLogAmount(''); setLogDesc(''); setLogBankId(''); setLogJointBankId(''); setLogSplitAmount('');
    }
  });

  const editMut = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`/api/real-estate/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) { let e; try { e = await res.json(); } catch (err) { throw new Error(`Network or server error (${res.status})`, { cause: err }); } throw new Error(e?.error || 'Failed to edit asset'); }
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['real-estate'] });
      setEditingId(null); setEditForm({});
    }
  });

  const delMut = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/real-estate/${id}`, { method: 'DELETE', headers: { 'Accept': 'application/json' } });
      if (!res.ok) { let e; try { e = await res.json(); } catch (err) { throw new Error(`Network or server error (${res.status})`, { cause: err }); } throw new Error(e?.error || 'Failed to delete asset'); }
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['real-estate'] });
      setConfirmDelete(null);
      setDeleteError(null);
    },
    onError: (err) => setDeleteError(err.message)
  });

  const submitAddProperty = () => {
    if (!addForm.title || !addForm.source_bank_id) return;
    const baseValuePaise = parseToPaiseBigInt(addForm.baseValue);
    if (baseValuePaise < 0n) return;
    const currentMarketValuePaise = parseToPaiseBigInt(addForm.currentMarketValue);
    const expectedRentPaise = parseToPaiseBigInt(addForm.expectedRent);
    const owner_split_percent = parseFloat(addForm.owner_split_percent);
    
    addMut.mutate({ 
      ...addForm, 
      baseValue: formatBigIntToDecimalString(baseValuePaise), 
      expectedRent: expectedRentPaise < 0n ? "0" : formatBigIntToDecimalString(expectedRentPaise), 
      currentMarketValue: currentMarketValuePaise < 0n ? formatBigIntToDecimalString(baseValuePaise) : formatBigIntToDecimalString(currentMarketValuePaise), 
      linkedLoanId: addForm.linkedLoanId ? parseInt(addForm.linkedLoanId) : null, 
      owner_member_id: addForm.owner_member_id || null, 
      joint_owner_member_id: addForm.joint_owner_member_id || null, 
      owner_split_percent: isNaN(owner_split_percent) || owner_split_percent < 0 || owner_split_percent > 100 ? 100 : Math.round(owner_split_percent * 100) / 100, 
      source_bank_id: addForm.source_bank_id,
      joint_bank_id: addForm.joint_bank_id || null,
      split_amount: addForm.split_amount ? formatBigIntToDecimalString(parseToPaiseBigInt(addForm.split_amount)) : null
    });
  };

  const submitLog = (propId, title) => {
    const amountPaise = parseToPaiseBigInt(logAmount);
    if (amountPaise <= 0n || !logBankId) return;
    const cleanAmount = formatBigIntToDecimalString(amountPaise);
    const cleanSplitAmt = logJointBankId && logSplitAmount ? formatBigIntToDecimalString(parseToPaiseBigInt(logSplitAmount)) : null;
    if (logAction.type === 'rent') {
      txMut.mutate({ title: `Rent Collected: ${title}`, amount: cleanAmount, date: new Date().toISOString().split('T')[0], category: 'rental', type: 'income', propertyId: propId, source_bank_id: logBankId, joint_bank_id: logJointBankId || null, split_amount: cleanSplitAmt });
    } else if (logAction.type === 'expense') {
      txMut.mutate({ title: `Property Expense: ${title} - ${logDesc || 'Maintenance'}`, amount: cleanAmount, date: new Date().toISOString().split('T')[0], category: 'maintenance', type: 'expense', propertyId: propId, taxDeductible: true, source_bank_id: logBankId, joint_bank_id: logJointBankId || null, split_amount: cleanSplitAmt });
    }
  };

  const submitEdit = (id) => {
    const currentMarketValuePaise = parseToPaiseBigInt(editForm.currentMarketValue);
    const expectedRentPaise = parseToPaiseBigInt(editForm.expectedRent);
    const owner_split_percent = parseFloat(editForm.owner_split_percent);
    
    editMut.mutate({ 
      id, 
      data: { 
        currentMarketValue: currentMarketValuePaise < 0n ? "0" : formatBigIntToDecimalString(currentMarketValuePaise), 
        occupancyStatus: editForm.occupancyStatus, 
        linkedLoanId: editForm.linkedLoanId ? parseInt(editForm.linkedLoanId) : null, 
        expectedRent: expectedRentPaise < 0n ? "0" : formatBigIntToDecimalString(expectedRentPaise), 
        owner_member_id: editForm.owner_member_id || null, 
        joint_owner_member_id: editForm.joint_owner_member_id || null, 
        owner_split_percent: isNaN(owner_split_percent) || owner_split_percent < 0 || owner_split_percent > 100 ? 100 : Math.round(owner_split_percent * 100) / 100 
      } 
    });
  };

  const deleteProperty = (id) => {
    setConfirmDelete(id);
  };

  const {
    totalPurchaseValue,
    totalMarketValue,
    totalAppreciation,
    totalAppreciationPct,
    totalFyYield,
    totalMonthlyRent
  } = useMemo(() => {
    const pVal = properties.reduce((a, p) => a + parseToPaiseBigInt(p.baseValue || '0'), 0n);
    const mVal = properties.reduce((a, p) => a + (p.currentMarketValue ? parseToPaiseBigInt(p.currentMarketValue) : parseToPaiseBigInt(p.baseValue || '0')), 0n);
    const app = mVal - pVal;
    const appPct = pVal > 0n ? (Number(app * 1000n / pVal) / 10).toFixed(1) : 0;
    const fYld = properties.reduce((a, p) => a + parseToPaiseBigInt(p.ytdRent || '0') - parseToPaiseBigInt(p.ytdMaintenance || '0'), 0n);
    const mRent = properties.reduce((a, p) => a + (p.occupancyStatus !== 'vacant' ? parseToPaiseBigInt(p.expectedRent || '0') : 0n), 0n);
    return {
      totalPurchaseValue: Number(pVal) / 100,
      totalMarketValue: Number(mVal) / 100,
      totalAppreciation: Number(app) / 100,
      totalAppreciationPct: appPct,
      totalFyYield: Number(fYld) / 100,
      totalMonthlyRent: Number(mRent) / 100
    };
  }, [properties]);

  const getTypeIcon = (type) => {
    if (type.includes('Apartment') || type.includes('House')) return <Home size={20} className="text-emerald" />;
    if (type.includes('Commercial')) return <Building size={20} className="text-sapphire" />;
    return <Map size={20} className="text-coral" />;
  };

  const occupancyBadge = (status) => {
    const cfg = { rented: { cls: 'safe', label: 'Rented' }, vacant: { cls: 'warning', label: 'Vacant' }, self_occupied: { cls: 'info', label: 'Self-Occupied' } };
    const c = cfg[status] || cfg.rented;
    return <span className={`urgency-badge ${c.cls}`}>{c.label}</span>;
  };

  const inputStyle = { padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '13px', width: '100%' };
  const selectStyle = { ...inputStyle, appearance: 'none' };

  const fyLabel = fyStart ? `FY ${fyStart.substring(0, 4)}-${(parseInt(fyStart.substring(0, 4)) + 1).toString().slice(-2)}` : 'FY';

  return (
    <div className="animate-fade-in">
      {error && <div className="alert-banner danger" style={{marginBottom:'20px'}}><AlertTriangle size={16}/> {error}</div>}

      <div className="section-header">
        <div>
          <h2>Real Estate Yield Engine</h2>
          <p>Illiquid Asset • True Maintenance • CII Capital Gains</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? <><X size={16} style={{marginRight:'8px'}} /> Cancel Asset Recording</> : <><Plus size={16} style={{marginRight:'8px'}} /> Record New Asset</>}
        </button>
      </div>

      {showAddForm && (
        <div className="glass-panel animate-fade-in" style={{ padding: '24px', marginBottom: '40px', borderLeft: '4px solid var(--accent-sapphire)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ margin: 0 }}>Add Real Estate Asset</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <CustomSelect value={addForm.propertyType} onChange={e => setAddForm({...addForm, propertyType: e.target.value})} style={selectStyle}>
              <option value="Residential Apartment">Residential Apartment</option>
              <option value="House (Primary)">House (Primary)</option>
              <option value="Commercial Complex">Commercial Complex</option>
              <option value="Farm Land">Farm Land</option>
              <option value="Business/Self-Owned Land">Business/Self-Owned Land</option>
            </CustomSelect>
            <input placeholder="Title (e.g. Skyline Apt 402)" value={addForm.title} onChange={e => setAddForm({...addForm, title: e.target.value})} style={inputStyle} />
            <input type="date" value={addForm.purchaseDate} onChange={e => setAddForm({...addForm, purchaseDate: e.target.value})} style={inputStyle} title="Purchase Date" />
            
            <CustomSelect value={addForm.owner_member_id} onChange={e => setAddForm({...addForm, owner_member_id: e.target.value})} style={selectStyle}>
              <option value="">-- Primary Owner (Unassigned) --</option>
              {familyMembers.map(m => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
            </CustomSelect>
            <CustomSelect value={addForm.joint_owner_member_id} onChange={e => setAddForm({...addForm, joint_owner_member_id: e.target.value})} style={selectStyle}>
              <option value="">-- Joint Owner (Optional) --</option>
              {familyMembers.map(m => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
            </CustomSelect>
            <div style={{display:'flex', alignItems:'center', gap:'8px', background:'rgba(255,255,255,0.05)', borderRadius:'8px', paddingRight:'12px'}}>
               <input type="number" min="0" max="100" placeholder="Primary Split %" value={addForm.owner_split_percent} onChange={e => setAddForm({...addForm, owner_split_percent: e.target.value})} style={{...inputStyle, background:'none', border:'none'}} title="Primary Owner Share (%)" />
               <span style={{color:'var(--text-muted)', fontSize:'12px'}}>%</span>
            </div>

            <input type="number" placeholder="Purchase Price (₹)" value={addForm.baseValue} onChange={e => setAddForm({...addForm, baseValue: e.target.value})} style={inputStyle} />
            <input type="number" placeholder="Current Market Value (₹)" value={addForm.currentMarketValue} onChange={e => setAddForm({...addForm, currentMarketValue: e.target.value})} style={inputStyle} />
            <input type="number" placeholder="Expected Monthly Rent (₹)" value={addForm.expectedRent} onChange={e => setAddForm({...addForm, expectedRent: e.target.value})} style={inputStyle} />
            <CustomSelect value={addForm.occupancyStatus} onChange={e => setAddForm({...addForm, occupancyStatus: e.target.value})} style={selectStyle}>
              <option value="rented">🟢 Rented</option>
              <option value="vacant">🟡 Vacant</option>
              <option value="self_occupied">🔵 Self-Occupied</option>
            </CustomSelect>
            <CustomSelect value={addForm.linkedLoanId} onChange={e => setAddForm({...addForm, linkedLoanId: e.target.value})} style={selectStyle}>
              <option value="">No Linked Loan</option>
              {loans.map(l => <option key={l.id} value={l.id}>{l.title} (₹{l.amount?.toLocaleString('en-IN')}/mo)</option>)}
            </CustomSelect>
            <div style={{display:'flex', gap:'8px', gridColumn: 'span 3'}}>
              <CustomSelect required value={addForm.source_bank_id} onChange={e => setAddForm({...addForm, source_bank_id: e.target.value})} style={{...selectStyle, flex: 1}}>
                <option value="" disabled>-- Primary Funding Bank Account --</option>
                {banks.map(b => <option key={b.id} value={b.id}>{b.bankName} (₹{b.ledgerBalance?.toLocaleString('en-IN')})</option>)}
              </CustomSelect>
              {parseFloat(addForm.owner_split_percent) < 100 && (
                <>
                  <CustomSelect required value={addForm.joint_bank_id} onChange={e => {
                    const val = e.target.value;
                    const splitPct = 100 - parseFloat(addForm.owner_split_percent || 100);
                    const basePaise = parseToPaiseBigInt(addForm.baseValue || '0');
                    const autoSplitPaise = (basePaise * BigInt(Math.round(splitPct * 100))) / 10000n;
                    setAddForm({...addForm, joint_bank_id: val, split_amount: val ? formatBigIntToDecimalString(autoSplitPaise) : ''});
                  }} style={{...selectStyle, flex: 1}}>
                    <option value="" disabled>-- Joint Funding Bank --</option>
                    {banks.map(b => String(b.id) !== String(addForm.source_bank_id) && <option key={b.id} value={b.id}>{b.bankName} (₹{b.ledgerBalance?.toLocaleString('en-IN')})</option>)}
                  </CustomSelect>
                  <input type="number" placeholder="Split Amount" value={addForm.split_amount} onChange={e => setAddForm({...addForm, split_amount: e.target.value})} style={{...inputStyle, flex: 0.5}} />
                </>
              )}
            </div>
            <button onClick={submitAddProperty} style={{ padding: '12px', background: 'var(--accent-sapphire)', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Save Asset</button>
          </div>
        </div>
      )}

      {/* Portfolio Summary */}
      <div className="stat-grid" style={{ marginBottom: '40px' }}>
        <div className="stat-card" style={{'--stat-accent':'var(--text-secondary)','--stat-color':'var(--text-secondary)'}}>
          <div className="stat-card-icon"><Home size={20}/></div>
          <div className="stat-card-label">Total Purchase Value</div>
          <div className="stat-card-value">₹{totalPurchaseValue.toLocaleString('en-IN')}</div>
          <div className="stat-card-sub">{properties.length} propert{properties.length !== 1 ? 'ies' : 'y'}</div>
        </div>
        <div className="stat-card" style={{'--stat-accent':'var(--accent-emerald)','--stat-color':'var(--accent-emerald)'}}>
          <div className="stat-card-icon"><TrendingUp size={20}/></div>
          <div className="stat-card-label">Current Market Value</div>
          <div className="stat-card-value">₹{totalMarketValue.toLocaleString('en-IN')}</div>
        </div>
        <div className="stat-card" style={{'--stat-accent':totalAppreciation >= 0 ? 'var(--accent-emerald)' : 'var(--accent-coral)','--stat-color':totalAppreciation >= 0 ? 'var(--accent-emerald)' : 'var(--accent-coral)'}}>
          <div className="stat-card-icon"><Percent size={20}/></div>
          <div className="stat-card-label">Total Appreciation</div>
          <div className="stat-card-value">{totalAppreciation >= 0 ? '+' : ''}₹{totalAppreciation.toLocaleString('en-IN')}</div>
          <div className="stat-card-sub">{totalAppreciationPct}%</div>
        </div>
        <div className="stat-card" style={{'--stat-accent':'var(--accent-sapphire)','--stat-color':'var(--accent-sapphire)'}}>
          <div className="stat-card-icon"><Banknote size={20}/></div>
          <div className="stat-card-label">Net {fyLabel} Yield</div>
          <div className="stat-card-value">₹{totalFyYield.toLocaleString('en-IN')}</div>
          <div className="stat-card-sub">Monthly Rent: ₹{totalMonthlyRent.toLocaleString('en-IN')}</div>
        </div>
      </div>

      {/* Property Cards */}
      {properties.length === 0 && (
        <div className="empty-state glass-panel"><PackageOpen size={48} style={{opacity:0.3,marginBottom:'12px'}}/><h4>No Properties Recorded</h4><p>Click "Record New Asset" to add your first property.</p></div>
      )}
      <div className="grid-2">
        {properties.map(p => {
          const ytdRentPaise = parseToPaiseBigInt(p.ytdRent || '0');
          const ytdMaintenancePaise = parseToPaiseBigInt(p.ytdMaintenance || '0');
          const netYieldPaise = ytdRentPaise - ytdMaintenancePaise;
          const netYield = Number(netYieldPaise) / 100;
          const marketVal = Number(parseToPaiseBigInt(p.currentMarketValue || p.baseValue || '0')) / 100;
          // const grossYieldPct = marketVal > 0 ? ((Number(ytdRentPaise) / 100 / marketVal) * 100).toFixed(2) : 0;
          const taxClass = p.propertyType.includes('Farm') ? 'Tax-Free Agricultural' : (p.propertyType.includes('Commercial') ? 'Commercial Slab' : 'Standard 30% Deduction (Sec 24a)');
          const isLoggingRent = logAction.id === p.id && logAction.type === 'rent';
          const isLoggingExpense = logAction.id === p.id && logAction.type === 'expense';
          const isEditing = editingId === p.id;
          const linkedLoan = loans.find(l => l.id === p.linkedLoanId);

          return (
            <div key={p.id} className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '12px' }}>{getTypeIcon(p.propertyType)}</div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ fontSize: '18px', margin: 0 }}>{p.title}</h3>
                      <button className="icon-btn danger" onClick={() => deleteProperty(p.id)}  title="Delete"><Trash2 size={14}/></button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.propertyType}</span>
                      {occupancyBadge(p.occupancyStatus)}
                    </div>
                  </div>
                </div>
                <button className="icon-btn" onClick={() => { if(isEditing) { setEditingId(null); } else { setEditingId(p.id); setEditForm({ currentMarketValue: p.currentMarketValue || p.baseValue || '0', occupancyStatus: p.occupancyStatus || 'rented', linkedLoanId: p.linkedLoanId || '', expectedRent: p.expectedRent || '0', owner_member_id: p.owner_member_id || '', joint_owner_member_id: p.joint_owner_member_id || '', owner_split_percent: p.owner_split_percent || 100 }); }}}  title="Edit"><Edit3 size={16}/></button>
              </div>

              {/* Edit Form */}
              {isEditing && (
                <div className="animate-fade-in" style={{ padding: '16px', background: 'rgba(59,130,246,0.05)', borderRadius: '10px', border: '1px solid rgba(59,130,246,0.2)', marginBottom: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div><label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Market Value</label><input type="number" value={editForm.currentMarketValue} onChange={e => setEditForm({...editForm, currentMarketValue: e.target.value})} style={{...inputStyle, marginTop: '4px'}} /></div>
                    <div><label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Monthly Rent</label><input type="number" value={editForm.expectedRent} onChange={e => setEditForm({...editForm, expectedRent: e.target.value})} style={{...inputStyle, marginTop: '4px'}} /></div>
                    <div><label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Occupancy</label><CustomSelect value={editForm.occupancyStatus} onChange={e => setEditForm({...editForm, occupancyStatus: e.target.value})} style={{...selectStyle, marginTop: '4px'}}><option value="rented">Rented</option><option value="vacant">Vacant</option><option value="self_occupied">Self-Occupied</option></CustomSelect></div>
                    <div><label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Linked Loan</label><CustomSelect value={editForm.linkedLoanId} onChange={e => setEditForm({...editForm, linkedLoanId: e.target.value})} style={{...selectStyle, marginTop: '4px'}}><option value="">None</option>{loans.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}</CustomSelect></div>
                    
                    <div style={{gridColumn:'span 2', display:'flex', gap:'8px', marginTop:'8px'}}>
                       <div style={{flex:1}}><label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Primary Owner</label>
                         <CustomSelect value={editForm.owner_member_id} onChange={e => setEditForm({...editForm, owner_member_id: e.target.value})} style={{...selectStyle, marginTop: '4px'}}>
                           <option value="">Unassigned</option>
                           {familyMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                         </CustomSelect>
                       </div>
                       <div style={{flex:1}}><label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Joint Owner</label>
                         <CustomSelect value={editForm.joint_owner_member_id} onChange={e => setEditForm({...editForm, joint_owner_member_id: e.target.value})} style={{...selectStyle, marginTop: '4px'}}>
                           <option value="">None</option>
                           {familyMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                         </CustomSelect>
                       </div>
                       <div style={{flex:0.5}}><label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Primary Split %</label>
                         <input type="number" min="0" max="100" value={editForm.owner_split_percent} onChange={e => setEditForm({...editForm, owner_split_percent: e.target.value})} style={{...inputStyle, marginTop: '4px'}} />
                       </div>
                    </div>
                  </div>
                  <button onClick={() => submitEdit(p.id)} style={{ marginTop: '12px', padding: '10px 24px', background: 'var(--accent-sapphire)', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '13px', width: '100%' }}>Save Changes</button>
                </div>
              )}

              {/* Value Panel */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Purchase Price</div>
                  <div style={{ fontSize: '16px', fontWeight: 600 }}>₹{(Number(parseToPaiseBigInt(p.baseValue || '0')) / 100).toLocaleString('en-IN', {maximumFractionDigits: 0})}</div>
                  {p.purchaseDate && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{new Date(p.purchaseDate).toLocaleDateString('en-IN', {month: 'short', year: 'numeric'})} • {p.monthsOwned} mo</div>}
                </div>
                <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Current Market Value</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-emerald)' }}>₹{marketVal.toLocaleString('en-IN', {maximumFractionDigits: 0})}</div>
                  <div style={{ fontSize: '11px', color: p.appreciation >= 0 ? 'var(--accent-emerald)' : 'var(--accent-coral)', marginTop: '2px' }}>
                    <TrendingUp size={10} style={{ marginRight: '4px' }}/>{p.appreciation >= 0 ? '+' : ''}₹{(p.appreciation || 0).toLocaleString('en-IN', {maximumFractionDigits: 0})} ({p.appreciationPct || 0}%)
                  </div>
                </div>
              </div>

              {/* Rental P&L */}
              <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  <span>{fyLabel} Rental P&L</span>
                  {linkedLoan && <span style={{ color: 'var(--accent-sapphire)', fontSize: '11px' }}>🔗 {linkedLoan.title}</span>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Expected Monthly Rent:</span>
                  <span style={{ fontWeight: 600 }}>₹{(Number(parseToPaiseBigInt(p.expectedRent || '0')) / 100).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                  <span style={{ color: 'var(--accent-emerald)' }}>{fyLabel} Rent Collected:</span>
                  <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>+ ₹{(Number(ytdRentPaise) / 100).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                  <span style={{ color: 'var(--accent-coral)' }}>{fyLabel} Expenses:</span>
                  <span style={{ color: 'var(--accent-coral)', fontWeight: 600 }}>- ₹{(Number(ytdMaintenancePaise) / 100).toLocaleString('en-IN')}</span>
                </div>
                <hr style={{ borderColor: 'rgba(255,255,255,0.05)', margin: '10px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px' }}>
                  <span style={{ fontWeight: 600 }}>Net Cash Flow:</span>
                  <span style={{ fontWeight: 700, color: netYield >= 0 ? 'var(--text-primary)' : 'var(--accent-coral)' }}>₹{netYield.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  <span>Annualized Yield:</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{p.annualizedYield || 0}%</span>
                </div>
              </div>

              {/* Capital Gains (CII) */}
              {p.purchaseDate && (
                <div style={{ padding: '12px', background: 'rgba(139, 92, 246, 0.05)', borderRadius: '10px', border: '1px solid rgba(139, 92, 246, 0.15)', marginBottom: '16px', fontSize: '12px' }}>
                  <div style={{ fontWeight: 600, color: '#a78bfa', marginBottom: '8px' }}>📊 Capital Gains & Tax</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Indexed Cost Basis:</span>
                    <span>₹{(p.indexedCostBasis || 0).toLocaleString('en-IN')}</span>
                  </div>
                  {p.isLTCG && p.optimalTaxRegime && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Optimal Tax Regime:</span>
                      <span style={{ color: 'var(--accent-coral)' }}>{p.optimalTaxRegime}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{p.isLTCG && p.optimalTaxRegime ? 'Est. Tax Liability:' : 'Taxable Gain:'}</span>
                    <span style={{ fontWeight: 700, color: (p.optimalTaxAmount || p.ltcgTaxable || p.stcgTaxable) > 0 ? 'var(--accent-coral)' : 'var(--accent-emerald)' }}>
                      ₹{((p.isLTCG && p.optimalTaxAmount !== undefined) ? p.optimalTaxAmount : (p.isLTCG ? p.ltcgTaxable : p.stcgTaxable) || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  {p.monthsOwned < 24 && <div style={{ marginTop: '6px', color: '#f59e0b', fontSize: '11px' }}>⚠ Held &lt; 24 months — STCG applies (taxed at slab rate)</div>}
                </div>
              )}

              {/* Tax Classification */}
              <div style={{ display: 'flex', gap: '8px', color: 'var(--text-muted)', fontSize: '12px', marginBottom: '16px', alignItems: 'center' }}>
                <AlertTriangle size={14} style={{ color: 'var(--accent-sapphire)' }} /> Tax: {taxClass}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: 'auto' }}>
                <button className="btn" style={{ flex: 1, background: isLoggingRent ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.1)', color: 'var(--accent-emerald)', border: '1px solid rgba(16,185,129,0.2)' }} onClick={() => { setLogAction({ id: p.id, type: 'rent' }); setLogAmount(''); setLogDesc(''); setLogBankId(''); setLogJointBankId(''); setLogSplitAmount(''); }}>Log Rent</button>
                <button className="btn" style={{ flex: 1, background: isLoggingExpense ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.1)', color: 'var(--accent-coral)', border: '1px solid rgba(239,68,68,0.2)' }} onClick={() => { setLogAction({ id: p.id, type: 'expense' }); setLogAmount(''); setLogDesc(''); setLogBankId(''); setLogJointBankId(''); setLogSplitAmount(''); }}><PenTool size={14} style={{ marginRight: '6px' }} />Log Expense</button>
              </div>

              {(isLoggingRent || isLoggingExpense) && (
                <div className="animate-fade-in" style={{ marginTop: '16px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: `1px solid ${isLoggingRent ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: isLoggingRent ? 'var(--accent-emerald)' : 'var(--accent-coral)' }}>{isLoggingRent ? 'Log Rent Income' : 'Log Maintenance Expense'}</span>
                    <button onClick={() => setLogAction({ id: null, type: null })} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={14} /></button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{display:'flex', gap:'8px'}}>
                      <CustomSelect required value={logBankId} onChange={e => setLogBankId(e.target.value)} style={{...selectStyle, flex: 1}}>
                        <option value="" disabled>-- Select Bank Account --</option>
                        {banks.map(b => <option key={b.id} value={b.id}>{b.bankName} (₹{b.ledgerBalance?.toLocaleString('en-IN')})</option>)}
                      </CustomSelect>
                      {parseFloat(p.owner_split_percent) < 100 && (
                        <>
                          <CustomSelect value={logJointBankId} onChange={e => {
                            const val = e.target.value;
                            const autoSplit = val && logAmount ? Math.round((parseFloat(logAmount) * (100 - parseFloat(p.owner_split_percent || 100)) / 100) * 100)/100 : '';
                            setLogJointBankId(val);
                            setLogSplitAmount(val ? autoSplit : '');
                          }} style={{...selectStyle, flex: 1}}>
                            <option value="">-- No Joint Bank --</option>
                            {banks.map(b => String(b.id) !== String(logBankId) && <option key={b.id} value={b.id}>{b.bankName} (₹{b.ledgerBalance?.toLocaleString('en-IN')})</option>)}
                          </CustomSelect>
                          {logJointBankId && <input type="number" placeholder="Split Amt" value={logSplitAmount} onChange={e => setLogSplitAmount(e.target.value)} style={{...inputStyle, flex: 0.5}} />}
                        </>
                      )}
                    </div>
                    <input type="number" placeholder="Amount (₹)" value={logAmount} onChange={e => setLogAmount(e.target.value)} style={inputStyle} />
                    {isLoggingExpense && <input type="text" placeholder="Description (e.g. Plumbing, Tax)" value={logDesc} onChange={e => setLogDesc(e.target.value)} style={inputStyle} />}
                    <button onClick={() => submitLog(p.id, p.title)} style={{ padding: '10px', background: isLoggingRent ? 'var(--accent-emerald)' : 'var(--accent-coral)', border: 'none', borderRadius: '6px', color: isLoggingRent ? '#000' : '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>Save Record</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmationModal
        isOpen={!!confirmDelete}
        title="Delete Property"
        message={deleteError ? <span style={{color: '#ef4444', fontWeight: 500}}>{deleteError}</span> : "Are you sure you want to delete this property and all its history?"}
        onCancel={() => { setConfirmDelete(null); setDeleteError(null); }}
        onConfirm={() => {
          setDeleteError(null);
          delMut.mutate(confirmDelete);
        }}
        keepOpenOnConfirm={true}
      />
    </div>
  );
}

export default RealEstate;
