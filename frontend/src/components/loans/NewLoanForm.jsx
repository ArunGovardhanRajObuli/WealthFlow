import React, { useState } from 'react';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { parseToPaiseBigInt, calculateEMIBigInt, formatBigIntToDecimalString } from '../../utils/bigIntMath';
import CustomSelect from '../ui/CustomSelect';

export default function NewLoanForm({ banks, familyMembers = [], onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({ 
    title: '', 
    principalAmount: '', 
    interestRate: '', 
    termYears: '', 
    dueDate: new Date().toISOString().split('T')[0], 
    source_bank_id: '',
    owner_member_id: ''
  });


  
  const calculatedEMI = formatBigIntToDecimalString(calculateEMIBigInt(parseToPaiseBigInt(formData.principalAmount), formData.interestRate, formData.termYears));

  const mutation = useMutation({
    mutationFn: async (newLoan) => {
      const response = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLoan),
      });
      if (!response.ok) throw new Error('Network response was not ok');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      onSuccess();
    },
    onError: (err) => {
      console.error('Failed to create loan:', err);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      title: formData.title, 
      amount: calculatedEMI, 
      dueDate: String(formData.dueDate), 
      category: 'loan', 
      termYears: Number(formData.termYears) || 0, 
      principalAmount: formData.principalAmount, 
      interestRate: formData.interestRate, 
      frequency: 'monthly', 
      source_bank_id: formData.source_bank_id ? String(formData.source_bank_id) : null,
      owner_member_id: formData.owner_member_id ? String(formData.owner_member_id) : null
    };
    Object.freeze(payload);
    mutation.mutate(payload);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, height: 0 }} 
      animate={{ opacity: 1, height: 'auto' }} 
      exit={{ opacity: 0, height: 0 }}
      className="glass-panel" 
      style={{ marginBottom: '24px', padding:'24px', borderLeft:'4px solid #ef4444', overflow: 'hidden' }} 
      role="form" aria-label="New loan form"
    >
      <div style={{display:'flex', justifyContent:'space-between', marginBottom:'16px'}}>
        <h3 style={{margin:0}}>Originate New Loan</h3>
        <button className="icon-btn" onClick={onClose} aria-label="Close form"><X size={18}/></button>
      </div>
      <form onSubmit={handleSubmit} style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px'}}>
        <div className="field-group">
          <label className="field-label" htmlFor="loan-name">Loan Name</label>
          <input id="loan-name" className="field-input" required placeholder="e.g. HDFC Home Loan" value={formData.title} onChange={e=>setFormData({ ...formData, title: e.target.value })} />
        </div>
        <div className="field-group">
          <label className="field-label" htmlFor="loan-principal">Principal Amount (₹)</label>
          <input id="loan-principal" className="field-input" required type="number" placeholder="e.g. 5000000" value={formData.principalAmount} onChange={e=>setFormData({ ...formData, principalAmount: e.target.value })} />
        </div>
        <div className="field-group">
          <label className="field-label" htmlFor="loan-apr">APR (%)</label>
          <input id="loan-apr" className="field-input" required type="number" step="0.01" placeholder="e.g. 8.5" value={formData.interestRate} onChange={e=>setFormData({ ...formData, interestRate: e.target.value })} />
        </div>
        <div className="field-group">
          <label className="field-label" htmlFor="loan-term">Term (Years)</label>
          <input id="loan-term" className="field-input" required type="number" placeholder="e.g. 20" value={formData.termYears} onChange={e=>setFormData({ ...formData, termYears: e.target.value })} />
        </div>
        <div className="field-group">
          <label className="field-label" htmlFor="loan-date">Origination Date</label>
          <input id="loan-date" className="field-input" required type="date" value={formData.dueDate} onChange={e=>setFormData({ ...formData, dueDate: e.target.value })} />
        </div>
        <div className="field-group">
          <label className="field-label" htmlFor="loan-bank">Disbursement Account</label>
          <CustomSelect id="loan-bank" className="field-input" required value={String(formData.source_bank_id || '')} onChange={e=>setFormData({ ...formData, source_bank_id: e.target.value })}>
              <option value="">-- Select Bank Account --</option>
              {banks.map(b => <option key={b.id} value={String(b.id)} >{b.bankName} (₹{b.ledgerBalance?.toLocaleString('en-IN')})</option>)}
          </CustomSelect>
        </div>
        <div className="field-group">
          <label className="field-label" htmlFor="loan-owner">Primary Owner</label>
          <CustomSelect id="loan-owner" className="field-input" required value={formData.owner_member_id} onChange={e => setFormData({ ...formData, owner_member_id: e.target.value })}>
            <option value="">-- Select Owner --</option>
            {familyMembers.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </CustomSelect>
        </div>
        <div style={{padding:'12px', background:'rgba(59,130,246,0.1)', borderRadius:'10px', textAlign:'center', border:'1px solid rgba(59,130,246,0.2)', display:'flex', flexDirection:'column', justifyContent:'center'}}>
          <div style={{fontSize:'11px', color:'var(--text-muted)'}}>Calculated EMI</div>
          <div style={{fontSize:'20px', fontWeight:800, color:'#3b82f6'}}>₹{calculatedEMI.split('.')[0]}</div>
        </div>
        <button type="submit" className="btn btn-primary" style={{gridColumn:'span 3', borderRadius:'10px'}} disabled={mutation.isPending}>
          {mutation.isPending ? 'Submitting...' : 'Submit Loan'}
        </button>
      </form>
    </motion.div>
  );
}
