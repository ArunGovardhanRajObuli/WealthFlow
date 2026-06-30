import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X } from 'lucide-react';

export default function AlertModal({ isOpen, message, onClose }) {
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (isOpen && (e.key === 'Escape' || e.key === 'Enter')) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (typeof document === 'undefined') return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden"
                        style={{ background: '#1e1e24', border: '1px solid #333', borderRadius: '16px', width: '100%', maxWidth: '400px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid #333' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontWeight: 600, fontSize: '18px' }}>
                                <AlertCircle style={{ color: 'var(--accent-sapphire, #3b82f6)', width: '20px', height: '20px' }} />
                                Notification
                            </div>
                            <button className="icon-btn" onClick={onClose} style={{background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px'}}>
                                <X style={{ width: '20px', height: '20px' }} />
                            </button>
                        </div>
                        
                        <div style={{ padding: '24px', color: '#e2e8f0', fontSize: '15px', lineHeight: '1.5' }}>
                            {message}
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px', background: '#1a1a1f', borderTop: '1px solid #333' }}>
                            <button
                                onClick={onClose}
                                style={{ padding: '8px 24px', borderRadius: '8px', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600, background: 'var(--accent-sapphire, #3b82f6)' }}
                            >
                                OK
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
