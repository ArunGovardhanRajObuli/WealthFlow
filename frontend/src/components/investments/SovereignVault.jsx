import { parseToPaiseBigInt, formatBigIntToDecimalString } from '../../utils/bigIntMath';
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Info, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomSelect from '../ui/CustomSelect';

export default function SovereignVault() {
  const queryClient = useQueryClient();

  const { data: invRes } = useQuery({ queryKey: ['investments'], queryFn: () => fetch('/api/investments').then(r => r.json()) });
  const { data: famRes } = useQuery({ queryKey: ['family-members'], queryFn: () => fetch('/api/family-members').then(r => r.json()) });
  const { data: bankRes } = useQuery({ queryKey: ['bank-balances'], queryFn: () => fetch('/api/bank-balances').then(r => r.json()) });

  const investments = useMemo(() => invRes?.data || [], [invRes?.data]);
  const familyMembers = useMemo(() => famRes?.data || [], [famRes?.data]);

  const ppf = useMemo(() => investments.find(i => i.category === 'ppf'), [investments]);
  const epf = useMemo(() => investments.find(i => i.category === 'epf'), [investments]);

  const [showPpfInit, setShowPpfInit] = useState(false);
  const [showEpfInit, setShowEpfInit] = useState(false);
  const [showPpfInfo, setShowPpfInfo] = useState(false);
  const [showEpfInfo, setShowEpfInfo] = useState(false);
  const [activeFund, setActiveFund] = useState(null);
  
  const [initAmount, setInitAmount] = useState('');
  const [fundAmount, setFundAmount] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [jointOwnerId, setJointOwnerId] = useState('');
  const [splitPercent, setSplitPercent] = useState('100');
  const [sourceBankId, setSourceBankId] = useState('');
  const [jointBankId, setJointBankId] = useState('');
  const [splitAmount, setSplitAmount] = useState('');

  const banks = useMemo(() => (bankRes?.data || []), [bankRes?.data]);

  const initMut = useMutation({
    mutationFn: async (data) => {
      const res = await fetch('/api/investments', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) { let e; try { e = await res.json(); } catch (err) { throw new Error(`Network or server error (${res.status})`, { cause: err }); } throw new Error(e?.error || 'Failed to create investment'); }
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['investments'] });
      setShowPpfInit(false); setShowEpfInit(false); setInitAmount('');
      setOwnerId(''); setJointOwnerId(''); setSplitPercent('100');
      setSourceBankId(''); setJointBankId(''); setSplitAmount('');
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

  const submitInitTracker = (category, assetClass, title, roi, targetAmount, initialBalance) => {
    const initialPaise = parseToPaiseBigInt(initialBalance);
    if (initialPaise < 0n) return;
    initMut.mutate({ 
      title, category, assetClass, currentAmount: formatBigIntToDecimalString(initialPaise), targetAmount, roi, unrealizedGain: 0, 
      schemeCode: null, latestNav: 0, isHistorical: false, manualUnits: '', 
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
    
    fundMut.mutate({ id: activeFund.id, data: { amount: amountStr, source_bank_id: sourceBankId || null, joint_bank_id: jointBankId || null, split_amount: jointBankId && splitAmount ? formatBigIntToDecimalString(parseToPaiseBigInt(splitAmount)) : null } });
  };

  return (
    <div className="sovereign-vault">
      <div className="section-header" style={{marginTop:'40px', marginBottom:'16px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          <Briefcase size={20} className="text-emerald" />
          <h3 style={{margin:0}}>The Sovereign Vault</h3>
        </div>
      </div>
      <div className="grid-2" style={{ marginBottom: '40px', gap: '24px' }}>
          
          <div className="glass-panel" style={{ background: 'var(--bg-secondary)', borderLeft: '4px solid var(--accent-emerald)', position: 'relative' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                    Public Provident Fund (PPF)
                    <button className="btn" style={{ padding: '4px', background: 'transparent', color: 'var(--text-muted)' }} onClick={() => setShowPpfInfo(!showPpfInfo)}><Info size={16} /></button>
                </h4>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '4px 8px', borderRadius: '8px', fontSize: '12px', color: 'var(--accent-emerald)', fontWeight: 600 }}>7.1% Sovereign Guarantee</div>
             </div>
             <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>Lock-in: 15 Years | Tier: EEE (Exempt-Exempt-Exempt)</p>
             
             <AnimatePresence>
                 {showPpfInfo && (
                     <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', marginBottom: '24px', borderLeft: '2px solid var(--accent-emerald)', fontSize: '13px', color: 'var(--text-secondary)', overflow: 'hidden' }}>
                         <strong style={{ color: 'var(--text-primary)' }}>How PPF Works:</strong> It is a government-backed, zero-risk savings scheme. It has a mandatory lock-in period of 15 years. It falls under the <strong style={{ color: 'var(--text-primary)' }}>EEE (Exempt-Exempt-Exempt)</strong> tax category: your deposits (up to ₹1.5L/year) are tax-deductible under 80C, the interest earned is completely tax-free, and the final maturity amount is completely tax-free.
                     </motion.div>
                 )}
             </AnimatePresence>
             
             {ppf ? (
                 <>
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
                         <span>Maximum Annual Allowance:</span>
                         <span>₹{Number(ppf.targetAmount).toLocaleString('en-IN')}</span>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--accent-sapphire)' }}>
                         <span>Total Vault Corpus:</span>
                         <span style={{ fontWeight: 700 }}>₹{Number(ppf.currentAmount).toLocaleString('en-IN', {maximumFractionDigits: 0})}</span>
                     </div>
                     <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', width: '100%', marginTop: '16px', borderRadius: '2px' }}>
                         <div style={{ width: `${Math.min((Number(ppf.currentAmount) / Number(ppf.targetAmount)) * 100, 100)}%`, height: '100%', background: 'var(--accent-sapphire)', borderRadius: '2px' }}></div>
                     </div>
                     
                     <AnimatePresence>
                         {activeFund?.id === ppf.id ? (
                             <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ marginTop: '16px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)', overflow: 'hidden' }}>
                                 <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                     <div style={{ display: 'flex', gap: '8px' }}>
                                         <input type="number" placeholder="Deposit Amount (₹)" value={fundAmount} onChange={e => setFundAmount(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '13px' }} />
                                         <CustomSelect value={sourceBankId} onChange={e => setSourceBankId(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '13px' }}>
                                            <option value="">-- Source Bank --</option>
                                            {banks.map(b => <option key={b.id} value={b.id}>{b.bankName} (₹{b.ledgerBalance?.toLocaleString('en-IN')})</option>)}
                                         </CustomSelect>
                                     </div>
                                     <div style={{ display: 'flex', gap: '8px' }}>
                                         <CustomSelect value={jointBankId} onChange={e => { setJointBankId(e.target.value); if(!e.target.value) setSplitAmount(''); }} style={{ flex: 1, padding: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '13px' }}>
                                            <option value="">-- Joint Bank --</option>
                                            {banks.map(b => <option key={b.id} value={b.id}>{b.bankName} (₹{b.ledgerBalance?.toLocaleString('en-IN')})</option>)}
                                         </CustomSelect>
                                         {jointBankId && <input type="number" placeholder="Split Amt" value={splitAmount} onChange={e => setSplitAmount(e.target.value)} style={{ width: '80px', padding: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '13px' }} />}
                                         <button onClick={submitFundTracker} style={{ padding: '8px 12px', background: 'var(--accent-emerald)', color: '#000', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}>Save</button>
                                         <button onClick={() => setActiveFund(null)} style={{ padding: '8px', background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
                                     </div>
                                 </div>
                             </motion.div>
                         ) : (
                             <button className="btn mt-4" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', fontSize: '13px', marginTop: '16px' }} onClick={() => setActiveFund({ id: ppf.id, title: 'PPF Deposit' })}>Log Deposit (Deducts Free Cash)</button>
                         )}
                     </AnimatePresence>
                 </>
             ) : showPpfInit ? (
                 <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)', overflow: 'hidden' }}>
                     <label style={{ display: 'block', fontSize: '12px', marginBottom: '8px', color: 'var(--text-secondary)' }}>Current PPF Balance</label>
                     <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                          <CustomSelect value={ownerId} onChange={e => setOwnerId(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '13px' }}>
                             <option value="">-- Primary Owner --</option>
                             {familyMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </CustomSelect>
                          <CustomSelect value={jointOwnerId} onChange={e => setJointOwnerId(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '13px' }}>
                             <option value="">-- Joint Owner --</option>
                             {familyMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </CustomSelect>
                          <div style={{display:'flex', alignItems:'center', gap:'4px', background:'rgba(255,255,255,0.05)', borderRadius:'4px', paddingRight:'12px', border: '1px solid var(--border-color)'}}>
                             <input type="number" min="0" max="100" placeholder="Split %" value={splitPercent} onChange={e => setSplitPercent(e.target.value)} style={{width: '60px', padding: '8px', background:'none', border:'none', color: '#fff', fontSize: '13px'}} />
                             <span style={{color:'var(--text-muted)', fontSize:'12px'}}>%</span>
                          </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                          <CustomSelect value={sourceBankId} onChange={e => setSourceBankId(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '13px' }}>
                             <option value="">-- Source Bank --</option>
                             {banks.map(b => <option key={b.id} value={b.id}>{b.bankName} (₹{b.ledgerBalance?.toLocaleString('en-IN')})</option>)}
                          </CustomSelect>
                          <CustomSelect value={jointBankId} onChange={e => { setJointBankId(e.target.value); if(!e.target.value) setSplitAmount(''); }} style={{ flex: 1, padding: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '13px' }}>
                             <option value="">-- Joint Bank --</option>
                             {banks.map(b => <option key={b.id} value={b.id}>{b.bankName} (₹{b.ledgerBalance?.toLocaleString('en-IN')})</option>)}
                          </CustomSelect>
                          {jointBankId && <input type="number" placeholder="Split Amt" value={splitAmount} onChange={e => setSplitAmount(e.target.value)} style={{ width: '80px', padding: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '13px' }} />}
                      </div>
                     <div style={{ display: 'flex', gap: '8px' }}>
                         <input type="number" placeholder="₹0" value={initAmount} onChange={e => setInitAmount(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '13px' }} />
                         <button onClick={() => submitInitTracker('ppf', 'sovereign', 'PPF Primary', 7.1, 150000, initAmount)} style={{ padding: '8px 12px', background: 'var(--accent-emerald)', color: '#000', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}>Start</button>
                         <button onClick={() => setShowPpfInit(false)} style={{ padding: '8px', background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
                     </div>
                 </motion.div>
             ) : (
                 <button className="btn" style={{ width: '100%', background: 'var(--bg-primary)'}} onClick={() => { setShowPpfInit(true); setInitAmount(''); }}>
                     <Plus size={16} style={{ marginRight: '8px' }} /> Initialize Real PPF Ledger
                 </button>
             )}
          </div>
          
          <div className="glass-panel" style={{ background: 'var(--bg-secondary)', borderLeft: '4px solid var(--accent-sapphire)', position: 'relative' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                    Employee Provident Fund (EPF)
                    <button className="btn" style={{ padding: '4px', background: 'transparent', color: 'var(--text-muted)' }} onClick={() => setShowEpfInfo(!showEpfInfo)}><Info size={16} /></button>
                </h4>
                <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '4px 8px', borderRadius: '8px', fontSize: '12px', color: 'var(--accent-sapphire)', fontWeight: 600 }}>8.15% Sovereign Target</div>
             </div>
             <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>Employer-Matched | Base Requirement: 12% Basic</p>

             <AnimatePresence>
                 {showEpfInfo && (
                     <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', marginBottom: '24px', borderLeft: '2px solid var(--accent-sapphire)', fontSize: '13px', color: 'var(--text-secondary)', overflow: 'hidden' }}>
                         <strong style={{ color: 'var(--text-primary)' }}>How EPF Works:</strong> This is a mandatory retirement fund for salaried employees. You contribute 12% of your basic salary, and your employer matches it. It generates high, tax-free sovereign interest. You can also make voluntary extra contributions (VPF) to earn the same high interest rate.
                     </motion.div>
                 )}
             </AnimatePresence>

             {epf ? (
                 <>
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
                         <span>Current Corpus:</span>
                         <span style={{ fontWeight: 700 }}>₹{Number(epf.currentAmount).toLocaleString('en-IN', {maximumFractionDigits: 0})}</span>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-secondary)' }}>
                         <span>Next Interest Credit (Estimated):</span>
                         <span>+ ₹{((Number(epf.currentAmount) * 0.0815)).toLocaleString('en-IN', {maximumFractionDigits: 0})}</span>
                     </div>
                     
                     <AnimatePresence>
                         {activeFund?.id === epf.id ? (
                             <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ marginTop: '30px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)', overflow: 'hidden' }}>
                                 <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                     <div style={{ display: 'flex', gap: '8px' }}>
                                         <input type="number" placeholder="VPF Amount (₹)" value={fundAmount} onChange={e => setFundAmount(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '13px' }} />
                                         <CustomSelect value={sourceBankId} onChange={e => setSourceBankId(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '13px' }}>
                                            <option value="">-- Source Bank --</option>
                                            {banks.map(b => <option key={b.id} value={b.id}>{b.bankName} (₹{b.ledgerBalance?.toLocaleString('en-IN')})</option>)}
                                         </CustomSelect>
                                     </div>
                                     <div style={{ display: 'flex', gap: '8px' }}>
                                         <CustomSelect value={jointBankId} onChange={e => { setJointBankId(e.target.value); if(!e.target.value) setSplitAmount(''); }} style={{ flex: 1, padding: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '13px' }}>
                                            <option value="">-- Joint Bank --</option>
                                            {banks.map(b => <option key={b.id} value={b.id}>{b.bankName} (₹{b.ledgerBalance?.toLocaleString('en-IN')})</option>)}
                                         </CustomSelect>
                                         {jointBankId && <input type="number" placeholder="Split Amt" value={splitAmount} onChange={e => setSplitAmount(e.target.value)} style={{ width: '80px', padding: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '13px' }} />}
                                         <button onClick={submitFundTracker} style={{ padding: '8px 12px', background: 'var(--accent-sapphire)', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}>Save</button>
                                         <button onClick={() => setActiveFund(null)} style={{ padding: '8px', background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
                                     </div>
                                 </div>
                             </motion.div>
                         ) : (
                             <button className="btn mt-4" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', fontSize: '13px', marginTop: '30px' }} onClick={() => setActiveFund({ id: epf.id, title: 'VPF Top-Up' })}>Log VPF Top-Up</button>
                         )}
                     </AnimatePresence>
                 </>
             ) : showEpfInit ? (
                 <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)', overflow: 'hidden' }}>
                     <label style={{ display: 'block', fontSize: '12px', marginBottom: '8px', color: 'var(--text-secondary)' }}>Current EPF Balance</label>
                     <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                          <CustomSelect value={ownerId} onChange={e => setOwnerId(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '13px' }}>
                             <option value="">-- Primary Owner --</option>
                             {familyMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </CustomSelect>
                          <CustomSelect value={jointOwnerId} onChange={e => setJointOwnerId(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '13px' }}>
                             <option value="">-- Joint Owner --</option>
                             {familyMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </CustomSelect>
                          <div style={{display:'flex', alignItems:'center', gap:'4px', background:'rgba(255,255,255,0.05)', borderRadius:'4px', paddingRight:'12px', border: '1px solid var(--border-color)'}}>
                             <input type="number" min="0" max="100" placeholder="Split %" value={splitPercent} onChange={e => setSplitPercent(e.target.value)} style={{width: '60px', padding: '8px', background:'none', border:'none', color: '#fff', fontSize: '13px'}} />
                             <span style={{color:'var(--text-muted)', fontSize:'12px'}}>%</span>
                          </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                          <CustomSelect value={sourceBankId} onChange={e => setSourceBankId(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '13px' }}>
                             <option value="">-- Source Bank --</option>
                             {banks.map(b => <option key={b.id} value={b.id}>{b.bankName} (₹{b.ledgerBalance?.toLocaleString('en-IN')})</option>)}
                          </CustomSelect>
                          <CustomSelect value={jointBankId} onChange={e => { setJointBankId(e.target.value); if(!e.target.value) setSplitAmount(''); }} style={{ flex: 1, padding: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '13px' }}>
                             <option value="">-- Joint Bank --</option>
                             {banks.map(b => <option key={b.id} value={b.id}>{b.bankName} (₹{b.ledgerBalance?.toLocaleString('en-IN')})</option>)}
                          </CustomSelect>
                          {jointBankId && <input type="number" placeholder="Split Amt" value={splitAmount} onChange={e => setSplitAmount(e.target.value)} style={{ width: '80px', padding: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '13px' }} />}
                      </div>
                     <div style={{ display: 'flex', gap: '8px' }}>
                         <input type="number" placeholder="₹0" value={initAmount} onChange={e => setInitAmount(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: '#fff', fontSize: '13px' }} />
                         <button onClick={() => submitInitTracker('epf', 'sovereign', 'EPF Primary Base', 8.15, 0, initAmount)} style={{ padding: '8px 12px', background: 'var(--accent-sapphire)', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}>Start</button>
                         <button onClick={() => setShowEpfInit(false)} style={{ padding: '8px', background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
                     </div>
                 </motion.div>
             ) : (
                 <button className="btn" style={{ width: '100%', background: 'var(--bg-primary)'}} onClick={() => { setShowEpfInit(true); setInitAmount(''); }}>
                     <Plus size={16} style={{ marginRight: '8px' }} /> Initialize Real EPF Account
                 </button>
             )}
          </div>
      </div>
    </div>
  );
}
