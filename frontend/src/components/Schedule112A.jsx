import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, AlertTriangle } from 'lucide-react';

function Schedule112A() {
  const { data: harvestData } = useQuery({
    queryKey: ['tax-harvest'],
    queryFn: async () => {
      const res = await fetch('/api/tax-harvest');
      if (!res.ok) throw new Error('Failed to load tax harvest data');
      return res.json();
    }
  });

  const data = {
    shortTerm: harvestData?.data?.lots?.filter(l => !l.isLongTerm) || [],
    longTerm: harvestData?.data?.lots?.filter(l => l.isLongTerm) || []
  };

  const handleExport = () => {
    // RED TEAM FIX: Match the exact column structure of ITR-2 Schedule 112A Utility
    let csvContent = "S.No,ISIN Code,Name of the Share/Unit,No. of Shares/Units,Sale price per Share/Unit,Full Value of Consideration,Cost of acquisition,Fair Market Value per share/unit as on 31st January 2018,Expenditure wholly and exclusively in connection with transfer\n";

    const addRows = (lots) => {
      // 27th VULNERABILITY FIX: Micro-Fractional Zeroing & Sequence Breakage. 
      // Filter out 'dust' lots (<= 0.0004) BEFORE iterating. Truncating dust to 0.000 crashes the Java utility.
      // Skipping them during iteration breaks the S.No sequence, which also crashes the utility.
      const validLots = lots.filter(lot => Number(Number(lot.units || 0).toFixed(3)) > 0);

      validLots.forEach((lot, index) => {
        // 26th VULNERABILITY FIX: Grandfathering Identity Loss. Append (PRE-2018) to the title so users can visually identify which rows require manual FMV entry in the Excel utility.
        const isGrandfathered = lot.purchaseDate && new Date(lot.purchaseDate) < new Date('2018-02-01');
        const titleSuffix = isGrandfathered ? " (PRE-2018)" : "";
        // 31st VULNERABILITY FIX: Suffix-Induced Overflow Rejection. 
        // The previous title limit (50 chars) failed to account for the injection of the 11-character ` (PRE-2018)` suffix.
        // If a grandfathered asset had a 50-character name, the suffix inflated it to 61, triggering the XSD Java crash.
        // We dynamically compute the maximum safe string length based on the suffix allocation.
        const suffixLength = titleSuffix.length;
        const maxTitleLength = 50 - suffixLength;
        
        let rawTitle = lot.title || 'Unknown';
        if (rawTitle.length > maxTitleLength) {
            rawTitle = rawTitle.substring(0, maxTitleLength - 3) + '...';
        }
        
        const title = `"${rawTitle.replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}${titleSuffix}"`;
        const isin = `""`; // RED TEAM FIX: Do NOT inject schemeCodes or tickers into the ISIN column. It causes Java validation crashes. Leave it blank so the utility flags it for manual entry safely.
        
        // RED TEAM FIX: Enforce exact decimal limits to satisfy ITR-2 Java validation macros and prevent Rounding Drift rejection
        const rawUnits = lot.units || 0;
        const rawCurrentVal = lot.currentValue || 0;
        
        const units = Number(rawUnits).toFixed(3);
        // 35th VULNERABILITY FIX: Micro-Fractional Price Deflation.
        // We MUST calculate pricePerUnit using the exactly truncated `units` (3 decimals), not `rawUnits`. 
        // If we use `rawUnits` (e.g. 10.12345), but output `units` (10.123), the multiplied Consideration algebraically leaks value (10.123 * [Val/10.12345] < Val). 
        // This causes the final CSV Consideration to systematically under-report the true Ledger value, triggering an AIS Defect Notice.
        const pricePerUnit = Number(units) > 0 ? (rawCurrentVal / Number(units)).toFixed(4) : "0.0000";
        
        // 25th VULNERABILITY FIX: Recalculate consideration using the EXACT truncated values to structurally guarantee 0.00 mismatch in the Java Validation engine.
        const currentVal = (Number(units) * Number(pricePerUnit)).toFixed(2);
        
        // 37th VULNERABILITY FIX: Micro-Fractional Cost Inflation.
        // If we export the full un-truncated costBasis for a mathematically truncated Quantity, we illegally claim Cost of Acquisition for units not declared on the row.
        // We must algebraically prorate the cost down to perfectly match the 3-decimal exported units to align precisely with Broker AIS reporting.
        const costPerUnit = rawUnits > 0 ? (Number(lot.costBasis || 0) / rawUnits) : 0;
        const cost = (Number(units) * costPerUnit).toFixed(2);
        
        const fmvPlaceholder = "0.00"; // RED TEAM FIX: Empty strings (,,) in numeric columns trigger fatal NumberFormatExceptions in the ITR-2 Java CSV parser. Supplying a strict 0.00 satisfies the xs:decimal constraint while gracefully forcing the user to manually correct the value for grandfathered assets.
        
        csvContent += `${index + 1},${isin},${title},${units},${pricePerUnit},${currentVal},${cost},${fmvPlaceholder},0\n`;
      });
    };

    // RED TEAM FIX: Schedule 112A is exclusively for Long-Term Capital Gains. 
    addRows(data.longTerm);

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Schedule_112A_Planning_Export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalUnrealizedLtcg = data.longTerm.reduce((acc, l) => acc + Number(l.unrealizedGain || 0), 0);
  
  // RED TEAM FIX: Section 70 allows cascading offset: STCL offsets STCG, then Debt Gains, then cascades to offset LTCG.
  // We must calculate the exact quantum of STCL that bypasses short-term heads to expand the 1.25L LTCG quota.
  const rawLtcg = Number(harvestData?.data?.realizedLTCG || 0);
  const rawLtcl = Number(harvestData?.data?.realizedLTCL || 0);
  const stcg = Number(harvestData?.data?.realizedSTCG || 0);
  const stcl = Number(harvestData?.data?.realizedSTCL || 0);
  const debtGains = Number(harvestData?.data?.realizedDebtGains || 0);
  
  const cascadingStclBypass = Math.max(0, stcl - stcg - debtGains);
  const realizedLtcg = rawLtcg - rawLtcl - cascadingStclBypass;

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '24px', marginBottom: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} color="var(--accent-sapphire)" />
            Schedule 112A Generator (ITR-2)
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Export your unrealized equity holdings mapped with ISIN and grandfathering data for planning.
          </p>
        </div>
        <button className="btn primary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
           <Download size={16} /> Export Unrealized CSV
        </button>
      </div>

      <div className="grid-2" style={{ gap: '24px' }}>
        <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px' }}>
           <h4 style={{ margin: '0 0 16px 0', color: 'var(--text-secondary)' }}>LTCG Exemption Tracker (₹1.25L)</h4>
           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Realized LTCG This FY</span>
              <span style={{ fontWeight: 600 }}>₹{Math.round(realizedLtcg).toLocaleString('en-IN')}</span>
           </div>
           <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ fontWeight: 600 }}>Available Tax-Free Harvest Quota:</span>
              <span style={{ fontWeight: 600, color: 'var(--accent-emerald)' }}>
                ₹{(125000 - realizedLtcg).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
           <div className="progress-bar">
             <div className="progress-fill" style={{ width: `${Math.max(0, Math.min((realizedLtcg / 125000) * 100, 100))}%`, background: realizedLtcg > 125000 ? 'var(--accent-coral)' : 'var(--accent-emerald)' }}></div>
           </div>
           {realizedLtcg > 125000 ? (
              <div style={{ marginTop: '8px' }}>
                <p style={{ fontSize: '11px', color: 'var(--accent-coral)', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                   <AlertTriangle size={12}/> You have exhausted the ₹1.25L tax-free limit. Further selling incurs 12.5% tax.*
                </p>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '4px 0 0 16px', fontStyle: 'italic' }}>
                   *Unless you have an Unexhausted Basic Exemption Limit (normal income below ₹3L/₹2.5L).
                </p>
              </div>
           ) : (
              <div style={{ marginTop: '8px' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                   You can harvest ₹{Math.max(0, 125000 - realizedLtcg).toLocaleString('en-IN')} more tax-free. (Unrealized available: ₹{Math.round(totalUnrealizedLtcg).toLocaleString('en-IN')})*
                </p>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '4px 0 0 0', fontStyle: 'italic' }}>
                   *Your actual tax-free quota may be higher if you have an Unexhausted Basic Exemption Limit (e.g., no salary/business income).
                </p>
              </div>
           )}
        </div>
        
        <div style={{ padding: '16px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
            <strong>Warning:</strong> This export contains <strong>UNREALIZED</strong> holdings for tax planning purposes.
            <br/><br/>
            When filing ITR-2, you must declare every single Mutual Fund or Equity <strong>sale</strong> individually under Schedule 112A. Do <strong>NOT</strong> paste this export directly into the government's utility unless these lots have actually been sold.
          </p>
          
          {data.longTerm.some(lot => lot.purchaseDate && new Date(lot.purchaseDate) < new Date('2018-02-01')) && (
            <p style={{ fontSize: '13px', color: 'var(--accent-amber)', margin: '12px 0 0 0', lineHeight: 1.6, padding: '12px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px', borderLeft: '4px solid var(--accent-amber)' }}>
              <strong><AlertTriangle size={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '4px' }}/> Grandfathering Detected:</strong> You hold assets purchased before Feb 1, 2018. The "Unrealized Gain" displayed above does <strong>not</strong> account for the Section 112A Fair Market Value (FMV) step-up. Your actual taxable gain upon sale will be significantly lower. Please calculate manually using FMV as of Jan 31, 2018.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Schedule112A;
