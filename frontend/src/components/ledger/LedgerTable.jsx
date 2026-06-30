import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { Check, X, ChevronDown, ChevronUp, Edit2, Trash2, PackageOpen } from 'lucide-react';
import CustomSelect from '../ui/CustomSelect';

const tableContainer = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.03 } }
};
const tableRow = {
    hidden: { opacity: 0, x: -10 },
    show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

const isTaxDeductibleTrue = (val) => val === true || val === 1 || String(val) === 'true' || String(val) === '1';

export default function LedgerTable({
    transactions,
    loading,
    isFetching,
    isBanksLoading,
    sortConfig,
    setSortConfig,
    setCurrentPage,
    editingId,
    setEditingId,
    editFormData,
    setEditFormData,
    updateTxnMutation,
    deleteTxnMutation,
    handleDelete,
    bankNameMap,
    getBankName,
    banks
}) {

    const formatDate = useCallback((dateString) => {
        if (!dateString) return '';
        const s = String(dateString);
        const dateOnly = s.split('T')[0].split(' ')[0];
        const match = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) {
          const d = new Date(s);
          if (isNaN(d.valueOf())) return s;
          return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
        }
        const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        if (isNaN(d.valueOf()) || d.getMonth() !== Number(match[2]) - 1) return s;
        return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
    }, []);

    const getSplitString = useCallback((txn) => {
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
        return ` (₹${s1.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}) & ${jointBank} (₹${s2.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})})`;
    }, [getBankName]);

    const handleEditInit = (txn) => {
        setEditingId(txn.id);
        let rawTime = txn.date ? (txn.date.includes('T') ? txn.date.split('T').slice(1).join('T') : (txn.date.includes(' ') ? txn.date.split(' ').slice(1).join('') : '00:00:00')) : '00:00:00';
        let safeDate = '';
        if (txn.date) {
            const dParts = txn.date.split('T')[0].split(' ')[0];
            safeDate = dParts.match(/^\d{4}-\d{2}-\d{2}$/) && !isNaN(new Date(dParts).valueOf()) ? dParts : '';
        }

        setEditFormData({ 
            title: txn.title || '',
            amount: txn.type === 'transfer' ? parseFloat(txn.amount || 0) : Math.abs(parseFloat(txn.amount || 0)),
            date: safeDate,
            original_time: rawTime,
            category: txn.category || '', 
            type: txn.type || 'expense',
            source_bank_id: txn.source_bank_id,
            joint_bank_id: txn.joint_bank_id,
            split_amount: txn.split_amount != null ? txn.split_amount : '',
            split_percent: txn.split_amount == null ? txn.split_percent : '',
            isTaxDeductible: isTaxDeductibleTrue(txn.isTaxDeductible)
        });
    };

    const handleEditSave = (e, id, txn) => {
        e.preventDefault();
        if (updateTxnMutation.isPending || deleteTxnMutation.isPending) return;

        if (!['income', 'expense', 'transfer'].includes(editFormData.type)) {
            alert('Error: Transaction type payload is structurally invalid.');
            return;
        }

        if (txn.type === 'transfer' && editFormData.type !== 'transfer') {
            alert('Error: Cannot structurally mutate a double-entry transfer into a single-entry transaction. Please delete and recreate.');
            return;
        }

        const trimmedCategory = (editFormData.category || '').trim().toLowerCase();
        if (trimmedCategory.length > 100) {
            alert('Error: Category exceeds safe maximum structural length (100).');
            return;
        }
        
        if (trimmedCategory === 'all') {
            alert('Error: "all" is a reserved structural keyword. Please choose a different category name to prevent filter annihilation.');
            return;
        }

        const parsedAmount = parseFloat(editFormData.amount);
        if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
            alert('Error: Amount must be a valid, finite positive number (or a signed scalar for structural transfers).');
            return;
        }

        if (!editFormData.date || !editFormData.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            alert('Error: Temporal vector (Date) is structurally invalid.');
            return;
        }
        const dateParts = editFormData.date.split('-');
        const parsedDateObj = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]));
        if (isNaN(parsedDateObj.valueOf()) || parsedDateObj.getMonth() !== Number(dateParts[1]) - 1) {
            alert('Error: Date violates calendrical constraints (e.g. month rollover overflow).');
            return;
        }

        if (editFormData.source_bank_id && editFormData.joint_bank_id && String(editFormData.source_bank_id) === String(editFormData.joint_bank_id)) {
            alert('Error: A transaction (or split) cannot originate and terminate at the identical banking institution.');
            return;
        }

        let finalSplitAmt = null;
        let finalSplitPct = null;

        if (editFormData.split_amount != null && editFormData.split_amount !== '') {
            let splitAmt = parseFloat(editFormData.split_amount);
            if (!Number.isFinite(splitAmt) || splitAmt < 0) {
                alert('Error: Split amount must be a valid, finite positive number.');
                return;
            }
            const absAmount = Math.abs(parsedAmount);
            if (splitAmt > absAmount) {
                alert('Error: Split amount cannot mathematically exceed the total transaction amount.');
                return;
            }
            
            finalSplitAmt = splitAmt;
            finalSplitPct = absAmount > 0 ? (splitAmt / absAmount) : 0;
        } else if (editFormData.split_percent != null && editFormData.split_percent !== '') {
            let pct = parseFloat(editFormData.split_percent);
            if (isNaN(pct) || pct < 0 || pct > 100) {
                alert('Error: Split percent must be a valid positive percentage between 0 and 100.');
                return;
            }
            finalSplitPct = pct;
            finalSplitAmt = Math.round(Math.abs(parsedAmount) * (pct / 100) * 100) / 100;
        }

        const trimmedTitle = (editFormData.title || '').trim();
        if (!trimmedTitle) {
            alert('Error: Title cannot be empty.');
            return;
        }

        updateTxnMutation.mutate({ 
          id, 
          data: { 
            title: trimmedTitle, 
            amount: parsedAmount, 
            date: `${editFormData.date}T${editFormData.original_time}`,
            category: trimmedCategory,
            type: editFormData.type,
            source_bank_id: (editFormData.source_bank_id !== '' && editFormData.source_bank_id != null) ? editFormData.source_bank_id : null,
            joint_bank_id: (editFormData.joint_bank_id !== '' && editFormData.joint_bank_id != null) ? editFormData.joint_bank_id : null,
            split_amount: finalSplitAmt,
            split_percent: finalSplitPct,
            isTaxDeductible: editFormData.type !== 'expense' ? 0 : (editFormData.isTaxDeductible ? 1 : 0)
          } 
        });
    };

    const handleSort = (key) => {
        if (updateTxnMutation.isPending || deleteTxnMutation.isPending) return;

        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        else if (sortConfig.key === key && sortConfig.direction === 'desc') {
            if (key !== 'date') {
                setSortConfig({ key: 'date', direction: 'desc' });
                setCurrentPage(1);
                setEditingId(null);
                setEditFormData({});
                return;
            }
        }
        setSortConfig({ key, direction });
        setCurrentPage(1);
        setEditingId(null);
        setEditFormData({});
    };

    const handleSortKeyDown = (e, key) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleSort(key);
        }
    };

    const renderSortIcon = (key) => {
        if (sortConfig.key !== key) return <ChevronDown size={14} style={{opacity: 0.3}} />;
        return sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
    };

    return (
        <div className="table-container" style={{ padding: '0', overflow: 'hidden' }}>
        {(loading || isBanksLoading) ? (
            <div style={{ width: '100%', overflowX: 'auto' }}>
                <table className="table-institutional" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '16px 24px' }}>Date</th>
                            <th style={{ padding: '16px 24px' }}>Description</th>
                            <th style={{ padding: '16px 24px' }}>Source</th>
                            <th style={{ padding: '16px 24px' }}>Category</th>
                            <th style={{ padding: '16px 24px' }}>Type</th>
                            <th style={{ padding: '16px 24px' }}>Amount</th>
                            <th style={{ padding: '16px 24px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                            {Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={7} style={{padding: '24px', textAlign: 'center'}}>Loading...</td></tr>)}
                    </tbody>
                </table>
            </div>
        ) : transactions.length === 0 ? (
             <div className="empty-state"><PackageOpen size={48} style={{opacity:0.3,marginBottom:'12px'}}/><h4>No Transactions Found</h4><p>Try adjusting your search or filters.</p></div>
        ) : (
            <div style={{ width: '100%', overflowX: 'auto' }}>
                <table className="table-institutional" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                            <th tabIndex={0} aria-sort={sortConfig.key === 'date' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'} onKeyDown={(e) => handleSortKeyDown(e, 'date')} onClick={() => handleSort('date')} style={{ padding: '16px 24px', textAlign: 'left', cursor: 'pointer', fontSize: '13px' }}>
                                <div style={{display:'flex', alignItems:'center', gap:'4px'}}>Date {renderSortIcon('date')}</div>
                            </th>
                            <th tabIndex={0} aria-sort={sortConfig.key === 'title' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'} onKeyDown={(e) => handleSortKeyDown(e, 'title')} onClick={() => handleSort('title')} style={{ padding: '16px 24px', textAlign: 'left', cursor: 'pointer', fontSize: '13px' }}>
                                <div style={{display:'flex', alignItems:'center', gap:'4px'}}>Description {renderSortIcon('title')}</div>
                            </th>
                            <th style={{ padding: '16px 24px', fontSize: '13px' }}>Funding Source</th>
                            <th tabIndex={0} aria-sort={sortConfig.key === 'category' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'} onKeyDown={(e) => handleSortKeyDown(e, 'category')} onClick={() => handleSort('category')} style={{ padding: '16px 24px', textAlign: 'left', cursor: 'pointer', fontSize: '13px' }}>
                                <div style={{display:'flex', alignItems:'center', gap:'4px'}}>Category {renderSortIcon('category')}</div>
                            </th>
                            <th style={{ padding: '16px 24px', fontSize: '13px' }}>
                                Type
                            </th>
                            <th tabIndex={0} aria-sort={sortConfig.key === 'amount' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'} onKeyDown={(e) => handleSortKeyDown(e, 'amount')} onClick={() => handleSort('amount')} style={{ padding: '16px 24px', textAlign: 'right', cursor: 'pointer', fontSize: '13px' }}>
                                <div style={{display:'flex', alignItems:'center', gap:'4px', justifyContent:'flex-end'}}>Amount {renderSortIcon('amount')}</div>
                            </th>
                            <th aria-label="Actions" style={{ padding: '16px 24px' }}></th>
                        </tr>
                </thead>
                  <motion.tbody variants={tableContainer} initial="hidden" animate="show" key={`page-txn`} style={{ opacity: (isFetching && !loading) ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                    {transactions.map(txn => {
                        const isEditing = editingId === txn.id;
                        return (
                        <motion.tr variants={tableRow} key={txn.id}>
                            {isEditing ? (
                                <td colSpan={7} style={{ padding: '12px' }}>
                                    <form onSubmit={(e) => handleEditSave(e, txn.id, txn)} onKeyDown={(e) => {
                                        if (e.key === 'Escape' && e.target.tagName !== 'SELECT') { 
                                            if (updateTxnMutation.isPending || deleteTxnMutation.isPending) return;
                                            e.preventDefault(); 
                                            setEditingId(null); 
                                            setEditFormData({}); 
                                            setTimeout(() => document.getElementById(`edit-btn-${txn.id}`)?.focus(), 0);
                                        }
                                    }} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', background: 'rgba(120, 130, 200, 0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(120, 130, 200, 0.2)' }}>
                                        <input required type="date" aria-label="Transaction Date" value={editFormData.date || ''} onChange={e=>setEditFormData({...editFormData, date:e.target.value})} className="form-control" style={{width: '140px', padding:'6px'}} disabled={txn.type === 'transfer' || updateTxnMutation.isPending} title={txn.type === 'transfer' ? "Temporal mutations for transfers must be performed via dedicated double-entry engines" : ""} />
                                        <input autoFocus required aria-label="Transaction Title" value={editFormData.title || ''} onChange={e=>setEditFormData({...editFormData, title:e.target.value})} className="form-control" style={{flex: 1, padding:'6px'}} placeholder="Title" disabled={updateTxnMutation.isPending} />
                                        <input required aria-label="Transaction Category" value={editFormData.category || ''} onChange={e=>setEditFormData({...editFormData, category:e.target.value})} className="form-control" style={{width: '120px', padding:'6px', textTransform: 'capitalize'}} placeholder="Category" disabled={updateTxnMutation.isPending} />
                                        <CustomSelect aria-label="Joint Bank" value={editFormData.joint_bank_id ?? ''} onChange={e=>setEditFormData({...editFormData, joint_bank_id:e.target.value})} className="form-control" style={{width: '100px', padding:'6px'}} title={txn.type === 'transfer' ? "Destination routing for transfers must be mutated via dedicated double-entry engines" : "Joint Bank"} disabled={txn.type === 'transfer' || updateTxnMutation.isPending}>
                                            <option value="">External</option>
                                            {(txn.joint_bank_id != null && txn.joint_bank_id !== '') && !bankNameMap.has(String(txn.joint_bank_id)) && (
                                                <option value={txn.joint_bank_id}>Unknown Bank</option>
                                            )}
                                            {banks.map(b => <option key={`jbank-${b.id}`} value={b.id}>{b.bankName} (₹{b.ledgerBalance?.toLocaleString('en-IN')})</option>)}
                                        </CustomSelect>
                                        <CustomSelect aria-label="Transaction Type" value={editFormData.type || 'expense'} onChange={e=>{
                                            setEditFormData({...editFormData, type: e.target.value});
                                        }} className="form-control" style={{width: '100px', padding:'6px'}} disabled={txn.type === 'transfer' || updateTxnMutation.isPending} title={txn.type === 'transfer' ? "Transfers cannot be mutated to single-entry types" : ""}>
                                            <option value="income">Income</option>
                                            <option value="expense">Expense</option>
                                            {txn.type === 'transfer' && <option value="transfer">Transfer</option>}
                                        </CustomSelect>
                                        <CustomSelect aria-label="Funding Source" value={editFormData.source_bank_id ?? ''} onChange={e=>setEditFormData({...editFormData, source_bank_id:e.target.value})} className="form-control" style={{width: '120px', padding:'6px'}} title="Funding Source" disabled={txn.type === 'transfer' || updateTxnMutation.isPending}>
                                            <option value="">Global Cash</option>
                                            {(txn.source_bank_id != null && txn.source_bank_id !== '') && !bankNameMap.has(String(txn.source_bank_id)) && (
                                                <option value={txn.source_bank_id}>Unknown Bank</option>
                                            )}
                                            {banks.map(b => <option key={b.id} value={b.id}>{b.bankName} (₹{b.ledgerBalance?.toLocaleString('en-IN')})</option>)}
                                        </CustomSelect>
                                        {txn.type !== 'transfer' && (
                                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', background: 'rgba(120, 130, 200, 0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(120, 130, 200, 0.2)' }}>
                                                <input aria-label="Split Amount" type="number" step="any" min="0" max={Math.abs(parseFloat(editFormData.amount) || 0)} value={editFormData.split_amount ?? ''} onChange={e=>setEditFormData({...editFormData, split_amount:e.target.value, split_percent:''})} onWheel={(e) => e.preventDefault()} className="form-control" style={{width: '90px', padding:'6px'}} placeholder="Split ₹" disabled={updateTxnMutation.isPending}/>
                                                <input aria-label="Split Percent (0 to 100)" type="number" step="any" min="0" max="100" value={editFormData.split_percent ?? ''} onChange={e=>setEditFormData({...editFormData, split_percent:e.target.value, split_amount:''})} onWheel={(e) => e.preventDefault()} className="form-control" style={{width: '100px', padding:'6px'}} placeholder="Split % (0-100)" disabled={updateTxnMutation.isPending}/>
                                            </div>
                                        )}
                                        <input required aria-label="Transaction Amount" type="number" step="any" value={editFormData.amount ?? ''} onChange={e=>setEditFormData({...editFormData, amount:e.target.value})} onWheel={(e) => e.preventDefault()} className="form-control" style={{width: '100px', padding:'6px'}} disabled={txn.type === 'transfer' || !!editFormData.split_amount || !!editFormData.split_percent || updateTxnMutation.isPending} title={(txn.type === 'transfer' || !!editFormData.split_amount || !!editFormData.split_percent) ? "Amounts for transfers or split transactions must be mutated via dedicated engines to preserve mathematical parity" : ""}/>
                                        <label style={{display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px'}}>
                                            <input type="checkbox" checked={editFormData.type === 'expense' && !!editFormData.isTaxDeductible} onChange={e=>setEditFormData({...editFormData, isTaxDeductible:e.target.checked})} disabled={editFormData.type !== 'expense' || updateTxnMutation.isPending} />
                                            Tax Deductible
                                        </label>
                                        <div style={{display:'flex', gap:'4px', alignItems:'center'}}>
                                            <button className="icon-btn" aria-label="Save Edits" type="submit" disabled={updateTxnMutation.isPending || deleteTxnMutation.isPending}><Check size={14}/></button>
                                            <button aria-label="Cancel Edits" type="button" className="btn" disabled={updateTxnMutation.isPending || deleteTxnMutation.isPending} style={{padding:'6px 12px', opacity: (updateTxnMutation.isPending || deleteTxnMutation.isPending) ? 0.3 : 1, cursor: (updateTxnMutation.isPending || deleteTxnMutation.isPending) ? 'not-allowed' : 'pointer'}} onClick={()=>{ 
                                                setEditingId(null); 
                                                setEditFormData({}); 
                                                setTimeout(() => document.getElementById(`edit-btn-${txn.id}`)?.focus(), 0);
                                            }}><X size={14}/></button>
                                        </div>
                                    </form>
                                </td>
                            ) : (
                                <>
                                <td style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: '14px', whiteSpace: 'nowrap' }}>{formatDate(txn.date)}</td>
                                <td style={{ padding: '16px 24px', fontWeight: 500, wordBreak: 'break-word', maxWidth: '300px' }}>{txn.title}</td>
                                <td style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: '13px' }}>
                                    {getBankName(txn.source_bank_id) || 'Global Cash'}
                                    {getSplitString(txn)}
                                </td>
                                <td style={{ padding: '16px 24px', fontSize: '13px', textTransform: 'capitalize' }}>{txn.category ? txn.category.charAt(0).toUpperCase() + txn.category.slice(1) : 'Uncategorized'}</td>
                                <td style={{ padding: '16px 24px' }}>
                                    <span className={`urgency-badge ${txn.type === 'income' ? 'safe' : txn.type === 'transfer' ? 'warning' : 'critical'}`} style={{textTransform: 'capitalize'}}>{txn.type}</span>
                                </td>
                                <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                    {txn.isTaxDeductible !== undefined && (
                                         <span className="tax-badge" style={{ 
                                             opacity: (txn.type === 'expense' && isTaxDeductibleTrue(txn.isTaxDeductible)) ? 1 : 0.2, 
                                             color: (txn.type === 'expense' && isTaxDeductibleTrue(txn.isTaxDeductible)) ? 'var(--accent)' : 'inherit',
                                             cursor: 'help' 
                                         }} title={(txn.type === 'expense' && isTaxDeductibleTrue(txn.isTaxDeductible)) ? "Tax Deductible" : "Not Deductible"}>
                                             TAX
                                         </span>
                                     )}
                                    {txn.type === 'income' ? <span style={{color: 'var(--success-color)'}}>{Number(txn.amount || 0) >= 0 ? '+' : ''}₹{Number(txn.amount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span> : 
                                        (txn.type === 'transfer' ? <span style={{color: 'var(--text-color)'}}>₹{Number(txn.amount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span> : 
                                        <span style={{color: 'var(--text-color)'}}>{Number(txn.amount || 0) >= 0 ? '-' : ''}₹{Number(txn.amount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>)}
                                </td>
                                <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                                        <button className="icon-btn" id={`edit-btn-${txn.id}`} aria-label={`Edit ${txn.title}`} onClick={() => handleEditInit(txn)} disabled={updateTxnMutation.isPending || deleteTxnMutation.isPending}><Edit2 size={16} /></button>
                                        <button className="icon-btn danger" aria-label={`Delete ${txn.title}`} onClick={() => handleDelete(txn.id, txn.title)} disabled={updateTxnMutation.isPending || deleteTxnMutation.isPending}><Trash2 size={16} /></button>
                                    </div>
                                </td>
                                </>
                            )}
                        </motion.tr>
                        );
                    })}
                  </motion.tbody>
                </table>
            </div>
        )}
        </div>
    );
}
