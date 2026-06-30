import React from 'react';

import { ShieldCheck, Activity, Home, AlertTriangle } from 'lucide-react';

function TaxLimitsTracker({ transactions = [], userAge = 30 }) {
  const [limits, setLimits] = React.useState({ sec80c: 0, sec80d: 0, sec24b: 0, sec80ccd: 0, sec80tta: 0 });

  React.useEffect(() => {
    let total80c = 0;
    let total80d_insurance = 0;
    let total80d_checkup = 0;
    let total24b = 0;
    let total80ccd = 0;

    // Calculate 80TTA / 80TTB from Income side
    let savingsInterest = 0;
    let fdInterest = 0;
    transactions.filter(tx => tx.type === 'income' && tx.category === 'interest').forEach(tx => {
        const amt = Number(tx.amount || 0);
        const title = (tx.title || '').toLowerCase();
        if (title.includes('fd') || title.includes('fixed')) {
            fdInterest += amt;
        } else {
            savingsInterest += amt;
        }
    });

    let total80tta;
    if (userAge >= 60) {
        total80tta = savingsInterest + fdInterest;
    } else {
        total80tta = savingsInterest;
    }

    const deductions = transactions.filter(tx => tx.type === 'expense');

    deductions.forEach(tx => {
      const amt = Number(tx.amount || 0);
      const title = (tx.title || '').toLowerCase();
      
      if (tx.category === 'nps_investment' || title.includes('nps') || title.includes('national pension')) {
          // NPS contributions go to 80CCD(1B) up to 50k, rest overflows to 80C
          total80ccd += amt;
      } else if (tx.category === 'donation' || title.includes('donation') || title.includes('charity') || title.includes('pm cares')) {
          // 80G donations are tracked separately in TaxVault, ignoring here for limits tracker since they are dynamic
      } else if (tx.category === 'insurance') {
          if (title.includes('checkup') || title.includes('preventive')) {
              total80d_checkup += amt;
          } else if (title.includes('health') || title.includes('medical') || title.includes('mediclaim')) {
              total80d_insurance += amt;
          } else if (title.includes('life') || title.includes('term')) {
              total80c += amt;
          } else if (tx.isTaxDeductible === 1) {
              total80c += amt; 
          }
      } else if (tx.category === 'loan') {
          if (title.includes('home') || title.includes('housing')) {
              if (title.includes('principal')) {
                  total80c += amt;
              } else if (title.includes('interest')) {
                  total24b += amt;
              } else {
                  // Approximate EMI split: 20% principal (80C), 80% interest (24b)
                  total80c += amt * 0.20;
                  total24b += amt * 0.80;
              }
          } else if (tx.isTaxDeductible === 1) {
              total80c += amt;
          }
      } else if (tx.category === 'fd_investment') {
          if (title.includes('tax') || tx.isTaxDeductible === 1) {
              total80c += amt;
          }
      } else if (tx.category === 'investment') {
          if (title.includes('elss') || title.includes('ppf') || title.includes('epf') || tx.isTaxDeductible === 1) {
              total80c += amt;
          }
      } else if (tx.category === 'medical' || tx.category === 'health' || title.includes('medical') || title.includes('hospital') || title.includes('pharmacy') || title.includes('surgery')) {
          if (tx.isTaxDeductible === 1) {
              total80d_insurance += amt;
          }
      } else if (tx.category === 'rent' || title.includes('rent')) {
          // Handled via HRA, ignore in limits tracker
      } else if (tx.isTaxDeductible === 1) {
          total80c += amt;
      }
    });
    
    // Handle NPS overflow to 80C
    if (total80ccd > 50000) {
        total80c += (total80ccd - 50000);
        total80ccd = 50000;
    }

    const allowedCheckup = Math.min(total80d_checkup, 5000);
    const total80d = total80d_insurance + allowedCheckup;

    setLimits({ sec80c: total80c, sec80d: total80d, sec24b: total24b, sec80ccd: total80ccd, sec80tta: total80tta });
  }, [transactions, userAge]);

  const max80D = userAge >= 60 ? 100000 : 75000;
  const max80TTA = userAge >= 60 ? 50000 : 10000;
  
  const progress80c = Math.min((limits.sec80c / 150000) * 100, 100);
  const progress80d = Math.min((limits.sec80d / max80D) * 100, 100);
  const progress24b = Math.min((limits.sec24b / 200000) * 100, 100);
  const progress80tta = Math.min((limits.sec80tta / max80TTA) * 100, 100);

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '24px', marginBottom: '32px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={20} color="var(--accent-emerald)" />
          Tax Exemption Headroom (Old Regime)
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
          Track your maximum allowable deductions under Sections 80C, 80D, and 24(b).
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* 80C */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Sec 80C (EPF, PPF, ELSS, Life)</span>
            <span style={{ fontSize: '14px', color: progress80c === 100 ? 'var(--accent-emerald)' : 'var(--text-secondary)' }}>
              ₹{Math.round(limits.sec80c).toLocaleString('en-IN')} / ₹1,50,000
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress80c}%`, background: progress80c === 100 ? 'var(--accent-emerald)' : 'var(--accent-sapphire)' }}></div>
          </div>
          {progress80c < 100 && (
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Invest ₹{(150000 - limits.sec80c).toLocaleString('en-IN')} more to max out.
            </p>
          )}
        </div>

        {/* 80D */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Sec 80D (Health Insurance)</span>
            <span style={{ fontSize: '14px', color: progress80d === 100 ? 'var(--accent-emerald)' : 'var(--text-secondary)' }}>
              ₹{Math.round(limits.sec80d).toLocaleString('en-IN')} / ₹{max80D.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress80d}%`, background: progress80d === 100 ? 'var(--accent-emerald)' : 'var(--accent-sapphire)' }}></div>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
            <strong>Max ₹{userAge >= 60 ? '50k' : '25k'} for self</strong>, plus ₹50k for senior parents.
          </p>
          {limits.sec80d > (userAge >= 60 ? 50000 : 25000) && limits.sec80d <= max80D && (
            <p style={{ fontSize: '11px', color: 'var(--accent-coral)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AlertTriangle size={12}/> Verify if excess premium is for senior parents. Your personal limit is already capped!
            </p>
          )}
        </div>

        {/* 24b */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Sec 24(b) (Home Loan Interest)</span>
            <span style={{ fontSize: '14px', color: progress24b === 100 ? 'var(--accent-emerald)' : 'var(--text-secondary)' }}>
              ₹{Math.round(limits.sec24b).toLocaleString('en-IN')} / ₹2,00,000
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress24b}%`, background: progress24b === 100 ? 'var(--accent-emerald)' : '#f59e0b' }}></div>
          </div>
        </div>

        {/* 80CCD(1B) NPS */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Sec 80CCD(1B) (NPS)</span>
            <span style={{ fontSize: '14px', color: Math.min((limits.sec80ccd / 50000) * 100, 100) === 100 ? 'var(--accent-emerald)' : 'var(--text-secondary)' }}>
              ₹{Math.round(limits.sec80ccd).toLocaleString('en-IN')} / ₹50,000
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${Math.min((limits.sec80ccd / 50000) * 100, 100)}%`, background: Math.min((limits.sec80ccd / 50000) * 100, 100) === 100 ? 'var(--accent-emerald)' : '#8b5cf6' }}></div>
          </div>
        </div>

        {/* 80TTA / 80TTB */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Sec {userAge >= 60 ? '80TTB' : '80TTA'} (Interest)</span>
            <span style={{ fontSize: '14px', color: progress80tta === 100 ? 'var(--accent-emerald)' : 'var(--text-secondary)' }}>
              ₹{Math.round(limits.sec80tta).toLocaleString('en-IN')} / ₹{max80TTA.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress80tta}%`, background: progress80tta === 100 ? 'var(--accent-emerald)' : '#10b981' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TaxLimitsTracker;
