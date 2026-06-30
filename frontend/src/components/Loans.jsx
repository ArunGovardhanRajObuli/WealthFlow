import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, AlertTriangle, X } from 'lucide-react';
 
import { motion, AnimatePresence } from 'framer-motion';

import { useAmortizationEngine } from '../hooks/useAmortizationEngine';
import { parseToPaiseBigInt, formatBigIntToDecimalString, calculateEMIBigInt } from '../utils/bigIntMath';
import LoanDashboard from './loans/LoanDashboard';
import NewLoanForm from './loans/NewLoanForm';
import ActiveLoans from './loans/ActiveLoans';
import DefeatedLoans from './loans/DefeatedLoans';
import ConfirmationModal from './ConfirmationModal';



const EMPTY_ARRAY = [];

export default function Loans({ engineData }) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [deletingLoanId, setDeletingLoanId] = useState(null);
  const [hiddenError, setHiddenError] = useState(null);

  const { data: loansData, error: loansError, isLoading: loansLoading } = useQuery({
    queryKey: ['loans-list'],
    queryFn: async () => {
      const res = await fetch('/api/loans-list');
      if (!res.ok) throw new Error('Failed to load loans');
      if (res.status === 204) return { data: [] };
      return res.json();
    }
  });

  const { data: paymentsData, error: payError, isLoading: payLoading } = useQuery({
    queryKey: ['loan-payments'],
    queryFn: async () => {
      const res = await fetch('/api/loan-payments');
      if (!res.ok) throw new Error('Failed to load payments');
      if (res.status === 204) return { data: [] };
      return res.json();
    }
  });

  const { data: recData, error: recError } = useQuery({
    queryKey: ['reconciliation'],
    queryFn: async () => {
      const res = await fetch('/api/reconciliation');
      if (!res.ok) throw new Error('Failed to load banks');
      if (res.status === 204) return { banks: [] };
      return res.json();
    }
  });

  const { data: familyMembersData } = useQuery({
    queryKey: ['family-members'],
    queryFn: async () => {
      const res = await fetch('/api/family-members');
      if (!res.ok) throw new Error('Failed to load family members');
      return res.json();
    }
  });

  const loans = useMemo(() => loansData?.data || EMPTY_ARRAY, [loansData]);
  const payments = paymentsData?.data || EMPTY_ARRAY;
  const banks = recData?.banks || EMPTY_ARRAY;
  const familyMembers = familyMembersData?.data || EMPTY_ARRAY;

  const localEngine = useAmortizationEngine(engineData ? EMPTY_ARRAY : loans, engineData ? EMPTY_ARRAY : payments);
  const { activeLoans, defeatedLoans, metrics } = engineData || localEngine;
  const isLoading = loansLoading || payLoading;

  const formatDate = useCallback((dateStr) => {
    if (!dateStr) return '';
    try {
      let normalized = String(dateStr).replace(' ', 'T');
      if (normalized.length === 10) normalized += 'T00:00:00';
      if (!normalized.endsWith('Z')) normalized += 'Z';
      return new Date(normalized).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
    } catch {
      return dateStr;
    }
  }, []);

  const updateLoanMutation = useMutation({
    mutationFn: async ({ loan, editFormData }) => {
      const mergedData = { ...loan, ...editFormData };
      
      const isRefinance = 
        Number(loan.interestRate) !== Number(mergedData.interestRate) ||
        Number(loan.termYears) !== Number(mergedData.termYears) ||
        parseToPaiseBigInt(loan.principalAmount) !== parseToPaiseBigInt(mergedData.principalAmount);

      let pPaise = 0n;
      let newEMIPaise = 0n;
      if (isRefinance) {
        pPaise = parseToPaiseBigInt(mergedData.principalAmount);
        const termY = Number(mergedData.termYears);
        const rateFloat = Number(mergedData.interestRate);
        
        if (termY > 0) {
          if (rateFloat <= 0) {
            newEMIPaise = pPaise / BigInt(termY * 12);
          } else {
            newEMIPaise = calculateEMIBigInt(pPaise, rateFloat, termY);
          }
        }
      }

      const payload = { 
          ...loan,
          title: mergedData.title, 
          amount: isRefinance ? formatBigIntToDecimalString(newEMIPaise) : loan.amount, 
          dueDate: loan.dueDate, 
          termYears: isRefinance ? Number(mergedData.termYears) : Number(loan.termYears), 
          frequency: loan.frequency, 
          principalAmount: isRefinance ? formatBigIntToDecimalString(pPaise) : loan.principalAmount, 
          interestRate: isRefinance ? Number(mergedData.interestRate) : Number(loan.interestRate), 
          category: 'loan',
          source_bank_id: mergedData.source_bank_id || null,
          owner_member_id: mergedData.owner_member_id || null
      };
      Object.freeze(payload);

      const url = isRefinance ? `/api/loans/${encodeURIComponent(loan.id)}/refinance` : `/api/reminders/${encodeURIComponent(loan.id)}`;
      const method = isRefinance ? 'POST' : 'PUT';

      const res = await fetch(url, { 
        method: method, 
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.status === 204) return null;
      if (!res.ok) { let e; try { e = await res.json(); } catch (err) { throw new Error(`Network or server error (${res.status})`, { cause: err }); } throw new Error(e?.error || (isRefinance ? 'Failed to refinance loan' : 'Failed to update loan')); }
      return res.json();
    },
    onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['reminders'] }),
          queryClient.invalidateQueries({ queryKey: ['loans-list'] }),
          queryClient.invalidateQueries({ queryKey: ['loan-payments'] }),
          queryClient.invalidateQueries({ queryKey: ['reconciliation'] }),
          queryClient.invalidateQueries({ queryKey: ['bank-balances'] })
        ]);
    }
  });

  const deleteLoanMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/reminders/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'Accept': 'application/json' } });
      if (res.status === 204) return null;
      if (!res.ok) { let e; try { e = await res.json(); } catch (err) { throw new Error(`Network or server error (${res.status})`, { cause: err }); } throw new Error(e?.error || 'Failed to delete loan'); }
      return res.json();
    },
    onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['reminders'] }),
          queryClient.invalidateQueries({ queryKey: ['loans-list'] }),
          queryClient.invalidateQueries({ queryKey: ['loan-payments'] }),
          queryClient.invalidateQueries({ queryKey: ['reconciliation'] }),
          queryClient.invalidateQueries({ queryKey: ['bank-balances'] })
        ]);
    }
  });

  const prepayMutation = useMutation({
    mutationFn: async ({ loanId, body }) => {
      Object.freeze(body);
      const res = await fetch(`/api/loans/${encodeURIComponent(loanId)}/payments`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, 
        body: JSON.stringify(body) 
      });
      if (res.status === 204) return null;
      if (!res.ok) { let e; try { e = await res.json(); } catch (err) { throw new Error(`Network or server error (${res.status})`, { cause: err }); } throw new Error(e?.error || 'Failed to process prepayment'); }
      return res.json();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reminders'] }),
        queryClient.invalidateQueries({ queryKey: ['loans-list'] }),
        queryClient.invalidateQueries({ queryKey: ['upcoming'] }),
        queryClient.invalidateQueries({ queryKey: ['loan-payments'] }),
        queryClient.invalidateQueries({ queryKey: ['reconciliation'] }),
        queryClient.invalidateQueries({ queryKey: ['bank-balances'] })
      ]);
    }
  });

  const handleEditSave = (loan, editFormData) => {
    if (updateLoanMutation.isPending) return;
    updateLoanMutation.mutate({ loan, editFormData });
  };



  const handleDelete = (id) => {
    setDeletingLoanId(id);
  };

  const confirmDelete = () => {
    if (deletingLoanId) {
      deleteLoanMutation.mutate(deletingLoanId);
      setDeletingLoanId(null);
    }
  };

  const handlePrepay = (loanId, prepayData) => {
    const amountPaise = parseToPaiseBigInt(prepayData.amount);
    if (amountPaise <= 0n) {
        alert("Error: Prepayment amount must be greater than zero.");
        return;
    }
    
    let sourceAmtPaise = prepayData.joint_bank_id ? parseToPaiseBigInt(prepayData.split_amount) : amountPaise;
    if (prepayData.joint_bank_id && (sourceAmtPaise <= 0n || sourceAmtPaise > amountPaise)) {
        alert("Error: Split amount cannot exceed the total prepayment amount and must be greater than zero.");
        return;
    }
    if (prepayData.source_bank_id) {
        const selectedBank = banks.find(b => String(b.id) === String(prepayData.source_bank_id));
        if (!selectedBank) {
            alert("Error: Invalid source bank selected.");
            return;
        }
        if (parseToPaiseBigInt(selectedBank.ledgerBalance) < sourceAmtPaise) {
            alert("Error: Insufficient funds in the primary bank account.");
            return;
        }
    }

    if (prepayData.joint_bank_id) {
        const jointAmtPaise = amountPaise - sourceAmtPaise;
        const selectedJointBank = banks.find(b => String(b.id) === String(prepayData.joint_bank_id));
        if (!selectedJointBank) {
            alert("Error: Invalid joint bank selected.");
            return;
        }
        if (parseToPaiseBigInt(selectedJointBank.ledgerBalance) < jointAmtPaise) {
            alert("Error: Insufficient funds in the joint bank account.");
            return;
        }
    }
    
    prepayMutation.mutate({ loanId, body: { 
        amount: formatBigIntToDecimalString(amountPaise), 
        date: prepayData.date, 
        source_bank_id: prepayData.source_bank_id || null, 
        joint_bank_id: prepayData.joint_bank_id || null, 
        split_amount: formatBigIntToDecimalString(sourceAmtPaise) 
    } });
  };

  const currentError = loansError || payError || recError || updateLoanMutation.error || deleteLoanMutation.error || prepayMutation.error;
  const fetchError = currentError?.message;
  const isErrorHidden = hiddenError === currentError;
  
  const dismissError = () => {
    if (currentError) setHiddenError(currentError);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="animate-fade-in page-container">
      {fetchError && !isErrorHidden && (
        <div className="alert-banner danger" role="alert" style={{ marginBottom: '24px' }}>
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{fetchError}</span>
          <button className="icon-btn" onClick={dismissError} aria-label="Dismiss error">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex-between" style={{ marginBottom: '24px' }}>
        <div className="section-header" style={{ marginBottom: 0 }}>
          <h2 style={{background:'linear-gradient(135deg, #ef4444, #f59e0b)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', margin:0}}>Loan Command Center</h2>
          <p style={{ margin:0, color: 'var(--text-muted)' }}>Amortization Engine · Prepayment Simulator · Interest Destruction</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsAdding(!isAdding)} aria-label="Originate new loan">
          {isAdding ? <><X size={16} style={{marginRight:'6px'}} /> Cancel Loan Addition</> : <><Plus size={16} style={{marginRight:'6px'}} /> New Loan</>}
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
            <NewLoanForm key="new-loan-form" banks={banks} familyMembers={familyMembers} onClose={() => setIsAdding(false)} onSuccess={() => { setIsAdding(false); queryClient.invalidateQueries({ queryKey: ['reminders'] }); queryClient.invalidateQueries({ queryKey: ['loans-list'] }); queryClient.invalidateQueries({ queryKey: ['reconciliation'] }); queryClient.invalidateQueries({ queryKey: ['bank-balances'] }); }} />
        )}
      </AnimatePresence>

      {loans.length > 0 && <LoanDashboard metrics={metrics} activeCount={activeLoans.length} />}

      <ActiveLoans activeLoans={activeLoans} banks={banks} familyMembers={familyMembers} onEditSave={handleEditSave} onDelete={handleDelete} onPrepay={handlePrepay} formatDate={formatDate} />
      
      <DefeatedLoans defeatedLoans={defeatedLoans} formatDate={formatDate} />

      {loans.length === 0 && !isAdding && !isLoading && (
        <div className="glass-panel">
          <div className="empty-state">
            <div className="empty-state-icon">🏦</div>
            <div className="empty-state-title">No Loans Tracked</div>
            <div className="empty-state-desc">Click "Originate Loan" to start tracking your debt and destroy interest.</div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!deletingLoanId}
        title="Delete Loan"
        message="Are you sure you want to completely delete this loan and its history? This action cannot be reversed."
        confirmText="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeletingLoanId(null)}
      />
    </motion.div>

  );
}

