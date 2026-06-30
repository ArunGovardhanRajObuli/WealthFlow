import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Landmark, Plus, Trash2, CheckCircle, AlertTriangle, XCircle, RefreshCw, Wallet, PiggyBank, PackageOpen } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import CustomSelect from './ui/CustomSelect';

function getLocalYYYYMMDD() {
  const d = new Date();
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().split('T')[0];
}

function parseToPaiseBigInt(val) {
    if (val === null || val === undefined) return 0n;
    if (typeof val === 'bigint') return val;
    let str = String(val).trim().replace(/,/g, '');
    if (str === '' || str === '0') return 0n;
    if (str.length > 50) return 0n; // Prevent V8 BigInt O(N^2) constructor DoS
    const isNeg = str.startsWith('-');
    if (isNeg) str = str.substring(1);
    const parts = str.split('.');
    let whole = parts[0] || '0';
    let frac = parts[1] || '';
    if (frac.length > 2) frac = frac.substring(0, 2);
    else if (frac.length === 1) frac += '0';
    else if (frac.length === 0) frac = '00';
    const paiseStr = whole + frac;
    try {
        let result = BigInt(paiseStr);
        return isNeg ? -result : result;
    } catch {
        return 0n;
    }
}

function formatBigIntToDecimalString(bigIntVal) {
    let str = bigIntVal.toString();
    const isNeg = str.startsWith('-');
    if (isNeg) str = str.substring(1);
    while (str.length < 3) str = '0' + str;
    const whole = str.substring(0, str.length - 2);
    const frac = str.substring(str.length - 2);
    return (isNeg ? '-' : '') + whole + '.' + frac;
}

function formatAmount(val) {
    const paise = parseToPaiseBigInt(val);
    const absPaise = paise < 0n ? -paise : paise;
    const wholeBigInt = absPaise / 100n;
    let wholeStr = wholeBigInt.toString();
    let result = '';
    let count = 0;
    for (let i = wholeStr.length - 1; i >= 0; i--) {
        if (count === 3 || (count > 3 && (count - 3) % 2 === 0)) {
            result = ',' + result;
        }
        result = wholeStr[i] + result;
        count++;
    }
    const fracStr = (absPaise % 100n).toString().padStart(2, '0');
    return `${result}.${fracStr}`;
}

