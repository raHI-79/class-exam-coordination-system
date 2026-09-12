export function Loading({ text = 'Loading...' }) {
  return (
    <div className="flex items-center gap-2 text-slate-400 text-sm py-6 justify-center">
      <span className="h-4 w-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      {text}
    </div>
  );
}

export function Empty({ text = 'Nothing here yet.' }) {
  return <div className="text-center text-slate-400 text-sm py-10 border border-dashed border-slate-200 rounded-xl">{text}</div>;
}

export function Alert({ type = 'info', children, onClose }) {
  const styles = {
    info: 'bg-brand-50 text-brand-700 border-brand-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    error: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <div className={`border rounded-lg px-4 py-2.5 text-sm mb-4 flex items-start justify-between gap-3 animate-fadeIn ${styles[type]}`}>
      <span>{children}</span>
      {onClose && <button onClick={onClose} className="text-xs opacity-60 hover:opacity-100">✕</button>}
    </div>
  );
}

export function Badge({ status }) {
  const map = {
    pending: 'badge-pending',
    approved: 'badge-approved',
    rejected: 'badge-rejected',
    cancelled: 'badge-cancelled',
    auto_cancelled: 'badge-cancelled',
  };
  const label = {
    pending: 'Pending', approved: 'Approved', rejected: 'Rejected',
    cancelled: 'Cancelled', auto_cancelled: 'Auto-cancelled',
  };
  return <span className={map[status] || 'badge bg-slate-100 text-slate-600'}>{label[status] || status}</span>;
}
