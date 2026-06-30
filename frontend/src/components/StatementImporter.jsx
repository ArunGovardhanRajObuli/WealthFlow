import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UploadCloud, CheckCircle, AlertTriangle } from 'lucide-react';
import CustomSelect from './ui/CustomSelect';

function StatementImporter() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [sourceBankId, setSourceBankId] = useState('');
  const [status, setStatus] = useState('idle'); // idle, uploading, success, error
  const [message, setMessage] = useState('');

  const { data: recData } = useQuery({ queryKey: ['reconciliation'], queryFn: () => fetch('/api/reconciliation').then(res => res.json()) });
  const banks = recData?.banks || [];

  const { data: ccRes } = useQuery({ queryKey: ['credit-cards'], queryFn: () => fetch('/api/credit-cards').then(res => res.json()) });
  const creditCards = ccRes?.data || [];

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setStatus('idle');
      setMessage('');
    }
  };

  const importMut = useMutation({
    mutationFn: async (formData) => {
      const response = await fetch('/api/import-csv', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to upload');
      return data;
    },
    onSuccess: (data) => {
      setStatus('success');
      setMessage(data.message);
      queryClient.invalidateQueries(); // Refresh everything after mass import
    },
    onError: (error) => {
      setStatus('error');
      setMessage(error.message);
    }
  });

  const handleUpload = () => {
    if (!file || !sourceBankId) {
      setStatus('error');
      setMessage('Please select a CSV file and a bank account.');
      return;
    }
    setStatus('uploading');

    const isCreditCard = sourceBankId.startsWith('cc_');
    const actualBankId = isCreditCard ? '' : sourceBankId;
    const actualCcId = isCreditCard ? sourceBankId.replace('cc_', '') : '';

    const formData = new FormData();
    formData.append('csvFile', file);
    if (actualBankId) formData.append('source_bank_id', actualBankId);
    if (actualCcId) formData.append('credit_card_id', actualCcId);
    
    importMut.mutate(formData);
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '24px', marginBottom: '32px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UploadCloud size={20} color="var(--accent-sapphire)" />
          Institutional Bank Statement Importer
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
          Zero manual entry. Upload your HDFC, SBI, or ICICI monthly CSV statement and our ML heuristic engine will automatically parse and categorize your transactions.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', background: 'var(--bg-secondary)', padding: '24px', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.2)', flexWrap: 'wrap' }}>
        <CustomSelect 
          required
          value={sourceBankId}
          onChange={(e) => setSourceBankId(e.target.value)}
          style={{ 
            color: '#fff',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            padding: '8px 12px',
            borderRadius: '6px',
            flex: 1
          }}
        >
          <option value="" disabled>-- Select Statement Source --</option>
          <optgroup label="Bank Accounts">
            {banks.map(b => <option key={b.id} value={b.id}>{b.bankName} (₹{b.ledgerBalance?.toLocaleString('en-IN')})</option>)}
          </optgroup>
          {creditCards.length > 0 && (
            <optgroup label="Credit Cards">
              {creditCards.map(c => <option key={`cc_${c.id}`} value={`cc_${c.id}`}>{c.name} (Bal: ₹{c.currentBalance})</option>)}
            </optgroup>
          )}
        </CustomSelect>
        <input 
          type="file" 
          accept=".csv" 
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
          onClick={handleUpload} 
          disabled={!file || !sourceBankId || status === 'uploading'}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {status === 'uploading' ? 'Parsing...' : 'Upload & Parse'}
        </button>
      </div>

      {status === 'success' && (
        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(16,185,129,0.1)', borderRadius: '8px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <CheckCircle size={20} color="var(--accent-emerald)" />
          <span style={{ fontSize: '14px', color: 'var(--accent-emerald)' }}>{message} Refresh the page to see them in your ledger.</span>
        </div>
      )}

      {status === 'error' && (
        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <AlertTriangle size={20} color="var(--accent-coral)" />
          <span style={{ fontSize: '14px', color: 'var(--accent-coral)' }}>{message}</span>
        </div>
      )}
    </div>
  );
}

export default StatementImporter;
