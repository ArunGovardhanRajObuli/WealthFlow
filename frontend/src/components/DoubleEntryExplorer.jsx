import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Layers, AlertTriangle } from 'lucide-react';

// Level 19 Fix: Singleton Intl formatter — eliminates 200+ Intl.NumberFormat
// instantiations per render cycle when formatting visible currency cells.
const INR_WHOLE_FORMATTER = (() => {
  try { return new Intl.NumberFormat('en-IN'); }
  catch { return null; }
})();


function DoubleEntryExplorer() {
  const { data: ledgerData, isLoading: loading, error: queryError } = useQuery({
    queryKey: ['ledger-lines'],
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const res = await fetch('/api/ledger-lines?limit=100000', { signal });
      if (!res.ok) throw new Error(`HTTP Error ${res.status}: Failed to load ledger lines`);
      // Level 19 Fix: 204 must be checked BEFORE .json() — a 204 has no body,
      // so res.json() throws SyntaxError which the catch block misreports as
      // 'firewall interference'. The previous placement after !res.ok was safe
      // (204 is 2xx) but the json() call below would still detonate.
      if (res.status === 204) return [];
      
      let json;
      try {
        json = await res.json();
      } catch (parseError) { throw new Error('Network Payload Corruption: The server returned a malformed response (non-JSON payload). This may indicate firewall interference.', { cause: parseError }); }
      
      // Fix 1: Strict Backend Schema Validation
      // Prevents catastrophic false-negatives where a 200 OK JSON error (e.g. API rate limit) 
      // is silently parsed as an empty array, falsely showing a green "Balanced ₹0" Trial Balance.
      if (!Array.isArray(json) && !Array.isArray(json?.data)) {
        if (json && typeof json === 'object') {
          if (json.error) throw new Error(String(json.error));
          if (json.message) throw new Error(String(json.message));
        }
        throw new Error('Data Integrity Error: Backend returned an unrecognized data schema.');
      }
      
      return json;
    }
  });

  const ledgerLines = useMemo(() => {
    if (!ledgerData) return [];
    return Array.isArray(ledgerData) ? ledgerData : (Array.isArray(ledgerData.data) ? ledgerData.data : []);
  }, [ledgerData]);

  const errorMessage = queryError ? (queryError.message || 'Failed to load ledger lines.') : null;

  const { tAccounts, totalSystemDebitsPaise, totalSystemCreditsPaise, corruptedEntries, isBalanced } = useMemo(() => {
    let globalDebitsPaise = 0n;
    let globalCreditsPaise = 0n;
    let globalInvalidCount = 0;
    const tAcc = {};
    const MAX_ACCOUNTS = 50; 

    // Fix 1: Infinite Scale Per-Account Local Truncation
    // Removed the global `validProcessedCount` limit which caused later T-Accounts to show 
    // a Net Balance with ZERO rendered transactions ("Phantom Money" panic).
    // Now we safely cap memory arrays at 100 lines per column per account, 
    // allowing millions of lines to process without JS Heap OOM crashes.
    const getSafeTitle = (line) => {
      const extractStr = (val) => {
        if (val === null || val === undefined) return '';
        if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val);
        return '';
      };
      const t = extractStr(line.title);
      const d = extractStr(line.description);
      if (t.trim() !== '') return t.trim();
      if (d.trim() !== '') return d.trim();
      return 'Untitled';
    };

    const getSafeDate = (rawDate) => {
      if (!rawDate) return 'No Date';
      if (typeof rawDate === 'string') {
        const t = rawDate.trim();
        if (!t) return 'No Date';
        return t.includes('T') ? t.split('T')[0] : t.split(' ')[0];
      }
      if (typeof rawDate === 'number') {
        try { return new Date(rawDate).toISOString().split('T')[0]; } catch { return 'Invalid Date'; }
      }
      return 'No Date';
    };

    ledgerLines.forEach((line, index) => {
      if (!line || typeof line !== 'object') {
        globalInvalidCount++; return;
      }
      let rawDebit = line.debit_amount;
      let rawCredit = line.credit_amount;
      
      if (typeof rawDebit === 'string') rawDebit = rawDebit.trim();
      if (typeof rawCredit === 'string') rawCredit = rawCredit.trim();

      const hasDebit = rawDebit !== null && rawDebit !== undefined && rawDebit !== '';
      const hasCredit = rawCredit !== null && rawCredit !== undefined && rawCredit !== '';
      
      if (!hasDebit && !hasCredit) {
        globalInvalidCount++; return;
      }

      const isValidFinancialString = (val) => {
        if (val === null || val === undefined || val === '') return true;
        if (typeof val !== 'number' && typeof val !== 'string') return false;
        return /^-?(0|[1-9]\d*)(\.\d{1,2})?$/.test(String(val));
      };
      
      if (!isValidFinancialString(rawDebit) || !isValidFinancialString(rawCredit)) {
        globalInvalidCount++; return;
      }

      const parseToPaiseBigInt = (val) => {
        if (val === null || val === undefined || val === '') return 0n;
        const str = String(val);
        const dotIdx = str.indexOf('.');
        if (dotIdx === -1) return BigInt(str + '00');
        
        const whole = str.substring(0, dotIdx);
        let fraction = str.substring(dotIdx + 1);
        if (fraction.length === 0) fraction = '00';
        else if (fraction.length === 1) fraction += '0';
        return BigInt(whole + fraction);
      };

      const dAmtPaise = hasDebit ? parseToPaiseBigInt(rawDebit) : 0n;
      const cAmtPaise = hasCredit ? parseToPaiseBigInt(rawCredit) : 0n;

      globalDebitsPaise += dAmtPaise;
      globalCreditsPaise += cAmtPaise;
      
      // Compute T-Account Groupings for the ENTIRE dataset
      const sanitizeTaxonomy = (str) => {
        if (typeof str !== 'string') return '';
        return str.replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '').trim();
      };

      const rawClassStr = sanitizeTaxonomy(line.account_class).toLowerCase();
      let aClass = 'Uncategorized';
      if (rawClassStr.includes('asset')) aClass = 'Asset';
      else if (rawClassStr.includes('liabilit') || rawClassStr.includes('debt') || rawClassStr.includes('payable')) aClass = 'Liability';
      else if (rawClassStr.includes('equit') || rawClassStr.includes('capital') || rawClassStr.includes('retained')) aClass = 'Equity';
      else if (rawClassStr.includes('revenu') || rawClassStr.includes('income') || rawClassStr.includes('sales')) aClass = 'Revenue';
      else if (rawClassStr.includes('expens') || rawClassStr.includes('cost')) aClass = 'Expense';
      else if (rawClassStr !== '') aClass = rawClassStr.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      
      const rawType = sanitizeTaxonomy(line.account_type);
      // Eradicate snake_case, kebab-case, and camelCase splintering
      const normalizedType = rawType.replace(/[-_]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
      let aType = normalizedType.split(' ').filter(Boolean).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      if (aType === '') aType = 'Uncategorized';
      
      let key = `${aClass}__::__${aType}`;
      
      if (!tAcc[key] && Object.keys(tAcc).length >= MAX_ACCOUNTS) {
        key = '__SYSTEM_OVERFLOW__';
      }

      if (!tAcc[key]) {
        tAcc[key] = {
          account_class: key === '__SYSTEM_OVERFLOW__' ? 'Overflow (Memory Capped)' : aClass,
          account_type: key === '__SYSTEM_OVERFLOW__' ? 'System Aggregation' : aType,
          debitLines: [],
          creditLines: [],
          debitLinesCount: 0,
          creditLinesCount: 0,
          totalDebitPaise: 0n,
          totalCreditPaise: 0n
        };
      }

      // Add to the true Net Balance regardless of rendering limit
      tAcc[key].totalDebitPaise += dAmtPaise;
      tAcc[key].totalCreditPaise += cAmtPaise;

      // Local memory cap: Keep RAM usage strictly limited to 100 objects per column
      if (hasDebit && dAmtPaise > 0n) {
        if (tAcc[key].debitLinesCount < 100) {
          tAcc[key].debitLines.push({ 
            ...line, 
            safeTitle: getSafeTitle(line),
            safeDate: getSafeDate(line.date),
            parsedAmtPaise: dAmtPaise, 
            uniqueId: line.id ? `dr_id_${line.id}_idx_${index}` : `dr_idx_${index}` 
          });
        }
        tAcc[key].debitLinesCount++;
      }
      
      if (hasCredit && cAmtPaise > 0n) {
        if (tAcc[key].creditLinesCount < 100) {
          tAcc[key].creditLines.push({ 
            ...line, 
            safeTitle: getSafeTitle(line),
            safeDate: getSafeDate(line.date),
            parsedAmtPaise: cAmtPaise, 
            uniqueId: line.id ? `cr_id_${line.id}_idx_${index}` : `cr_idx_${index}` 
          });
        }
        tAcc[key].creditLinesCount++;
      }
    });
    
    return { 
      tAccounts: tAcc, 
      totalSystemDebitsPaise: globalDebitsPaise, 
      totalSystemCreditsPaise: globalCreditsPaise,
      corruptedEntries: globalInvalidCount,
      isBalanced: globalDebitsPaise === globalCreditsPaise
    };
  }, [ledgerLines]);

  // Level 19 Fix: Sort once in useMemo, not on every render frame.
  // Prevents redundant sort comparisons + getBalanceInfo/getCardStyle
  // recalculation on every React reconciliation cycle.
  const sortedAccounts = useMemo(() => {
    return Object.values(tAccounts).sort((a, b) => {
      const weights = { 'Asset': 1, 'Liability': 2, 'Equity': 3, 'Revenue': 4, 'Expense': 5 };
      const weightA = weights[a.account_class] || 99;
      const weightB = weights[b.account_class] || 99;
      if (weightA !== weightB) return weightA - weightB;
      const cmp = String(a.account_type).localeCompare(String(b.account_type), 'en', { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return cmp;
      return String(a.account_type).localeCompare(String(b.account_type));
    });
  }, [tAccounts]);

  if (loading) {
    return (
      <div className="animate-fade-in" style={{ paddingBottom: '40px' }}>
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading double-entry engine...</div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="animate-fade-in" style={{ paddingBottom: '40px' }}>
        <div className="alert-banner danger">{errorMessage}</div>
      </div>
    );
  }

  const getCardStyle = (accountClass) => {
    switch (accountClass) {
      case 'Asset': return { borderColor: 'var(--accent-sapphire)' };
      case 'Liability': return { borderColor: 'var(--accent-coral)' };
      case 'Equity': return { borderColor: 'var(--accent-amethyst)' };
      case 'Revenue': return { borderColor: 'var(--accent-emerald)' };
      case 'Expense': return { borderColor: 'var(--accent-amber)' };
      default: return { borderColor: 'var(--border-color)' };
    }
  };

  const getBalanceInfo = (acc) => {
    const debitBalancePaise = acc.totalDebitPaise - acc.totalCreditPaise;
    const creditBalancePaise = acc.totalCreditPaise - acc.totalDebitPaise;

    if (['Asset', 'Expense'].includes(acc.account_class)) {
      if (debitBalancePaise === 0n) return { amountPaise: 0n, isWarning: false, label: 'Settled' };
      if (debitBalancePaise < 0n) return { amountPaise: creditBalancePaise, isWarning: true, label: 'CR Balance (Abnormal)' };
      return { amountPaise: debitBalancePaise, isWarning: false, label: 'DR Balance' };
    } else if (['Liability', 'Equity', 'Revenue'].includes(acc.account_class)) {
      if (creditBalancePaise === 0n) return { amountPaise: 0n, isWarning: false, label: 'Settled' };
      if (creditBalancePaise < 0n) return { amountPaise: debitBalancePaise, isWarning: true, label: 'DR Balance (Abnormal)' };
      return { amountPaise: creditBalancePaise, isWarning: false, label: 'CR Balance' };
    } else {
      if (debitBalancePaise === 0n) return { amountPaise: 0n, isWarning: true, label: 'Uncategorized (Settled)' };
      if (debitBalancePaise > 0n) return { amountPaise: debitBalancePaise, isWarning: true, label: 'Uncategorized (DR)' };
      return { amountPaise: creditBalancePaise, isWarning: true, label: 'Uncategorized (CR)' };
    }
  };

  const formatBigIntCurrency = (paiseBigInt) => {
    if (typeof paiseBigInt !== 'bigint') return '₹0.00';
    const isNegative = paiseBigInt < 0n;
    const absPaise = isNegative ? -paiseBigInt : paiseBigInt;
    let str = absPaise.toString();
    
    while (str.length < 3) str = '0' + str;
    const wholeStr = str.slice(0, -2);
    const fractionStr = str.slice(-2);
    
    
    let formattedWhole = wholeStr;
    try {
       if (INR_WHOLE_FORMATTER) {
           formattedWhole = INR_WHOLE_FORMATTER.format(Number(BigInt(wholeStr)));
       }
    } catch {
       // Ignore formatting error, default to wholeStr
    }
    
    const formatted = `₹${formattedWhole}.${fractionStr}`;
    return isNegative ? `(${formatted})` : formatted;
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '40px' }}>
      
      {corruptedEntries > 0 && (
        <div style={{ padding: '16px', marginBottom: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--accent-coral)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--accent-coral)' }}>
          <AlertTriangle size={24} />
          <div>
            <h4 style={{ margin: 0, fontWeight: 700 }}>Critical Data Integrity Error</h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px' }}>
              {corruptedEntries} ledger entries contained malformed financial strings and were dropped. <strong>Trial Balance calculation is incomplete and mathematically invalid.</strong>
            </p>
          </div>
        </div>
      )}

      {ledgerLines.length >= 100000 && (
        <div style={{ padding: '16px', marginBottom: '16px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--accent-amber)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--accent-amber)' }}>
          <AlertTriangle size={24} />
          <div>
            <h4 style={{ margin: 0, fontWeight: 700 }}>Network Payload Truncation</h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px' }}>
              The query reached the maximum network limit of 100,000 rows. <strong>The Trial Balance calculation below is mathematically compromised and may falsely report an imbalance.</strong>
            </p>
          </div>
        </div>
      )}

      {/* Trial Balance Banner */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '32px', display: 'flex', flexWrap: 'wrap', gap: '24px', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%)' }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={20} color={isBalanced && corruptedEntries === 0 ? "var(--accent-sapphire)" : "var(--accent-coral)"} /> 
            Live Trial Balance
          </h3>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
            Mathematical validation of the double-entry engine.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', justifyContent: 'flex-end', flex: '1 1 auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>System Debits</div>
            <div style={{ fontSize: 'clamp(16px, 3vw, 24px)', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{formatBigIntCurrency(totalSystemDebitsPaise)}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>System Credits</div>
            <div style={{ fontSize: 'clamp(16px, 3vw, 24px)', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{formatBigIntCurrency(totalSystemCreditsPaise)}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end' }}>
            {isBalanced && corruptedEntries === 0 ? (
              <span className="urgency-badge safe" style={{ padding: '6px 12px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-emerald)', fontWeight: 600 }}>Balanced</span>
            ) : isBalanced && corruptedEntries > 0 ? (
              <span className="urgency-badge warning" style={{ padding: '6px 12px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent-amber)', fontWeight: 600 }}>Partial Balance (Drops)</span>
            ) : (
              <span className="urgency-badge critical" style={{ padding: '6px 12px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-coral)', fontWeight: 600 }}>
                Imbalanced (Discrepancy: {formatBigIntCurrency(totalSystemDebitsPaise > totalSystemCreditsPaise ? totalSystemDebitsPaise - totalSystemCreditsPaise : totalSystemCreditsPaise - totalSystemDebitsPaise)}) {corruptedEntries > 0 ? '(Drops)' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* T-Accounts Grid */}
      {ledgerLines.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed var(--border-color)', color: 'var(--text-muted)' }}>
          <Layers size={48} style={{ opacity: 0.2, margin: '0 auto 16px auto', display: 'block' }} />
          <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Empty Ledger</h3>
          <p style={{ margin: 0, fontSize: '14px' }}>No double-entry transactions exist in the database.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 600px), 1fr))', gap: '24px' }}>
          {sortedAccounts.map(acc => {
            const { amountPaise, isWarning, label } = getBalanceInfo(acc);
            
            return (
              <div key={`${acc.account_class}__::__${acc.account_type}`} className="glass-panel t-account-card" style={{ padding: '0', borderTop: `4px solid ${getCardStyle(acc.account_class).borderColor}`, overflow: 'hidden' }}>
                
                {/* Card Header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                      <Layers size={18} color={getCardStyle(acc.account_class).borderColor} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '16px' }}>{acc.account_type}</h4>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{acc.account_class}</span>
                    </div>
                  </div>
                </div>

                {/* Double Entry Table */}
                <div style={{ maxHeight: '400px', overflowY: 'auto', scrollbarWidth: 'thin', scrollbarGutter: 'stable', background: 'var(--border-color)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', minHeight: '100px' }}>
                    
                    {/* Debit Column */}
                    <div style={{ background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(20,20,20,0.95)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', padding: '8px', borderBottom: '1px solid var(--border-color)', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center', letterSpacing: '1px' }}>DEBIT</div>
                      <div style={{ flex: 1 }}>
                        {acc.debitLines.map(l => (
                          <div key={l.uniqueId} className="t-account-row" style={{ padding: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                            <div style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, marginRight: '8px' }} title={`${l.safeDate} | ${l.safeTitle}`}>{l.safeTitle}</div>
                            <div style={{ fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>{formatBigIntCurrency(l.parsedAmtPaise)}</div>
                          </div>
                        ))}
                        {acc.debitLinesCount > 100 && (
                          <div style={{ padding: '12px 8px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', background: 'rgba(255,255,255,0.01)' }}>
                            + {acc.debitLinesCount - 100} hidden
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Credit Column */}
                    <div style={{ background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(20,20,20,0.95)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', padding: '8px', borderBottom: '1px solid var(--border-color)', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center', letterSpacing: '1px' }}>CREDIT</div>
                      <div style={{ flex: 1 }}>
                        {acc.creditLines.map(l => (
                          <div key={l.uniqueId} className="t-account-row" style={{ padding: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                            <div style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, marginRight: '8px' }} title={`${l.safeDate} | ${l.safeTitle}`}>{l.safeTitle}</div>
                            <div style={{ fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>{formatBigIntCurrency(l.parsedAmtPaise)}</div>
                          </div>
                        ))}
                        {acc.creditLinesCount > 100 && (
                          <div style={{ padding: '12px 8px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', background: 'rgba(255,255,255,0.01)' }}>
                            + {acc.creditLinesCount - 100} hidden
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </div>

                {/* Card Footer Balance */}
                <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>Net Balance ({label})</span>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: isWarning ? 'var(--accent-coral)' : 'var(--text-primary)' }}>
                    {formatBigIntCurrency(amountPaise)}
                  </span>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

export default DoubleEntryExplorer;
