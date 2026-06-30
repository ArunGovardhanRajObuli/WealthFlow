import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import SipPortfolio from './investments/SipPortfolio';
import DirectEquity from './investments/DirectEquity';
import SovereignVault from './investments/SovereignVault';

export default function Investments() {
  const navigate = useNavigate();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -20 }}
      className="page-container"
    >
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
         <button className="btn" style={{ padding: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }} onClick={() => navigate('/')}>
             <ArrowLeft size={16} />
         </button>
         <div>
            <h2 style={{ margin: 0 }}>Investment Engine</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>Market-linked analytics, SIPs, Stocks & Sovereign Vaults</p>
         </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
         <SipPortfolio />
         <DirectEquity />
         <SovereignVault />
      </div>
    </motion.div>
  );
}
