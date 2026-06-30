import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Upload, CheckCircle, AlertTriangle, ScanLine } from 'lucide-react';
import CustomSelect from './ui/CustomSelect';

function ReceiptScanner({ onScanSuccess }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, scanning, success, error
  const [message, setMessage] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('irregular');
  const [sourceBankId, setSourceBankId] = useState('');

  const { data: recData } = useQuery({ queryKey: ['reconciliation'], queryFn: () => fetch('/api/reconciliation').then(res => res.json()) });
  const banks = recData?.banks || [];
  
  const { data: ccRes } = useQuery({ queryKey: ['credit-cards'], queryFn: () => fetch('/api/credit-cards').then(res => res.json()) });
  const creditCards = ccRes?.data || [];

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setStatus('idle');
      setMessage('');
      setParsedData(null);
    }
  };

  const scanMutation = useMutation({
    mutationFn: async (formData) => {
      const response = await fetch('/api/scan-bill', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: formData,
      });
      if (!response.ok) {
          let e;
          try { e = await response.json(); } catch (err) { throw new Error(`Network or server error (${response.status})`, { cause: err }); }
          throw new Error(e?.error || 'Failed to scan receipt');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setStatus('success');
      setParsedData(data);
      setTitle(file.name.split('.')[0]); // default title
    },
    onError: (err) => {
      setStatus('error');
      setMessage(err.message || 'Network error. Is the server running?');
    }
  });

  const handleScan = () => {
    if (!file) return;
    setStatus('scanning');

    const formData = new FormData();
    formData.append('receipt', file);

    scanMutation.mutate(formData);
  };

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
          let e;
          try { e = await response.json(); } catch (err) { throw new Error(`Network or server error (${response.status})`, { cause: err }); }
          throw new Error(e?.error || 'Failed to save transaction');
      }
      return response.json();
    },
    onSuccess: async () => {
      setMessage("Transaction officially logged!");
      if (onScanSuccess) onScanSuccess();
      setFile(null);
      setParsedData(null);
      setStatus('idle');
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      await queryClient.invalidateQueries({ queryKey: ['bank-balances'] });
    },
    onError: () => {
      setMessage("Failed to save transaction");
      setStatus('error');
    }
  });

  const saveTransaction = () => {
    if (!parsedData || !parsedData.parsedAmount || !sourceBankId) {
       setMessage("Missing amount or bank account selection.");
       return;
    }

    const isCreditCard = sourceBankId.startsWith('cc_');
    const actualBankId = isCreditCard ? '' : sourceBankId;
    const actualCcId = isCreditCard ? sourceBankId.replace('cc_', '') : '';

    saveMutation.mutate({
      title: title || 'Scanned Receipt',
      amount: parsedData.parsedAmount,
      type: 'expense',
      category: category,
      receiptUrl: parsedData.receiptUrl,
      source_bank_id: actualBankId,
      credit_card_id: actualCcId
    });
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '24px', marginBottom: '24px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ScanLine size={20} color="var(--accent-sapphire)" />
            AI Physical Receipt OCR
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Upload a photo of a physical receipt. Tesseract AI will extract the amount and log the expense.
            </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', background: 'var(--bg-secondary)', padding: '24px', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.2)' }}>
        <input 
          type="file" 
          accept="image/*" 
          capture="environment"
          onChange={handleFileChange} 
          style={{ 
            color: 'var(--text-secondary)',
            background: 'var(--bg-primary)',
            padding: '8px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.1)',
            flex: 1
          }} 
        />
        <button 
          className="btn primary" 
          onClick={handleScan} 
          disabled={!file || status === 'scanning' || scanMutation.isPending}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {status === 'scanning' || scanMutation.isPending ? 'AI Processing...' : 'Scan Receipt'}
        </button>
      </div>

      {status === 'success' && parsedData && (
        <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(59,130,246,0.1)', borderRadius: '12px', border: '1px solid rgba(59,130,246,0.3)' }}>
          <h4 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={16} color="var(--accent-sapphire)" />
              Extraction Successful
          </h4>
          
          <div className="grid-2" style={{ gap: '16px', marginBottom: '16px' }}>
              <div className="field-group">
                  <label>Extracted Amount (₹)</label>
                  <input type="number" className="field-input" value={parsedData.parsedAmount || ''} readOnly style={{ color: 'var(--accent-emerald)', fontWeight: 'bold' }} />
                  {!parsedData.parsedAmount && <span style={{fontSize:'12px', color:'var(--accent-coral)'}}>AI failed to detect amount.</span>}
              </div>
              
              <div className="field-group">
                  <label>Title / Merchant Name</label>
                  <input type="text" className="field-input" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              
              <div className="field-group" style={{ gridColumn: 'span 2' }}>
                  <label>Category</label>
                  <CustomSelect className="field-input" value={category} onChange={e => setCategory(e.target.value)}>
                    <option value="groceries">Groceries & Household</option>
                    <option value="dining">Dining & Entertainment</option>
                    <option value="utilities">Utilities</option>
                    <option value="shopping">Shopping</option>
                    <option value="health">Healthcare</option>
                    <option value="irregular">Irregular/Misc</option>
                  </CustomSelect>
              </div>

              <div className="field-group" style={{ gridColumn: 'span 2' }}>
                  <label>Paid From</label>
                  <CustomSelect required className="field-input" value={sourceBankId} onChange={e => setSourceBankId(e.target.value)}>
                    <option value="" disabled>-- Select Payment Source --</option>
                    <optgroup label="Bank Accounts">
                        {banks.map(b => <option key={b.id} value={b.id}>{b.bankName} (₹{(b.ledgerBalance || 0).toLocaleString('en-IN')})</option>)}
                    </optgroup>
                    {creditCards.length > 0 && (
                        <optgroup label="Credit Cards">
                            {creditCards.map(c => <option key={`cc_${c.id}`} value={`cc_${c.id}`}>{c.name} (Bal: ₹{c.currentBalance})</option>)}
                        </optgroup>
                    )}
                  </CustomSelect>
              </div>
          </div>
          
          <button className="btn primary w-full" onClick={saveTransaction} disabled={!parsedData.parsedAmount || !sourceBankId || saveMutation.isPending}>
              {saveMutation.isPending ? 'Logging Transaction...' : 'Approve & Log Transaction'}
          </button>
        </div>
      )}

      {status === 'error' && (
        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <AlertTriangle size={20} color="var(--accent-coral)" />
          <span style={{ fontSize: '14px', color: 'var(--accent-coral)' }}>{message}</span>
        </div>
      )}
      
      {message && status === 'idle' && (
          <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(16,185,129,0.1)', borderRadius: '8px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <CheckCircle size={20} color="var(--accent-emerald)" />
          <span style={{ fontSize: '14px', color: 'var(--accent-emerald)' }}>{message}</span>
        </div>
      )}
    </div>
  );
}

export default ReceiptScanner;
