import React, { useState } from 'react';
import { Edit2, Trash2, Activity, X, Check } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { parseToPaiseBigInt, formatBigIntPaise } from '../../utils/bigIntMath';
import { motion, AnimatePresence } from 'framer-motion';
import CustomSelect from '../ui/CustomSelect';



export default function ActiveLoans({ 
  activeLoans, banks, familyMembers = [],
  onEditSave, onDelete, onPrepay, 
  formatDate 
}) {
  const [activeAnalyzer, setActiveAnalyzer] = useState(null); 
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [prepayData, setPrepayData] = useState({ amount: '', date: new Date().toISOString().split('T')[0], source_bank_id: '', joint_bank_id: '', split_amount: '' });
  const [prepaying, setPrepaying] = useState(false);

  const handleEditInit = (loan) => { 
    setEditingId(loan.id); 
    setEditFormData({ title: loan.title, principalAmount: loan.principalAmount, interestRate: loan.interestRate, termYears: loan.termYears, source_bank_id: loan.source_bank_id || '', owner_member_id: loan.owner_member_id || '' }); 
  };



  const handlePrepaySubmit = async (e, loanId) => {
    e.preventDefault();
    setPrepaying(true);
    await onPrepay(loanId, prepayData);
    setPrepayData({ amount: '', date: new Date().toISOString().split('T')[0], source_bank_id: '', joint_bank_id: '', split_amount: '' });
    setPrepaying(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection:'column', gap: '20px' }} role="list" aria-label="Active loans">
      {activeLoans.map(loan => {
        const stats = loan.engine;
        const isExpanded = activeAnalyzer === loan.id;
        const isEditing = editingId === loan.id;
        
        return (
          <div key={loan.id} className="glass-panel" style={{borderLeft: `4px solid ${stats.progressRatio > 70 ? '#10b981' : stats.progressRatio > 30 ? '#f59e0b' : '#ef4444'}`, overflow: 'hidden'}} role="listitem">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '16px' }}>{loan.title}</h3>
                <span className="loan-type-badge" style={{background:'rgba(239,68,68,0.1)', color:'#ef4444'}}>{loan.interestRate}% APR</span>
                {loan.dueDate && (
                  <span style={{fontSize:'11px', color:'var(--text-muted)'}}>{formatDate(loan.dueDate)}</span>
                )}
                {!isEditing && (
                  <>
                    <button className="icon-btn" onClick={() => handleEditInit(loan)} aria-label={`Edit ${loan.title}`}><Edit2 size={12}/></button>
                    <button className="icon-btn danger" onClick={() => onDelete(loan.id)} aria-label={`Delete ${loan.title}`}><Trash2 size={12}/></button>
                  </>
                )}
                {isEditing && <button style={{background:'none',border:'none',color:'var(--text-secondary)',cursor:'pointer',padding:'2px'}} onClick={() => setEditingId(null)} aria-label="Cancel editing"><X size={12}/></button>}
              </div>
              {!isEditing && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn" style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(16,185,129,0.1)', color: '#10b981', border:'1px solid rgba(16,185,129,0.2)', borderRadius:'8px', cursor:'pointer' }} onClick={() => { setActiveAnalyzer(loan.id); setPrepayData({ amount: loan.amount, date: new Date().toISOString().split('T')[0], source_bank_id: String(loan.source_bank_id || ''), joint_bank_id: '', split_amount: '' }); }} aria-label={`Pay EMI for ${loan.title}`}>
                    Pay EMI
                  </button>
                  <button className="btn" style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border:'1px solid rgba(59,130,246,0.2)', borderRadius:'8px', cursor:'pointer' }} onClick={() => setActiveAnalyzer(isExpanded ? null : loan.id)} aria-expanded={isExpanded} aria-label={`${isExpanded ? 'Collapse' : 'Analyze'} ${loan.title}`}>
                    <Activity size={14} style={{ marginRight: '4px', verticalAlign:'middle' }} aria-hidden="true" /> {isExpanded ? 'Collapse' : 'Analyze'}
                  </button>
                </div>
              )}
            </div>

            {isEditing ? (
              <form onSubmit={(e) => { e.preventDefault(); onEditSave(loan, editFormData); setEditingId(null); }} style={{ background: 'rgba(0,0,0,0.2)', padding:'14px', borderRadius: '12px', marginBottom: '16px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }} aria-label={`Edit ${loan.title}`}>
                <div className="field-group"><label className="field-label">Title</label><input className="field-input" required value={editFormData.title} onChange={e=>setEditFormData({ ...editFormData, title: e.target.value })}/></div>
                <div className="field-group"><label className="field-label">Principal</label><input className="field-input" required type="number" value={editFormData.principalAmount} onChange={e=>setEditFormData({ ...editFormData, principalAmount: e.target.value })}/></div>
                <div className="field-group"><label className="field-label">APR (%)</label><input className="field-input" required type="number" step="0.01" value={editFormData.interestRate} onChange={e=>setEditFormData({ ...editFormData, interestRate: e.target.value })}/></div>
                <div className="field-group"><label className="field-label">Term (Years)</label><input className="field-input" required type="number" value={editFormData.termYears} onChange={e=>setEditFormData({ ...editFormData, termYears: e.target.value })}/></div>
                <div className="field-group" style={{gridColumn:'span 2'}}>
                  <label className="field-label">Primary Owner</label>
                  <CustomSelect required value={editFormData.owner_member_id} onChange={e => setEditFormData({ ...editFormData, owner_member_id: e.target.value })} className="field-input">
                    <option value="">-- Select Owner --</option>
                    {familyMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </CustomSelect>
                </div>
                <button type="submit" className="btn btn-success" style={{gridColumn:'span 2', borderRadius:'10px'}}><Check size={14} aria-hidden="true" />Save</button>
              </form>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'flex-end' }}>
                  <div>
                    <span style={{fontSize:'11px', color:'var(--text-muted)'}}>Remaining Balance</span>
                    <div style={{fontSize:'26px', fontWeight:800, color:'var(--text-primary)'}}>₹{formatBigIntPaise(parseToPaiseBigInt(stats.remainingBalance))}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <span style={{fontSize:'11px', color:'var(--text-muted)'}}>EMI</span>
                    <div style={{fontSize:'16px', fontWeight:700}}>₹{formatBigIntPaise(parseToPaiseBigInt(loan.amount))}/mo</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <span style={{fontSize:'11px', color:'var(--text-muted)'}}>Original</span>
                    <div style={{fontSize:'14px', fontWeight:600, color:'var(--text-muted)'}}>₹{formatBigIntPaise(parseToPaiseBigInt(loan.originalPrincipal || loan.principalAmount))}</div>
                  </div>
                </div>

                <div style={{marginBottom:'16px'}}>
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:'11px', color:'var(--text-muted)', marginBottom:'4px'}}>
                    <span>{stats.progressRatio.toFixed(1)}% paid off</span>
                    <span>{parseToPaiseBigInt(stats.totalPrepaid) > 0n ? `₹${formatBigIntPaise(parseToPaiseBigInt(stats.totalPrepaid))} prepaid` : ''}</span>
                  </div>
                  <div style={{width:'100%', height:'8px', background:'rgba(255,255,255,0.05)', borderRadius:'4px', overflow:'hidden'}} role="progressbar" aria-valuenow={stats.progressRatio.toFixed(1)} aria-valuemin="0" aria-valuemax="100">
                    <div style={{width:`${stats.progressRatio > 100 ? 100 : stats.progressRatio}%`, height:'100%', background:`linear-gradient(90deg, #10b981, #3b82f6)`, borderRadius:'4px', transition:'width 0.3s ease'}}></div>
                  </div>
                </div>
              </>
            )}

            <AnimatePresence>
              {isExpanded && !isEditing && (
                <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: 'auto' }} 
                    exit={{ opacity: 0, height: 0 }}
                    style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px', marginTop: '8px' }}
                >
                  <p style={{ color: stats.aiRecommendation.includes('🔥') ? '#ef4444' : '#10b981', fontSize: '13px', marginBottom:'16px' }}>{stats.aiRecommendation}</p>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom: '20px'}}>
                    <div style={{ padding:'16px', background:'rgba(16,185,129,0.05)', borderRadius:'12px', border:'1px solid rgba(16,185,129,0.15)' }}>
                      <div style={{fontSize:'11px', color:'var(--text-muted)', marginBottom:'4px'}}>Interest Destroyed ✨</div>
                      <div style={{fontSize:'22px', fontWeight:700, color:'#10b981'}}>₹{formatBigIntPaise(parseToPaiseBigInt(stats.interestSaved))}</div>
                    </div>
                    <div style={{ padding:'16px', background:'rgba(59,130,246,0.05)', borderRadius:'12px', border:'1px solid rgba(59,130,246,0.15)' }}>
                      <div style={{fontSize:'11px', color:'var(--text-muted)', marginBottom:'4px'}}>Timeline Crushed ⌛</div>
                      <div style={{fontSize:'22px', fontWeight:700, color:'#3b82f6'}}>{stats.monthsShavedOff} months</div>
                    </div>
                  </div>
                  <div style={{ height: '200px', marginBottom: '20px' }}>
                    <Line data={{
                      labels: stats.curveData.labels,
                      datasets: [
                        { label: 'Interest', data: stats.curveData.interest, borderColor: 'rgba(239,68,68,1)', tension: 0.4, pointRadius: 2 },
                        { label: 'Principal', data: stats.curveData.principal, borderColor: 'rgba(16,185,129,1)', tension: 0.4, pointRadius: 2 }
                      ]
                    }} options={{ responsive: true, maintainAspectRatio: false, plugins:{legend:{labels:{color:'#94a3b8'}}} }} />
                  </div>
                  <form onSubmit={(e) => handlePrepaySubmit(e, loan.id)} style={{ display: 'flex', flexDirection:'column', gap: '8px' }} aria-label="Payment form">
                    <div style={{display:'flex', gap:'8px'}}>
                      <div className="field-group" style={{flex:1}}>
                        <label className="field-label">Payment Date</label>
                        <input className="field-input" required type="date" value={prepayData.date} onChange={e=>setPrepayData({ amount: prepayData.amount, date: e.target.value, source_bank_id: prepayData.source_bank_id, joint_bank_id: prepayData.joint_bank_id, split_amount: prepayData.split_amount })} />
                      </div>
                      <div className="field-group" style={{flex:2}}>
                        <label className="field-label">Payment Amount (₹)</label>
                        <input className="field-input" required type="number" value={prepayData.amount} onChange={e=>setPrepayData({ amount: e.target.value, date: prepayData.date, source_bank_id: prepayData.source_bank_id, joint_bank_id: prepayData.joint_bank_id, split_amount: prepayData.split_amount })} placeholder="Amount" />
                      </div>
                    </div>
                    <div style={{display:'flex', gap:'8px', alignItems:'flex-end'}}>
                       <div className="field-group" style={{flex:2}}>
                         <label className="field-label">Funding Account</label>
                         <CustomSelect className="field-input" required value={String(prepayData.source_bank_id || '')} onChange={e=>setPrepayData({ amount: prepayData.amount, date: prepayData.date, source_bank_id: e.target.value, joint_bank_id: prepayData.joint_bank_id, split_amount: prepayData.split_amount })}>
                            <option value="">-- Select Funding Account --</option>
                            {banks.map(b => <option key={b.id} value={String(b.id)} >{b.bankName} (₹{formatBigIntPaise(parseToPaiseBigInt(b.ledgerBalance))})</option>)}
                         </CustomSelect>
                       </div>
                       <div className="field-group" style={{flex:2}}>
                         <label className="field-label">Joint Split</label>
                         <CustomSelect className="field-input" value={String(prepayData.joint_bank_id || '')} onChange={e=>setPrepayData({ amount: prepayData.amount, date: prepayData.date, source_bank_id: prepayData.source_bank_id, joint_bank_id: e.target.value, split_amount: prepayData.split_amount })}>
                            <option value="">-- No Joint Split --</option>
                            {banks.map(b => <option key={b.id} value={String(b.id)}>{b.bankName} (₹{formatBigIntPaise(parseToPaiseBigInt(b.ledgerBalance))})</option>)}
                         </CustomSelect>
                       </div>
                       <div className="field-group" style={{flex:1}}>
                         <label className="field-label">Split Amount</label>
                         <input className="field-input" type="number" value={prepayData.split_amount} onChange={e=>setPrepayData({ amount: prepayData.amount, date: prepayData.date, source_bank_id: prepayData.source_bank_id, joint_bank_id: prepayData.joint_bank_id, split_amount: e.target.value })} placeholder="From primary" disabled={!prepayData.joint_bank_id} required={!!prepayData.joint_bank_id} title="Amount from Primary Account" />
                       </div>
                       <button type="submit" className="btn btn-success" style={{whiteSpace:'nowrap', flexShrink:0}} disabled={prepaying} aria-busy={prepaying}>
                         {prepaying ? 'Processing...' : 'Log Payment'}
                       </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
