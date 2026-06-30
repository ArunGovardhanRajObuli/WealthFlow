import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useLedgerState() {
  const queryClient = useQueryClient();

  // Active sub-tab in Ledger
  const [activeTab, setActiveTab] = useState('transactions');

  // Editing state
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  // Export & Delete Modals
  const [isExporting, setIsExporting] = useState(false);
  const [showImportTools, setShowImportTools] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, id: null, title: '' });

  // L7 FIX #3: Wrap in useCallback. Passed as a prop to child components.
  const invalidateAllLedgerQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['ledger-lines'] }),
      queryClient.invalidateQueries({ queryKey: ['summary'] }),
      queryClient.invalidateQueries({ queryKey: ['liquidity'] }),
      queryClient.invalidateQueries({ queryKey: ['bank-balances'] }),
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
    ]);
  }, [queryClient]);

  // Server-side pagination & filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    // L10 FIX #2: The Debounce Initialization Yank.
    if (debouncedSearch === searchTerm) return;
    const timeout = setTimeout(() => {
        setDebouncedSearch(searchTerm);
        setCurrentPage(1);
        // L13 FIX #1: The Search Edit-Phantom Paradox.
        setEditingId(null);
        setEditFormData({});
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchTerm, debouncedSearch]);

  const fetchTransactions = async ({ queryKey }) => {
      const [_key, page, limit, dSearch, fType, fCat, sKey, sDir] = queryKey;
      const params = new URLSearchParams({ page, limit });
      if (dSearch) params.set('search', dSearch);
      if (fType !== 'all') params.set('type', fType);
      if (fCat !== 'all') params.set('category', fCat.startsWith('cat_') ? fCat.slice(4) : fCat);
      // L16 FIX #1: The Server Sort Parameter Disconnect.
      if (sKey) {
          params.set('sort', sKey);
          if (sDir) params.set('dir', sDir);
      }
      
      const res = await fetch(`/api/transactions?${params.toString()}`, { headers: { 'Accept': 'application/json' } });
      if (res.status === 204) return { data: [], totalPages: 0, totalCount: 0 };
      if (!res.ok) throw new Error('Failed to load transactions');
      return res.json();
  };

  const activeQueryKey = ['transactions', currentPage, itemsPerPage, debouncedSearch, filterType, filterCategory, sortConfig.key, sortConfig.direction];

  const { data: txnData, isLoading: loading, isFetching, error } = useQuery({
    queryKey: activeQueryKey,
    queryFn: fetchTransactions,
    placeholderData: (prev) => prev,
    // L5 FIX #7: Explicitly retry stale error flashes.
    retry: 1,
    retryDelay: 500
  });

  const { data: banksData, isLoading: isBanksLoading } = useQuery({
    queryKey: ['bank-balances'],
    queryFn: async () => {
      const res = await fetch('/api/bank-balances');
      if (res.status === 204) return [];
      if (!res.ok) throw new Error('Failed to load banks');
      return res.json();
    }
  });

  const { data: uniqueCategoriesData } = useQuery({
    queryKey: ['transactions-categories'],
    queryFn: async () => {
      try {
        const catRes = await fetch('/api/transactions/categories');
        if (catRes.status === 204) return [];
        if (catRes.ok) {
          const catData = await catRes.json();
          return Array.isArray(catData) ? catData.map(c => String(c ?? '').toLowerCase()) : [];
        }
      } catch {
        /* Ignore fetch failure and fallback */
      }
      // L4 FIX #5: Fallback to fuzzy match local cache
      const allTxnCaches = queryClient.getQueriesData({ queryKey: ['transactions'] });
      const allCategories = new Set();
      for (const [, cacheData] of allTxnCaches) {
        if (cacheData?.data && Array.isArray(cacheData.data)) {
          cacheData.data.forEach(t => allCategories.add(String(t.category ?? '').toLowerCase()));
        }
      }
      return allCategories.size > 0 ? [...allCategories] : [];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const transactions = Array.isArray(txnData?.data) ? txnData.data : [];
  const banks = useMemo(() => Array.isArray(banksData) ? banksData : (Array.isArray(banksData?.data) ? banksData.data : []), [banksData]);
  const totalCount = txnData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;
  const uniqueCategories = useMemo(() => Array.isArray(uniqueCategoriesData) ? uniqueCategoriesData : [], [uniqueCategoriesData]);

  // L3 FIX #3: Memoized bank ID→name lookup map.
  const bankNameMap = useMemo(() => {
    const map = new Map();
    banks.forEach(b => map.set(String(b.id), b.bankName));
    return map;
  }, [banks]);

  const getBankName = useCallback((bankId) => {
    if (bankId == null || bankId === '') return null;
    return bankNameMap.get(String(bankId)) || 'Unknown Bank';
  }, [bankNameMap]);

  // L2 FIX #6: Remove currentPage from dependency array
  useEffect(() => {
      if (totalPages === 0 && currentPage !== 1) {
          setCurrentPage(1);
      } else if (totalPages > 0 && currentPage > totalPages) {
          setCurrentPage(totalPages);
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  // L8 FIX #1 & L15 FIX #2 & L17 FIX #7
  useEffect(() => {
    if (filterCategory !== 'all') {
      const catName = filterCategory.startsWith('cat_') ? filterCategory.slice(4) : filterCategory;
      if (!uniqueCategories.includes(catName)) {
        if (editingId) {
            setEditingId(null);
            setEditFormData({});
        }
        setFilterCategory('all');
      }
    }
  }, [uniqueCategories, filterCategory, editingId]);

  // L20 FIX #8: The Pagination Render Hallucination
  const showingStart = (totalCount === 0 || (currentPage - 1) * itemsPerPage >= totalCount) ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const showingEnd = showingStart === 0 ? 0 : Math.min(currentPage * itemsPerPage, totalCount);

  const updateTxnMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`/api/transactions/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(data)
      });
      if (res.status === 204) return {};
      if (!res.ok) { let e; try { e = await res.json(); } catch (err) { throw new Error(`Network or server error (${res.status})`, { cause: err }); } throw new Error(e?.error || 'Failed to update transaction'); }
      return res.json();
    },
    onSuccess: async (_, variables) => {
      // L15 FIX #7 & L19 FIX #7
      queryClient.setQueriesData({ queryKey: activeQueryKey }, old => {
          if (!old || !Array.isArray(old.data)) return old;
          return {
              ...old,
              data: old.data.map(txn => txn.id === variables.id ? { ...txn, ...variables.data } : txn)
          };
      });
      await invalidateAllLedgerQueries();
      if (variables?.data?.category) {
          queryClient.setQueryData(['transactions-categories'], old => old ? [...new Set([...old, variables.data.category.toLowerCase()])] : [variables.data.category.toLowerCase()]);
      }
      // L19 FIX #4
      setEditingId(prev => {
          if (prev === variables.id) setEditFormData({});
          return prev === variables.id ? null : prev;
      });
      // L15 FIX #6
      setTimeout(() => document.getElementById(`edit-btn-${variables.id}`)?.focus(), 0);
    },
    onError: (err) => {
      // L8 FIX #6
      const safeMsg = (err.message || '').includes('Failed to') ? err.message : 'Update failed due to a server error. Please try again.';
      alert(`Update failed: ${safeMsg}`);
    }
  });

  const deleteTxnMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/transactions/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'Accept': 'application/json' } });
      if (res.status === 204) return {};
      if (!res.ok) { let e; try { e = await res.json(); } catch (err) { throw new Error(`Network or server error (${res.status})`, { cause: err }); } throw new Error(e?.error || 'Failed to delete transaction'); }
      return res.json();
    },
    onSuccess: async (_, id) => {
      // L18 FIX #6 & L19 FIX #7
      queryClient.setQueriesData({ queryKey: activeQueryKey }, old => {
          if (!old || !Array.isArray(old.data)) return old;
          return {
              ...old,
              data: old.data.filter(txn => txn.id !== id),
              totalCount: Math.max(0, (old.totalCount || 0) - 1)
          };
      });
      await invalidateAllLedgerQueries();
      setConfirmDelete({ isOpen: false, id: null, title: '' });
      // L14 FIX #1 & L19 FIX #4
      setEditingId(prev => {
          if (prev === id) setEditFormData({});
          return prev === id ? null : prev;
      });
      // L15 FIX #5
      setTimeout(() => document.getElementById('ledger-search-input')?.focus(), 0);
    },
    onError: (err) => {
      const safeMsg = (err.message || '').includes('Failed to') ? err.message : 'Delete failed due to a server error. Please try again.';
      alert(`Delete failed: ${safeMsg}`);
      // L12 FIX #7
      setConfirmDelete({ isOpen: false, id: null, title: '' });
    }
  });

  return {
    queryClient,
    transactions, loading, isFetching, error,
    banks, isBanksLoading, bankNameMap, getBankName,
    uniqueCategories,
    totalCount, totalPages, itemsPerPage,
    showingStart, showingEnd,
    searchTerm, setSearchTerm, debouncedSearch,
    filterType, setFilterType,
    filterCategory, setFilterCategory,
    sortConfig, setSortConfig,
    currentPage, setCurrentPage,
    editingId, setEditingId,
    editFormData, setEditFormData,
    isExporting, setIsExporting,
    showImportTools, setShowImportTools,
    confirmDelete, setConfirmDelete,
    activeTab, setActiveTab,
    invalidateAllLedgerQueries,
    updateTxnMutation, deleteTxnMutation
  };
}