function BankReconciliation() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [formData, setFormData] = useState({ bankName: '', balance: '', asOfDate: getLocalYYYYMMDD(), owner_member_id: '' });
  const [localError, setLocalError] = useState(null);
  const isSubmittingRef = React.useRef(false);
  const isDeletingRef = React.useRef(false);

  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, id: null, name: '' });

  const { data: recData, isLoading: recLoading, isFetching: recFetching, error: recError, refetch: refetchRec } = useQuery({
    queryKey: ['reconciliation'],
    queryFn: async () => {
      const res = await fetch('/api/reconciliation');
      if (!res.ok) throw new Error('Failed to load reconciliation data.');
      return res.json();
    }
  });

  const { data: famData, error: famError } = useQuery({
    queryKey: ['family-members'],
    queryFn: async () => {
      const res = await fetch('/api/family-members');
      if (!res.ok) throw new Error('Failed to load family members.');
      return res.json();
    }
  });

  const addBankMutation = useMutation({
    mutationFn: async (bankData) => {
      const res = await fetch('/api/bank-balances', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bankData)
      });
      if (!res.ok) throw new Error('Failed to add bank balance.');
      return res.json();
    },
    onSuccess: async () => {
      setLocalError(null);
      await queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
      await queryClient.invalidateQueries({ queryKey: ['bank-balances'] });
      await queryClient.invalidateQueries({ queryKey: ['family-estate-ledger'] });
      setAdding(false);
      setFormData({ bankName: '', balance: '', asOfDate: getLocalYYYYMMDD(), owner_member_id: '' });
    },
    onError: (err) => {
      setLocalError(err.message);
    }
  });

  const deleteBankMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/bank-balances/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete bank balance.');
      }
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
      await queryClient.invalidateQueries({ queryKey: ['bank-balances'] });
      await queryClient.invalidateQueries({ queryKey: ['family-estate-ledger'] });
    }
  });

  const addBank = async (e) => {
    e.preventDefault();
    if (addBankMutation.isPending || addBankMutation.isLoading || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setLocalError(null);

    const balancePaise = parseToPaiseBigInt(formData.balance);
    const trimmedName = formData.bankName.trim();
    if (!trimmedName || !/^[a-zA-Z0-9 &'()-]+$/.test(trimmedName)) {
      setLocalError('Bank name contains invalid characters. Only alphanumeric, spaces, and &\'()- are allowed.');
      isSubmittingRef.current = false;
      return;
    }
    if (!formData.asOfDate) {
      setLocalError('Date is required.');
      isSubmittingRef.current = false;
      return;
    }
    
    if (formData.owner_member_id && !familyMembers.find(m => m && typeof m === 'object' && String(m.id) === String(formData.owner_member_id))) {
      setLocalError("Selected family member is invalid.");
      isSubmittingRef.current = false;
      return;
    }

    try {
      const payload = { 
        bankName: trimmedName, 
        balance: formatBigIntToDecimalString(balancePaise), 
        asOfDate: String(formData.asOfDate), 
        owner_member_id: formData.owner_member_id ? String(formData.owner_member_id) : null 
      };
      Object.freeze(payload);
      await addBankMutation.mutateAsync(payload);
    } catch {
      // Error handled by mutation config
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const deleteBank = async (id) => {
    if (!id) return;
    if (deleteBankMutation.isPending || deleteBankMutation.isLoading || isDeletingRef.current) return;
    isDeletingRef.current = true;
    setLocalError(null);
    try {
      await deleteBankMutation.mutateAsync(id);
    } catch (err) {
      setLocalError(err.message || 'Failed to delete bank balance.');
    } finally {
      isDeletingRef.current = false;
    }
  };

  const reconciliation = recData || null;
  const familyMembers = Array.isArray(famData?.data) ? famData.data : [];
  const loading = recLoading;
  const isRefreshing = recFetching && !recLoading;
  const error = localError || recError?.message || famError?.message || addBankMutation.error?.message || deleteBankMutation.error?.message;

  const loadData = () => { refetchRec(); };

  const statusConfig = {
    aligned: { icon: <CheckCircle size={24} />, color: 'var(--accent-emerald)', label: 'VERIFIED', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' },
    minor_discrepancy: { icon: <AlertTriangle size={24} />, color: '#f59e0b', label: 'MINOR LEAK', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' },
    major_discrepancy: { icon: <XCircle size={24} />, color: 'var(--accent-coral)', label: 'MAJOR LEAK', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' }
  };

  if (loading) return <div className="glass-panel" style={{ textAlign: 'center', padding: '40px' }}>Loading reconciliation...</div>;

  const cfg = Object.prototype.hasOwnProperty.call(statusConfig, reconciliation?.status) ? statusConfig[reconciliation?.status] : statusConfig.aligned;
  const hasBanks = Array.isArray(reconciliation?.banks) && reconciliation.banks.length > 0;

  return (
    <div className="animate-fade-in">
      <ConfirmationModal 
        isOpen={confirmDelete.isOpen} 
        title="Delete Bank Balance" 
        message={`Are you sure you want to delete ${confirmDelete.name}? This will permanently corrupt all transactions anchored to this ledger line. This action is irreversible.`} 
        onConfirm={() => { deleteBank(confirmDelete.id); setConfirmDelete({ isOpen: false, id: null, name: '' }); }}
        onCancel={() => setConfirmDelete({ isOpen: false, id: null, name: '' })}
        confirmText="Delete Permanently"
      />
      {error && <div className="alert-banner danger" style={{marginBottom:'20px'}}><AlertTriangle size={16}/> {error}</div>}
      <div className="section-header">
        <div>
          <h2>Bank Reconciliation</h2>
          <p>Compare your real bank balances against computed ledger cash to detect leaks</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn" onClick={loadData} disabled={loading || isRefreshing} style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', opacity: (loading || isRefreshing) ? 0.5 : 1, cursor: (loading || isRefreshing) ? 'not-allowed' : 'pointer' }}>
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} /> Refresh
          </button>
          <button className="btn btn-primary" disabled={loading || isRefreshing} onClick={() => { setAdding(true); setFormData({ bankName: '', balance: '', asOfDate: getLocalYYYYMMDD(), owner_member_id: '' }); setLocalError(null); }} style={{ opacity: (loading || isRefreshing) ? 0.5 : 1, cursor: (loading || isRefreshing) ? 'not-allowed' : 'pointer' }}>
            <Plus size={16} style={{marginRight:'6px'}}/> Add Bank Balance
          </button>
        </div>
      </div>

      {/* Add Form */}
      {adding && (
        <div className="glass-panel" style={{ marginBottom: '24px', border: '1px solid var(--accent-sapphire)' }}>
          <form onSubmit={addBank} className="grid-3" style={{ gap: '16px' }}>
            <div className="field-group">
              <label>Bank / Account Name</label>
              <input required maxLength="100" value={formData.bankName} onChange={e => setFormData({ bankName: e.target.value, balance: formData.balance, asOfDate: formData.asOfDate, owner_member_id: formData.owner_member_id })} className="field-input" placeholder="e.g. HDFC Savings" />
            </div>
            <div className="field-group">
              <label>Current Balance (₹)</label>
              <input required maxLength="20" type="text" inputMode="decimal" pattern="^-?\d*(\.\d{0,2})?$" title="Enter a valid amount (e.g. 1000.00)" value={formData.balance} onChange={e => setFormData({ bankName: formData.bankName, balance: e.target.value, asOfDate: formData.asOfDate, owner_member_id: formData.owner_member_id })} className="field-input" placeholder="0.00" />
            </div>
            <div className="field-group">
              <label>As Of Date</label>
              <input required type="date" value={formData.asOfDate} onChange={e => setFormData({ bankName: formData.bankName, balance: formData.balance, asOfDate: e.target.value, owner_member_id: formData.owner_member_id })} className="field-input" />
            </div>
            <div className="field-group" style={{ gridColumn: 'span 3' }}>
              <label>Account Holder (Entity)</label>
              <CustomSelect className="field-input" value={String(formData.owner_member_id || '')} onChange={e => setFormData({ bankName: formData.bankName, balance: formData.balance, asOfDate: formData.asOfDate, owner_member_id: e.target.value })}>
                <option value="">-- Unassigned (Global) --</option>
                {familyMembers.map((m, i) => <option key={m.id || i} value={String(m.id)} selected={String(m.id) === String(formData.owner_member_id)}>{String(m.name || '')} ({String(m.role || '')})</option>)}
              </CustomSelect>
            </div>
            <div style={{ gridColumn: 'span 3', display: 'flex', gap: '8px' }}>
              <button type="submit" disabled={addBankMutation.isPending || addBankMutation.isLoading} className="btn btn-success" style={{ flex: 1, opacity: (addBankMutation.isPending || addBankMutation.isLoading) ? 0.7 : 1 }}>
                {(addBankMutation.isPending || addBankMutation.isLoading) ? 'Saving...' : 'Save Balance'}
              </button>
              <button type="button" disabled={addBankMutation.isPending || addBankMutation.isLoading} className="btn" onClick={() => { setAdding(false); setFormData({ bankName: '', balance: '', asOfDate: getLocalYYYYMMDD(), owner_member_id: '' }); setLocalError(null); }} style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', opacity: (addBankMutation.isPending || addBankMutation.isLoading) ? 0.5 : 1 }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Reconciliation Status */}
      <div className="glass-panel" style={{ 
        marginBottom: '24px', background: cfg.bg, border: `1px solid ${cfg.border}`,
        display: 'flex', alignItems: 'center', gap: '20px', padding: '28px'
      }}>
        <div style={{ color: cfg.color, flexShrink: 0 }}>{cfg.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: cfg.color, letterSpacing: '0.05em' }}>{cfg.label}</span>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            {hasBanks ? String(reconciliation?.interpretation || '') : 'No bank balances entered yet. Add your bank balances to enable reconciliation.'}
          </p>
        </div>
        {hasBanks && (parseToPaiseBigInt(reconciliation?.actualBankBalance) - parseToPaiseBigInt(reconciliation?.computedFreeCash)) !== 0n && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <span style={{ fontSize: '24px', fontWeight: 700, color: cfg.color }}>
              {(parseToPaiseBigInt(reconciliation?.actualBankBalance) - parseToPaiseBigInt(reconciliation?.computedFreeCash)) > 0n ? '+' : ((parseToPaiseBigInt(reconciliation?.actualBankBalance) - parseToPaiseBigInt(reconciliation?.computedFreeCash)) < 0n ? '-' : '')}₹{formatAmount(formatBigIntToDecimalString(parseToPaiseBigInt(reconciliation?.actualBankBalance) - parseToPaiseBigInt(reconciliation?.computedFreeCash)))}
            </span>
            <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>discrepancy</span>
          </div>
        )}
      </div>

      {/* Comparison Cards */}
      <div className="stat-grid" style={{ gap: '16px', marginBottom: '24px' }}>
        <div className="stat-card" style={{'--stat-accent':'var(--accent-emerald)','--stat-color':'var(--accent-emerald)'}}>
          <div className="stat-card-icon"><Landmark size={20}/></div>
          <div className="stat-card-label">Actual Bank Balance</div>
          <div className="stat-card-value">{(parseToPaiseBigInt(reconciliation?.actualBankBalance) < 0n) ? '-' : ''}₹{formatAmount(reconciliation?.actualBankBalance)}</div>
          <div className="stat-card-sub">{hasBanks ? `${reconciliation.banks.length} account(s) logged` : 'No accounts logged'}</div>
        </div>
        <div className="stat-card" style={{'--stat-accent':'var(--accent-sapphire)','--stat-color':'var(--accent-sapphire)'}}>
          <div className="stat-card-icon"><PiggyBank size={20}/></div>
          <div className="stat-card-label">Computed Free Cash</div>
          <div className="stat-card-value">{(parseToPaiseBigInt(reconciliation?.computedFreeCash) < 0n) ? '-' : ''}₹{formatAmount(reconciliation?.computedFreeCash)}</div>
          <div className="stat-card-sub">Derived from ledger (income − expenses)</div>
        </div>
      </div>

      {/* Bank List */}
      {hasBanks && (
        <div className="table-container" style={{ padding: '0', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="table-institutional" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '16px 24px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '13px' }}>ACCOUNT</th>
                <th style={{ padding: '16px 24px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '13px' }}>SNAPSHOT</th>
                <th style={{ padding: '16px 24px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '13px' }}>LEDGER</th>
                <th style={{ padding: '16px 24px', textAlign: 'right', color: 'var(--text-muted)', fontSize: '13px' }}>DISCREPANCY</th>
                <th style={{ padding: '16px 24px' }}></th>
              </tr>
            </thead>
            <tbody>
            {reconciliation.banks.map((b) => {
              if (!b || typeof b !== 'object') return null;
              const owner = familyMembers.find(m => m && typeof m === 'object' && String(m.id) === String(b.owner_member_id));
              const snapshotPaise = parseToPaiseBigInt((b.snapshotBalance !== null && b.snapshotBalance !== undefined && b.snapshotBalance !== '') ? b.snapshotBalance : b.balance);
              const ledgerPaise = parseToPaiseBigInt(b.ledgerBalance);
              const discPaise = snapshotPaise - ledgerPaise;
              const discColor = (discPaise > -100n && discPaise < 100n) ? 'var(--accent-emerald)' : (discPaise > -500000n && discPaise < 500000n) ? '#f59e0b' : '#ef4444';
              return (
                <tr key={b.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Landmark size={16} style={{ color: 'var(--accent-sapphire)', flexShrink: 0 }} />
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{String(b.bankName || '')}</span>
                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>
                          {owner ? String(owner.name || '') : 'Unassigned'} • {String(b.asOfDate || '')}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px', fontWeight: 700, fontSize: '14px', color: 'var(--accent-emerald)', textAlign: 'right' }}>
                    {(parseToPaiseBigInt((b.snapshotBalance !== null && b.snapshotBalance !== undefined && b.snapshotBalance !== '') ? b.snapshotBalance : b.balance) < 0n) ? '-' : ''}₹{formatAmount((b.snapshotBalance !== null && b.snapshotBalance !== undefined && b.snapshotBalance !== '') ? b.snapshotBalance : b.balance)}
                  </td>
                  <td style={{ padding: '16px 24px', fontWeight: 700, fontSize: '14px', color: 'var(--accent-sapphire)', textAlign: 'right' }}>
                    {(parseToPaiseBigInt(b.ledgerBalance) < 0n) ? '-' : ''}₹{formatAmount(b.ledgerBalance)}
                  </td>
                  <td style={{ padding: '16px 24px', fontWeight: 700, fontSize: '14px', color: discColor, textAlign: 'right' }}>
                    {discPaise > 0n ? '+' : (discPaise < 0n ? '-' : '')}₹{formatAmount(formatBigIntToDecimalString(discPaise))}
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <button className="icon-btn danger" onClick={() => setConfirmDelete({ isOpen: true, id: String(b.id), name: String(b.bankName) })} disabled={deleteBankMutation.isPending || deleteBankMutation.isLoading}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
      )}

      {!hasBanks && !adding && (
        <div className="empty-state glass-panel"><PackageOpen size={48} style={{opacity:0.3,marginBottom:'12px'}}/><h4>No Bank Balances Logged</h4><p>Enter your actual bank balances to enable reconciliation checks.</p></div>
      )}
    </div>
  );
}

export default BankReconciliation;
