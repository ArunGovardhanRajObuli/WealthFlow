import React, { useRef, useCallback } from 'react';
import { BookOpen, Calculator, Landmark, ArrowRightLeft } from 'lucide-react';
import BankReconciliation from './BankReconciliation';
import Budgets from './Budgets';
import ConfirmationModal from './ConfirmationModal';
import DoubleEntryExplorer from './DoubleEntryExplorer';
import { useLedgerState } from '../hooks/useLedgerState';
import LedgerFilters from './ledger/LedgerFilters';
import LedgerTable from './ledger/LedgerTable';
import LedgerPagination from './ledger/LedgerPagination';

const isTaxDeductibleTrue = (val) => val === true || val === 1 || String(val) === 'true' || String(val) === '1';

export default function Ledger() {
    const state = useLedgerState();
    const tabRefs = useRef([]);

    const {
        transactions, loading, isFetching, banks, isBanksLoading, bankNameMap, getBankName,
        uniqueCategories, totalCount, totalPages, showingStart, showingEnd,
        searchTerm, setSearchTerm, debouncedSearch, filterType, setFilterType,
        filterCategory, setFilterCategory, sortConfig, setSortConfig,
        currentPage, setCurrentPage, editingId, setEditingId, editFormData, setEditFormData,
        isExporting, setIsExporting, showImportTools, setShowImportTools,
        confirmDelete, setConfirmDelete, activeTab, setActiveTab,
        invalidateAllLedgerQueries, updateTxnMutation, deleteTxnMutation, error
    } = state;

    const getSplitStringForExport = useCallback((txn) => {
        if ((txn.split_amount == null || txn.split_amount === '') && (txn.split_percent == null || txn.split_percent === '')) return '';
        const jointBank = txn.joint_bank_id != null && txn.joint_bank_id !== '' 
            ? (getBankName(txn.joint_bank_id) || 'Unknown Bank') 
            : 'Cash/External';
        let s1, s2;
        const amt = Number((Math.abs(Number(txn.amount) || 0)).toFixed(2));
        if (txn.split_amount != null && txn.split_amount !== '') {
          const rawSplit = Number(txn.split_amount);
          s1 = Number.isFinite(rawSplit) ? Number((Math.min(Math.abs(rawSplit), amt)).toFixed(2)) : 0;
          s2 = Number(Math.abs(amt - s1).toFixed(2));
        } else {
          const rawPct = Number(txn.split_percent);
          const safePct = Number.isFinite(rawPct) ? Math.max(0, Math.min(rawPct, 100)) / 100 : 0;
          s1 = Number((Math.min(Math.abs(amt * safePct), amt)).toFixed(2));
          s2 = Number(Math.abs(amt - s1).toFixed(2));
        }
        return `(₹${s1.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}) & ${jointBank} (₹${s2.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})})`;
    }, [getBankName]);

    const exportToCSV = async () => {
        if (isExporting) return;
        setIsExporting(true);
        let url = null;
        try {
            const params = new URLSearchParams({ limit: 0, page: 1 });
            if (sortConfig.key) params.set('sort', sortConfig.key);
            if (sortConfig.direction) params.set('dir', sortConfig.direction);
            if (filterType !== 'all') params.set('type', filterType);
            if (filterCategory !== 'all') {
                params.set('category', filterCategory.startsWith('cat_') ? filterCategory.slice(4) : filterCategory);
            }
            if (debouncedSearch) params.set('search', debouncedSearch);
  
            const initialReq = await fetch(`/api/transactions?${params.toString()}`);
            if (initialReq.status === 204) {
                alert('No transactions to export.');
                return;
            }
            if (!initialReq.ok) throw new Error('Export failed: Backend rejected initial request');
            const initialRes = await initialReq.json();
            let allTxns = Array.isArray(initialRes.data) ? [...initialRes.data] : [];
  
            if (allTxns.length === 0) {
                alert('No transactions to export.');
                return;
            }
  
            const serverTotal = initialRes.totalCount || initialRes.total || allTxns.length;
            if (allTxns.length < serverTotal) {
                const proceed = confirm(`Warning: Your ledger contains ${serverTotal.toLocaleString()} transactions, but the server returned only ${allTxns.length.toLocaleString()} due to export limits. The exported CSV will be incomplete. Continue anyway?`);
                if (!proceed) return;
            }
  
            const headers = ['ID', 'Date', 'Title', 'Funding Source', 'Category', 'Type', 'Amount', 'Tax Deductible', 'Split Details'];
            const sanitizeCSV = (val) => {
                if (val == null) return '';
                const str = String(val);
                if (str.trimStart().match(/^[=+\-@\t\r\n|;]/)) return "'" + str;
                return str;
            };
            const cap = (s) => typeof s === 'string' && s.length > 0 ? s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : s;
  
            const isoDate = (dateString) => {
              if (!dateString) return '';
              const s = String(dateString);
              const dateOnly = s.split('T')[0].split(' ')[0];
              const match = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
              if (match) {
                  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
                  if (!isNaN(d.valueOf()) && d.getMonth() === Number(match[2]) - 1) return dateOnly;
              }
              const d = new Date(s);
              if (isNaN(d.valueOf())) return s;
              return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            };
  
            const rows = allTxns.map(t => [
                `"${sanitizeCSV(t.id).replace(/"/g, '""')}"`,
                `"${sanitizeCSV(isoDate(t.date)).replace(/"/g, '""')}"`,
                `"${sanitizeCSV(t.title).replace(/"/g, '""')}"`, 
                `"${sanitizeCSV((t.source_bank_id != null && t.source_bank_id !== '') ? (getBankName(t.source_bank_id) || 'Unknown Bank') : 'Global Cash').replace(/"/g, '""')}"`,
                `"${sanitizeCSV(cap(t.category) || 'Uncategorized').replace(/"/g, '""')}"`, 
                `"${sanitizeCSV(cap(t.type)).replace(/"/g, '""')}"`, 
                `"${t.type === 'income' ? Number(parseFloat(t.amount) || 0) : (t.type === 'transfer' ? Number(parseFloat(t.amount) || 0) : -(Number(parseFloat(t.amount) || 0)))}"`, 
                `"${t.type !== 'expense' ? 'N/A' : (isTaxDeductibleTrue(t.isTaxDeductible) ? 'Yes' : 'No')}"`,
                `"${sanitizeCSV(getSplitStringForExport(t)).replace(/"/g, '""')}"`
            ]);
        
            const csvContent = [headers.join(',')].concat(rows.map(r => r.join(','))).join('\n');
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute("href", url);
            const d = new Date();
            const localDateString = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            link.setAttribute('download', `ledger_export_${localDateString}.csv`);
            document.body.appendChild(link);
            try {
                link.click();
            } finally {
                if (document.body.contains(link)) document.body.removeChild(link);
            }
        } catch (err) {
            console.error(err);
            alert(`CSV Export Failed: ${err.message}`);
        } finally {
            if (url) {
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
            setIsExporting(false);
        }
    };

    const handleTabKeyDown = (e, index) => {
        const tabs = ['transactions', 'double-entry', 'budgets', 'banking'];
        let newIndex;
        if (e.key === 'ArrowRight') newIndex = (index + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') newIndex = (index - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') newIndex = 0;
        else if (e.key === 'End') newIndex = tabs.length - 1;
        else return;
        
        e.preventDefault();
        if (updateTxnMutation.isPending || deleteTxnMutation.isPending) return;
    
        setEditingId(null);
        setEditFormData({});
        setConfirmDelete({ isOpen: false, id: null, title: '' });
        setActiveTab(tabs[newIndex]);
        tabRefs.current[newIndex]?.focus();
    };

    const handleDelete = (id, title) => {
        if (updateTxnMutation.isPending || deleteTxnMutation.isPending) return;
        setConfirmDelete({ isOpen: true, id, title });
    };

    return (
        <div className="animate-fade-in">
            <ConfirmationModal 
                isOpen={confirmDelete.isOpen} 
                title="Delete Transaction" 
                message={`Are you sure you want to delete "${confirmDelete.title || ''}"? This action will permanently reverse the ledger entry and cannot be undone.`} 
                onConfirm={() => { 
                    if (deleteTxnMutation.isPending) return;
                    deleteTxnMutation.mutate(confirmDelete.id); 
                }}
                onCancel={() => {
                    setConfirmDelete({ isOpen: false, id: null, title: '' });
                    setTimeout(() => document.getElementById('ledger-search-input')?.focus(), 0);
                }}
                confirmText="Delete Permanently"
            />

            <div className="section-header">
                <div>
                    <h2>Transaction & Banking Ledger</h2>
                    <p>Manage your centralized transactions and banking reconciliation.</p>
                </div>
            </div>

            <div className="debt-tab-bar" role="tablist" aria-label="Ledger Sections" style={{ marginBottom: '32px' }}>
                {[
                { id: 'transactions', label: 'Transactions', icon: <BookOpen size={16} /> },
                { id: 'double-entry', label: 'Double-Entry Explorer', icon: <ArrowRightLeft size={16} /> },
                { id: 'budgets', label: 'Envelope Budgets', icon: <Calculator size={16} /> },
                { id: 'banking', label: 'Bank Reconciliation', icon: <Landmark size={16} /> }
                ].map((tab, i) => (
                <button
                    key={tab.id}
                    ref={el => (tabRefs.current[i] = el)}
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    aria-controls={activeTab === tab.id ? `panel-${tab.id}` : undefined}
                    id={`tab-${tab.id}`}
                    tabIndex={activeTab === tab.id ? 0 : -1}
                    onClick={() => {
                        if (updateTxnMutation.isPending || deleteTxnMutation.isPending) return;
                        if (activeTab === tab.id) return;
                        setEditingId(null);
                        setEditFormData({});
                        setConfirmDelete({ isOpen: false, id: null, title: '' });
                        setActiveTab(tab.id);
                    }}
                    onKeyDown={(e) => handleTabKeyDown(e, i)}
                    className={`debt-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                >
                    {tab.icon} {tab.label}
                </button>
                ))}
            </div>

            {activeTab === 'transactions' && (
                <div id="panel-transactions" role="tabpanel" aria-labelledby="tab-transactions" tabIndex={0}>
                    {error && <div className="alert-banner danger" style={{marginBottom:'20px'}} role="alert">{(error.message || '').includes('Failed to load') ? error.message : 'Failed to load transactions. Please check your connection and try again.'}</div>}
                    
                    <LedgerFilters 
                        searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                        filterType={filterType} setFilterType={setFilterType}
                        filterCategory={filterCategory} setFilterCategory={setFilterCategory}
                        uniqueCategories={uniqueCategories} exportToCSV={exportToCSV}
                        isExporting={isExporting} loading={loading} isBanksLoading={isBanksLoading}
                        updateTxnMutation={updateTxnMutation} deleteTxnMutation={deleteTxnMutation}
                        showImportTools={showImportTools} setShowImportTools={setShowImportTools}
                        setEditingId={setEditingId} setEditFormData={setEditFormData}
                        setCurrentPage={setCurrentPage} invalidateAllLedgerQueries={invalidateAllLedgerQueries}
                    />

                    <LedgerTable 
                        transactions={transactions} loading={loading} isFetching={isFetching}
                        isBanksLoading={isBanksLoading} sortConfig={sortConfig} setSortConfig={setSortConfig}
                        setCurrentPage={setCurrentPage} editingId={editingId} setEditingId={setEditingId}
                        editFormData={editFormData} setEditFormData={setEditFormData}
                        updateTxnMutation={updateTxnMutation} deleteTxnMutation={deleteTxnMutation}
                        handleDelete={handleDelete} bankNameMap={bankNameMap} getBankName={getBankName} banks={banks}
                    />

                    <LedgerPagination 
                        currentPage={currentPage} totalPages={totalPages} setCurrentPage={setCurrentPage}
                        showingStart={showingStart} showingEnd={showingEnd} totalCount={totalCount}
                        setEditingId={setEditingId} setEditFormData={setEditFormData}
                        isPending={updateTxnMutation.isPending || deleteTxnMutation.isPending}
                    />
                </div>
            )}
            
            {activeTab === 'double-entry' && (
                <div id="panel-double-entry" role="tabpanel" aria-labelledby="tab-double-entry" tabIndex={0}>
                    <DoubleEntryExplorer />
                </div>
            )}
            
            {activeTab === 'budgets' && (
                <div id="panel-budgets" role="tabpanel" aria-labelledby="tab-budgets" tabIndex={0}>
                    <Budgets />
                </div>
            )}
            
            {activeTab === 'banking' && (
                <div id="panel-banking" role="tabpanel" aria-labelledby="tab-banking" tabIndex={0}>
                    <BankReconciliation />
                </div>
            )}
        </div>
    );
}
