import { NavLink, Outlet } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/',           label: 'Command Center',   icon: '◉' },
  { to: '/bot',        label: 'Bot Intel Feed',    icon: '⚙' },
  { to: '/signals',    label: 'Signal Inbox',      icon: '⚡' },
  { to: '/theses',     label: 'Theses',            icon: '◈' },
  { to: '/thesis/new', label: 'Quick Capture',        icon: '+' },
  { to: '/market',     label: 'Market Data',        icon: '◆' },
  { to: '/reviews',    label: 'Reviews',            icon: '◇' },
  { to: '/quarantine', label: 'Quarantine',         icon: '⊘' },
  { to: '/providers',  label: 'Provider Health',    icon: '●' },
];

export default function AppShell() {
  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <nav className="w-56 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <h1 className="text-lg font-bold text-slate-100 tracking-tight">SIGNAL FORGE</h1>
          <p className="text-xs text-slate-500 mt-1">Decision Engine v1</p>
        </div>
        <div className="flex-1 py-2 overflow-y-auto">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
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
              {item.label}
            </NavLink>
          ))}
        </div>
        <div className="p-3 border-t border-slate-800">
          <p className="text-xs text-slate-600 text-center">Evidence over excitement.</p>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
