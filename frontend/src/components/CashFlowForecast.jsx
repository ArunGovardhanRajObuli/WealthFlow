import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Radar, AlertTriangle, TrendingUp, Calendar } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

function CashFlowForecast() {
  const [range, setRange] = useState(90);

  const { data, error: fetchError } = useQuery({
    queryKey: ['forecast', range],
    queryFn: async () => {
      const res = await fetch(`/api/forecast?days=${range}`);
      if (!res.ok) throw new Error('Failed to load forecast data');
      return res.json();
    }
  });

  const error = fetchError?.message;

  const { chartData, upcomingEvents } = useMemo(() => {
    if (!data) return { sampledTimeline: [], chartData: null, upcomingEvents: [] };

    const sampled = (data.timeline || []).filter((_, i) => i % 7 === 0 || i === data.timeline.length - 1);
    const chart = {
      labels: sampled.map(t => {
        const d = new Date(t.date + 'T00:00:00');
        return `${d.getDate()} ${d.toLocaleString('en-IN', { month: 'short' })}`;
      }),
      datasets: [
        {
          label: 'Projected Balance',
          data: sampled.map(t => t.balance),
          borderColor: data.crisisDate ? 'rgba(239, 68, 68, 1)' : 'rgba(59, 130, 246, 1)',
          backgroundColor: data.crisisDate ? 'rgba(239, 68, 68, 0.08)' : 'rgba(59, 130, 246, 0.08)',
          fill: true,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 6,
        },
        {
          label: 'Zero Line',
          data: sampled.map(() => 0),
          borderColor: 'rgba(239, 68, 68, 0.4)',
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
        }
      ]
    };
    
    const upcoming = (data.events || []).slice(0, 8);
    
    return { sampledTimeline: sampled, chartData: chart, upcomingEvents: upcoming };
  }, [data]);

  const chartOptions = {
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.parsed.y < 0 ? '-' : ''}₹${Math.abs(ctx.parsed.y).toLocaleString('en-IN')}`
        }
      }
    },
    scales: {
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: {
          color: '#94a3b8',
          callback: v => v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${(v / 1000).toFixed(0)}K`
        }
      },
      x: { grid: { display: false }, ticks: { color: '#94a3b8', maxRotation: 45 } }
    }
  };

  if (!data) return null;

  return (
    <div className="animate-fade-in">
      {error && <div className="alert-banner danger" style={{marginBottom:'20px'}}><AlertTriangle size={16}/> {error}</div>}
      <div className="section-header">
        <div>
          <h2>Cash Flow Forecasting Engine</h2>
          <p>Temporal Liquidity Radar — See your future balance before it happens</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[30, 60, 90].map(d => (
            <button key={d} className="btn" onClick={() => setRange(d)}
              style={{ padding: '8px 16px', fontSize: '12px', background: range === d ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.03)', color: range === d ? '#60a5fa' : 'var(--text-secondary)', border: range === d ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent' }}>
              {d}D
            </button>
          ))}
        </div>
      </div>

      {/* Alert Bar */}
      {data.crisisDate && (
        <div className="alert-banner danger" style={{ marginBottom: '24px' }}>
          <AlertTriangle size={24} />
          <div>
            <h4 style={{ margin: '0 0 4px 0' }}>LIQUIDITY CRISIS PROJECTED</h4>
            <p style={{ fontSize: '13px', margin: 0 }}>
              Your projected balance goes negative on <strong>{new Date(data.crisisDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>. Pre-position capital now.
            </p>
          </div>
        </div>
      )}

      {/* KPI Strip */}
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-card-label">Starting Free Cash</div>
          <div className="stat-card-value">{`${(data.startingCash || 0) < 0 ? '-' : ''}₹${Math.abs(data.startingCash || 0).toLocaleString('en-IN')}`}</div>
        </div>
        <div className="stat-card" style={{'--stat-accent': (data.minProjectedBalance || 0) < 0 ? '#ef4444' : '#10b981', '--stat-color': (data.minProjectedBalance || 0) < 0 ? '#ef4444' : '#10b981'}}>
          <div className="stat-card-label">Minimum Projected Balance</div>
          <div className="stat-card-value">{`${(data.minProjectedBalance || 0) < 0 ? '-' : ''}₹${Math.abs(data.minProjectedBalance || 0).toLocaleString('en-IN')}`}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Forecast Horizon</div>
          <div className="stat-card-value">{range} Days</div>
        </div>
      </div>

      {/* Chart */}
      <div className="glass-panel" style={{ marginBottom: '40px' }}>
        <h3 style={{ marginBottom: '24px' }}>Projected Balance Timeline</h3>
        <div style={{ height: '320px' }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* Upcoming Events Timeline */}
      <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Calendar size={20} className="text-sapphire" />
        Upcoming Financial Events
      </h3>
      <div className="glass-panel">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {upcomingEvents.map((event, idx) => (
            <div key={idx} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px',
              borderLeft: `3px solid ${event.type === 'income' ? 'var(--accent-emerald)' : 'var(--accent-coral)'}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '70px' }}>
                  {new Date(event.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 500 }}>{event.title}</span>
              </div>
              <span style={{ fontWeight: 700, color: event.type === 'income' ? 'var(--accent-emerald)' : 'var(--text-primary)' }}>
                {event.type === 'income' ? '+' : '-'}₹{Number(String(event.amount || '0').replace(/,/g, '')).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
          ))}
          {upcomingEvents.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '24px' }}>No scheduled events in this window.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default CashFlowForecast;
