import React, { useState, useMemo, useEffect, useTransition } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Line } from 'react-chartjs-2';
import { ShieldCheck, TrendingUp, AlertTriangle } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// Box-Muller transform for normal distribution
function randomNormal(mean, stdDev) {
  let u1 = 0, u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  let z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}

function MonteCarloSimulator() {
  const [manualPortfolio, setManualPortfolio] = useState(null);
  const [annualContribution, setAnnualContribution] = useState(600000);
  const [years, setYears] = useState(25);
  const [meanReturn, setMeanReturn] = useState(12); // 12% expected
  const [inflationRate, setInflationRate] = useState(6); // 6% expected inflation
  const [volatility, setVolatility] = useState(15); // 15% standard deviation
  const [targetRetirementCorpus, setTargetRetirementCorpus] = useState(50000000); // 5 Cr default target

  const { data: invRes } = useQuery({ queryKey: ['investments'], queryFn: () => fetch('/api/investments').then(r => r.json()).catch(() => ({data: []})) });
  const { data: bankRes } = useQuery({ queryKey: ['reconciliation'], queryFn: () => fetch('/api/reconciliation').then(r => r.json()).catch(() => ({banks: []})) });
  const { data: npsRes } = useQuery({ queryKey: ['nps-accounts'], queryFn: () => fetch('/api/nps-accounts').then(r => r.json()).catch(() => ([])) });
  const { data: goldRes } = useQuery({ queryKey: ['gold-portfolio'], queryFn: () => fetch('/api/gold-holdings/portfolio').then(r => r.json()).catch(() => ({totalCurrentValue: 0})) });
  const { data: fdRes } = useQuery({ queryKey: ['fd-ladder'], queryFn: () => fetch('/api/fixed-deposits').then(r => r.json()).catch(() => ({data: []})) });
  const { data: ccRes } = useQuery({ queryKey: ['credit-cards'], queryFn: () => fetch('/api/credit-cards').then(r => r.json()).catch(() => ({data: []})) });
  const { data: loanRes } = useQuery({ queryKey: ['loans-list'], queryFn: () => fetch('/api/loans-list').then(r => r.json()).catch(() => ({data: []})) });
  const { data: reRes } = useQuery({ queryKey: ['real-estate'], queryFn: () => fetch('/api/real-estate').then(r => r.json()).catch(() => ({data: []})) });

  const calculatedPortfolioObj = useMemo(() => {
    let assets = 0;
    let liabilities = 0;
    if (Array.isArray(invRes?.data)) assets += invRes.data.reduce((sum, i) => {
      const liveValue = (i.schemeCode && i.latestNav > 0 && i.totalUnits > 0) ? (Number(i.latestNav) * Number(i.totalUnits)) : Number(i.currentAmount || 0);
      return sum + liveValue;
    }, 0);
    if (Array.isArray(bankRes?.banks)) assets += bankRes.banks.reduce((sum, b) => sum + Number(b.ledgerBalance || 0), 0);
    if (Array.isArray(npsRes)) assets += npsRes.reduce((sum, a) => sum + Number(a.currentValue || 0), 0);
    if (goldRes?.totalCurrentValue) assets += Number(goldRes.totalCurrentValue);
    if (Array.isArray(fdRes?.data)) assets += fdRes.data.reduce((sum, f) => sum + Number(f.principal || 0) + Number(f.interestEarned || 0), 0);
    if (Array.isArray(reRes?.data)) assets += reRes.data.reduce((sum, p) => sum + Number(p.currentMarketValue || p.baseValue || 0), 0);
    
    if (Array.isArray(ccRes?.data)) liabilities += ccRes.data.reduce((sum, c) => sum + Number(c.currentBalance || 0), 0);
    if (Array.isArray(loanRes?.data)) liabilities += loanRes.data.reduce((sum, l) => sum + Number(l.principalAmount || 0), 0);
    
    return { assets, liabilities, netWorth: assets - liabilities };
  }, [invRes, bankRes, npsRes, goldRes, fdRes, ccRes, loanRes, reRes]);

  const currentPortfolioValue = manualPortfolio !== null ? manualPortfolio : calculatedPortfolioObj.netWorth;
  const startingAssets = manualPortfolio !== null ? Math.max(0, manualPortfolio) : calculatedPortfolioObj.assets;
  const startingLiabilities = manualPortfolio !== null ? Math.max(0, -manualPortfolio) : calculatedPortfolioObj.liabilities;

  const [isPending, startTransition] = useTransition();
  const [simResults, setSimResults] = useState({ simulationData: null, successProb: 0 });

  useEffect(() => {
    // Sanitize inputs securely
    const safeYears = Math.max(1, Math.min(60, years));
    const safeVol = Math.max(1, Math.min(100, volatility));
    
    startTransition(() => {
        const safeContrib = parseFloat(annualContribution) || 0;
        
        // Removed arbitrary lockout: Users with negative net worth and zero/negative SIP 
        // still need Monte Carlo if they have gross assets (leveraged exposure), 
        // or to accurately forecast bankruptcy debt spirals.

        const numSimulations = 1000; // Institutional standard is often 10k, using 1k for browser perf
        
        const safeMean = parseFloat(meanReturn) || 0;
        const safeInflation = Math.max(-99, parseFloat(inflationRate) || 0); // Prevent division by zero
        const safeTarget = parseFloat(targetRetirementCorpus) || 0;
        
        const realMean = ((1 + (safeMean / 100)) / (1 + (safeInflation / 100))) - 1;
        
        // Volatility is usually inputted nominally. Deflate it to get true real volatility.
        const stdDev = (safeVol / 100) / (1 + (safeInflation / 100));
        
        // Ito Correction: Add Half-Variance to arithmetic mean so the geometric median matches the user's expected CAGR
        const mean = realMean + (stdDev * stdDev) / 2;
        
        // Assume liabilities grow at a fixed nominal rate of 10% (blended loan/CC rate)
        const realDebtRate = ((1 + 0.10) / (1 + (safeInflation / 100))) - 1;
        
        let endValues = [];
        let percentilePaths = { 10: [], 50: [], 90: [] };
        let allPaths = [];

        for (let i = 0; i < numSimulations; i++) {
          let path = [currentPortfolioValue];
          let currentA = startingAssets;
          let currentL = startingLiabilities;
          
          for (let y = 1; y <= safeYears; y++) {
            const returnRate = Math.max(-0.99, Math.min(3.0, randomNormal(mean, stdDev))); 
            
            // Assets compound at market return, liabilities compound at debt rate
            currentA = currentA * (1 + returnRate);
            currentL = currentL * (1 + realDebtRate);
            
            let availContrib = safeContrib;
            
            // Geometric temporal shift factors (solves AM-GM divergence)
            const midYearAssetGrowth = Math.pow(1 + returnRate, 0.5);
            const midYearDebtGrowth = Math.pow(1 + realDebtRate, 0.5);
            
            if (availContrib > 0) {
                // Accumulation: Pay down debt first, then buy assets
                if (currentL > 0) {
                   // Intra-year amortization: Debt payments made throughout the year avoid half the year's interest
                   let effectivePayment = availContrib * midYearDebtGrowth;
                   if (effectivePayment >= currentL) {
                       let leftoverContrib = (effectivePayment - currentL) / midYearDebtGrowth;
                       currentL = 0;
                       currentA += leftoverContrib * midYearAssetGrowth;
                   } else {
                       currentL -= effectivePayment;
                   }
                } else {
                   // Intra-year SIP: Contributions made throughout the year capture half the year's growth
                   currentA += availContrib * midYearAssetGrowth;
                }
            } else if (availContrib < 0) {
                // Drawdown: Sell assets first, then take on debt if bankrupt
                let withdrawalTarget = Math.abs(availContrib);
                
                // End-of-year asset cost of a mid-year withdrawal
                let effectiveAssetDraw = withdrawalTarget * midYearAssetGrowth; 
                
                if (currentA >= effectiveAssetDraw) {
                    currentA -= effectiveAssetDraw;
                } else {
                    // Convert remaining assets to mid-year cash equivalents
                    let cashRaised = currentA / midYearAssetGrowth;
                    currentA = 0;
                    
                    let cashShortfall = withdrawalTarget - cashRaised;
                    
                    // Mid-year debt accrues half a year's interest by year-end
                    currentL += cashShortfall * midYearDebtGrowth; 
                }
            }
            
            const netValue = currentA - currentL;
            path.push(netValue);
          }
          endValues.push(currentA - currentL);
          allPaths.push(path);
        }

        const successes = endValues.filter(v => v >= safeTarget).length;
        const successProb = (successes / numSimulations) * 100;

        for (let y = 0; y <= safeYears; y++) {
          let yearValues = allPaths.map(p => p[y]).sort((a, b) => a - b);
          percentilePaths[10].push(yearValues[Math.floor(numSimulations * 0.10)]);
          percentilePaths[50].push(yearValues[Math.floor(numSimulations * 0.50)]);
          percentilePaths[90].push(yearValues[Math.floor(numSimulations * 0.90)]);
        }

        const simulationData = {
          labels: Array.from({ length: safeYears + 1 }, (_, i) => `Year ${i}`),
          datasets: [
            {
              label: '90th Percentile (Bull Case)',
              data: percentilePaths[90],
              borderColor: 'rgba(16, 185, 129, 0.4)',
              backgroundColor: 'transparent',
              borderWidth: 1,
              pointRadius: 0
            },
            {
              label: '50th Percentile (Base Case)',
              data: percentilePaths[50],
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderWidth: 2,
              fill: true,
              pointRadius: 0
            },
            {
              label: '10th Percentile (Bear Case)',
              data: percentilePaths[10],
              borderColor: 'rgba(239, 68, 68, 0.8)',
              backgroundColor: 'transparent',
              borderWidth: 2,
              borderDash: [5, 5],
              pointRadius: 0
            }
          ]
        };

        setSimResults({ simulationData, successProb });
    });
  }, [currentPortfolioValue, startingAssets, startingLiabilities, annualContribution, years, meanReturn, inflationRate, volatility, targetRetirementCorpus]);

  const { simulationData, successProb } = simResults;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { color: 'rgba(255,255,255,0.7)' } },
      tooltip: {
        callbacks: {
          label: (ctx) => `₹${Math.round(ctx.raw).toLocaleString('en-IN')}`
        }
      }
    },
    scales: {
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { 
          color: 'rgba(255,255,255,0.5)',
          callback: (val) => `₹${(val / 10000000).toFixed(1)}Cr`
        }
      },
      x: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: 'rgba(255,255,255,0.5)' }
      }
    }
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '24px', marginBottom: '32px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={20} color="var(--accent-sapphire)" />
            Institutional Monte Carlo Engine
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Running 1,000 randomized market simulations to model portfolio survival. Projected in real (inflation-adjusted) purchasing power.
          </p>
        </div>
        
        <div style={{ textAlign: 'right' }}>
           <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>Probability of Success</span>
           <span style={{ fontSize: '24px', fontWeight: 700, color: successProb >= 80 ? 'var(--accent-emerald)' : successProb >= 50 ? '#f59e0b' : 'var(--accent-coral)' }}>
             {successProb.toFixed(1)}%
           </span>
        </div>
      </div>

      <div className="grid-2" style={{ gap: '24px', marginBottom: '24px' }}>
        <div className="field-group">
          <label>Current Portfolio Value (₹)</label>
          <input type="number" className="field-input" value={Math.round(currentPortfolioValue)} onChange={e => setManualPortfolio(Number(e.target.value))} />
        </div>
        <div className="field-group">
          <label>Annual Contribution / SIP (Real ₹)</label>
          <input type="number" className="field-input" value={annualContribution} onChange={e => setAnnualContribution(Number(e.target.value))} />
        </div>
        <div className="field-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label>Time Horizon (Years)</label>
            <input type="number" className="field-input" value={years} onChange={e => setYears(Number(e.target.value))} />
          </div>
          <div>
            <label>Target Corpus (Real ₹)</label>
            <input type="number" className="field-input" value={targetRetirementCorpus} onChange={e => setTargetRetirementCorpus(Number(e.target.value))} />
          </div>
        </div>
        <div className="field-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          <div>
            <label>Mean Return (CAGR %)</label>
            <input type="number" className="field-input" value={meanReturn} onChange={e => setMeanReturn(Number(e.target.value))} />
          </div>
          <div>
            <label>Inflation (%)</label>
            <input type="number" className="field-input" value={inflationRate} onChange={e => setInflationRate(Number(e.target.value))} />
          </div>
          <div>
            <label>Volatility / Risk (%)</label>
            <input type="number" className="field-input" value={volatility} onChange={e => setVolatility(Number(e.target.value))} />
          </div>
        </div>
      </div>

      {isPending ? (
        <div style={{ height: '350px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Calculating simulations...</span>
        </div>
      ) : simulationData ? (
        <div style={{ height: '350px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <Line data={simulationData} options={chartOptions} />
        </div>
      ) : null}

      <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(59,130,246,0.05)', borderRadius: '12px', display: 'flex', gap: '16px' }}>
         <ShieldCheck size={24} color="var(--accent-sapphire)" style={{ flexShrink: 0 }} />
         <div>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>How to read this chart</h4>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              The <strong>Base Case (50th percentile)</strong> shows your expected trajectory. The <strong>Bear Case (10th percentile)</strong> represents a severe market downturn — this is your worst-case scenario. If your Bear Case still hits your target, your retirement is highly secure.
            </p>
         </div>
      </div>
    </div>
  );
}

export default MonteCarloSimulator;
