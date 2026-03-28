import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useSignalStore } from '../../store/useSignalStore';

const PIPELINE_NAV = [
  { to: '/',           label: 'Signal Inbox',      icon: '⚡', countKey: 'inbox' },
  { to: '/bot',        label: 'Bot Feed',          icon: '⚙' },
  { to: '/dashboard',  label: 'Thesis Hub',        icon: '◉' },
  { to: '/market',     label: 'Market Context',    icon: '◆' },
];

const SECONDARY_NAV = [
  { to: '/theses',     label: 'All Theses',        icon: '◈' },
  { to: '/thesis/new', label: 'Quick Capture',     icon: '+' },
  { to: '/reviews',    label: 'Reviews',           icon: '◇' },
  { to: '/quarantine', label: 'Quarantine',        icon: '⊘' },
  { to: '/providers',  label: 'Providers',         icon: '●' },
];

export default function AppShell() {
  const counts = useSignalStore(s => s.counts);
  const fetchCounts = useSignalStore(s => s.fetchCounts);
  const [lastScanSummary, setLastScanSummary] = useState(null);

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 60000);
    return () => clearInterval(interval);
  }, [fetchCounts]);

  // Persist last bot scan summary for the activity bar
  useEffect(() => {
    const stored = localStorage.getItem('sf_last_scan_summary');
    if (stored) {
      try { setLastScanSummary(JSON.parse(stored)); } catch {}
    }
    // Listen for scan updates from BotFeed
    const handler = (e) => {
      if (e.key === 'sf_last_scan_summary' && e.newValue) {
        try { setLastScanSummary(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const newCount = counts.inbox || 0;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <nav className="w-56 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <h1 className="text-lg font-bold text-slate-100 tracking-tight">SIGNAL FORGE</h1>
          <p className="text-xs text-slate-500 mt-1">Capture · Analyze · Act</p>
        </div>

        <div className="flex-1 py-2 overflow-y-auto">
          <p className="px-4 mb-1 text-xs text-slate-600 uppercase tracking-wider">Pipeline</p>
          {PIPELINE_NAV.map((item, idx) => (
            <div key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-slate-800 text-white border-r-2 border-cyan-400'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`
                }
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.countKey && newCount > 0 && (
                  <span className="text-xs bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-full font-medium min-w-[1.25rem] text-center">
                    {newCount > 99 ? '99+' : newCount}
                  </span>
                )}
              </NavLink>
              {idx < PIPELINE_NAV.length - 1 && (
                <div className="pl-7 py-0.5">
                  <span className="text-xs text-slate-700">↓</span>
                </div>
              )}
            </div>
          ))}

          <div className="mx-4 my-3 border-t border-slate-800" />
          <p className="px-4 mb-1 text-xs text-slate-600 uppercase tracking-wider">Tools</p>

          {SECONDARY_NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2 text-xs transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-slate-300 border-r-2 border-slate-500'
                    : 'text-slate-500 hover:text-slate-400 hover:bg-slate-800/30'
                }`
              }
            >
              <span className="text-sm w-5 text-center">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>

        {/* System activity bar */}
        <div className="p-3 border-t border-slate-800 space-y-1">
          {lastScanSummary && (
            <p className="text-xs text-slate-600 text-center">
              {lastScanSummary.total_inputs || 0} processed · {lastScanSummary.clusters_formed || 0} clusters · {lastScanSummary.escalations || 0} escalations
            </p>
          )}
          <p className="text-xs text-slate-700 text-center">Evidence over excitement.</p>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
