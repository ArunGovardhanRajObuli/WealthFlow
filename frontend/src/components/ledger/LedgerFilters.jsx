import React from 'react';
import { Search, Download, PackageOpen, ChevronDown, ChevronUp } from 'lucide-react';
import StatementImporter from '../StatementImporter';
import ReceiptScanner from '../ReceiptScanner';
import CustomSelect from '../ui/CustomSelect';

export default function LedgerFilters({
    searchTerm,
    setSearchTerm,
    filterType,
    setFilterType,
    filterCategory,
    setFilterCategory,
    uniqueCategories,
    exportToCSV,
    isExporting,
    loading,
    isBanksLoading,
    updateTxnMutation,
    deleteTxnMutation,
    showImportTools,
    setShowImportTools,
    setEditingId,
    setEditFormData,
    setCurrentPage,
    invalidateAllLedgerQueries
}) {
    return (
        <>
            <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: '1 1 250px', position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input 
                        id="ledger-search-input"
                        type="text" 
                        placeholder="Search transactions..." 
                        value={searchTerm}
                        onChange={e => {
                            setEditingId(null);
                            setEditFormData({});
                            setSearchTerm(e.target.value);
                        }}
                        autoComplete="off"
                        aria-label="Search transactions"
                        disabled={updateTxnMutation.isPending || deleteTxnMutation.isPending}
                        style={{ width: '100%', padding: '10px 10px 10px 36px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', opacity: (updateTxnMutation.isPending || deleteTxnMutation.isPending) ? 0.5 : 1 }}
                    />
                </div>
                
                <CustomSelect 
                    value={filterType} 
                    onChange={e => {
                        if (updateTxnMutation.isPending || deleteTxnMutation.isPending) return;
                        setEditingId(null);
                        setEditFormData({});
                        setFilterType(e.target.value);
                        setCurrentPage(1);
                    }}
                    style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', minWidth: '150px', textTransform: 'capitalize' }}
                >
                    <option value="all">All Types</option>
                    <option value="income">Income Only</option>
                    <option value="expense">Expense Only</option>
                    <option value="transfer">Transfer Only</option>
                </CustomSelect>

                <CustomSelect 
                    value={uniqueCategories.includes(filterCategory.startsWith('cat_') ? filterCategory.slice(4) : filterCategory) || filterCategory === 'all' ? filterCategory : 'all'} 
                    onChange={e => {
                        if (updateTxnMutation.isPending || deleteTxnMutation.isPending) return;
                        setEditingId(null);
                        setEditFormData({});
                        setFilterCategory(e.target.value);
                        setCurrentPage(1);
                    }}
                    className="form-control"
                    style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', minWidth: '150px' }}
                >
                    <option value="all">All Categories</option>
                    {uniqueCategories.map(c => <option key={`cat-${c}`} value={`cat_${c}`} style={{textTransform:'capitalize'}}>{c === '' ? 'Uncategorized' : c}</option>)}
                </CustomSelect>

                <button 
                    onClick={exportToCSV} 
                    disabled={isExporting || loading || isBanksLoading || updateTxnMutation.isPending || deleteTxnMutation.isPending}
                    style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: isExporting ? 'var(--text-muted)' : 'var(--text-secondary)', cursor: isExporting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '13px' }}
                    title="Export filtered transactions as CSV"
                >
                    <Download size={14} /> {isExporting ? 'Exporting...' : 'Export CSV'}
                </button>
            </div>

            <div style={{ marginBottom: '24px' }}>
                <button 
                    onClick={() => setShowImportTools(!showImportTools)}
                    style={{ padding: '12px 20px', background: 'var(--bg-secondary)', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '14px', width: '100%', justifyContent: 'space-between', transition: 'all 0.2s' }}
                    onMouseOver={e => e.currentTarget.style.borderColor = 'var(--text-muted)'}
                    onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <PackageOpen size={16} /> Automated Entry Tools (CSV Importer & Receipt OCR)
                    </div>
                    {showImportTools ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                
                {showImportTools && (
                    <div className="animate-fade-in" style={{ marginTop: '16px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <StatementImporter onImportSuccess={() => { setEditingId(null); setEditFormData({}); invalidateAllLedgerQueries(); }} />
                        <ReceiptScanner onScanSuccess={() => { setEditingId(null); setEditFormData({}); invalidateAllLedgerQueries(); }} />
                    </div>
                )}
            </div>
        </>
    );
}
