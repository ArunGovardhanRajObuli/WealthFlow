import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, ShieldAlert, Key, Loader } from 'lucide-react';

export default function AuthLock({ onUnlock }) {
  const [loading, setLoading] = useState(true);
  const [setupMode, setSetupMode] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/auth/check-setup')
      .then(res => res.json())
      .then(data => {
        if (!data.isSetup) {
          setSetupMode(true);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Auth check failed:", err);
        setError("Failed to connect to secure backend.");
        setLoading(false);
      });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    
    try {
      const endpoint = setupMode ? '/api/auth/setup' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }
      
      if (data.token) {
        sessionStorage.setItem('session_token', data.token);
      }
      
      onUnlock();
    } catch (err) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-main)' }}>
        <Loader className="spin" size={32} style={{ color: 'var(--accent-sapphire)' }} />
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: 'var(--bg-main)',
      color: 'var(--text-primary)',
      position: 'relative'
    }}>
      <div className="ambient-orbs" aria-hidden="true">
        <div className="orb orb-blue" style={{ width: '400px', height: '400px', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', opacity: 0.15 }} />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative',
          zIndex: 10
        }}
      >
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(130, 140, 220, 0.1)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: '24px',
          border: '1px solid rgba(130, 140, 220, 0.2)'
        }}>
          <Shield size={32} style={{ color: 'var(--accent-sapphire)' }} />
        </div>

        <h2 className="text-gradient" style={{ marginBottom: '8px', fontSize: '24px' }}>
          {setupMode ? "Set Master Password" : "App Locked"}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '32px', lineHeight: 1.5 }}>
          {setupMode 
            ? "Create a secure master password to encrypt your local financial data." 
            : "Enter your master password to access your financial dashboard."}
        </p>

        {error && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid rgba(244, 63, 94, 0.2)',
            color: 'var(--accent-coral)',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            marginBottom: '20px'
          }}>
            <ShieldAlert size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ position: 'relative' }}>
            <Key size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="password" 
              className="field-input"
              placeholder={setupMode ? "Enter new password" : "Master password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              style={{ paddingLeft: '44px', width: '100%' }}
              disabled={isSubmitting}
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '12px', justifyContent: 'center' }}
            disabled={!password || isSubmitting}
          >
            {isSubmitting ? 'Verifying...' : setupMode ? 'Secure App' : 'Unlock'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
