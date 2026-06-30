import React, { useState, useEffect } from 'react';
import { DownloadCloud, ShieldCheck, Database, HardDrive, Lock, Save, Trash2, AlertTriangle, Eye, Clock, FolderOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import ConfirmationModal from './ConfirmationModal';
import CustomSelect from './ui/CustomSelect';

export default function Settings() {
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [settings, setSettings] = useState({
      sentinel_cibil_threshold: '0.3',
      sentinel_anomaly_multiplier: '1.4',
      sentinel_anomaly_absolute: '5000',
      backup_schedule: 'disabled',
      backup_location: ''
  });

  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState('');

  useEffect(() => {
      fetchSettings();
  }, []);

  const fetchSettings = async () => {
      try {
          const res = await fetch('/api/settings');
          const data = await res.json();
          if (data.data) {
              setSettings(prev => ({ ...prev, ...data.data }));
          }
      } catch (err) {
          console.error("Failed to load settings", err);
      }
  };

  const handleChange = (e) => {
      const { name, value } = e.target;
      setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveSettings = async () => {
      setIsSaving(true);
      try {
          await fetch('/api/settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(settings)
          });
          alert('Settings saved successfully.');
      } catch (err) {
          console.error(err);
          alert('Failed to save settings.');
      } finally {
          setIsSaving(false);
      }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const a = document.createElement('a');
      a.href = '/api/export';
      a.download = `wealthflow-export-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      alert("Failed to export data.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleWipeData = async () => {
      if (wipeConfirmText !== 'DELETE') {
          alert('You must type DELETE to confirm.');
          return;
      }
      try {
          await fetch('/api/settings/wipe', { method: 'POST' });
          alert('All data has been wiped.');
          setIsWipeModalOpen(false);
          window.location.reload();
      } catch (err) {
          console.error(err);
          alert('Failed to wipe data.');
      }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="page-container" style={{ paddingBottom: '60px' }}>
      <div className="section-header" style={{ marginBottom: '32px' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldCheck size={24} className="text-emerald" /> Data Sovereignty & Settings</h2>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>Manage your wealth data, privacy, and system configurations.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Sentinel Configuration */}
          <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}><Eye size={20} className="text-sapphire" /> Sentinel Strictness</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px', maxWidth: '600px', lineHeight: 1.6 }}>
                  Configure the thresholds that trigger the autonomous auditing engine.
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', maxWidth: '700px' }}>
                  <div className="field-group">
                      <label>CIBIL Score Threat Threshold</label>
                      <input 
                          type="number" 
                          step="0.05"
                          name="sentinel_cibil_threshold" 
                          className="field-input" 
                          value={settings.sentinel_cibil_threshold} 
                          onChange={handleChange} 
                      />
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>Ratio of credit limit used before alerting (e.g., 0.3 = 30%).</span>
                  </div>
                  
                  <div className="field-group">
                      <label>Anomaly Absolute Minimum (₹)</label>
                      <input 
                          type="number" 
                          name="sentinel_anomaly_absolute" 
                          className="field-input" 
                          value={settings.sentinel_anomaly_absolute} 
                          onChange={handleChange} 
                      />
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>Minimum absolute over-spend to trigger anomaly.</span>
                  </div>
                  
                  <div className="field-group">
                      <label>Anomaly Multiplier</label>
                      <input 
                          type="number" 
                          step="0.1"
                          name="sentinel_anomaly_multiplier" 
                          className="field-input" 
                          value={settings.sentinel_anomaly_multiplier} 
                          onChange={handleChange} 
                      />
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>Multiplier over historical average (e.g., 1.4 = 40% higher).</span>
                  </div>
              </div>
          </div>

          {/* Automated Backups */}
          <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}><Clock size={20} className="text-sapphire" /> Automated Backups</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px', maxWidth: '600px', lineHeight: 1.6 }}>
                  Set up automatic local backups of your SQLite database.
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', maxWidth: '700px' }}>
                  <div className="field-group">
                      <label>Backup Schedule</label>
                      <CustomSelect name="backup_schedule" className="field-input" value={settings.backup_schedule} onChange={handleChange}>
                          <option value="disabled">Disabled</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                      </CustomSelect>
                  </div>
                  <div className="field-group">
                      <label>Backup Location (Absolute Path)</label>
                      <div style={{ position: 'relative' }}>
                          <FolderOpen size={16} className="text-muted" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                          <input 
                              type="text" 
                              name="backup_location" 
                              className="field-input" 
                              style={{ paddingLeft: '36px' }}
                              value={settings.backup_location} 
                              onChange={handleChange} 
                              placeholder="C:\Backups\Finance"
                          />
                      </div>
                  </div>
              </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '10px', marginBottom: '20px' }}>
              <button className="btn btn-primary" style={{ padding: '12px 32px', display: 'flex', gap: '8px', alignItems: 'center' }} onClick={handleSaveSettings} disabled={isSaving}>
                  <Save size={18} /> {isSaving ? 'Saving...' : 'Save Configuration'}
              </button>
          </div>

          {/* Data Export */}
          <div className="glass-panel" style={{ padding: '24px' }}>
             <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}><Database size={20} className="text-sapphire" /> Full Data Export</h3>
             <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px', maxWidth: '600px', lineHeight: 1.6 }}>
                 Your financial data belongs to you. You can export a complete snapshot of your entire database, along with human-readable CSV files of your ledgers and transactions, at any time.
             </p>
             
             <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
                 <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                     <HardDrive size={18} className="text-muted" />
                     <div>
                         <div style={{ fontSize: '13px', fontWeight: 600 }}>finance.sqlite</div>
                         <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Raw Relational DB</div>
                     </div>
                 </div>
                 <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                     <Lock size={18} className="text-emerald" />
                     <div>
                         <div style={{ fontSize: '13px', fontWeight: 600 }}>AES-256 Secured</div>
                         <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sensitive Fields Encrypted</div>
                     </div>
                 </div>
             </div>
    
             <button 
                 className="btn btn-outline" 
                 style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }} 
                 onClick={handleExportData}
                 disabled={isExporting}
             >
                 <DownloadCloud size={18} />
                 {isExporting ? 'Packaging Archive...' : 'Export My Data (.zip)'}
             </button>
          </div>

          {/* Danger Zone */}
          <div className="glass-panel" style={{ padding: '24px', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'linear-gradient(145deg, rgba(30,30,36,0.95), rgba(239, 68, 68, 0.05))' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#ef4444' }}>
                  <AlertTriangle size={20} /> Danger Zone
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px', maxWidth: '600px', lineHeight: 1.6 }}>
                  Permanently delete all your ledgers, transactions, and configurations. This action cannot be undone and will restore the app to its factory state.
              </p>
              
              <button 
                  className="btn" 
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }} 
                  onClick={() => { setWipeConfirmText(''); setIsWipeModalOpen(true); }}
              >
                  <Trash2 size={18} /> Wipe All Data
              </button>
          </div>
      </div>

      {/* Wipe Confirmation Modal */}
      <ConfirmationModal
          isOpen={isWipeModalOpen}
          title="Wipe All Data"
          message={
              <div>
                  <p style={{ marginBottom: '16px' }}>Are you absolutely sure you want to wipe all your data? This action is irreversible.</p>
                  <p style={{ marginBottom: '8px', fontSize: '13px' }}>Please type <strong>DELETE</strong> to confirm.</p>
                  <input 
                      type="text" 
                      className="field-input" 
                      value={wipeConfirmText}
                      onChange={(e) => setWipeConfirmText(e.target.value)}
                      placeholder="DELETE"
                  />
              </div>
          }
          confirmText="Permanently Delete Data"
          confirmStyle="danger"
          onConfirm={handleWipeData}
          onCancel={() => setIsWipeModalOpen(false)}
      />

    </motion.div>
  );
}
