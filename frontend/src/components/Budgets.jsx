import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, X, Check, AlertTriangle, PackageOpen } from 'lucide-react';
import { parseToPaiseBigInt, formatBigIntToDecimalString } from '../utils/bigIntMath';

function Budgets() {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [formData, setFormData] = useState({ category: '', monthlyLimit: '' });

  const { data: budgetsData, error: budgetsError } = useQuery({
    queryKey: ['budgets'],
    queryFn: async () => {
      const res = await fetch('/api/budgets');
      if (!res.ok) throw new Error('Failed to load budgets');
      return res.json();
    }
  });



  const addBudgetMutation = useMutation({
    mutationFn: async (newBudget) => {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBudget)
      });
      if (!res.ok) throw new Error('Failed to add budget');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['budgets']);
      setIsAdding(false);
      setFormData({ category: '', monthlyLimit: '' });
    }
  });

  const updateBudgetMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`/api/budgets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update budget');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['budgets']);
      setEditingId(null);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const limitPaise = parseToPaiseBigInt(formData.monthlyLimit);
    if (limitPaise < 0n) return;
    addBudgetMutation.mutate({ category: formData.category, monthlyLimit: formatBigIntToDecimalString(limitPaise) });
  };

  const handleEditInit = (b) => {
      setEditingId(b.id);
      setEditFormData({ category: b.category, monthlyLimit: b.monthlyLimit });
  };
  
  const handleEditSave = (e, id) => {
      e.preventDefault();
      const limitPaise = parseToPaiseBigInt(editFormData.monthlyLimit);
      if (limitPaise < 0n) return;
      updateBudgetMutation.mutate({ id, data: { category: editFormData.category, monthlyLimit: formatBigIntToDecimalString(limitPaise) } });
  };

  const budgets = budgetsData?.data || [];


  const error = budgetsError?.message || addBudgetMutation.error?.message || updateBudgetMutation.error?.message;

  return (
    <div className="animate-fade-in">
      {error && <div className="alert-banner danger" style={{marginBottom:'20px'}}><AlertTriangle size={16}/> {error}</div>}
      <div className="section-header">
        <div>
          <h2>Envelope Budgeting</h2>
          <p>Track category limits against actual monthly spend</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? <><X size={16} style={{marginRight:'6px'}} /> Cancel Budget Creation</> : <><Plus size={16} style={{marginRight:'6px'}} /> New Budget</>}
        </button>
      </div>

      {isAdding && (
         <div className="glass-panel" style={{ marginBottom: '24px' }}>
            <form onSubmit={handleSubmit} className="grid-3" style={{ alignItems: 'flex-end' }}>
                <div className="field-group">
                    <label>Category</label>
                    <input required name="category" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="field-input" placeholder="e.g. groceries" />
                </div>
                <div className="field-group">
                    <label>Monthly Limit (₹)</label>
                    <input required type="number" name="monthlyLimit" value={formData.monthlyLimit} onChange={e => setFormData({...formData, monthlyLimit: e.target.value})} className="field-input" placeholder="0.00" />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="submit" className="btn btn-success" style={{ flex: 1 }}>Set Limit</button>
                    <button type="button" className="btn" onClick={() => setIsAdding(false)}>Cancel</button>
                </div>
            </form>
         </div>
      )}

      <div className="grid-2">
         {budgets.map(b => {
             const spentPaise = BigInt(b.spentPaise || '0');
             const limitPaise = parseToPaiseBigInt(b.monthlyLimit);
             const ratio = limitPaise > 0n ? Number((spentPaise * 10000n) / limitPaise) / 100 : 0;
             const isWarning = ratio > 85;
             const isAlert = ratio > 100;
             const isEditing = editingId === b.id;
             
             return (
                 <div key={b.id} className="glass-panel">
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                         {isEditing ? (
                             <input required value={editFormData.category} onChange={e=>setEditFormData({...editFormData, category:e.target.value})} className="field-input" style={{width:'140px', padding:'4px 8px'}} />
                         ) : (
                             <h3 className="capitalize" style={{ fontSize: '18px', margin:0 }}>{b.category}</h3>
                         )}
                         {!isEditing && isAlert && <span className="urgency-badge critical">Over Budget</span>}
                         {!isEditing && isWarning && !isAlert && <span className="urgency-badge warning">Warning</span>}
                       </div>
                       
                       <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                           {!isEditing && (
                               <span style={{ fontWeight: 600, color: isAlert ? 'var(--accent-coral)' : 'var(--text-primary)' }}>
                                  ₹{Number(formatBigIntToDecimalString(spentPaise)).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})} / ₹{Number(formatBigIntToDecimalString(limitPaise)).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                               </span>
                           )}
                           
                           {!isEditing ? (
                               <button className="icon-btn" onClick={() => handleEditInit(b)}><Edit2 size={14} /></button>
                           ) : (
                               <button className="btn" style={{ padding: '2px 4px', color: 'var(--text-secondary)' }} onClick={() => setEditingId(null)}><X size={14} /></button>
                           )}
                       </div>
                    </div>

                    {isEditing ? (
                        <form onSubmit={(e) => handleEditSave(e, b.id)} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                            <input required type="number" value={editFormData.monthlyLimit} onChange={e=>setEditFormData({...editFormData, monthlyLimit:e.target.value})} className="field-input" placeholder="New Limit (₹)" style={{ flex: 1, padding: '6px' }} />
                            <button className="icon-btn" type="submit"><Check size={14}/></button>
                        </form>
                    ) : (
                        <div style={{ width: '100%', height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
                           <div style={{ 
                               width: `${Math.min(ratio, 100)}%`, 
                               height: '100%', 
                               background: isAlert ? 'var(--accent-coral)' : (isWarning ? '#f59e0b' : 'var(--accent-emerald)'),
                               transition: 'width 0.5s ease-out'
                           }}></div>
                        </div>
                    )}
                    
                    {!isEditing && (
                        <p style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'right', margin: 0 }}>
                           {ratio.toFixed(1)}% Used
                        </p>
                    )}
                 </div>
             )
         })}
      </div>
      
      {budgets.length === 0 && !isAdding && (
         <div className="empty-state glass-panel"><PackageOpen size={48} style={{opacity:0.3,marginBottom:'12px'}}/><h4>No Budgets Set</h4><p>Create your first envelope budget to start tracking category limits.</p></div>
      )}
    </div>
  );
}

export default Budgets;
