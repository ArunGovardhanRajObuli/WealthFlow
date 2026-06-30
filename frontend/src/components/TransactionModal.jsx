import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function getLocalYYYYMMDD() {
  const d = new Date();
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().split('T')[0];
}

function parseToPaiseBigInt(val) {
    if (val === null || val === undefined) return 0n;
    if (typeof val === 'bigint') return val;
    let str = String(val).trim().replace(/,/g, '');
    if (str === '' || str === '0') return 0n;
    const isNeg = str.startsWith('-');
    if (isNeg) str = str.substring(1);
    const parts = str.split('.');
    let whole = parts[0] || '0';
    let frac = parts[1] || '';
    if (frac.length > 2) return -1n;
    else if (frac.length === 1) frac += '0';
    else if (frac.length === 0) frac = '00';
    const paiseStr = whole + frac;
    try {
        let result = BigInt(paiseStr);
        return isNeg ? -result : result;
    } catch {
        return -1n; // Indicate error with invalid state
    }
}

function formatBigIntToDecimalString(bigIntVal) {
    let str = bigIntVal.toString();
    const isNeg = str.startsWith('-');
    if (isNeg) str = str.substring(1);
    while (str.length < 3) str = '0' + str;
    const whole = str.substring(0, str.length - 2);
    const frac = str.substring(str.length - 2);
    return (isNeg ? '-' : '') + whole + '.' + frac;
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ConfirmationModal from './ConfirmationModal';
import CustomSelect from './ui/CustomSelect';

function TransactionModal({ isOpen, onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('standard'); // standard or transfer
  const [confirmState, setConfirmState] = useState({ isOpen: false, msg: '', pendingPayload: null, pendingAction: null });
  const [apiError, setApiError] = useState(null);

  const [formData, setFormData] = useState({
    title: '', amount: '', type: 'expense', category: 'regular', 
    date: getLocalYYYYMMDD(), isTaxDeductible: 0, receiptUrl: null,
    source_bank_id: '', joint_bank_id: '', split_amount: '',
    linked_loan_id: '', credit_card_id: '', sinking_fund_id: '', investment_id: '',
    propertyId: '', fd_id: '', gold_id: '', nps_id: '', insurance_id: '', subscription_id: '', family_member_id: ''
  });

  const [transferData, setTransferData] = useState({
    amount: '', date: getLocalYYYYMMDD(), source_bank_id: '', target_bank_id: ''
  });

  const [setupData, setSetupData] = useState({
    name: '', role: 'Provider', age: '', annualIncome: '', 
    collegeSavings: '', targetAge: 18, targetCollegeValue: 150000,
    bankName: 'Cash Wallet', balance: '0.00'
  });
  const [isSettingUp, setIsSettingUp] = useState(false);

  const { data: recData, isLoading: recLoading, isError: recError } = useQuery({ queryKey: ['bank-balances'], queryFn: () => fetch('/api/bank-balances').then(r=>r.json()), enabled: isOpen });
  const { data: budData, isLoading: budLoading, isError: budError } = useQuery({ queryKey: ['budgets'], queryFn: () => fetch('/api/budgets').then(r=>r.json()), enabled: isOpen && activeTab === 'standard' && formData.type === 'expense' });
  const { data: remData, isLoading: remLoading, isError: remError } = useQuery({ queryKey: ['reminders'], queryFn: () => fetch('/api/reminders').then(r=>r.json()), enabled: isOpen && ['loan', 'insurance', 'subscription'].includes(formData.category) });
  const { data: ccData, isLoading: ccLoading, isError: ccError } = useQuery({ queryKey: ['credit-cards'], queryFn: () => fetch('/api/credit-cards').then(r=>r.json()), enabled: isOpen && formData.category === 'cc_repayment' });
  const { data: sfData, isLoading: sfLoading, isError: sfError } = useQuery({ queryKey: ['sinking-funds'], queryFn: () => fetch('/api/sinking-funds').then(r=>r.json()), enabled: isOpen && ['sinking_fund', 'capital_retrieval'].includes(formData.category) });
  const { data: invData, isLoading: invLoading, isError: invError } = useQuery({ queryKey: ['investments'], queryFn: () => fetch('/api/investments').then(r=>r.json()), enabled: isOpen && ['investment', 'capital_retrieval'].includes(formData.category) });
  const { data: reData, isLoading: reLoading, isError: reError } = useQuery({ queryKey: ['real-estate'], queryFn: () => fetch('/api/real-estate').then(r=>r.json()), enabled: isOpen && ['maintenance', 'rental', 'capital_retrieval'].includes(formData.category) });
  const { data: fdData, isLoading: fdLoading, isError: fdError } = useQuery({ queryKey: ['fixed-deposits'], queryFn: () => fetch('/api/fixed-deposits').then(r=>r.json()), enabled: isOpen && ['fd_investment', 'capital_retrieval'].includes(formData.category) });
  const { data: goldData, isLoading: goldLoading, isError: goldError } = useQuery({ queryKey: ['gold-holdings'], queryFn: () => fetch('/api/gold-holdings').then(r=>r.json()), enabled: isOpen && ['gold_investment', 'capital_retrieval'].includes(formData.category) });
  const { data: npsData, isLoading: npsLoading, isError: npsError } = useQuery({ queryKey: ['nps-accounts'], queryFn: () => fetch('/api/nps-accounts').then(r=>r.json()), enabled: isOpen && ['nps_investment', 'capital_retrieval'].includes(formData.category) });
  const { data: fmData, isLoading: fmLoading, isError: fmError } = useQuery({ queryKey: ['family-members'], queryFn: () => fetch('/api/family-members').then(r=>r.json()), enabled: isOpen && ['capital_deployment', 'capital_retrieval'].includes(formData.category) });
  const isDataLoading = recLoading || budLoading || remLoading || ccLoading || sfLoading || invLoading || reLoading || fdLoading || goldLoading || npsLoading || fmLoading;
  const isDataError = recError || budError || remError || ccError || sfError || invError || reError || fdError || goldError || npsError || fmError;

  const banks = useMemo(() => recData?.data || [], [recData]);
  const BUILT_IN_EXPENSE_CATS = useMemo(() => ['regular', 'irregular', 'loan', 'cc_repayment', 'sinking_fund', 'investment', 'fd_investment', 'gold_investment', 'nps_investment', 'maintenance', 'insurance', 'subscription'], []);
  const budgetCategories = useMemo(() => {
      if (!budData?.data) return [];
      return budData.data.map(b => b.category).filter(cat => !BUILT_IN_EXPENSE_CATS.includes(cat.toLowerCase()));
  }, [budData, BUILT_IN_EXPENSE_CATS]);
  const loans = useMemo(() => remData?.data ? remData.data.filter(x => x.category === 'loan') : [], [remData]);
  const insurances = useMemo(() => remData?.data ? remData.data.filter(x => x.category === 'insurance') : [], [remData]);
  const subscriptions = useMemo(() => remData?.data ? remData.data.filter(x => x.category === 'subscription') : [], [remData]);
  const creditCards = ccData?.data || [];
  const sinkingFunds = sfData?.data || [];
  const investments = invData?.data || [];
  const properties = reData?.data || [];
  const fds = fdData?.data || [];
  const gold = goldData?.data || [];
  const nps = npsData?.data || [];
  const familyMembers = fmData?.data || [];

  useEffect(() => {
    if (isOpen) {
      setFormData(f => ({ ...f, date: getLocalYYYYMMDD() }));
      setTransferData(t => ({ ...t, date: getLocalYYYYMMDD() }));
    } else {
      setFormData(f => ({
        ...f,
        title: '', amount: '', type: 'expense', category: 'regular', 
        date: getLocalYYYYMMDD(), isTaxDeductible: 0, receiptUrl: null,
        joint_bank_id: '', split_amount: '',
        linked_loan_id: '', credit_card_id: '', sinking_fund_id: '', investment_id: '',
        propertyId: '', fd_id: '', gold_id: '', nps_id: '', insurance_id: '', subscription_id: '', family_member_id: ''
      }));
      setTransferData(t => ({
        ...t,
        amount: '', date: getLocalYYYYMMDD()
      }));
      setActiveTab('standard');
      setApiError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (banks.length > 0) {
        setFormData(f => f.source_bank_id ? f : ({...f, source_bank_id: banks[0].id}));
        setTransferData(t => t.source_bank_id ? t : ({...t, source_bank_id: banks[0].id, target_bank_id: banks.length > 1 ? banks[1].id : ''}));
    }
  }, [banks]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'type') {
      setFormData({ 
          ...formData, 
          type: value, 
          category: value === 'income' ? 'salary' : 'regular',
          isTaxDeductible: value === 'income' ? 0 : formData.isTaxDeductible 
      });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };
  const handleTransferChange = (e) => setTransferData({ ...transferData, [e.target.name]: e.target.value });

  const isSubmittingRef = React.useRef(false);

  const transferMut = useMutation({
    mutationFn: (data) => fetch('/api/transfer', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(data) }).then(async r => { if (!r.ok) { let e; try { e = await r.json(); } catch (err) { throw new Error(`Network or server error (${r.status})`, { cause: err }); } throw new Error(e?.error || 'Transfer failed'); } return r.json(); }),
    onSuccess: async () => {
      setApiError(null);
      queryClient.invalidateQueries(); // Invalidate all to refresh ledger, banks, etc.
      onSuccess();
      onClose();
    },
    onError: (err) => setApiError(err.message),
    onSettled: () => { isSubmittingRef.current = false; }
  });

  const txMut = useMutation({
    mutationFn: (data) => fetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(data) }).then(async r => { if (!r.ok) { let e; try { e = await r.json(); } catch (err) { throw new Error(`Network or server error (${r.status})`, { cause: err }); } throw new Error(e?.error || 'Transaction failed'); } return r.json(); }),
    onSuccess: async () => {
      setApiError(null);
      queryClient.invalidateQueries(); // Invalidate all to refresh everything
      onSuccess();
      onClose();
    },
    onError: (err) => setApiError(err.message),
    onSettled: () => { isSubmittingRef.current = false; }
  });

  const executeSubmit = (actionType, payload) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setApiError(null);
    if (actionType === 'transfer') {
      transferMut.mutate(payload);
    } else {
      txMut.mutate(payload);
    }
  };

  const handleQuickSetup = async (e) => {
    e.preventDefault();
    if (isSettingUp) return;
    setIsSettingUp(true);
    setApiError(null);
    try {
        const memberRes = await fetch('/api/family-members', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                name: setupData.name, role: setupData.role, age: setupData.age, 
                annualIncome: setupData.annualIncome, collegeSavings: setupData.collegeSavings, 
                targetAge: setupData.targetAge, targetCollegeValue: setupData.targetCollegeValue
            })
        });
        if (!memberRes.ok) throw new Error("Failed to create family member");
        const memberData = await memberRes.json();
        const memberId = memberData.data?.id || memberData.id;
        
        const bankRes = await fetch('/api/bank-balances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                bankName: setupData.bankName, balance: setupData.balance, 
                owner_member_id: memberId,
                asOfDate: getLocalYYYYMMDD()
            })
        });
        if (!bankRes.ok) throw new Error("Failed to create cash wallet");
        
        await queryClient.invalidateQueries();
    } catch (err) {
        setApiError(err.message);
    } finally {
        setIsSettingUp(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    let isOverdraft = false;
    let warningMsg = '';

    if (activeTab === 'transfer') {
        const amtPaise = parseToPaiseBigInt(transferData.amount);
        if (amtPaise <= 0n) {
            setApiError("Please enter a valid positive amount with up to 2 decimal places.");
            return;
        }
        if (!transferData.source_bank_id || !transferData.target_bank_id) {
            setApiError("Please select both source and target accounts.");
            return;
        }
        if (String(transferData.source_bank_id) === String(transferData.target_bank_id)) {
            setApiError("Source and target accounts must be different.");
            return;
        }
        const sourceBank = banks.find(b => String(b.id) === String(transferData.source_bank_id));
        const targetBank = banks.find(b => String(b.id) === String(transferData.target_bank_id));
        if (!sourceBank || !targetBank) {
            setApiError("Selected bank accounts are invalid.");
            return;
        }
        if (amtPaise > parseToPaiseBigInt(sourceBank.ledgerBalance)) {
            isOverdraft = true;
            warningMsg = `Transfer exceeds available balance in ${sourceBank.bankName}. Current ledger balance is ₹${sourceBank.ledgerBalance}. Proceed anyway?`;
        }
        
        const payload = {
            date: String(transferData.date),
            source_bank_id: transferData.source_bank_id ? String(transferData.source_bank_id) : null,
            target_bank_id: transferData.target_bank_id ? String(transferData.target_bank_id) : null,
            amount: formatBigIntToDecimalString(amtPaise)
        };
        
        if (isOverdraft) {
            setConfirmState({ isOpen: true, msg: warningMsg, pendingPayload: payload, pendingAction: 'transfer' });
        } else {
            executeSubmit('transfer', payload);
        }
        return;
    } else {
        const amtPaise = parseToPaiseBigInt(formData.amount);
        if (amtPaise <= 0n) {
            setApiError("Please enter a valid positive amount with up to 2 decimal places.");
            return;
        }
        
        if (formData.type !== 'expense' && formData.type !== 'income') {
            return setApiError("Invalid transaction type.");
        }
        
        const validExpenseCategories = ['regular', 'irregular', 'capital_deployment', 'loan', 'cc_repayment', 'sinking_fund', 'investment', 'fd_investment', 'gold_investment', 'nps_investment', 'maintenance', 'insurance', 'subscription', 'realized_ltcl', 'realized_stcl', 'opening_balance', ...budgetCategories.map(c=>c.toLowerCase())];
        const validIncomeCategories = ['salary', 'rental', 'capital_retrieval', 'realized_ltcg', 'realized_stcg', 'realized_stcg_debt', 'dividend', 'opening_balance', 'other'];
        
        if (formData.type === 'expense' && !validExpenseCategories.includes(formData.category)) {
            return setApiError("Invalid expense category.");
        }
        if (formData.type === 'income' && !validIncomeCategories.includes(formData.category)) {
            return setApiError("Invalid income category.");
        }

        const reqCategory = formData.category;
        const sourceBank = formData.source_bank_id ? banks.find(b => String(b.id) === String(formData.source_bank_id)) : null;
        const sourceCC = formData.credit_card_id ? creditCards.find(c => String(c.id) === String(formData.credit_card_id)) : null;
        const jointBank = formData.joint_bank_id ? banks.find(b => String(b.id) === String(formData.joint_bank_id)) : null;

        if (reqCategory !== 'opening_balance') {
            if (reqCategory === 'cc_repayment') {
                if (!sourceBank) return setApiError("Please select a valid primary bank account to pay from.");
                if (!sourceCC) return setApiError("Please select a valid credit card to repay.");
            } else {
                if (!sourceBank && !sourceCC) return setApiError("Selected primary payment source is invalid.");
            }
        }

        if (formData.joint_bank_id && !jointBank) {
            setApiError("Selected joint bank account is invalid.");
            return;
        }
        
        if ((reqCategory === 'maintenance' || reqCategory === 'rental') && (!formData.propertyId || !properties.find(p => String(p.id) === String(formData.propertyId)))) return setApiError("Please select a valid property.");
        if (reqCategory === 'fd_investment' && (!formData.fd_id || !fds.find(x => String(x.id) === String(formData.fd_id)))) return setApiError("Please select a valid fixed deposit.");
        if (reqCategory === 'gold_investment' && (!formData.gold_id || !gold.find(x => String(x.id) === String(formData.gold_id)))) return setApiError("Please select a valid gold holding.");
        if (reqCategory === 'nps_investment' && (!formData.nps_id || !nps.find(x => String(x.id) === String(formData.nps_id)))) return setApiError("Please select a valid NPS account.");
        if (reqCategory === 'loan' && (!formData.linked_loan_id || !loans.find(x => String(x.id) === String(formData.linked_loan_id)))) return setApiError("Please select a valid loan.");
        if (reqCategory === 'insurance' && (!formData.insurance_id || !insurances.find(x => String(x.id) === String(formData.insurance_id)))) return setApiError("Please select a valid insurance policy.");
        if (reqCategory === 'subscription' && (!formData.subscription_id || !subscriptions.find(x => String(x.id) === String(formData.subscription_id)))) return setApiError("Please select a valid subscription.");
        if (reqCategory === 'sinking_fund' && (!formData.sinking_fund_id || !sinkingFunds.find(x => String(x.id) === String(formData.sinking_fund_id)))) return setApiError("Please select a valid sinking fund.");
        if (reqCategory === 'investment' && (!formData.investment_id || !investments.find(x => String(x.id) === String(formData.investment_id)))) return setApiError("Please select a valid investment.");
        if (reqCategory === 'capital_retrieval' && !formData.investment_id && !formData.sinking_fund_id && !formData.fd_id && !formData.gold_id && !formData.nps_id && !formData.propertyId && !formData.family_member_id) return setApiError("Please select an asset to retrieve capital from.");

        let sourceAmtPaise = amtPaise;
        if (formData.joint_bank_id) {
            if (String(formData.source_bank_id) === String(formData.joint_bank_id)) {
                setApiError("Primary and Joint split accounts must be different.");
                return;
            }
            const splitPaise = parseToPaiseBigInt(formData.split_amount);
            if (splitPaise <= 0n || splitPaise > amtPaise) {
                setApiError("Split amount must be a valid number greater than ₹0 and up to the total transaction amount (max 2 decimal places).");
                return;
            }
            const jointAmtPaise = splitPaise;
            sourceAmtPaise = amtPaise - jointAmtPaise;
        }

        if (formData.type === 'expense') {
            const jointAmtPaise = formData.joint_bank_id ? parseToPaiseBigInt(formData.split_amount) : 0n;

            let warnings = [];
            if (sourceBank && sourceAmtPaise > parseToPaiseBigInt(sourceBank.ledgerBalance)) {
                isOverdraft = true;
                warnings.push(`${sourceBank.bankName} (Bal: ₹${sourceBank.ledgerBalance})`);
            }
            if (jointBank && jointAmtPaise > parseToPaiseBigInt(jointBank.ledgerBalance)) {
                isOverdraft = true;
                warnings.push(`${jointBank.bankName} (Bal: ₹${jointBank.ledgerBalance})`);
            }
            if (isOverdraft) {
                warningMsg = `Transaction exceeds available balance in ${warnings.join(' and ')}. Proceed anyway?`;
            }
        }
        
        let safeSplit = null;
        let splitPercent = 100.0;
        if (formData.joint_bank_id) {
            safeSplit = formatBigIntToDecimalString(parseToPaiseBigInt(formData.split_amount));
            const total = parseToPaiseBigInt(formData.amount);
            const split = parseToPaiseBigInt(formData.split_amount);
            if (total > 0n) {
                splitPercent = Number((split * 1000000n) / total) / 10000;
            }
        }
        const payload = { 
            title: String(formData.title),
            type: String(formData.type),
            category: String(formData.category),
            date: String(formData.date),
            isTaxDeductible: formData.isTaxDeductible ? 1 : 0,
            receiptUrl: formData.receiptUrl,
            amount: formatBigIntToDecimalString(amtPaise),
            source_bank_id: formData.source_bank_id ? String(formData.source_bank_id) : null,
            joint_bank_id: formData.joint_bank_id ? String(formData.joint_bank_id) : null,
            split_amount: safeSplit,
            split_percent: splitPercent,
            linked_loan_id: formData.category === 'loan' ? (formData.linked_loan_id ? String(formData.linked_loan_id) : null) : null,
            credit_card_id: (formData.category === 'cc_repayment' || formData.credit_card_id) ? String(formData.credit_card_id) : null,
            sinking_fund_id: (formData.category === 'sinking_fund' || formData.category === 'capital_retrieval') ? (formData.sinking_fund_id ? String(formData.sinking_fund_id) : null) : null,
            investment_id: (formData.category === 'investment' || formData.category === 'capital_retrieval') ? (formData.investment_id ? String(formData.investment_id) : null) : null,
            propertyId: (formData.category === 'maintenance' || formData.category === 'rental' || formData.category === 'capital_retrieval') ? (formData.propertyId ? String(formData.propertyId) : null) : null,
            fd_id: (formData.category === 'fd_investment' || formData.category === 'capital_retrieval') ? (formData.fd_id ? String(formData.fd_id) : null) : null,
            gold_id: (formData.category === 'gold_investment' || formData.category === 'capital_retrieval') ? (formData.gold_id ? String(formData.gold_id) : null) : null,
            nps_id: (formData.category === 'nps_investment' || formData.category === 'capital_retrieval') ? (formData.nps_id ? String(formData.nps_id) : null) : null,
            insurance_id: formData.category === 'insurance' ? (formData.insurance_id ? String(formData.insurance_id) : null) : null,
            subscription_id: formData.category === 'subscription' ? (formData.subscription_id ? String(formData.subscription_id) : null) : null,
            family_member_id: formData.family_member_id ? String(formData.family_member_id) : null
        };
        
        if (isOverdraft) {
            setConfirmState({ isOpen: true, msg: warningMsg, pendingPayload: payload, pendingAction: 'standard' });
        } else {
            executeSubmit('standard', payload);
        }
    }
  };

  const handleConfirmOverdraft = () => {
      const { pendingAction, pendingPayload } = confirmState;
      setConfirmState({ isOpen: false, msg: '', pendingPayload: null, pendingAction: null });
      if (pendingPayload) {
          executeSubmit(pendingAction, pendingPayload);
      }
  };

  const inputStyle = { padding:'12px 16px', background:'rgba(20,20,20,0.8)', border:'1px solid var(--border-color)', borderRadius:'12px', color:'var(--text-primary)', fontSize:'14px', width:'100%', marginTop:'4px', outline:'none', boxShadow:'inset 0 2px 4px 0 rgba(0, 0, 0, 0.4)', transition:'all 0.2s' };

  const isSubmitting = txMut.isPending || transferMut.isPending;

  return (
    <>
    <ConfirmationModal 
        isOpen={confirmState.isOpen} 
        title="Overdraft Warning" 
        message={confirmState.msg} 
        onConfirm={handleConfirmOverdraft} 
        onCancel={() => {
            if (isSubmitting) return;
            setConfirmState({ isOpen: false, msg: '', pendingPayload: null, pendingAction: null });
        }} 
        confirmText="Proceed Anyway" 
    />
    <AnimatePresence>
      {isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            transition={{ duration: 0.3 }}
            style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
            onClick={isSubmitting ? undefined : onClose}
          />
          
          {/* Drawer */}
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="glass-panel" 
            style={{ 
              position: 'relative',
              width: '480px', 
              maxWidth: '100%', 
              height: '100%', 
              borderRadius: '24px 0 0 24px',
              borderRight: 'none',
              padding: '32px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {banks.length > 0 && !isDataLoading && !isDataError && (
                <div style={{display:'flex', gap:'8px', marginBottom:'24px', flexShrink: 0}}>
                   <button type="button" onClick={()=>setActiveTab('standard')} style={{flex:1, padding:'10px', borderRadius:'12px', border:'none', background: activeTab==='standard'?'linear-gradient(to right, #3b82f6, #4f46e5)':'rgba(25,25,25,0.6)', color:'#fff', cursor:'pointer', fontWeight:600, transition:'all 0.2s'}}>Standard</button>
                   <button type="button" onClick={()=>setActiveTab('transfer')} style={{flex:1, padding:'10px', borderRadius:'12px', border:'none', background: activeTab==='transfer'?'linear-gradient(to right, #f59e0b, #ef4444)':'rgba(25,25,25,0.6)', color:'#fff', cursor:'pointer', fontWeight:600, transition:'all 0.2s'}}>Internal Transfer</button>
                </div>
            )}

            {apiError && (
              <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '12px', color: '#ef4444', marginBottom: '16px', fontSize: '13px' }}>
                {apiError}
              </div>
            )}

            <form onSubmit={banks.length === 0 ? handleQuickSetup : handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
              {isDataLoading && (<div style={{position: 'absolute', inset: 0, background: 'rgba(20,20,20,0.6)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px'}}><span style={{color: 'var(--text-secondary)'}}>Loading options...</span></div>)}
              {isDataError && (<div style={{position: 'absolute', inset: 0, background: 'rgba(20,20,20,0.6)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px'}}><span style={{color: '#ef4444'}}>Error loading required data. Please refresh.</span></div>)}
              <div style={{ flex: 1 }}>
                {banks.length === 0 && !isDataLoading && !isDataError ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ padding: '16px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', borderRadius: '12px', color: '#60a5fa', textAlign: 'center', fontSize: '13px', lineHeight: '1.5' }}>
                      <strong>Welcome! Let's get you set up.</strong><br/>
                      Please provide a few details to create your profile and initial cash wallet.
                    </div>
                    
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '8px' }}>Family Member Details</div>
                    <input required placeholder="Your Name" value={setupData.name} onChange={e=>setSetupData({...setupData, name:e.target.value})} style={inputStyle} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <CustomSelect value={setupData.role} onChange={e=>setSetupData({...setupData, role:e.target.value})} style={inputStyle}>
                        <option value="Provider" style={{background: '#1a1a1a', color: '#fff'}}>Primary Provider / Breadwinner</option>
                        <option value="Partner" style={{background: '#1a1a1a', color: '#fff'}}>Spouse / Partner</option>
                        <option value="Child" style={{background: '#1a1a1a', color: '#fff'}}>Child (Dependent)</option>
                        <option value="Elder" style={{background: '#1a1a1a', color: '#fff'}}>Elder (Dependent / Grandparent)</option>
                        <option value="HUF" style={{background: '#1a1a1a', color: '#fff'}}>HUF (Hindu Undivided Family)</option>
                      </CustomSelect>
                      {setupData.role !== 'HUF' && (
                        <input required type="number" placeholder="Age" value={setupData.age} onChange={e=>setSetupData({...setupData, age:e.target.value})} style={inputStyle} />
                      )}
                    </div>
                    
                    {['Provider', 'Partner', 'Elder', 'HUF'].includes(setupData.role) && (
                      <input type="number" step="0.01" placeholder="Annual Income (₹)" value={setupData.annualIncome} onChange={e=>setSetupData({...setupData, annualIncome:e.target.value})} style={inputStyle} />
                    )}
                    
                    {setupData.role === 'Child' && (
                      <>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '16px' }}>Education Targets (Optional)</div>
                        <input type="number" step="0.01" placeholder="Current College Savings (₹)" value={setupData.collegeSavings} onChange={e=>setSetupData({...setupData, collegeSavings:e.target.value})} style={inputStyle} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <input type="number" placeholder="Target Age" value={setupData.targetAge} onChange={e=>setSetupData({...setupData, targetAge:e.target.value})} style={inputStyle} />
                          <input type="number" step="0.01" placeholder="Target Value (₹)" value={setupData.targetCollegeValue} onChange={e=>setSetupData({...setupData, targetCollegeValue:e.target.value})} style={inputStyle} />
                        </div>
                      </>
                    )}

                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '16px' }}>Initial Account</div>
                    <input required placeholder="Account Name (e.g. Cash Wallet)" value={setupData.bankName} onChange={e=>setSetupData({...setupData, bankName:e.target.value})} style={inputStyle} />
                    <input required type="number" step="0.01" placeholder="Starting Balance (₹)" value={setupData.balance} onChange={e=>setSetupData({...setupData, balance:e.target.value})} style={inputStyle} />
                  </div>
                ) : activeTab === 'standard' ? (
             <>
               <div className="form-group mb-4">
                 <label style={{fontSize:'12px', color:'var(--text-muted)'}}>Title</label>
                 <input required name="title" value={formData.title} onChange={handleChange} style={inputStyle} placeholder="e.g. Groceries" />
               </div>
               
               <div className="grid-2 mb-4" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
                 <div>
                   <label style={{fontSize:'12px', color:'var(--text-muted)'}}>Amount (₹)</label>
                   <input required type="number" step="0.01" name="amount" value={formData.amount} onChange={handleChange} style={inputStyle} placeholder="0.00" />
                 </div>
                 <div>
                    <label style={{fontSize:'12px', color:'var(--text-muted)'}}>Date</label>
                    <input required type="date" name="date" value={formData.date} onChange={handleChange} style={inputStyle} />
                 </div>
               </div>

               <div className="grid-2 mb-4" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px'}}>
                 <div>
                   <label style={{fontSize:'12px', color:'var(--text-muted)'}}>Type</label>
                   <CustomSelect name="type" style={inputStyle} value={formData.type} onChange={handleChange}>
                     <option value="expense">Expense</option>
                     <option value="income">Income</option>
                   </CustomSelect>
                 </div>
                 <div>
                     <label style={{fontSize:'12px', color:'var(--text-muted)'}}>Category</label>
                      <CustomSelect name="category" style={inputStyle} value={formData.category} onChange={handleChange}>
                        {formData.type === 'expense' ? (
                          <>
                              <optgroup label="General">
                                <option value="opening_balance">Opening Balance</option>
                                <option value="regular">Regular</option>
                              <option value="irregular">Irregular</option>
                              <option value="capital_deployment">Capital Deployment</option>
                              <option value="loan">Loan EMI</option>
                              <option value="cc_repayment">Credit Card Repayment</option>
                              <option value="sinking_fund">Sinking Fund Contribution</option>
                              <option value="investment">Investment / Sip</option>
                              <option value="fd_investment">Fixed Deposit Funding</option>
                              <option value="gold_investment">Gold Purchase</option>
                              <option value="nps_investment">NPS Contribution</option>
                              <option value="maintenance">Property Maintenance</option>
                              <option value="insurance">Insurance Premium</option>
                              <option value="subscription">Subscription</option>
                              <option value="realized_ltcl">LTCL (Property/Gold Loss)</option>
                              <option value="realized_stcl">STCL (Property/Gold Loss)</option>
                            </optgroup>
                            {budgetCategories.length > 0 && (
                              <optgroup label="Budget Envelopes">
                                {budgetCategories.map(cat => <option key={cat} value={cat.toLowerCase()}>{cat}</option>)}
                              </optgroup>
                            )}
                          </>
                        ) : (
                          <><option value="opening_balance">Opening Balance</option><option value="salary">Salary</option><option value="rental">Rental</option><option value="capital_retrieval">Capital Retrieval (Sell)</option><option value="realized_ltcg">LTCG (Property/Gold)</option><option value="realized_stcg">STCG (Property/Gold)</option><option value="realized_stcg_debt">STCG (Debt/Other)</option><option value="dividend">Dividend</option><option value="other">Other</option></>
                        )}
                     </CustomSelect>
                 </div>
               </div>

               {/* Contextual Asset Selectors */}
               {(formData.category === 'maintenance' || formData.category === 'rental') && (
                 <div className="mb-4">
                   <label style={{fontSize:'12px', color:'var(--accent-sapphire)'}}>Which Property?</label>
                   <CustomSelect name="propertyId" value={formData.propertyId} onChange={handleChange} style={inputStyle} required>
                     <option value="">-- Select Property --</option>
                     {properties.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                   </CustomSelect>
                 </div>
               )}
               {formData.category === 'fd_investment' && (
                 <div className="mb-4">
                   <label style={{fontSize:'12px', color:'var(--accent-sapphire)'}}>Which Fixed Deposit?</label>
                   <CustomSelect name="fd_id" value={formData.fd_id} onChange={handleChange} style={inputStyle} required>
                     <option value="">-- Select FD --</option>
                     {fds.map(f => <option key={f.id} value={f.id}>{f.bankName} (₹{f.principal})</option>)}
                   </CustomSelect>
                 </div>
               )}
               {formData.category === 'gold_investment' && (
                 <div className="mb-4">
                   <label style={{fontSize:'12px', color:'var(--accent-sapphire)'}}>Which Gold Holding?</label>
                   <CustomSelect name="gold_id" value={formData.gold_id} onChange={handleChange} style={inputStyle} required>
                     <option value="">-- Select Gold --</option>
                     {gold.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                   </CustomSelect>
                 </div>
               )}
               {formData.category === 'nps_investment' && (
                 <div className="mb-4">
                   <label style={{fontSize:'12px', color:'var(--accent-sapphire)'}}>Which NPS Account?</label>
                   <CustomSelect name="nps_id" value={formData.nps_id} onChange={handleChange} style={inputStyle} required>
                     <option value="">-- Select NPS --</option>
                     {nps.map(n => <option key={n.id} value={n.id}>{n.memberName} - Tier {n.tier}</option>)}
                   </CustomSelect>
                 </div>
               )}
               {formData.category === 'loan' && (
                 <div className="mb-4">
                   <label style={{fontSize:'12px', color:'var(--accent-sapphire)'}}>Which Loan?</label>
                   <CustomSelect name="linked_loan_id" value={formData.linked_loan_id} onChange={handleChange} style={inputStyle} required>
                     <option value="">-- Select Loan --</option>
                     {loans.map(l => <option key={l.id} value={l.id}>{l.title} (Bal: ₹{l.principalAmount})</option>)}
                   </CustomSelect>
                 </div>
               )}
               {formData.category === 'insurance' && (
                 <div className="mb-4">
                   <label style={{fontSize:'12px', color:'var(--accent-sapphire)'}}>Which Insurance Policy?</label>
                   <CustomSelect name="insurance_id" value={formData.insurance_id} onChange={handleChange} style={inputStyle} required>
                     <option value="">-- Select Policy --</option>
                     {insurances.map(i => <option key={i.id} value={i.id}>{i.title} (Prem: ₹{i.amount})</option>)}
                   </CustomSelect>
                 </div>
               )}
               {formData.category === 'subscription' && (
                 <div className="mb-4">
                   <label style={{fontSize:'12px', color:'var(--accent-sapphire)'}}>Which Subscription?</label>
                   <CustomSelect name="subscription_id" value={formData.subscription_id} onChange={handleChange} style={inputStyle} required>
                     <option value="">-- Select Subscription --</option>
                     {subscriptions.map(s => <option key={s.id} value={s.id}>{s.title} (₹{s.amount})</option>)}
                   </CustomSelect>
                 </div>
               )}
               {formData.category === 'cc_repayment' && (
                 <div className="mb-4">
                   <label style={{fontSize:'12px', color:'var(--accent-sapphire)'}}>Which Credit Card?</label>
                   <CustomSelect name="credit_card_id" value={formData.credit_card_id} onChange={handleChange} style={inputStyle} required>
                     <option value="">-- Select Credit Card --</option>
                      {creditCards.map(c => <option key={c.id} value={c.id}>{c.name} (Avail: ₹{((c.creditLimit || 0) - (c.currentBalance || 0)).toLocaleString('en-IN')})</option>)}
                   </CustomSelect>
                 </div>
               )}
               {formData.category === 'sinking_fund' && (
                 <div className="mb-4">
                   <label style={{fontSize:'12px', color:'var(--accent-sapphire)'}}>Which Sinking Fund?</label>
                   <CustomSelect name="sinking_fund_id" value={formData.sinking_fund_id} onChange={handleChange} style={inputStyle} required>
                     <option value="">-- Select Sinking Fund --</option>
                     {sinkingFunds.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                   </CustomSelect>
                 </div>
               )}
               {formData.category === 'investment' && (
                 <div className="mb-4">
                   <label style={{fontSize:'12px', color:'var(--accent-sapphire)'}}>Which Investment?</label>
                   <CustomSelect name="investment_id" value={formData.investment_id} onChange={handleChange} style={inputStyle} required>
                     <option value="">-- Select Investment --</option>
                     {investments.map(i => <option key={i.id} value={i.id}>{i.title}</option>)}
                   </CustomSelect>
                 </div>
               )}
               {formData.category === 'capital_retrieval' && (
                 <div className="mb-4">
                   <label style={{fontSize:'12px', color:'var(--accent-sapphire)'}}>Retrieve From Which Asset?</label>
                   <CustomSelect style={inputStyle} required value={
                       formData.investment_id ? `inv_${formData.investment_id}` :
                       formData.sinking_fund_id ? `sf_${formData.sinking_fund_id}` :
                       formData.fd_id ? `fd_${formData.fd_id}` :
                       formData.gold_id ? `gold_${formData.gold_id}` :
                       formData.nps_id ? `nps_${formData.nps_id}` :
                       formData.propertyId ? `prop_${formData.propertyId}` : 
                       formData.family_member_id ? `fam_${formData.family_member_id}` : ''
                   } onChange={(e) => {
                       const val = e.target.value;
                       let updates = { investment_id: '', sinking_fund_id: '', fd_id: '', gold_id: '', nps_id: '', propertyId: '', family_member_id: '' };
                       if (val.startsWith('inv_')) updates.investment_id = val.replace('inv_', '');
                       if (val.startsWith('sf_')) updates.sinking_fund_id = val.replace('sf_', '');
                       if (val.startsWith('fd_')) updates.fd_id = val.replace('fd_', '');
                       if (val.startsWith('gold_')) updates.gold_id = val.replace('gold_', '');
                       if (val.startsWith('nps_')) updates.nps_id = val.replace('nps_', '');
                       if (val.startsWith('prop_')) updates.propertyId = val.replace('prop_', '');
                       if (val.startsWith('fam_')) updates.family_member_id = val.replace('fam_', '');
                       setFormData({...formData, ...updates});
                   }}>
                       <option value="">-- Select Asset to Retrieve From --</option>
                       {investments.length > 0 && <optgroup label="Investments">{investments.map(i => <option key={'inv_'+i.id} value={'inv_'+i.id}>{i.title}</option>)}</optgroup>}
                       {sinkingFunds.length > 0 && <optgroup label="Sinking Funds">{sinkingFunds.map(i => <option key={'sf_'+i.id} value={'sf_'+i.id}>{i.title}</option>)}</optgroup>}
                       {fds.length > 0 && <optgroup label="Fixed Deposits">{fds.map(i => <option key={'fd_'+i.id} value={'fd_'+i.id}>{i.bankName}</option>)}</optgroup>}
                       {gold.length > 0 && <optgroup label="Gold Holdings">{gold.map(i => <option key={'gold_'+i.id} value={'gold_'+i.id}>{i.title}</option>)}</optgroup>}
                       {nps.length > 0 && <optgroup label="NPS Accounts">{nps.map(i => <option key={'nps_'+i.id} value={'nps_'+i.id}>{i.memberName}</option>)}</optgroup>}
                       {properties.length > 0 && <optgroup label="Real Estate">{properties.map(i => <option key={'prop_'+i.id} value={'prop_'+i.id}>{i.title}</option>)}</optgroup>}
                       {familyMembers.length > 0 && <optgroup label="Family Endowments">{familyMembers.map(i => <option key={'fam_'+i.id} value={'fam_'+i.id}>{i.name}</option>)}</optgroup>}
                   </CustomSelect>
                 </div>
               )}

               {/* Bank Routing Options */}
               <div style={{background:'rgba(255,255,255,0.02)', padding:'12px', borderRadius:'12px', border:'1px solid rgba(255,255,255,0.05)', marginBottom:'16px'}}>
                   <div style={{fontSize:'12px', color:'var(--accent-sapphire)', fontWeight:600, marginBottom:'8px'}}>Payment Source</div>
                   <div style={{display:'flex', gap:'8px', marginBottom:'8px'}}>
                       <CustomSelect required value={formData.source_bank_id || (formData.credit_card_id && formData.category !== 'cc_repayment' ? `cc_${formData.credit_card_id}` : '')} 
                               onChange={e => {
                                   const val = e.target.value;
                                   if (val.startsWith('cc_')) {
                                       setFormData({...formData, source_bank_id: '', credit_card_id: val.replace('cc_', '')});
                                   } else {
                                       setFormData({...formData, source_bank_id: val, credit_card_id: formData.category === 'cc_repayment' ? formData.credit_card_id : ''});
                                   }
                               }} style={{...inputStyle, flex:2}}>
                           <option value="" disabled>-- Select Payment Source --</option>
                           <optgroup label="Banks & Cash Wallets">
                               {banks.map(b => <option key={b.id} value={b.id}>{b.bankName} (₹{b.ledgerBalance?.toLocaleString('en-IN')})</option>)}
                           </optgroup>
                           {formData.type === 'expense' && formData.category !== 'cc_repayment' && creditCards.length > 0 && (
                               <optgroup label="Credit Cards">
                                   {creditCards.map(c => <option key={`cc_${c.id}`} value={`cc_${c.id}`}>{c.name} (Avail: ₹{((c.creditLimit || 0) - (c.currentBalance || 0)).toLocaleString('en-IN')})</option>)}
                               </optgroup>
                           )}
                       </CustomSelect>
                   </div>
                   <div style={{display:'flex', gap:'8px'}}>
                       <CustomSelect value={formData.joint_bank_id} onChange={e=>{
                           const val = e.target.value;
                           setFormData({...formData, joint_bank_id: val, split_amount: val ? formData.split_amount : ''});
                       }} style={{...inputStyle, flex:2}} disabled={!!formData.credit_card_id && formData.category !== 'cc_repayment'}>
                           <option value="">-- No Joint Split --</option>
                           {banks.map(b => <option key={b.id} value={b.id}>{b.bankName} (₹{b.ledgerBalance?.toLocaleString('en-IN')})</option>)}
                       </CustomSelect>
                       <input type="number" step="0.01" placeholder="Split Amount" value={formData.split_amount} onChange={e=>setFormData({...formData, split_amount:e.target.value})} style={{...inputStyle, flex:1}} title="Amount from Joint Account" disabled={!formData.joint_bank_id} required={!!formData.joint_bank_id} />
                   </div>
               </div>

               {formData.type === 'expense' && (
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" checked={formData.isTaxDeductible === 1} onChange={e => setFormData({...formData, isTaxDeductible: e.target.checked ? 1 : 0})} style={{ width: '16px', height: '16px' }} />
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Tax Deductible (Save to Vault)</span>
                 </div>
               )}
             </>
          ) : (
             <>
                <div style={{fontSize:'13px', color:'var(--text-muted)', marginBottom:'16px'}}>Transfer funds internally between mapped bank accounts without affecting global net worth.</div>
                <div style={{display:'flex', gap:'12px', marginBottom:'16px'}}>
                    <div style={{flex:1}}>
                        <label style={{fontSize:'12px', color:'var(--text-muted)'}}>Amount (₹)</label>
                        <input required type="number" step="0.01" name="amount" value={transferData.amount} onChange={handleTransferChange} style={inputStyle} placeholder="0.00" />
                    </div>
                    <div style={{flex:1}}>
                        <label style={{fontSize:'12px', color:'var(--text-muted)'}}>Date</label>
                        <input required type="date" name="date" value={transferData.date} onChange={handleTransferChange} style={inputStyle} />
                    </div>
                </div>
                <div style={{display:'flex', flexDirection:'column', gap:'12px', marginBottom:'24px'}}>
                    <div>
                        <label style={{fontSize:'12px', color:'var(--text-muted)'}}>Source Account (Withdrawal)</label>
                        <CustomSelect required name="source_bank_id" value={transferData.source_bank_id} onChange={handleTransferChange} style={inputStyle}>
                            <option value="">-- Select Source Bank --</option>
                            {banks.map(b => <option key={b.id} value={b.id}>{b.bankName} (₹{b.ledgerBalance?.toLocaleString('en-IN')})</option>)}
                        </CustomSelect>
                    </div>
                    <div>
                        <label style={{fontSize:'12px', color:'var(--text-muted)'}}>Target Account (Deposit)</label>
                        <CustomSelect required name="target_bank_id" value={transferData.target_bank_id} onChange={handleTransferChange} style={inputStyle}>
                            <option value="">-- Select Target Bank --</option>
                            {banks.map(b => <option key={b.id} value={b.id}>{b.bankName} (₹{b.ledgerBalance?.toLocaleString('en-IN')})</option>)}
                        </CustomSelect>
                    </div>
                </div>
             </>
          )}

              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '32px', paddingBottom: '32px' }}>
                <button type="button" onClick={isSubmitting || isSettingUp ? undefined : onClose} disabled={isSubmitting || isSettingUp} className="btn" style={{ flex: 1, backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', opacity: (isSubmitting || isSettingUp) ? 0.5 : 1, cursor: (isSubmitting || isSettingUp) ? 'not-allowed' : 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting || isSettingUp} className="btn btn-primary" style={{ flex: 1, background: activeTab==='transfer'?'linear-gradient(to right, #f59e0b, #ef4444)':'linear-gradient(to right, #3b82f6, #4f46e5)', border:'none', opacity: (isSubmitting || isSettingUp) ? 0.7 : 1, cursor: (isSubmitting || isSettingUp) ? 'not-allowed' : 'pointer' }}>
                  {banks.length === 0 ? (isSettingUp ? 'Setting up...' : 'Complete Setup & Continue') : isSubmitting ? 'Processing...' : (activeTab === 'transfer' ? 'Execute Transfer' : 'Save Record')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  );
}

export default TransactionModal;

