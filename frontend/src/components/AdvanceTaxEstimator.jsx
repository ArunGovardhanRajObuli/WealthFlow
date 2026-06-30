import React, { useState } from 'react';
import { Calendar, AlertTriangle, CheckCircle } from 'lucide-react';

function AdvanceTaxEstimator({ estimatedTax, userAge = 30 }) {
  const [tdsDeducted, setTdsDeducted] = useState(0);
  const [manualSeniorOverride, setManualSeniorOverride] = useState(null);
  const [hasBusinessIncome, setHasBusinessIncome] = useState(false);
  const [isPresumptive, setIsPresumptive] = useState(false);
  const [isResident, setIsResident] = useState(true);

  const isSeniorCitizen = manualSeniorOverride !== null ? manualSeniorOverride : (userAge >= 60);
  
  // Section 288B: Tax liability MUST be rounded to the nearest multiple of 10.
  const rawLiability = Math.max(0, estimatedTax - tdsDeducted);
  const netTaxLiability = Math.round(rawLiability / 10) * 10;
  
  // Section 207: RESIDENT senior citizens WITHOUT business/profession income are exempt.
  // NRIs (Non-Residents) do NOT get this exemption, regardless of age.
  // If `isPresumptive` is true, they mathematically MUST have business income.
  const actuallyHasBusiness = hasBusinessIncome || isPresumptive;
  const isExemptSenior = isResident && isSeniorCitizen && !actuallyHasBusiness;
  const requiresAdvanceTax = !isExemptSenior && netTaxLiability >= 10000;

  // Section 44AD / 44ADA: Presumptive taxation requires ONLY 1 installment (100% by 15 Mar)
  // Section 288B: Installments are amounts payable, must be rounded to nearest 10.
  const installments = isPresumptive ? [
    { date: '15 Mar', cumulativePct: 100, amount: Math.round((netTaxLiability * 1.00) / 10) * 10 }
  ] : [
    { date: '15 Jun', cumulativePct: 15, amount: Math.round((netTaxLiability * 0.15) / 10) * 10 },
    { date: '15 Sep', cumulativePct: 45, amount: Math.round((netTaxLiability * 0.45) / 10) * 10 },
    { date: '15 Dec', cumulativePct: 75, amount: Math.round((netTaxLiability * 0.75) / 10) * 10 },
    { date: '15 Mar', cumulativePct: 100, amount: Math.round((netTaxLiability * 1.00) / 10) * 10 },
  ];

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '24px', marginBottom: '32px', borderLeft: requiresAdvanceTax ? '4px solid #ef4444' : '4px solid #10b981' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={20} color={requiresAdvanceTax ? "var(--accent-coral)" : "var(--accent-emerald)"} />
            Advance Tax & TDS Tracker
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Avoid 234B/234C penalty interest by tracking your quarterly deadlines.
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
           <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>Net Liability</span>
           <span style={{ fontSize: '20px', fontWeight: 700, color: requiresAdvanceTax ? 'var(--accent-coral)' : 'var(--accent-emerald)' }}>
             ₹{Math.round(netTaxLiability).toLocaleString('en-IN')}
           </span>
        </div>
      </div>

      <div className="grid-2" style={{ gap: '24px' }}>
        <div>
          <div className="field-group" style={{ marginBottom: '16px' }}>
            <label>Estimated Annual Tax (₹)</label>
            <input type="number" className="field-input" value={Math.round(estimatedTax)} disabled style={{ opacity: 0.7 }} />
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Auto-calculated from your chosen regime.</p>
          </div>
          <div className="field-group">
            <label>TDS Deducted so far (₹)</label>
            <input type="number" className="field-input" value={tdsDeducted} onChange={e => {
                let val = parseFloat(e.target.value);
                val = isNaN(val) || val < 0 ? 0 : Math.round(val * 100) / 100;
                setTdsDeducted(val);
            }} />
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Enter TDS from Salary, FD Interest, etc. <strong>Do NOT include Advance Tax already paid.</strong></p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                id="residentToggle"
                checked={isResident} 
                onChange={e => setIsResident(e.target.checked)} 
                style={{ accentColor: 'var(--accent-emerald)', cursor: 'pointer' }}
              />
              <label htmlFor="residentToggle" style={{ fontSize: '13px', cursor: 'pointer' }}>Resident of India</label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                id="seniorToggle"
                checked={isSeniorCitizen} 
                onChange={e => setManualSeniorOverride(e.target.checked)} 
                style={{ accentColor: 'var(--accent-emerald)', cursor: 'pointer' }}
              />
              <label htmlFor="seniorToggle" style={{ fontSize: '13px', cursor: 'pointer' }}>Senior Citizen (Age 60+)</label>
            </div>
            
            {isSeniorCitizen && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '24px' }}>
                <input 
                  type="checkbox" 
                  id="businessToggle"
                  checked={hasBusinessIncome} 
                  onChange={e => setHasBusinessIncome(e.target.checked)} 
                  style={{ accentColor: 'var(--accent-emerald)', cursor: 'pointer' }}
                />
                <label htmlFor="businessToggle" style={{ fontSize: '13px', cursor: 'pointer' }}>I have Business/Profession Income</label>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <input 
                type="checkbox" 
                id="presumptiveToggle"
                checked={isPresumptive} 
                onChange={e => setIsPresumptive(e.target.checked)} 
                style={{ accentColor: 'var(--accent-emerald)', cursor: 'pointer' }}
              />
              <label htmlFor="presumptiveToggle" style={{ fontSize: '13px', cursor: 'pointer' }}>I opt for Presumptive Taxation (Sec 44AD / 44ADA)</label>
            </div>
          </div>
          
          {isExemptSenior ? (
             <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(16,185,129,0.1)', borderRadius: '8px', display: 'flex', gap: '12px' }}>
                <CheckCircle size={20} color="var(--accent-emerald)" style={{ flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-primary)' }}>
                  Under Section 207 of the IT Act, resident senior citizens without business income are <strong>exempt</strong> from paying Advance Tax.
                </p>
             </div>
          ) : requiresAdvanceTax ? (
             <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', display: 'flex', gap: '12px' }}>
                <AlertTriangle size={20} color="var(--accent-coral)" style={{ flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-primary)' }}>
                  Your net liability exceeds ₹10,000. You <strong>must</strong> pay Advance Tax in installments to avoid 1% monthly penalty interest.
                </p>
             </div>
          ) : (
             <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(16,185,129,0.1)', borderRadius: '8px', display: 'flex', gap: '12px' }}>
                <CheckCircle size={20} color="var(--accent-emerald)" style={{ flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-primary)' }}>
                  No Advance Tax required. Your TDS covers your liability or liability is below ₹10k.
                </p>
             </div>
          )}
        </div>

        <div>
          <h4 style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>Advance Tax Schedule</h4>
          
          <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(59,130,246,0.1)', borderRadius: '8px', borderLeft: '3px solid #3b82f6' }}>
             <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-primary)' }}>
               <strong>Capital Gains Exception:</strong> If your liability includes late-year Capital Gains or Dividend income, you are only required to pay advance tax in the installments that fall <em>after</em> the income was realized. You will not face penalties for missing earlier targets.
             </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {installments.map((inst, idx) => {
               // Determine if date has passed
               const now = new Date();
               const m = now.getMonth();
               const d = now.getDate();
               const fyCurrentMonth = m >= 3 ? m - 3 : m + 9;
               
               let instMonth = 2; // Default Mar
               if (inst.date === '15 Jun') instMonth = 5;
               else if (inst.date === '15 Sep') instMonth = 8;
               else if (inst.date === '15 Dec') instMonth = 11;
               
               const fyInstMonth = instMonth >= 3 ? instMonth - 3 : instMonth + 9;
               
               const isPast = fyCurrentMonth > fyInstMonth || (fyCurrentMonth === fyInstMonth && d > 15);

               return (
                 <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', opacity: requiresAdvanceTax ? 1 : 0.4, borderLeft: isPast ? '3px solid var(--text-muted)' : '3px solid var(--accent-sapphire)' }}>
                    <div>
                      <strong style={{ display: 'block', fontSize: '14px', color: isPast ? 'var(--text-muted)' : 'inherit', textDecoration: isPast ? 'line-through' : 'none' }}>{inst.date} {isPast && '(Passed)'}</strong>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Target: {inst.cumulativePct}% of Net Liability</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>Cumulative Total</span>
                      <strong style={{ display: 'block', fontSize: '14px', color: isPast ? 'var(--text-muted)' : 'inherit' }}>₹{Math.round(inst.amount).toLocaleString('en-IN')}</strong>
                    </div>
                 </div>
               );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdvanceTaxEstimator;
