import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import OptionsFlowTable from './components/OptionsFlowTable';
import UnusualSweeps from './components/UnusualSweeps';
import DarkPoolActivity from './components/DarkPoolActivity';
import PutCallRatio from './components/PutCallRatio';
import {
  generateOptionsFlow,
  generateDarkPoolData,
  generatePutCallRatio,
  generateSweepAlerts,
  generateMarketSummary,
} from './data/mockData';

function App() {
  const [activeTicker, setActiveTicker] = useState('ALL');
  const [optionsFlow, setOptionsFlow] = useState([]);
  const [darkPool, setDarkPool] = useState([]);
  const [putCallData, setPutCallData] = useState([]);
  const [sweepAlerts, setSweepAlerts] = useState([]);
  const [marketSummary, setMarketSummary] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const refreshData = useCallback(() => {
    setOptionsFlow(generateOptionsFlow(60));
    setDarkPool(generateDarkPoolData(30));
    setPutCallData(generatePutCallRatio());
    setSweepAlerts(generateSweepAlerts());
    setMarketSummary(generateMarketSummary());
    setLastUpdate(new Date());
  }, []);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 15000);
    return () => clearInterval(interval);
  }, [refreshData]);

  const totalFlowValue = optionsFlow.reduce((sum, o) => sum + o.totalValue, 0);
  const callCount = optionsFlow.filter(o => o.type === 'Call').length;
  const putCount = optionsFlow.filter(o => o.type === 'Put').length;
  const sweepCount = optionsFlow.filter(o => o.orderType === 'Sweep').length;

  return (
    <div className="min-h-screen bg-slate-950">
      <Header
        summary={marketSummary}
        activeTicker={activeTicker}
        onTickerChange={setActiveTicker}
      />

      <main className="p-6 max-w-[1600px] mx-auto space-y-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Flow" value={formatLargeValue(totalFlowValue)} sub="Premium value" color="text-white" />
          <StatCard label="Calls" value={callCount} sub={`${((callCount / (callCount + putCount)) * 100).toFixed(0)}% of flow`} color="text-emerald-400" />
          <StatCard label="Puts" value={putCount} sub={`${((putCount / (callCount + putCount)) * 100).toFixed(0)}% of flow`} color="text-red-400" />
          <StatCard label="Sweeps" value={sweepCount} sub="Unusual activity" color="text-purple-400" />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <OptionsFlowTable data={optionsFlow} activeTicker={activeTicker} />
          </div>
          <div className="space-y-6">
            <PutCallRatio data={putCallData} />
            <UnusualSweeps data={sweepAlerts} activeTicker={activeTicker} />
          </div>
        </div>

        {/* Dark Pool Section */}
        <DarkPoolActivity data={darkPool} activeTicker={activeTicker} />

        {/* Footer */}
        <div className="text-center py-4 text-xs text-slate-600">
          Data refreshes every 15s &middot; Last update: {lastUpdate.toLocaleTimeString()} &middot; Simulated data for demonstration
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 px-5 py-4">
      <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">{label}</p>
      <p className={`text-2xl font-bold font-mono mt-1 ${color}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>
    </div>
  );
}

function formatLargeValue(val) {
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(1)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val}`;
}

export default App;
