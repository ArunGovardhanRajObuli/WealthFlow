import { parseToPaiseBigInt, formatBigIntToDecimalString } from '../../utils/bigIntMath';
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, RefreshCw, Plus, X, Banknote, Activity, PackageOpen, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from '../ConfirmationModal';
import CustomSelect from '../ui/CustomSelect';

export default function SipPortfolio() {
  const queryClient = useQueryClient();

  const { data: invRes } = useQuery({ queryKey: ['investments'], queryFn: () => fetch('/api/investments').then(r => r.json()) });
  const { data: famRes } = useQuery({ queryKey: ['family-members'], queryFn: () => fetch('/api/family-members').then(r => r.json()) });
  const { data: bankRes } = useQuery({ queryKey: ['bank-balances'], queryFn: () => fetch('/api/bank-balances').then(r => r.json()) });

  const investments = useMemo(() => invRes?.data || [], [invRes?.data]);
  const familyMembers = useMemo(() => famRes?.data || [], [famRes?.data]);
  const banks = useMemo(() => (bankRes?.data || []), [bankRes?.data]);

  const sips = useMemo(() => investments.filter(i => i.category === 'sip'), [investments]);

  const [showSipInit, setShowSipInit] = useState(false);
  const [activeFund, setActiveFund] = useState(null);
  const [deletingTrackerId, setDeletingTrackerId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [amfiQuery, setAmfiQuery] = useState('');
  const [debouncedAmfiQuery, setDebouncedAmfiQuery] = useState('');
  const [selectedAmfi, setSelectedAmfi] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [initAmount, setInitAmount] = useState('');
  const [sipName, setSipName] = useState('');
  const [fundAmount, setFundAmount] = useState('');
  const [sellUnits, setSellUnits] = useState('');
  const [isHistorical, setIsHistorical] = useState(false);
  const [manualUnits, setManualUnits] = useState('');
  const [sourceBankId, setSourceBankId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [jointOwnerId, setJointOwnerId] = useState('');
  const [splitPercent, setSplitPercent] = useState('100');
  const [jointBankId, setJointBankId] = useState('');
  const [splitAmount, setSplitAmount] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedAmfiQuery(amfiQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [amfiQuery]);

  const { data: amfiSearchRes } = useQuery({
    queryKey: ['amfi-search', debouncedAmfiQuery],
    queryFn: () => fetch(`/api/amfi-search?q=${encodeURIComponent(debouncedAmfiQuery)}`).then(r => r.json()),
    enabled: debouncedAmfiQuery.length >= 3
  });
  const amfiResults = amfiSearchRes?.data || [];

  const syncMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/investments/sync-market', { method: 'POST', headers: { 'Accept': 'application/json' } });
      if (!res.ok) { let e; try { e = await res.json(); } catch (err) { throw new Error(`Network or server error (${res.status})`, { cause: err }); } throw new Error(e?.error || 'Failed to sync AMFI market data'); }
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['investments'] });
      setIsSyncing(false);
    }
  });

  const initMut = useMutation({
    mutationFn: async (data) => {
      const res = await fetch('/api/investments', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) { let e; try { e = await res.json(); } catch (err) { throw new Error(`Network or server error (${res.status})`, { cause: err }); } throw new Error(e?.error || 'Failed to create investment'); }
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['investments'] });
      setShowSipInit(false); setInitAmount(''); setSipName(''); setSelectedAmfi(null);
      setAmfiQuery(''); setIsHistorical(false); setManualUnits(''); setOwnerId('');
      setJointOwnerId(''); setSplitPercent('100'); setJointBankId(''); setSplitAmount('');
    }
  });

  const fundMut = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`/api/investments/${id}/fund`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) { let e; try { e = await res.json(); } catch (err) { throw new Error(`Network or server error (${res.status})`, { cause: err }); } throw new Error(e?.error || 'Failed to fund investment'); }
      return res.json();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['investments'] }),
        queryClient.invalidateQueries({ queryKey: ['bank-balances'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['family-estate-ledger'] })
      ]);
      setActiveFund(null); setFundAmount(''); setSourceBankId(''); setJointBankId(''); setSplitAmount('');
    }
  });

  const sellMut = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`/api/investments/${id}/sell`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) { let e; try { e = await res.json(); } catch (err) { throw new Error(`Network or server error (${res.status})`, { cause: err }); } throw new Error(e?.error || 'Failed to sell investment'); }
      return res.json();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['investments'] }),
        queryClient.invalidateQueries({ queryKey: ['bank-balances'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['family-estate-ledger'] })
      ]);
      setActiveFund(null); setSellUnits(''); setSourceBankId(''); setJointBankId(''); setSplitAmount('');
    }
  });

  const delMut = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/investments/${id}`, { method: 'DELETE', headers: { 'Accept': 'application/json' } });
      if (!res.ok) { let e; try { e = await res.json(); } catch (err) { throw new Error(`Network or server error (${res.status})`, { cause: err }); } throw new Error(e?.error || 'Failed to delete investment'); }
      if (res.status === 204) return null;
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['investments'] });
      setDeletingTrackerId(null);
      setDeleteError(null);
    },
    onError: (err) => setDeleteError(err.message)
  });

  const triggerMarketSync = () => {
    setIsSyncing(true);
    syncMut.mutate();
  };

  const submitInitTracker = () => {
    const initialPaise = parseToPaiseBigInt(initAmount);
    if (initialPaise <= 0n) return;
    
    const isDebt = /liquid|debt|gilt|bond|arbitrage|money market/i.test(sipName);
    const dynamicAssetClass = isDebt ? 'debt' : 'equity';

    initMut.mutate({ 
      title: sipName, category: 'sip', assetClass: dynamicAssetClass, currentAmount: formatBigIntToDecimalString(initialPaise), targetAmount: 12, roi: 0, unrealizedGain: 0, 
      schemeCode: selectedAmfi.schemeCode, latestNav: selectedAmfi.nav, isHistorical, manualUnits, 
      owner_member_id: ownerId || null, joint_owner_member_id: jointOwnerId || null, 
      owner_split_percent: parseFloat(splitPercent) || 100, source_bank_id: sourceBankId || null,
      joint_bank_id: jointBankId || null, split_amount: jointBankId && splitAmount ? formatBigIntToDecimalString(parseToPaiseBigInt(splitAmount)) : null
    });
  };

  const submitFundTracker = () => {
    if (!activeFund) return;
    const amountPaise = parseToPaiseBigInt(fundAmount);
    if (amountPaise <= 0n) return;
    const amountStr = formatBigIntToDecimalString(amountPaise);
    
    fundMut.mutate({ id: activeFund.id, data: { amount: amountStr, source_bank_id: sourceBankId, joint_bank_id: jointBankId || null, split_amount: jointBankId && splitAmount ? formatBigIntToDecimalString(parseToPaiseBigInt(splitAmount)) : null } });
  };

  const submitSellTracker = () => {
    if (!activeFund || !sellUnits) return;
    const units = parseFloat(sellUnits) || 0;
    if (units <= 0) return;
    if (!sourceBankId) { alert("Please select a destination bank account"); return; }
    
    sellMut.mutate({ id: activeFund.id, data: { units, source_bank_id: sourceBankId, joint_bank_id: jointBankId || null } });
  };

  const deleteTracker = (id) => {
    setDeletingTrackerId(id);
  };

  const { totalSipInvested, totalSipLiveValue, absoluteReturn } = useMemo(() => {
    const investedPaise = sips.reduce((acc, curr) => acc + parseToPaiseBigInt(curr.currentAmount), 0n);
    const live = sips.reduce((acc, curr) => {
        const units = parseFloat(curr.totalUnits) || 0;
        const nav = parseFloat(curr.latestNav) || 0;
        const val = curr.schemeCode ? (units * nav) : (Number(parseToPaiseBigInt(curr.currentAmount)) / 100);
        return acc + val;
    }, 0);
    const invested = Number(investedPaise) / 100;
    return { totalSipInvested: invested, totalSipLiveValue: live, absoluteReturn: live - invested };
  }, [sips]);

  return (
    <div className="sip-portfolio">
      <div className="section-header" style={{marginBottom:'16px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          <TrendingUp size={20} className="text-sapphire" />
          <h3 style={{margin:0}}>Equity SIP & Mutual Funds</h3>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn" style={{ fontSize: '12px', padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} onClick={triggerMarketSync}>
            <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} style={{ marginRight: '4px' }}/> Sync AMFI
          </button>
          <button className="btn btn-primary" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => { setShowSipInit(true); setInitAmount(''); setSipName(''); setSelectedAmfi(null); }}>
            <Plus size={14} style={{ marginRight: '4px' }}/> Add SIP
          </button>
        </div>
      </div>
      
      <AnimatePresence>
        {showSipInit && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: 'auto' }} 
            exit={{ opacity: 0, height: 0 }}
            className="glass-panel" style={{ marginBottom: '24px', padding: '20px', borderLeft: '4px solid var(--accent-emerald)', overflow: 'visible', position: 'relative', zIndex: 100 }}
          >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                 <h4 style={{ margin: 0 }}>Register Mutual Fund via AMFI</h4>
                 <button onClick={() => { setShowSipInit(false); setSelectedAmfi(null); setAmfiQuery(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
              </div>
              
              {!selectedAmfi ? (
                  <div style={{ position: 'relative' }}>
                      <input type="text" placeholder="Search Mutual Fund via AMFI Database (e.g. Parag Parikh Flexi)" value={amfiQuery} onChange={e => setAmfiQuery(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '6px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--accent-sapphire)', color: '#fff', fontSize: '14px', outline: 'none' }} />
                      
                      {amfiResults.length > 0 && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#0f172a', border: '1px solid var(--border-color)', borderRadius: '8px', marginTop: '8px', zIndex: 9999, maxHeight: '250px', overflowY: 'auto', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.8)' }}>
                              {amfiResults.map(res => (
                                  <div key={res.schemeCode} onClick={() => { setSelectedAmfi(res); setSipName(res.name); }} style={{ padding: '12px 16px', fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{res.name}</div>
                                      <div style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Live NAV: <strong style={{color: 'var(--accent-emerald)'}}>₹{res.nav}</strong> | Code: {res.schemeCode}</div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              ) : (
                  <div className="grid-2" style={{ gap: '16px', marginTop: '16px' }}>
                      <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                          <div style={{ fontSize: '11px', color: 'var(--accent-emerald)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>AMFI Asset Locked</div>
                          <div style={{ fontSize: '14px', fontWeight: 700 }}>{selectedAmfi.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Market NAV: ₹{selectedAmfi.nav} (As of {selectedAmfi.date})</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                              <input type="checkbox" checked={isHistorical} onChange={e => setIsHistorical(e.target.checked)} />
                              This is an existing holding (I already own this)
                          </label>

                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '12px', marginBottom: '12px' }}>
                             <CustomSelect value={sourceBankId} onChange={e => setSourceBankId(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '13px' }}>
                                <option value="">-- Source Bank Account --</option>
                                {banks.map(b => <option key={b.id} value={b.id}>{b.bankName} (₹{b.ledgerBalance?.toLocaleString('en-IN')})</option>)}
                             </CustomSelect>
                             <CustomSelect value={jointBankId} onChange={e => { setJointBankId(e.target.value); if(!e.target.value) setSplitAmount(''); }} style={{ flex: 1, padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '13px' }}>
                                <option value="">-- Joint Bank Account --</option>
                                {banks.map(b => <option key={b.id} value={b.id}>{b.bankName} (₹{b.ledgerBalance?.toLocaleString('en-IN')})</option>)}
                             </CustomSelect>
                             {jointBankId && <input type="number" placeholder="Split Amt" value={splitAmount} onChange={e => setSplitAmount(e.target.value)} style={{ width: '90px', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '13px' }} />}
                          </div>

                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                              <CustomSelect value={ownerId} onChange={e => setOwnerId(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '13px' }}>
                                 <option value="">-- Primary Owner --</option>
                                 {familyMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                              </CustomSelect>
                              <CustomSelect value={jointOwnerId} onChange={e => setJointOwnerId(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '13px' }}>
                                 <option value="">-- Joint Owner --</option>
                                 {familyMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                              </CustomSelect>
                              <div style={{display:'flex', alignItems:'center', gap:'4px', background:'rgba(255,255,255,0.05)', borderRadius:'8px', paddingRight:'12px', border: '1px solid var(--border-color)'}}>
                                 <input type="number" min="0" max="100" placeholder="Split %" value={splitPercent} onChange={e => setSplitPercent(e.target.value)} style={{width: '70px', padding: '12px', background:'none', border:'none', color: '#fff', fontSize: '13px'}} />
                                 <span style={{color:'var(--text-muted)', fontSize:'12px'}}>%</span>
                              </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              {isHistorical ? (
                                  <>
                                      <input type="number" placeholder="Total Units" value={manualUnits} onChange={e => setManualUnits(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '14px' }} />
                                      <input type="number" placeholder="Capital (₹)" value={initAmount} onChange={e => setInitAmount(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '14px' }} />
                                  </>
                              ) : (
                                  <input type="number" placeholder="Initial Deposit (₹)" value={initAmount} onChange={e => setInitAmount(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '14px' }} />
                              )}
                              <button onClick={submitInitTracker} style={{ padding: '12px 24px', background: 'var(--accent-emerald)', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap' }}>{isHistorical ? 'Add Holding' : 'Log Purchase'}</button>
                          </div>
                      </div>
                  </div>
              )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass-panel" style={{ marginBottom: '40px' }}>
         <h4 style={{marginBottom:'4px'}}>Systematic Investment Portfolio</h4>
         <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom:'16px' }}>Market-Linked Analytics</p>
         <div className="stat-grid" style={{marginBottom:'20px'}}>
           <div className="stat-card" style={{'--stat-accent':'var(--text-secondary)','--stat-color':'var(--text-secondary)'}}>
             <div className="stat-card-icon"><Banknote size={20}/></div>
             <div className="stat-card-label">Total Invested</div>
             <div className="stat-card-value">₹{totalSipInvested.toLocaleString('en-IN', {maximumFractionDigits: 0})}</div>
           </div>
           <div className="stat-card" style={{'--stat-accent':'var(--accent-emerald)','--stat-color':'var(--accent-emerald)'}}>
             <div className="stat-card-icon"><TrendingUp size={20}/></div>
             <div className="stat-card-label">Live Market Value</div>
             <div className="stat-card-value">₹{totalSipLiveValue.toLocaleString('en-IN', {maximumFractionDigits: 0})}</div>
           </div>
           <div className="stat-card" style={{'--stat-accent':absoluteReturn >= 0 ? 'var(--accent-emerald)' : 'var(--accent-coral)','--stat-color':absoluteReturn >= 0 ? 'var(--accent-emerald)' : 'var(--accent-coral)'}}>
             <div className="stat-card-icon"><Activity size={20}/></div>
             <div className="stat-card-label">Absolute Return</div>
             <div className="stat-card-value">{absoluteReturn > 0 ? '+' : ''}₹{absoluteReturn.toLocaleString('en-IN', {maximumFractionDigits: 0})}</div>
           </div>
         </div>

         <div className="grid-3" style={{ gap: '16px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px dashed var(--accent-emerald)' }}>
                <h5 style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>Tax-Free LTCG Limit</h5>
                <p style={{ fontSize: '24px', fontWeight: 700 }}>₹1,25,000</p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                    You have ₹1.25L of zero-tax long-term gains allowed this FY. 
                    <strong style={{ color: 'var(--text-primary)' }}> Algorithm highly recommends selling and re-buying ₹1.25L worth of equity to reset your basis legally.</strong>
                </p>
            </div>
            
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', gridColumn: 'span 2' }}>
                <h5 style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>Live Active Portfolios</h5>
                {sips.length === 0 ? (
                    <div className="empty-state"><PackageOpen size={40} style={{opacity:0.3,marginBottom:'12px'}}/><h4>No Active SIP Portfolios</h4><p>Register a mutual fund via AMFI to start live NAV tracking.</p></div>
                ) : (
                    sips.map(sip => {
                        const isLinked = !!sip.schemeCode;
                        const investedVal = Number(parseToPaiseBigInt(sip.currentAmount)) / 100;
                        const liveValue = isLinked ? (sip.totalUnits * sip.latestNav) : investedVal;
                        const pnl = liveValue - investedVal;
                        const pnlPct = investedVal > 0 ? (pnl / investedVal) * 100 : 0;

                        return (
                           <div key={sip.id} style={{ display: 'flex', flexDirection: 'column', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <div>
                                      <span style={{ fontSize: '14px', fontWeight: 600 }}>{sip.title}</span>
                                      <button className="icon-btn danger" onClick={() => deleteTracker(sip.id)}  title="Delete Tracker"><Trash2 size={14}/></button>
                                      {isLinked ? (
                                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                              Units: <span style={{color: 'var(--text-primary)'}}>{(sip.totalUnits || 0).toFixed(4)}</span> | Live NAV: <span style={{color: 'var(--text-primary)'}}>₹{(sip.latestNav || 0).toFixed(4)}</span>
                                              {sip.source_bank_id && <span style={{marginLeft: '8px', paddingLeft: '8px', borderLeft: '1px solid var(--border-color)'}}>Source: <span style={{color: 'var(--text-primary)'}}>{banks.find(b => b.id === sip.source_bank_id)?.bankName || 'Unknown Bank'}</span></span>}
                                          </div>
                                      ) : (
                                          <div style={{ fontSize: '11px', color: 'var(--accent-coral)', marginTop: '4px' }}>
                                              Unlinked (Manual Tracking Only)
                                              {sip.source_bank_id && <span style={{color: 'var(--text-muted)', marginLeft: '8px', paddingLeft: '8px', borderLeft: '1px solid var(--border-color)'}}>Source: <span style={{color: 'var(--text-primary)'}}>{banks.find(b => b.id === sip.source_bank_id)?.bankName || 'Unknown Bank'}</span></span>}
                                          </div>
                                      )}
                                  </div>
                                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                     <div style={{ textAlign: 'right' }}>
                                         {isLinked ? (
                                             <>
                                                 <div style={{ fontSize: '15px', fontWeight: 700, color: pnl >= 0 ? 'var(--accent-emerald)' : 'var(--accent-coral)' }}>
                                                     ₹{liveValue.toLocaleString('en-IN', {maximumFractionDigits: 0})}
                                                     <span style={{ fontSize: '11px', marginLeft: '6px' }}>({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)</span>
                                                 </div>
                                                 <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Invested: ₹{investedVal.toLocaleString('en-IN', {maximumFractionDigits: 0})}</div>
                                             </>
                                         ) : (
                                             <div style={{ fontSize: '15px', fontWeight: 700 }}>₹{investedVal.toLocaleString('en-IN')}</div>
                                         )}
                                     </div>
                                     <button 
                                        className="btn" 
                                        style={{ padding: '6px 12px', fontSize: '12px', background: activeFund?.id === sip.id && activeFund?.mode === 'sell' ? 'var(--accent-coral)' : 'rgba(255,255,255,0.05)', color: activeFund?.id === sip.id && activeFund?.mode === 'sell' ? '#000' : 'var(--text-primary)' }} 
                                        onClick={() => setActiveFund({ id: sip.id, title: sip.title, type: 'sip', mode: 'sell' })}
                                     >
                                         - Sell
                                     </button>
                                     <button 
                                        className="btn" 
                                        style={{ padding: '6px 12px', fontSize: '12px', background: activeFund?.id === sip.id && activeFund?.mode === 'buy' ? 'var(--accent-emerald)' : 'rgba(255,255,255,0.05)', color: activeFund?.id === sip.id && activeFund?.mode === 'buy' ? '#000' : 'var(--text-primary)' }} 
                                        onClick={() => setActiveFund({ id: sip.id, title: sip.title, type: 'sip', mode: 'buy' })}
                                     >
                                         + Buy
                                     </button>
                                  </div>
                              </div>
                              
                              <AnimatePresence>
                                {activeFund?.id === sip.id && activeFund?.type === 'sip' && (
                                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} style={{ marginTop: '16px', padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: `1px solid ${activeFund.mode === 'sell' ? 'rgba(244, 63, 94, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`, display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        {isLinked && (
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                {activeFund.mode === 'sell' ? 'Selling at NAV' : 'Buying at NAV'} <strong style={{color: activeFund.mode === 'sell' ? 'var(--accent-coral)' : 'var(--accent-emerald)'}}>₹{sip.latestNav}</strong>
                                            </div>
                                        )}
                                        {activeFund.mode === 'sell' ? (
                                            <>
                                                <input type="number" placeholder="Units to Sell" value={sellUnits} onChange={e => setSellUnits(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '13px' }} />
                                                <CustomSelect value={sourceBankId} onChange={e => setSourceBankId(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '13px' }}>
                                                    <option value="">-- Destination Bank --</option>
                                                    {banks.map(b => <option key={b.id} value={b.id}>{b.bankName} (₹{b.ledgerBalance?.toLocaleString('en-IN')})</option>)}
                                                </CustomSelect>
                                                <CustomSelect value={jointBankId} onChange={e => setJointBankId(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '13px' }}>
                                                    <option value="">-- Joint Bank --</option>
                                                    {banks.map(b => <option key={b.id} value={b.id}>{b.bankName} (₹{b.ledgerBalance?.toLocaleString('en-IN')})</option>)}
                                                </CustomSelect>
                                                <button onClick={submitSellTracker} style={{ padding: '10px 20px', background: 'var(--accent-coral)', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>Execute Sell</button>
                                            </>
                                        ) : (
                                            <>
                                                <input type="number" placeholder="Capital to Deploy (₹)" value={fundAmount} onChange={e => setFundAmount(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '13px' }} />
                                                <CustomSelect value={sourceBankId} onChange={e => setSourceBankId(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '13px' }}>
                                                    <option value="">-- Source Bank --</option>
                                                    {banks.map(b => <option key={b.id} value={b.id}>{b.bankName} (₹{b.ledgerBalance?.toLocaleString('en-IN')})</option>)}
                                                </CustomSelect>
                                                <CustomSelect value={jointBankId} onChange={e => { setJointBankId(e.target.value); if(!e.target.value) setSplitAmount(''); }} style={{ flex: 1, padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '13px' }}>
                                                    <option value="">-- Joint Bank --</option>
                                                    {banks.map(b => <option key={b.id} value={b.id}>{b.bankName} (₹{b.ledgerBalance?.toLocaleString('en-IN')})</option>)}
                                                </CustomSelect>
                                                {jointBankId && <input type="number" placeholder="Split Amt" value={splitAmount} onChange={e => setSplitAmount(e.target.value)} style={{ width: '80px', padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '13px' }} />}
                                                <button onClick={submitFundTracker} style={{ padding: '10px 20px', background: 'var(--accent-emerald)', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>Execute Buy</button>
                                            </>
                                        )}
                                        <button onClick={() => setActiveFund(null)} style={{ padding: '10px', background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
                                    </motion.div>
                                )}
                              </AnimatePresence>
                           </div>
                        );
                    })
                )}
            </div>
         </div>
      </div>
      <ConfirmationModal
          isOpen={deletingTrackerId !== null}
          title="Delete SIP Portfolio"
          message={deleteError ? <span style={{color: '#ef4444', fontWeight: 500}}>{deleteError}</span> : "Are you sure you want to delete this SIP portfolio? This action cannot be undone."}
          confirmText="Delete"
          confirmStyle="danger"
          onCancel={() => { setDeletingTrackerId(null); setDeleteError(null); }}
          onConfirm={() => {
              setDeleteError(null);
              delMut.mutate(deletingTrackerId);
          }}
          keepOpenOnConfirm={true}
      />
    </div>
  );
}
