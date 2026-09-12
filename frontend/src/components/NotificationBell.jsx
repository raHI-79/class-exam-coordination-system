import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso + 'Z').getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationBell({ token, userId }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState(() => localStorage.getItem(`notif_seen_${userId}`) || '');
  const boxRef = useRef(null);

  const load = () => api.get('/notifications/mine', token).then(setNotifications).catch(() => {});

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // poll every 30s for new notifications
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !lastSeen || n.created_at > lastSeen).length;

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && notifications.length > 0) {
      const now = notifications[0].created_at;
      localStorage.setItem(`notif_seen_${userId}`, now);
      setLastSeen(now);
    }
  };

  return (
    <div className="relative" ref={boxRef}>
      <button onClick={toggleOpen} className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400">
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] leading-none rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg z-50 dropdown-transition">
          <div className="px-4 py-2.5 border-b border-slate-200 font-medium text-sm text-slate-700">Notifications</div>
          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-400">No notifications yet.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {notifications.map(n => (
                <li key={n.id} className="px-4 py-3 text-sm hover:bg-slate-50">
                  <div className="font-medium text-slate-800">{n.title}</div>
                  {n.body && <div className="text-slate-400 text-xs mt-0.5 line-clamp-2">{n.body}</div>}
                  <div className="text-slate-400 text-[11px] mt-1">{timeAgo(n.created_at)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
