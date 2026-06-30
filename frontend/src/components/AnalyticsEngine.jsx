import React from 'react';
import TaxVault from './TaxVault';
import DividendTracker from './DividendTracker';
import MFOverlap from './MFOverlap';
import EmergencyAdequacy from './EmergencyAdequacy';

import CashFlowForecast from './CashFlowForecast';
import LifestyleCreep from './LifestyleCreep';
import StressTest from './StressTest';

import MonteCarloSimulator from './MonteCarloSimulator';
import WealthAdvisor from './WealthAdvisor';

function AnalyticsEngine() {
  return (
    <div className="analytics-engine animate-fade-in" style={{paddingBottom:'40px'}}>
      <div className="section-header">
        <div>
          <h2>Analytics & Forecasting Engine</h2>
          <p>Holistic terminal for deep portfolio diagnostics and behavioral cashflow forecasting.</p>
        </div>
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:'40px'}}>
        <section>
          <WealthAdvisor />
        </section>

        <section>
          <TaxVault />
        </section>

        <section>
          <CashFlowForecast />
        </section>

        <section>
          <MonteCarloSimulator />
        </section>

        <section>
          <StressTest />
        </section>

        <section className="grid-2" style={{gap:'24px', alignItems:'start'}}>
          <DividendTracker />
          <MFOverlap />
        </section>

        <section>
          <EmergencyAdequacy />
        </section>
        


        <section>
          <LifestyleCreep />
        </section>
      </div>
    </div>
  );
}

export default AnalyticsEngine;
