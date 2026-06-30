import React, { useState, useRef } from 'react';
import { Shield, Calculator, Users, Link, FileText } from 'lucide-react';
import Insurance from './Insurance';
import FamilyEstate from './FamilyEstate';
import HLVCalculator from './HLVCalculator';
import SuccessionPlanner from './SuccessionPlanner';
import DocumentVault from './DocumentVault';

function ProtectionHub() {
  const [activeTab, setActiveTab] = useState('insurance');

  const tabs = [
    { id: 'insurance', label: 'Insurance Policies', icon: <Shield size={16} /> },
    { id: 'hlv', label: 'HLV Calculator', icon: <Calculator size={16} /> },
    { id: 'family', label: 'Family & Estate', icon: <Users size={16} /> },
    { id: 'succession', label: 'Succession Planning', icon: <Link size={16} /> },
    { id: 'vault', label: 'Document Vault', icon: <FileText size={16} /> },
  ];

  const tabRefs = useRef([]);
  const handleTabKeyDown = (e, index) => {
    let newIndex;
    if (e.key === 'ArrowRight') {
      newIndex = (index + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      newIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      newIndex = 0;
    } else if (e.key === 'End') {
      newIndex = tabs.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    setActiveTab(tabs[newIndex].id);
    tabRefs.current[newIndex]?.focus();
  };

  return (
    <div className="protection-hub animate-fade-in">
      <div className="section-header" style={{marginBottom:'24px'}}>
        <div>
          <h2>Protection & Estate Hub</h2>
          <p>Manage life risks, family milestones, and legacy planning.</p>
        </div>
      </div>
      
      <div className="debt-tab-bar" role="tablist" aria-label="Protection & Estate Sections" style={{marginBottom:'32px'}}>
        {tabs.map((t, i) => (
          <button 
            key={t.id}
            ref={el => (tabRefs.current[i] = el)}
            role="tab"
            aria-selected={activeTab === t.id}
            aria-controls={`panel-${t.id}`}
            id={`tab-${t.id}`}
            tabIndex={activeTab === t.id ? 0 : -1}
            onClick={() => setActiveTab(t.id)}
            onKeyDown={(e) => handleTabKeyDown(e, i)}
            className={`debt-tab-btn ${activeTab === t.id ? 'active' : ''}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="tab-contents" id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
        <div style={{ display: activeTab === 'insurance' ? 'block' : 'none' }}><Insurance /></div>
        <div style={{ display: activeTab === 'hlv' ? 'block' : 'none' }}><HLVCalculator /></div>
        <div style={{ display: activeTab === 'family' ? 'block' : 'none' }}><FamilyEstate /></div>
        <div style={{ display: activeTab === 'succession' ? 'block' : 'none' }}><SuccessionPlanner /></div>
        <div style={{ display: activeTab === 'vault' ? 'block' : 'none' }}><DocumentVault /></div>
      </div>
    </div>
  );
}

export default ProtectionHub;
