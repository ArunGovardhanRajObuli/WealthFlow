import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PackageOpen, TrendingUp, BarChart3, Activity, Plus, X, Banknote } from 'lucide-react';
import { parseToPaiseBigInt, formatBigIntToDecimalString } from '../utils/bigIntMath';
import CustomSelect from './ui/CustomSelect';

function DividendTracker() {
  const queryClient = useQueryClient();
  const { data, isLoading: loading } = useQuery({
    queryKey: ['dividend-tracker'],
    queryFn: async () => {
      const res = await fetch('/api/dividend-tracker');
      if (!res.ok) throw new Error('Failed to load dividend tracker data');
      return res.json();
    }
  });

  const { data: bankRes, isLoading: loadingBanks } = useQuery({
    queryKey: ['bank-balances'],
    queryFn: async () => {
      const res = await fetch('/api/bank-balances');
      return res.json();
    }
  });

  const bankBalances = bankRes?.data || [];

  const [loggingId, setLoggingId] = useState(null);
  const [form, setForm] = useState({ amount: '', date: new Date().toISOString().split('T')[0], target_bank_id: '', joint_bank_id: '', split_amount: '' });

  const mut = useMutation({
    mutationFn: async ({ id, payload }) => {
      const res = await fetch(`/api/investments/${id}/dividend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to log dividend');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dividend-tracker'] });
      queryClient.invalidateQueries({ queryKey: ['bank-balances'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['family-estate-ledger'] });
      setLoggingId(null);
      setForm({ amount: '', date: new Date().toISOString().split('T')[0], target_bank_id: '', joint_bank_id: '', split_amount: '' });
    }
  });

  const { sortedInvestments, maxReturn } = React.useMemo(() => {
    const investments = data?.investments || [];
    const sorted = [...investments].sort((a, b) => (b.annualReturn || 0) - (a.annualReturn || 0));
    const max = sorted.length > 0 ? sorted[0].annualReturn || 0 : 0;
    return { sortedInvestments: sorted, maxReturn: max };
  }, [data]);

  if (loading || loadingBanks) return <div className="glass-panel animate-fade-in"><p style={{color:'var(--text-muted)'}}>Loading dividend data...</p></div>;

  if (!data || data.investments.length === 0) return <div className="empty-state glass-panel"><PackageOpen size={48} style={{opacity:0.3,marginBottom:'12px'}}/><h4>No Dividends</h4><p>No dividend-yielding investments found. Add dividend stocks or payout mutual funds to track returns.</p></div>;

  const inputStyle = { padding:'8px 12px', background:'rgba(255,255,255,0.05)', border:'1px solid var(--border-color)', borderRadius:'6px', color:'var(--text-primary)', fontSize:'13px', width:'100%' };

  const handleLogSubmit = (inv) => {
    if (!form.amount || !form.target_bank_id) return alert('Amount and target bank are required');
    const amtPaise = parseToPaiseBigInt(form.amount);
    const splitPaise = form.split_amount ? parseToPaiseBigInt(form.split_amount) : 0n;
    if (amtPaise < 0n || splitPaise < 0n) return;
    
    mut.mutate({
      id: inv.id,
      payload: {
        amount: formatBigIntToDecimalString(amtPaise),
        date: form.date,
        target_bank_id: form.target_bank_id,
        joint_bank_id: form.joint_bank_id || null,
        split_amount: formatBigIntToDecimalString(splitPaise)
      }
    });
  };

  return (
    <div className="animate-fade-in">
      <div className="section-header">
        <div>
          <h2>Investment Returns Tracker</h2>
          <p>Track estimated returns and passive income from your portfolio</p>
        </div>
      </div>

      <div className="stat-grid" style={{marginBottom:'24px'}}>
        <div className="stat-card" style={{'--stat-accent':'#10b981','--stat-color':'#10b981'}}>
          <div className="stat-card-icon"><TrendingUp size={20}/></div>
          <div className="stat-card-label">Annual Returns</div>
          <div className="stat-card-value">₹{Number(data.totalAnnualReturn || 0).toLocaleString('en-IN')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><Activity size={20}/></div>
          <div className="stat-card-label">Monthly Passive</div>
          <div className="stat-card-value">₹{Number(data.totalMonthlyReturn || 0).toLocaleString('en-IN')}</div>
        </div>
        <div className="stat-card" style={{'--stat-accent':'#3b82f6','--stat-color':'#3b82f6'}}>
          <div className="stat-card-icon"><BarChart3 size={20}/></div>
          <div className="stat-card-label">Weighted Yield</div>
          <div className="stat-card-value">{data.weightedYield || data.weightedROI || 0}%</div>
        </div>
      </div>

      <div className="glass-panel" style={{padding:'24px'}}>
        <h3 style={{marginBottom:'16px'}}>Portfolio Returns Breakdown</h3>
        {sortedInvestments.map((inv) => {
          const pct = maxReturn > 0 ? (inv.annualReturn/maxReturn)*100 : 0;
          const isLogging = loggingId === inv.id;
          
          return (
            <div key={inv.id} style={{marginBottom:'14px'}}>
              <div style={{display:'flex',justifyContent:'space-between', alignItems:'center', marginBottom:'4px',fontSize:'13px'}}>
                <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                    <span><span style={{fontWeight:600}}>{inv.title || inv.name}</span> <span style={{color:'var(--text-muted)',fontSize:'11px'}}>({inv.category})</span></span>
                    <button onClick={() => setLoggingId(isLogging ? null : inv.id)} style={{background:'none', border:'1px solid var(--border-color)', borderRadius:'4px', padding:'2px 6px', fontSize:'11px', color:'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', gap:'4px'}}>
                        {isLogging ? <X size={12}/> : <Plus size={12}/>} {isLogging ? 'Cancel' : 'Log Payout'}
                    </button>
                </div>
                <span><span style={{color:'#10b981',fontWeight:600}}>₹{Number(inv.annualReturn || 0).toLocaleString('en-IN')}/yr</span> <span style={{color:'var(--text-muted)',fontSize:'11px'}}>({inv.dividendYield || 0}% Yield)</span></span>
              </div>
              <div style={{height:'6px',background:'rgba(255,255,255,0.05)',borderRadius:'3px',overflow:'hidden', marginBottom: isLogging ? '12px' : '0'}}>
                <div style={{width:`${pct}%`,height:'100%',background:'linear-gradient(90deg,#10b981,#3b82f6)',borderRadius:'3px'}} />
              </div>
              
              {isLogging && (
                <div style={{padding:'12px', background:'rgba(255,255,255,0.02)', border:'1px solid var(--border-color)', borderRadius:'8px', marginTop:'8px'}}>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px'}}>
                    <input type="number" placeholder="Payout Amount (₹)" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})} style={inputStyle} />
                    <input type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})} style={inputStyle} />
                    <CustomSelect value={form.target_bank_id} onChange={e=>setForm({...form, target_bank_id:e.target.value})} style={{...inputStyle, appearance:'none'}}>
                      <option value="">-- Target Bank Account --</option>
                      {bankBalances.map(b => <option key={b.id} value={b.id}>{b.bankName} (...{b.accountNumber.slice(-4)})</option>)}
                    </CustomSelect>
                    
                    {inv.joint_owner_member_id && (
                        <>
                           <CustomSelect value={form.joint_bank_id} onChange={e => setForm({...form, joint_bank_id: e.target.value})} style={{...inputStyle, appearance:'none', gridColumn: 'span 1'}}>
                               <option value="">-- Joint Target Bank (if split) --</option>
                               {bankBalances.map(b => <option key={b.id} value={b.id}>{b.bankName} (...{b.accountNumber.slice(-4)})</option>)}
                           </CustomSelect>
                           <input type="number" placeholder="Actual Joint Amount" value={form.split_amount} onChange={e => setForm({...form, split_amount: e.target.value})} style={{...inputStyle, gridColumn: 'span 1'}} />
                        </>
                    )}
                    <button onClick={() => handleLogSubmit(inv)} style={{gridColumn: '1 / -1', padding:'8px', background:'var(--accent-emerald)', color:'#000', fontWeight:600, border:'none', borderRadius:'6px', cursor:'pointer'}}>Confirm Log</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {data?.history && data.history.length > 0 && (
        <div className="glass-panel" style={{padding:'24px', marginTop:'24px'}}>
          <h3 style={{marginBottom:'16px', display:'flex', alignItems:'center', gap:'8px'}}><Banknote size={16}/> Recent Payout History</h3>
          {data.history.map(h => (
            <div key={h.id} style={{display:'flex', justifyContent:'space-between', padding:'12px', borderBottom:'1px solid var(--border-color)'}}>
              <div>
                <div style={{fontWeight:600, fontSize:'13px'}}>{h.title}</div>
                <div style={{fontSize:'11px', color:'var(--text-muted)'}}>{new Date(h.date).toLocaleDateString()}</div>
              </div>
              <div style={{fontWeight:700, color:'var(--accent-emerald)'}}>+₹{Number(h.amount || 0).toLocaleString('en-IN')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export default DividendTracker;
