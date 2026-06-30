import React, { useState } from 'react';
import { Home, Calculator } from 'lucide-react';
import CustomSelect from './ui/CustomSelect';

function HraCalculator() {
  const [basicSalary, setBasicSalary] = useState(50000);
  const [daAmount, setDaAmount] = useState(0);
  const [commission, setCommission] = useState(0);
  const [hraReceived, setHraReceived] = useState(25000);
  const [rentPaid, setRentPaid] = useState(20000);
  const [isMetro, setIsMetro] = useState(true);
  const [months, setMonths] = useState(12);
  const [regime, setRegime] = useState('old');

  // Salary for HRA = Basic + DA (forming part of retirement) + Commission (fixed % of turnover)
  // MUST be calculated on a periodic/monthly basis to prevent illegal cross-period offset
  const eligibleSalary = basicSalary + daAmount + commission;

  // Exemption is MIN of:
  // 1. Actual HRA received
  // 2. 50% (metro) or 40% (non-metro) of Eligible Salary
  // 3. Rent paid - 10% of Eligible Salary
  
  const actualHra = hraReceived;
  const salaryPercent = isMetro ? eligibleSalary * 0.50 : eligibleSalary * 0.40;
  const rentMinus10Percent = Math.max(0, rentPaid - (eligibleSalary * 0.10));

  let exemption = Math.round(Math.min(actualHra, salaryPercent, rentMinus10Percent));
  
  // Section 115BAC: HRA Exemption is explicitly disallowed under the New Tax Regime
  if (regime === 'new') {
      exemption = 0;
  }
  
  const taxableHra = Math.round(Math.max(0, actualHra - exemption));
  
  const totalExemption = exemption * months;
  const totalTaxable = taxableHra * months;

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '24px', marginBottom: '32px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Home size={20} color="var(--accent-sapphire)" />
          HRA Exemption Calculator (Sec 10(13A))
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
          Optimize your rent allowance deductions.
        </p>
      </div>

      <div className="grid-2" style={{ gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="field-group">
            <label>Tax Regime</label>
            <CustomSelect className="field-input" value={regime} onChange={e => setRegime(e.target.value)} style={{background: 'var(--bg-secondary)', color: 'var(--text-primary)'}}>
              <option value="old">Old Tax Regime</option>
              <option value="new">New Tax Regime</option>
            </CustomSelect>
            {regime === 'new' && <span style={{fontSize: '12px', color: 'var(--accent-coral)', marginTop:'4px', display:'block'}}>*Sec 115BAC: HRA Exemption is NOT available under the New Regime.</span>}
          </div>
          <div className="field-group">
            <label>Basic Salary (Per Month) (₹)</label>
            <span style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block'}}>The fixed base component of your salary (found on your payslip). Do not include any other allowances.</span>
            <input type="number" className="field-input" value={basicSalary} onChange={e => setBasicSalary(Number(e.target.value))} />
          </div>
          <div className="field-group">
            <label>Dearness Allowance (DA) (Per Month) (₹)</label>
            <span style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block'}}>Include only if it forms part of retirement benefits. (Leave as 0 for most private sector employees).</span>
            <input type="number" className="field-input" value={daAmount} onChange={e => setDaAmount(Number(e.target.value))} />
          </div>
          <div className="field-group">
            <label>Commission (Per Month) (₹)</label>
            <span style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block'}}>Only include if it is received as a fixed percentage of sales turnover achieved by you. (Usually 0).</span>
            <input type="number" className="field-input" value={commission} onChange={e => setCommission(Number(e.target.value))} />
          </div>
          <div className="field-group">
            <label>HRA Received (Per Month) (₹)</label>
            <span style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block'}}>The exact House Rent Allowance paid by your employer as per your payslip.</span>
            <input type="number" className="field-input" value={hraReceived} onChange={e => setHraReceived(Number(e.target.value))} />
          </div>
          <div className="field-group">
            <label>Rent Paid (Per Month) (₹)</label>
            <span style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block'}}>The actual rent you pay out of pocket to your landlord each month.</span>
            <input type="number" className="field-input" value={rentPaid} onChange={e => setRentPaid(Number(e.target.value))} />
          </div>
          <div className="field-group">
            <label>Duration in this state (Months)</label>
            <span style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block'}}>Number of months in the financial year you paid this rent (Max 12).</span>
            <input type="number" className="field-input" value={months} min="1" max="12" onChange={e => setMonths(Number(e.target.value))} />
          </div>
          <div className="field-group">
             <label style={{display:'flex', alignItems:'center', gap:'8px', cursor:'pointer'}}>
               <input type="checkbox" checked={isMetro} onChange={e => setIsMetro(e.target.checked)} style={{accentColor:'var(--accent-sapphire)'}}/>
               <div style={{display:'flex', flexDirection:'column'}}>
                 <span>I live in Delhi, Mumbai, Kolkata, or Chennai (50% limit)</span>
                 <span style={{fontSize: '11px', color: 'var(--accent-coral)'}}>*Bangalore, Hyderabad, Pune etc. are NON-METRO (40%) under IT Act</span>
               </div>
             </label>
          </div>
        </div>

        <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '12px' }}>
          <h4 style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>Calculation Breakdown</h4>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize:'13px' }}>
            <span>1. Actual HRA</span>
            <span>₹{actualHra.toLocaleString('en-IN')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize:'13px' }}>
            <span>2. {isMetro ? '50%' : '40%'} of Eligible Salary</span>
            <span>₹{salaryPercent.toLocaleString('en-IN')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize:'13px' }}>
            <span>3. Rent - 10% Eligible Salary</span>
            <span>₹{rentMinus10Percent.toLocaleString('en-IN')}</span>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>Total Exempt HRA (for {months} months)</span>
            <span style={{ fontWeight: 700, fontSize: '18px', color: 'var(--accent-emerald)' }}>₹{totalExemption.toLocaleString('en-IN')}</span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-coral)' }}>
            <span style={{ fontWeight: 600 }}>Total Taxable HRA (for {months} months)</span>
            <span style={{ fontWeight: 700, fontSize: '18px' }}>₹{totalTaxable.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HraCalculator;
