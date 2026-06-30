import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, AlertTriangle, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function SystemSentinelBanner() {
    const { data, isLoading, isError } = useQuery({
        queryKey: ['system-reconciliation'],
        queryFn: () => fetch('/api/system/reconciliation').then(res => {
            if (!res.ok) throw new Error("Failed to fetch reconciliation");
            return res.json();
        }),
        refetchInterval: 30000, // Poll every 30 seconds
    });

    if (isLoading || isError) return null;

    const imbalancedCount = data?.imbalancedCount || 0;
    if (imbalancedCount === 0) return null; // System is healthy

    const imbalancedRows = data?.data || [];

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -50, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                style={{
                    position: 'relative',
                    zIndex: 100,
                    margin: '0 0 24px 0',
                    background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.15) 0%, rgba(244, 63, 94, 0.05) 100%)',
                    border: '1px solid rgba(244, 63, 94, 0.3)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '16px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    boxShadow: '0 8px 32px rgba(244, 63, 94, 0.1)'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    <div style={{
                        background: 'rgba(244, 63, 94, 0.2)',
                        padding: '10px',
                        borderRadius: '50%',
                        color: 'var(--accent-coral)'
                    }}>
                        <ShieldAlert size={24} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <h3 style={{ margin: '0 0 4px 0', color: 'var(--accent-coral)', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AlertTriangle size={16} />
                            System Integrity Warning: Ledger Imbalance Detected
                        </h3>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5' }}>
                            The automated double-entry accounting audit has detected <strong>{imbalancedCount}</strong> transaction{imbalancedCount > 1 ? 's' : ''} where Debits do not equal Credits. 
                            This usually happens due to incomplete manual ledger entries. Please review and correct the following transactions to ensure your portfolio metrics remain accurate.
                        </p>
                    </div>
                </div>

                <div style={{
                    background: 'rgba(10, 11, 20, 0.4)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(244, 63, 94, 0.1)',
                    padding: '12px',
                    maxHeight: '150px',
                    overflowY: 'auto'
                }}>
                    {imbalancedRows.map(row => (
                        <div key={row.transaction_id} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 12px',
                            borderBottom: '1px solid rgba(244, 63, 94, 0.05)',
                            fontSize: '13px'
                        }}>
                            <div>
                                <strong style={{ color: 'var(--text-primary)' }}>{row.title}</strong>
                                <span style={{ color: 'var(--text-muted)', marginLeft: '8px', fontSize: '12px' }}>{row.date}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontFamily: 'monospace' }}>
                                <span style={{ color: 'var(--accent-sapphire)' }}>Dr: {Number(row.total_debit || 0).toLocaleString('en-IN')}</span>
                                <span style={{ color: 'var(--text-muted)' }}>|</span>
                                <span style={{ color: 'var(--accent-emerald)' }}>Cr: {Number(row.total_credit || 0).toLocaleString('en-IN')}</span>
                                <span style={{ color: 'var(--accent-coral)', fontWeight: 'bold' }}>Diff: {Math.abs(Number(row.total_debit || 0) - Number(row.total_credit || 0)).toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

export default SystemSentinelBanner;
