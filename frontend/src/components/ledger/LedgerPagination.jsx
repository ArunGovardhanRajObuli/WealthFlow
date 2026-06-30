import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function LedgerPagination({
    currentPage,
    totalPages,
    setCurrentPage,
    showingStart,
    showingEnd,
    totalCount,
    setEditingId,
    setEditFormData,
    isPending
}) {
    if (totalPages <= 1 && totalCount === 0) return null;

    return (
        <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                Showing {showingStart} to {showingEnd} of {totalCount} entries
            </div>
            
            {totalPages > 1 && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button 
                        onClick={() => {
                            if (isPending) return;
                            setEditingId(null);
                            setEditFormData({});
                            setCurrentPage(p => Math.max(1, p - 1));
                        }}
                        disabled={currentPage === 1 || isPending}
                        style={{ padding: '8px', background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '6px', color: (currentPage === 1 || isPending) ? 'var(--text-muted)' : 'var(--text-color)', cursor: (currentPage === 1 || isPending) ? 'not-allowed' : 'pointer' }}
                        aria-label="Previous Page"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span style={{ fontSize: '14px', fontWeight: 500, margin: '0 8px' }}>Page {currentPage} of {totalPages}</span>
                    <button 
                        onClick={() => {
                            if (isPending) return;
                            setEditingId(null);
                            setEditFormData({});
                            setCurrentPage(p => Math.min(totalPages, p + 1));
                        }}
                        disabled={currentPage === totalPages || isPending}
                        style={{ padding: '8px', background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '6px', color: (currentPage === totalPages || isPending) ? 'var(--text-muted)' : 'var(--text-color)', cursor: (currentPage === totalPages || isPending) ? 'not-allowed' : 'pointer' }}
                        aria-label="Next Page"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </div>
    );
}
