import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, CheckCircle, AlertTriangle } from 'lucide-react';
import CustomSelect from './ui/CustomSelect';

function AisReconciliation() {
  const now = new Date();
  const defaultFyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const [selectedFyStartYear, setSelectedFyStartYear] = useState(defaultFyStartYear);

  const fyStart = `${selectedFyStartYear}-04-01`;
  const fyEnd = `${selectedFyStartYear + 1}-03-31`;

  const [aisValues, setAisValues] = useState({ dividends: '', interest: '', rent: '', salary: '' });

  useEffect(() => {
    setAisValues({ dividends: '', interest: '', rent: '', salary: '' });
  }, [selectedFyStartYear]);

  const { data: txnData, isFetching } = useQuery({
    queryKey: ['transactions', fyStart, fyEnd],
    queryFn: async () => {
      const res = await fetch(`/api/transactions?limit=1000&startDate=${fyStart}&endDate=${fyEnd}`);
      if (!res.ok) throw new Error('Failed to load transactions');
      return res.json();
    }
  });

  const data = React.useMemo(() => {
    let div = 0; let int = 0; let rent = 0; let sal = 0;
    if (txnData?.data) {
      txnData.data.forEach(t => {
         if (t.type !== 'income') return;
         const paise = Math.round((t.amount || 0) * 100);
         const cat = t.category;
         const title = (t.title || '').toLowerCase();
         // Ensure mutual exclusivity to prevent double-counting
         if (cat === 'salary') {
            sal += paise;
         } else if (cat === 'dividend' || /\bdividends?\b/i.test(title)) {
            div += paise;
         } else if (cat === 'rent' || cat === 'rental_income' || /\brent\b/i.test(title)) {
            rent += paise;
         } else if ((cat === 'interest' || /\binterest\b/i.test(title)) && !title.includes('ppf') && !title.includes('epf') && cat !== 'refund') {
            int += paise;
         }
      });
    }
    return { dividends: div / 100, interest: int / 100, rent: rent / 100, salary: sal / 100 };
  }, [txnData]);

  const getStatus = (ledgerVal, aisValRaw) => {
    if (aisValRaw === '' || aisValRaw === null || aisValRaw === undefined) return 'neutral';
    
    // Explicitly parse, ensuring "0" is respected mathematically
    const aisVal = parseFloat(aisValRaw);
    if (isNaN(aisVal)) return 'neutral';
    
    const diff = Math.round(aisVal) - Math.round(ledgerVal);
    if (Math.abs(diff) <= 10) return 'match';
    
    if (diff < 0) return 'warning'; // We have more income logged than AIS (safe, but check)
    return 'danger'; // AIS has more income than we do (High risk of notice!)
  };

  const renderRow = (label, key) => {
    const status = isFetching ? 'neutral' : getStatus(data[key], aisValues[key]);
    
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '16px', alignItems: 'center', padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ fontSize: '14px', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>₹{Math.round(data[key]).toLocaleString('en-IN')}</div>
        <div>
          <input 
            type="number" 
            className="field-input" 
            style={{ padding: '6px', fontSize: '13px' }}
            value={aisValues[key] ?? ''} 
            onChange={e => {
                setAisValues({...aisValues, [key]: e.target.value});
            }} 
            placeholder="AIS Value"
          />
        </div>
        <div style={{ textAlign: 'center' }}>
          {status === 'match' && <CheckCircle size={18} color="var(--accent-emerald)" />}
          {status === 'danger' && <AlertTriangle size={18} color="var(--accent-coral)" title="High risk of notice! AIS shows more income." />}
          {status === 'warning' && <AlertTriangle size={18} color="#f59e0b" title="Ledger has more income than AIS." />}
          {status === 'neutral' && <span style={{ color: 'var(--text-muted)' }}>-</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '24px', marginBottom: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={20} color="var(--text-primary)" />
            AIS / TIS Reconciliation
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Compare your ledger data against the Annual Information Statement downloaded from the IT Portal.
          </p>
        </div>
        <CustomSelect 
          className="field-input" 
          style={{ width: 'auto', padding: '6px 12px', fontSize: '13px', background: 'var(--bg-secondary)', border: '1px solid rgba(255,255,255,0.1)' }}
          value={selectedFyStartYear}
          onChange={e => setSelectedFyStartYear(parseInt(e.target.value, 10))}
        >
          <option value={defaultFyStartYear + 1}>FY {defaultFyStartYear + 1}-{String(defaultFyStartYear + 2).slice(2)}</option>
          <option value={defaultFyStartYear}>FY {defaultFyStartYear}-{String(defaultFyStartYear + 1).slice(2)}</option>
          <option value={defaultFyStartYear - 1}>FY {defaultFyStartYear - 1}-{String(defaultFyStartYear).slice(2)}</option>
          <option value={defaultFyStartYear - 2}>FY {defaultFyStartYear - 2}-{String(defaultFyStartYear - 1).slice(2)}</option>
        </CustomSelect>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '16px', padding: '0 12px 12px 12px', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
        <div>Category</div>
        <div>Ledger Total</div>
        <div>AIS Value</div>
        <div style={{ textAlign: 'center' }}>Status</div>
      </div>

      <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '12px' }}>
        {renderRow('Salary Income', 'salary')}
        {renderRow('Rental Income', 'rent')}
        {renderRow('Dividend Income', 'dividends')}
        {renderRow('Interest (FD/Savings)', 'interest')}
      </div>
      
      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '16px', textAlign: 'center' }}>
        * If AIS value is higher than Ledger Total, you must declare the AIS value in your ITR to avoid scrutiny notices.
      </p>
    </div>
  );
}

export default AisReconciliation;
