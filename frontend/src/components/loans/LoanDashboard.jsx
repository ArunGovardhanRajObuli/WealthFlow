import { parseToPaiseBigInt } from '../../utils/bigIntMath';
import React from 'react';
import { Landmark, CalendarClock, Banknote, Sparkles } from 'lucide-react';



export default function LoanDashboard({ metrics, activeCount }) {
  const formatBigIntPaise = (paiseVal) => {
    let absPaiseStr = String(paiseVal).replace(/-/g, '');
    while (absPaiseStr.length < 3) absPaiseStr = '0' + absPaiseStr;
    const whole = absPaiseStr.substring(0, absPaiseStr.length - 2);
    let result = '';
    let count = 0;
    for (let i = whole.length - 1; i >= 0; i--) {
        if (count === 3 || (count > 3 && (count - 3) % 2 === 0)) {
            result = ',' + result;
        }
        result = whole[i] + result;
        count++;
    }
    return result;
  };

  return (
    <div className="stat-grid" role="region" aria-label="Loan portfolio summary">
      <div className="stat-card" style={{'--stat-accent': '#ef4444', '--stat-accent-dim': 'rgba(239,68,68,0.1)', '--stat-color': '#ef4444'}}>
        <div className="stat-card-icon" aria-hidden="true">
          <Landmark size={18} color="#ef4444" />
        </div>
        <div className="stat-card-label">Total Outstanding</div>
        <div className="stat-card-value">₹{formatBigIntPaise(parseToPaiseBigInt(metrics.totalOutstanding))}</div>
        <div className="stat-card-sub">{activeCount} active loan{activeCount !== 1 ? 's' : ''}</div>
      </div>
      <div className="stat-card" style={{'--stat-accent': '#f59e0b', '--stat-accent-dim': 'rgba(245,158,11,0.1)', '--stat-color': '#f59e0b'}}>
        <div className="stat-card-icon" aria-hidden="true">
          <CalendarClock size={18} color="#f59e0b" />
        </div>
        <div className="stat-card-label">Monthly EMI Burden</div>
        <div className="stat-card-value">₹{formatBigIntPaise(parseToPaiseBigInt(metrics.totalEMI))}</div>
      </div>
      <div className="stat-card" style={{'--stat-accent': '#3b82f6', '--stat-accent-dim': 'rgba(59,130,246,0.1)', '--stat-color': '#3b82f6'}}>
        <div className="stat-card-icon" aria-hidden="true">
          <Banknote size={18} color="#3b82f6" />
        </div>
        <div className="stat-card-label">Total Prepaid</div>
        <div className="stat-card-value">₹{formatBigIntPaise(parseToPaiseBigInt(metrics.totalPrepaid))}</div>
      </div>
      <div className="stat-card" style={{'--stat-accent': '#10b981', '--stat-accent-dim': 'rgba(16,185,129,0.1)', '--stat-color': '#10b981'}}>
        <div className="stat-card-icon" aria-hidden="true">
          <Sparkles size={18} color="#10b981" />
        </div>
        <div className="stat-card-label">Interest Destroyed</div>
        <div className="stat-card-value">₹{formatBigIntPaise(parseToPaiseBigInt(metrics.totalInterestSaved))}</div>
      </div>
    </div>
  );
}
