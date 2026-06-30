import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, X, Check, Trash2, Flame, TrendingDown, PackageOpen, CheckCircle } from 'lucide-react';


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

function Subscriptions() {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [formData, setFormData] = useState({
    title: '', amount: '', frequency: 'monthly',
    dueDate: new Date().toISOString().split('T')[0],
  });
  const [, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [quickPayId, setQuickPayId] = useState(null);
  const [quickPayFormData, setQuickPayFormData] = useState({ amount: '', sourceBankId: '' });

  const { data: remRes, error: queryError } = useQuery({ queryKey: ['reminders'], queryFn: () => fetch('/api/reminders').then(r => r.json()) });
  const { data: banksRes } = useQuery({ queryKey: ['banks'], queryFn: () => fetch('/api/bank-balances').then(r => r.json()) });

  const banks = banksRes?.data || [];
  /* const isLoading = loadingRem || loadingBanks; */

  const error = queryError ? 'Failed to fetch subscriptions' : null;

  const subs = useMemo(() => {
    return (remRes?.data || []).filter(r => r.category === 'subscription');
  }, [remRes]);

  const metrics = useMemo(() => {
    let monthlyPaise = 0n;
    subs.forEach(s => {
      const amtPaise = parseToPaiseBigInt(s.amount);
      if (s.frequency === 'monthly') monthlyPaise += amtPaise;
      else if (s.frequency === 'quarterly') monthlyPaise += (amtPaise / 3n);
      else if (s.frequency === 'yearly') monthlyPaise += (amtPaise / 12n);
    });
    return { monthly: formatBigIntToDecimalString(monthlyPaise), annually: formatBigIntToDecimalString(monthlyPaise * 12n) };
  }, [subs]);

  /* ── Helpers ── */

  const getDaysUntilDue = useCallback((dueDate) => {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const now = new Date();
    // Reset time portion for clean day diff
    due.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    let diff = due - now; let msInDay = 24 * 60 * 60 * 1000; let d = diff / msInDay; let n = Number(d.toFixed(0)); return d > n ? n + 1 : n;
  }, []);

  const getUrgencyClass = useCallback((days) => {
    if (days === null) return 'info';
    if (days <= 0) return 'critical';
    if (days <= 3) return 'warning';
    return 'safe';
  }, []);

  const getUrgencyLabel = useCallback((days) => {
    if (days === null) return '—';
    if (days < 0) return `${((x) => x < 0 ? -x : x)(days)}d overdue`;
    if (days === 0) return 'Due today';
    if (days === 1) return 'Tomorrow';
    return `${days}d left`;
  }, []);

  const formatCurrency = useCallback(
    (val) => `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    [],
  );

  /* ── Enriched subs with countdown ── */
  const enrichedSubs = useMemo(() =>
    subs.map(s => {
      const daysLeft = getDaysUntilDue(s.dueDate);
      return { id: s.id, title: s.title, amount: s.amount, frequency: s.frequency, dueDate: s.dueDate, daysLeft, urgencyClass: getUrgencyClass(daysLeft) };
    }),
    [subs, getDaysUntilDue, getUrgencyClass],
  );

  /* ── CRUD handlers ── */

  const addMut = useMutation({
    mutationFn: (newSub) => fetch('/api/reminders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newSub) }),
    onSuccess: () => { queryClient.invalidateQueries(['reminders']); setIsAdding(false); setFormData({ title: '', amount: '', frequency: 'monthly', dueDate: new Date().toISOString().split('T')[0] }); }
  });

  const editMut = useMutation({
    mutationFn: ({ id, data }) => fetch(`/api/reminders/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries(['reminders']); setEditingId(null); }
  });

  const delMut = useMutation({
    mutationFn: (id) => fetch(`/api/reminders/${id}`, { method: 'DELETE' }),
    onSuccess: () => { queryClient.invalidateQueries(['reminders']); setConfirmModal({ isOpen: false }); }
  });

  const payMut = useMutation({
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

  const handleQuickPayInit = (sub) => {
    setQuickPayId(sub.id);
    setQuickPayFormData({ amount: sub.amount, sourceBankId: banks.length > 0 ? String(banks[0].id) : '' });
  };

  const handleQuickPaySubmit = (e, sub) => {
    e.preventDefault();
    const payAmtPaise = parseToPaiseBigInt(quickPayFormData.amount);
    if (payAmtPaise <= 0n) return;
    
    if (!quickPayFormData.sourceBankId) {
      alert("Please select a valid bank."); return;
    }
    const selectedBank = banks.find(b => String(b.id) === String(quickPayFormData.sourceBankId));
    if (!selectedBank) { alert("Please select a valid bank."); return; }
    if (parseToPaiseBigInt(selectedBank.ledgerBalance) < payAmtPaise) {
      alert("Insufficient funds in the selected bank account."); return;
    }

    const currentDue = new Date(sub.dueDate);
    const nextDue = new Date(currentDue);
    if (sub.frequency === 'monthly') nextDue.setMonth(nextDue.getMonth() + 1);
    else if (sub.frequency === 'quarterly') nextDue.setMonth(nextDue.getMonth() + 3);
    else if (sub.frequency === 'yearly') nextDue.setFullYear(nextDue.getFullYear() + 1);
    
    payMut.mutate({
      id: sub.id,
      transactionData: {
        source_bank_id: parseInt(quickPayFormData.sourceBankId),
        amount: formatBigIntToDecimalString(payAmtPaise),
        type: 'expense',
        category: 'subscription',
        title: `Paid: ${sub.title}`,
        subscription_id: sub.id,
        date: new Date().toISOString().split('T')[0]
      },
      reminderData: {
        title: sub.title, amount: sub.amount, frequency: sub.frequency, category: 'subscription',
        dueDate: nextDue.toISOString().split('T')[0]
      }
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const amt = parseToPaiseBigInt(formData.amount);
    if (amt <= 0n) return;
    
    addMut.mutate({
      title: formData.title, amount: formatBigIntToDecimalString(amt), frequency: formData.frequency, dueDate: formData.dueDate, category: 'subscription'
    });
  };

  const handleEditInit = (s) => {
    setEditingId(s.id);
    setEditFormData({ title: s.title, amount: s.amount, frequency: s.frequency, dueDate: s.dueDate });
  };

  const handleEditSave = (e, s) => {
    e.preventDefault();
    const amt = parseToPaiseBigInt(editFormData.amount);
    if (amt <= 0n) return;
    
    editMut.mutate({
      id: s.id,
      data: {
        title: editFormData.title, amount: formatBigIntToDecimalString(amt), dueDate: editFormData.dueDate,
        termYears: s.termYears, frequency: editFormData.frequency, principalAmount: s.principalAmount, interestRate: s.interestRate
      }
    });
  };

  const handleDelete = (id) => {
    setConfirmModal({
        isOpen: true,
        title: 'Delete Subscription',
        message: 'Delete this subscription? This action cannot be undone.',
        onConfirm: () => {
            delMut.mutate(id);
            setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });
        }
    });
  };

  return (
    <div className="animate-fade-in">
      {/* ── Section Header ── */}
      <div className="flex-between" style={{ marginBottom: '24px' }}>
        <div className="section-header" style={{ marginBottom: 0 }}>
          <h2>Subscription &amp; SaaS Manager</h2>
          <p>Track recurring services, monitor burn rate, and manage billing cycles.</p>
        </div>
        <button 
          className="btn" 
          onClick={() => setIsAdding(!isAdding)}
          aria-label="Add new subscription"
        >
          {isAdding ? <><X size={16} style={{marginRight:'6px'}} /> Cancel Subscription</> : <><Plus size={16} style={{marginRight:'6px'}} /> Add Subscription</>}
        </button>
      </div>

      {error && (
        <div className="alert-banner danger" role="alert">
          <span>{error}</span>
        </div>
      )}

      {/* ── Add Form ── */}
      {isAdding && (
        <div className="glass-panel animate-slide-in" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ margin: 0 }}>New Subscription</h3>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="grid-3" style={{ alignItems: 'flex-start', marginBottom: '16px' }}>
              <div className="field-group">
                <label className="field-label" htmlFor="sub-name">Service Name</label>
                <input
                  id="sub-name"
                  required
                  className="field-input"
                  placeholder="e.g. Netflix"
                  value={formData.title}
                  onChange={e => setFormData({ title: e.target.value, amount: formData.amount, frequency: formData.frequency, dueDate: formData.dueDate })}
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="sub-amount">Amount (₹)</label>
                <input
                  id="sub-amount"
                  required
                  type="number"
                  step="0.01"
                  className="field-input"
                  value={formData.amount}
                  onChange={e => setFormData({ title: formData.title, amount: e.target.value, frequency: formData.frequency, dueDate: formData.dueDate })}
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="sub-freq">Billing Cycle</label>
                <CustomSelect
                  id="sub-freq"
                  className="field-input"
                  value={formData.frequency}
                  onChange={e => setFormData({ title: formData.title, amount: formData.amount, frequency: e.target.value, dueDate: formData.dueDate })}
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </CustomSelect>
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="sub-date">Next Billing Date</label>
                <input
                  id="sub-date"
                  required
                  type="date"
                  className="field-input"
                  value={formData.dueDate}
                  onChange={e => setFormData({ title: formData.title, amount: formData.amount, frequency: formData.frequency, dueDate: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', gridColumn: 'span 2', paddingBottom: '4px' }}>
                <button type="submit" className="btn btn-success" style={{ flex: 1 }}>Save Service</button>
                <button type="button" className="btn" onClick={() => setIsAdding(false)}>Cancel</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ── Summary KPI Cards ── */}
      <div className="stat-grid animate-slide-in" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: '32px' }} role="region" aria-label="Subscription metrics">
        <div
          className="stat-card"
          style={{
            '--stat-accent': 'var(--accent-coral)',
            '--stat-accent-dim': 'var(--accent-coral-dim)',
            '--stat-color': 'var(--accent-coral)',
          }}
        >
          <div className="stat-card-icon">
            <Flame size={18} style={{ color: 'var(--accent-coral)' }} />
          </div>
          <div className="stat-card-label">Monthly Burn Rate</div>
          <div className="stat-card-value">{formatCurrency(metrics.monthly)}</div>
          <div className="stat-card-sub">{subs.length} active service{subs.length !== 1 ? 's' : ''}</div>
        </div>
        <div
          className="stat-card"
          style={{
            '--stat-accent': 'var(--accent-sapphire)',
            '--stat-accent-dim': 'var(--accent-sapphire-dim)',
            '--stat-color': 'var(--accent-sapphire)',
          }}
        >
          <div className="stat-card-icon">
            <TrendingDown size={18} style={{ color: 'var(--accent-sapphire)' }} />
          </div>
          <div className="stat-card-label">Annualized Drain</div>
          <div className="stat-card-value">{formatCurrency(metrics.annually)}</div>
          <div className="stat-card-sub">Projected yearly cost</div>
        </div>
      </div>

      {/* ── Empty State ── */}
      {subs.length === 0 && !isAdding && (
        <div className="glass-panel">
          <div className="empty-state" role="status">
            <div className="empty-state-icon">
              <PackageOpen size={48} />
            </div>
            <div className="empty-state-title">No subscriptions yet</div>
            <div className="empty-state-desc">
              Start tracking your recurring services by clicking "Add Subscription" above.
              We'll help you monitor your burn rate and upcoming billing dates.
            </div>
          </div>
        </div>
      )}

      {/* ── Subscriptions Table ── */}
      {subs.length > 0 && (
        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table className="table-institutional" aria-label="Subscriptions list">
              <thead>
                <tr>
                  <th>Service Name</th>
                  <th>Billing Cycle</th>
                  <th>Due Date</th>
                  <th>Countdown</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ width: '80px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {enrichedSubs.map(s => {
                  const isEditing = editingId === s.id;

                  if (isEditing) {
                    return (
                      <tr key={s.id}>
                        <td colSpan={6} style={{ padding: '16px' }}>
                          <form
                            onSubmit={(e) => handleEditSave(e, s)}
                            style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}
                          >
                            <div className="field-group" style={{ flex: 2, minWidth: '140px' }}>
                              <label className="field-label">Name</label>
                              <input
                                required
                                className="field-input"
                                value={editFormData.title}
                                onChange={e => setEditFormData({ title: e.target.value, amount: editFormData.amount, frequency: editFormData.frequency, dueDate: editFormData.dueDate })}
                              />
                            </div>
                            <div className="field-group" style={{ flex: 1, minWidth: '100px' }}>
                              <label className="field-label">Amount (₹)</label>
                              <input
                                required
                                type="number"
                                step="0.01"
                                className="field-input"
                                value={editFormData.amount}
                                onChange={e => setEditFormData({ title: editFormData.title, amount: e.target.value, frequency: editFormData.frequency, dueDate: editFormData.dueDate })}
                              />
                            </div>
                            <div className="field-group" style={{ flex: 1, minWidth: '100px' }}>
                              <label className="field-label">Cycle</label>
                              <CustomSelect
                                className="field-input"
                                value={editFormData.frequency}
                                onChange={e => setEditFormData({ title: editFormData.title, amount: editFormData.amount, frequency: e.target.value, dueDate: editFormData.dueDate })}
                              >
                                <option value="monthly">Monthly</option>
                                <option value="quarterly">Quarterly</option>
                                <option value="yearly">Yearly</option>
                              </CustomSelect>
                            </div>
                            <div className="field-group" style={{ flex: 1, minWidth: '130px' }}>
                              <label className="field-label">Due Date</label>
                              <input
                                required
                                type="date"
                                className="field-input"
                                value={editFormData.dueDate}
                                onChange={e => setEditFormData({ title: editFormData.title, amount: editFormData.amount, frequency: editFormData.frequency, dueDate: e.target.value })}
                              />
                            </div>
                            <div style={{ display: 'flex', gap: '6px', paddingBottom: '2px' }}>
                              <button className="icon-btn" type="submit">
                                <Check size={14} />
                              </button>
                              <button
                                type="button"
                                className="btn"
                                style={{ padding: '8px 14px' }}
                                onClick={() => setEditingId(null)}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    );
                  }

                  const isQuickPaying = quickPayId === s.id;
                  if (isQuickPaying) {
                    return (
                      <tr key={`qp-${s.id}`}>
                        <td colSpan={6} style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.05)' }}>
                          <form
                            onSubmit={(e) => handleQuickPaySubmit(e, s)}
                            style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}
                          >
                            <div style={{ flex: 1, minWidth: '150px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--accent-emerald)' }}>
                              <CheckCircle size={18} /> Quick Pay & Renew
                            </div>
                            <div className="field-group" style={{ flex: 1, minWidth: '100px' }}>
                              <label className="field-label">Amount (₹)</label>
                              <input
                                required
                                type="number"
                                step="0.01"
                                className="field-input"
                                value={quickPayFormData.amount}
                                onChange={e => setQuickPayFormData({ ...quickPayFormData, amount: e.target.value })}
                              />
                            </div>
                            <div className="field-group" style={{ flex: 2, minWidth: '180px' }}>
                              <label className="field-label">Source Bank Account</label>
                              <CustomSelect
                                required
                                className="field-input"
                                value={quickPayFormData.sourceBankId}
                                onChange={e => setQuickPayFormData({ ...quickPayFormData, sourceBankId: e.target.value })}
                              >
                                <option value="">-- Select Bank --</option>
                                {banks.map(b => (
                                  <option key={b.id} value={b.id}>{b.bankName} (Bal: ₹{(b.ledgerBalance || 0).toLocaleString('en-IN')})</option>
                                ))}
                              </CustomSelect>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', paddingBottom: '2px' }}>
                              <button type="submit" className="btn btn-success" style={{ padding: '8px 14px' }} disabled={payMut.isLoading}>
                                {payMut.isLoading ? 'Processing...' : 'Confirm'}
                              </button>
                              <button
                                type="button"
                                className="btn"
                                style={{ padding: '8px 14px' }}
                                onClick={() => setQuickPayId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 500 }}>{s.title}</td>
                      <td>
                        <span className={`urgency-badge ${s.frequency === 'monthly' ? 'info' : s.frequency === 'quarterly' ? 'warning' : 'safe'}`}>
                          {s.frequency === 'monthly' ? 'Monthly' : s.frequency === 'quarterly' ? 'Quarterly' : 'Yearly'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                        {s.dueDate || '—'}
                      </td>
                      <td>
                        <span className={`urgency-badge ${s.urgencyClass}`}>
                          {getUrgencyLabel(s.daysLeft)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(s.amount)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '4px' }}>
                          <button
                            className="btn"
                            style={{ padding: '4px', color: 'var(--accent-emerald)', background: 'none' }}
                            onClick={() => handleQuickPayInit(s)}
                            aria-label={`Quick Pay ${s.title}`}
                            title="Quick Pay & Renew"
                          >
                            <CheckCircle size={15} />
                          </button>
                          <button className="icon-btn" onClick={() => handleEditInit(s)}
                            aria-label={`Edit ${s.title}`}
                            title="Edit"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button className="icon-btn danger" onClick={() => handleDelete(s.id)}
                            aria-label={`Delete ${s.title}`}
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
    </div>
  );
}

export default Subscriptions;

