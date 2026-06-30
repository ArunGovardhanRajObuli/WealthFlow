import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { parseToPaiseBigInt, formatBigIntPaise } from '../../utils/bigIntMath';
import { motion, AnimatePresence } from 'framer-motion';



export default function DefeatedLoans({ defeatedLoans, formatDate }) {
  const [showDefeated, setShowDefeated] = useState(false);



  if (defeatedLoans.length === 0) return null;

  return (
    <div style={{marginTop:'24px'}} role="region" aria-label="Defeated loans">
      <button onClick={() => setShowDefeated(!showDefeated)} style={{background:'none', border:'none', color:'#10b981', cursor:'pointer', fontSize:'14px', fontWeight:600, display:'flex', alignItems:'center', gap:'6px', marginBottom:'12px'}} aria-expanded={showDefeated}>
        {showDefeated ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />} 🏆 {defeatedLoans.length} Defeated Loan{defeatedLoans.length > 1 ? 's' : ''} 
      </button>
      
      <AnimatePresence>
        {showDefeated && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
              {defeatedLoans.map(loan => (
                <div key={loan.id} style={{padding:'16px', background:'rgba(16,185,129,0.04)', borderRadius:'12px', border:'1px solid rgba(16,185,129,0.15)', marginBottom:'8px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <div>
                    <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                      <span style={{fontWeight:600}}>{loan.title}</span>
                      <span className="urgency-badge paid">✅ PAID OFF</span>
                    </div>
                    <div style={{fontSize:'12px', color:'var(--text-muted)', marginTop:'4px'}}>Principal: ₹{formatBigIntPaise(parseToPaiseBigInt(loan.principalAmount))} · {loan.interestRate}% · {loan.termYears}yr · {formatDate(loan.dueDate)}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:'13px', fontWeight:600, color:'#10b981'}}>₹{formatBigIntPaise(parseToPaiseBigInt(loan.engine.interestSaved))} saved</div>
                    <div style={{fontSize:'11px', color:'var(--text-muted)'}}>{loan.engine.monthsShavedOff}mo early</div>
                  </div>
                </div>
              ))}
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
