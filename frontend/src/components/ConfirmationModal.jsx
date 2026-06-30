import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmationModal({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Confirm', confirmStyle = 'danger', keepOpenOnConfirm = false }) {
    if (!isOpen) return null;

    return createPortal(
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden"
                    style={{ background: '#1e1e24', border: '1px solid #333', borderRadius: '16px', width: '100%', maxWidth: '400px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid #333' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontWeight: 600, fontSize: '18px' }}>
                            {confirmStyle === 'danger' && <AlertTriangle style={{ color: '#ef4444', width: '20px', height: '20px' }} />}
                            {title}
                        </div>
                        <button className="icon-btn" onClick={onCancel}>
                            <X style={{ width: '20px', height: '20px' }} />
                        </button>
                    </div>
                    
                    <div style={{ padding: '24px', color: '#cbd5e1', fontSize: '15px', lineHeight: '1.5' }}>
                        {message}
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px', background: '#1a1a1f', borderTop: '1px solid #333' }}>
                        <button
                            onClick={onCancel}
                            style={{ padding: '8px 16px', borderRadius: '8px', background: 'transparent', border: '1px solid #475569', color: '#cbd5e1', cursor: 'pointer', fontWeight: 500 }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                onConfirm();
                                if (!keepOpenOnConfirm) {
                                    onCancel();
                                }
                            }}
                            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 500, background: confirmStyle === 'danger' ? '#ef4444' : '#10b981' }}
                        >
                            {confirmText}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
}
