import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import NotificationBell from './NotificationBell.jsx';
import CampusBanner from './CampusBanner.jsx';

export default function DashboardShell({ title, roleLabel, navItems, active, onSelect, children }) {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // A stable per-account key for the "last seen notification" marker —
  // reg_no / teacher_id uniquely identifies the account even though we
  // don't keep the raw numeric user id around on the frontend.
  const notifKey = auth?.profile?.reg_no || auth?.profile?.teacher_id || auth?.role;

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className={`
        fixed z-30 inset-y-0 left-0 w-64 bg-brand-900 text-white transform transition-transform
        lg:translate-x-0 lg:static lg:flex lg:flex-col
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="px-5 py-5 border-b border-white/10">
          <div className="text-lg font-bold leading-tight font-brand tracking-wide">SUST CSE</div>
          <div className="text-xs text-white/45 mt-0.5">Class &amp; Exam Coordination</div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {navItems.map(item => (
            <button
              key={item.key}
              onClick={() => { onSelect(item.key); setSidebarOpen(false); }}
              className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition
                ${active === item.key ? 'bg-brand-600 text-white font-medium' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <button onClick={handleLogout} className="w-full btn bg-white/10 text-white hover:bg-white/20">
            Log out
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <CampusBanner />
        <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-slate-400" onClick={() => setSidebarOpen(true)}>☰</button>
            <h1 className="text-lg font-semibold text-slate-800 font-brand">{title}</h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <NotificationBell token={auth.token} userId={notifKey} />
            <span className="badge bg-brand-50 text-brand-700">{roleLabel}</span>
            <span className="text-slate-400 hidden sm:inline">{auth?.profile?.full_name || auth?.profile?.name || ''}</span>
          </div>
        </header>
        <main key={active} className="flex-1 p-4 lg:p-8 max-w-6xl w-full mx-auto page-transition">
          {children}
        </main>
      </div>
    </div>
  );
}
