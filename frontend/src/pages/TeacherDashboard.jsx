import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';
import DashboardShell from '../components/DashboardShell.jsx';
import { Loading, Empty, Alert, Badge } from '../components/Ui.jsx';

const NAV = [
  { key: 'schedule', label: 'Daily Schedule', icon: '📅' },
  { key: 'requests', label: 'Approval Requests', icon: '✅' },
  { key: 'cancel', label: 'Cancel a Class', icon: '🚫' },
  { key: 'messages', label: 'CR Messages', icon: '💬' },
  { key: 'send', label: 'Send Message / Notice', icon: '📨' },
];

export default function TeacherDashboard() {
  const { auth } = useAuth();
  const [tab, setTab] = useState('schedule');
  return (
    <DashboardShell title={`Teacher Dashboard — ${auth.profile?.name || ''}`} roleLabel="Teacher" navItems={NAV} active={tab} onSelect={setTab}>
      {tab === 'schedule' && <Schedule token={auth.token} />}
      {tab === 'requests' && <Requests token={auth.token} />}
      {tab === 'cancel' && <CancelClass token={auth.token} />}
      {tab === 'messages' && <CRMessages token={auth.token} />}
      {tab === 'send' && <SendMessage token={auth.token} />}
    </DashboardShell>
  );
}

function Schedule({ token }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/teacher/schedule?date=' + date, token).then(setData); }, [token, date]);

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4 gap-3">
        <h2 className="font-semibold text-slate-800">Your Schedule</h2>
        <input type="date" className="input max-w-[180px]" value={date} onChange={e => setDate(e.target.value)} />
      </div>
      {!data ? <Loading /> : (() => {
        const combined = [...data.fixedClasses, ...data.scheduledEvents].sort((a, b) => a.start_time.localeCompare(b.start_time));
        return combined.length === 0 ? <Empty text={`No classes scheduled for ${data.day}, ${data.date}.`} /> : (
          <div className="space-y-2">
            {combined.map((c, i) => (
              <div key={i} className="flex flex-wrap justify-between gap-2 border-b border-slate-200 py-2.5 last:border-0 text-sm">
                <div>
                  <div className="font-medium">{c.course_code} — {c.course_title}</div>
                  <div className="text-slate-400">{c.batch ? `${c.batch} Sec ${c.section}` : ''} · Room {c.room}</div>
                </div>
                <span className="text-slate-600 font-medium">{c.start_time}-{c.end_time}</span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

function Requests({ token }) {
  const [rows, setRows] = useState(null);
  const [msg, setMsg] = useState('');

  const load = () => api.get('/teacher/requests/pending', token).then(setRows);
  useEffect(() => { load(); }, [token]);

  const act = async (id, action) => {
    try {
      const res = await api.post(`/teacher/requests/${id}/${action}`, {}, token);
      setMsg(res.message);
      load();
    } catch (e) { setMsg(e.message); }
  };

  if (!rows) return <Loading />;
  return (
    <div className="card">
      <h2 className="font-semibold text-slate-800 mb-3">Pending Requests</h2>
      {msg && <Alert type="info" onClose={() => setMsg('')}>{msg}</Alert>}
      {rows.length === 0 ? <Empty text="No pending requests." /> : (
        <div className="space-y-3">
          {rows.map(r => (
            <div key={r.id} className="border border-slate-200 rounded-lg p-3 flex flex-wrap justify-between items-center gap-3">
              <div className="text-sm">
                <div className="font-medium">{r.course_code} — {r.course_title} <Badge status="pending" /></div>
                <div className="text-slate-400">{r.batch} Sec {r.section} · {r.date} · {r.start_time}-{r.end_time} @ {r.room}</div>
                <div className="text-slate-400 text-xs">Requested by {r.requested_by || 'CR'} · Type: {r.event_type}</div>
              </div>
              <div className="flex gap-2">
                <button className="btn-success" onClick={() => act(r.id, 'approve')}>Approve</button>
                <button className="btn-danger" onClick={() => act(r.id, 'reject')}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CancelClass({ token }) {
  const [upcoming, setUpcoming] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState('');

  const loadUpcoming = () => api.get('/teacher/events/upcoming', token).then(setUpcoming);
  const load = () => api.get('/teacher/schedule?date=' + date, token).then(setData);
  useEffect(() => { loadUpcoming(); }, [token]);
  useEffect(() => { load(); }, [token, date]);

  const cancel = async (id) => {
    if (!confirm('Cancel this class? Students will be notified immediately.')) return;
    try {
      const res = await api.post(`/teacher/events/${id}/cancel`, {}, token);
      setMsg(res.message);
      loadUpcoming();
      load();
    } catch (e) { setMsg(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="font-semibold text-slate-800 mb-1">Cancel Any Upcoming Class</h2>
        <p className="text-sm text-slate-400 mb-3">Any of your approved classes, any day — cancel it whenever you need to.</p>
        {msg && <Alert type="info" onClose={() => setMsg('')}>{msg}</Alert>}
        {!upcoming ? <Loading /> : upcoming.length === 0 ? (
          <Empty text="No upcoming approved classes." />
        ) : (
          <div className="space-y-2">
            {upcoming.map(e => (
              <div key={e.id} className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-200 py-2.5 last:border-0 text-sm">
                <div>
                  <div className="font-medium">{e.course_code} — {e.course_title} <span className="text-slate-400 font-normal">· {e.event_type}</span></div>
                  <div className="text-slate-400">{e.batch} Sec {e.section} · {e.date} · {e.start_time}-{e.end_time} @ {e.room}</div>
                </div>
                <button className="btn-danger" onClick={() => cancel(e.id)}>Cancel Class</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-4 gap-3">
          <h2 className="font-semibold text-slate-800">Browse by Date</h2>
          <input type="date" className="input max-w-[180px]" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        {!data ? <Loading /> : data.scheduledEvents.length === 0 ? (
          <Empty text="No specially-scheduled classes for this date." />
        ) : (
          <div className="space-y-2">
            {data.scheduledEvents.map(e => (
              <div key={e.id} className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-200 py-2.5 last:border-0 text-sm">
                <div>
                  <div className="font-medium">{e.course_code} — {e.course_title}</div>
                  <div className="text-slate-400">{e.start_time}-{e.end_time} @ {e.room}</div>
                </div>
                <button className="btn-danger" onClick={() => cancel(e.id)}>Cancel Class</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CRMessages({ token }) {
  const [inbox, setInbox] = useState(null);
  const [replyTarget, setReplyTarget] = useState(null);
  const [content, setContent] = useState('');
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState('');

  const load = () => api.get('/teacher/messages/inbox', token).then(setInbox);
  useEffect(() => { load(); }, [token]);

  const sendReply = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('crUserId', replyTarget);
    fd.append('content', content);
    if (file) fd.append('file', file);
    try {
      const res = await api.postForm('/teacher/messages/reply', fd, token);
      setMsg(res.message); setContent(''); setFile(null); setReplyTarget(null);
      load();
    } catch (e) { setMsg(e.message); }
  };

  if (!inbox) return <Loading />;
  return (
    <div className="card">
      <h2 className="font-semibold text-slate-800 mb-3">Messages from Class Representatives</h2>
      {msg && <Alert type="info" onClose={() => setMsg('')}>{msg}</Alert>}
      {inbox.length === 0 ? <Empty text="No messages yet." /> : (
        <div className="space-y-3">
          {inbox.map(m => (
            <div key={m.id} className="border border-slate-200 rounded-lg p-3">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span className="font-medium text-slate-700">{m.sender_name}</span>
                <span>{new Date(m.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{m.content}</p>
              {m.file_path && <a href={m.file_path} target="_blank" rel="noreferrer" className="text-brand-600 text-sm hover:underline">📎 Attachment</a>}
              <div className="mt-2">
                <button className="text-sm text-brand-600 hover:underline" onClick={() => setReplyTarget(m.sender_id)}>Reply</button>
              </div>
              {replyTarget === m.sender_id && (
                <form onSubmit={sendReply} className="mt-2 space-y-2 border-t border-slate-200 pt-2">
                  <textarea className="input" rows={2} placeholder="Your reply..." value={content} onChange={e => setContent(e.target.value)} />
                  <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files[0])} />
                  <div className="flex gap-2">
                    <button className="btn-primary">Send Reply</button>
                    <button type="button" className="btn-secondary" onClick={() => setReplyTarget(null)}>Cancel</button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SendMessage({ token }) {
  const [targetType, setTargetType] = useState('cr'); // 'cr' | 'batch' | 'student'
  const [crs, setCrs] = useState([]);
  const [batches, setBatches] = useState([]);
  const [sections, setSections] = useState([]);
  const [crUserId, setCrUserId] = useState('');
  const [targetBatch, setTargetBatch] = useState('');
  const [targetSection, setTargetSection] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [studentResults, setStudentResults] = useState([]);
  const [studentUserId, setStudentUserId] = useState('');
  const [studentLabel, setStudentLabel] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/teacher/lookups/crs', token).then(setCrs);
    api.get('/teacher/lookups/batches', token).then(setBatches);
  }, [token]);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (targetBatch) qs.set('batch', targetBatch);
    api.get('/teacher/lookups/sections?' + qs.toString(), token).then(setSections);
  }, [token, targetBatch]);

  useEffect(() => {
    if (targetType !== 'student') return;
    const timeout = setTimeout(() => {
      api.get('/teacher/lookups/students?q=' + encodeURIComponent(studentQuery), token).then(setStudentResults);
    }, 250);
    return () => clearTimeout(timeout);
  }, [token, studentQuery, targetType]);

  const submit = async (e) => {
    e.preventDefault(); setMsg(''); setErr('');
    const fd = new FormData();
    fd.append('targetType', targetType);
    fd.append('content', content);
    if (targetType === 'cr') fd.append('crUserId', crUserId);
    if (targetType === 'batch') { fd.append('targetBatch', targetBatch); fd.append('targetSection', targetSection); }
    if (targetType === 'student') fd.append('studentUserId', studentUserId);
    if (file) fd.append('file', file);
    try {
      const res = await api.postForm('/teacher/messages/send', fd, token);
      setMsg(res.message); setContent(''); setFile(null);
    } catch (e) { setErr(e.message); }
  };

  return (
    <div className="card max-w-xl">
      <h2 className="font-semibold text-slate-800 mb-1">Send Message / Notice</h2>
      <p className="text-sm text-slate-400 mb-4">To a Class Representative, an entire batch (or one section), or one specific student — with an optional PDF.</p>
      {msg && <Alert type="success" onClose={() => setMsg('')}>{msg}</Alert>}
      {err && <Alert type="error" onClose={() => setErr('')}>{err}</Alert>}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Send to</label>
          <select className="input" value={targetType} onChange={e => setTargetType(e.target.value)}>
            <option value="cr">A Class Representative</option>
            <option value="batch">A batch (or one section)</option>
            <option value="student">A specific student</option>
          </select>
        </div>

        {targetType === 'cr' && (
          <div>
            <label className="label">Class Representative</label>
            <select className="input" value={crUserId} onChange={e => setCrUserId(e.target.value)} required>
              <option value="">Select CR</option>
              {crs.map(c => <option key={c.user_id} value={c.user_id}>{c.full_name} — {c.batch} Sec {c.section}</option>)}
            </select>
          </div>
        )}

        {targetType === 'batch' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Batch</label>
              <select className="input" value={targetBatch} onChange={e => { setTargetBatch(e.target.value); setTargetSection(''); }} required>
                <option value="">Select batch</option>
                {batches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Section (optional)</label>
              <select className="input" value={targetSection} onChange={e => setTargetSection(e.target.value)}>
                <option value="">Whole batch</option>
                {sections.map(s => <option key={s} value={s}>Section {s}</option>)}
              </select>
            </div>
          </div>
        )}

        {targetType === 'student' && (
          <div>
            <label className="label">Student</label>
            {studentLabel ? (
              <div className="flex items-center justify-between border border-slate-300 rounded-lg px-3 py-2 text-sm">
                <span>{studentLabel}</span>
                <button type="button" className="text-xs text-brand-600 hover:underline" onClick={() => { setStudentUserId(''); setStudentLabel(''); }}>Change</button>
              </div>
            ) : (
              <>
                <input className="input" placeholder="Search by name or reg no" value={studentQuery} onChange={e => setStudentQuery(e.target.value)} />
                {studentResults.length > 0 && (
                  <ul className="border border-slate-200 rounded-lg mt-1 max-h-40 overflow-y-auto text-sm divide-y divide-slate-100">
                    {studentResults.map(s => (
                      <li
                        key={s.user_id}
                        className="px-3 py-2 hover:bg-slate-50 cursor-pointer"
                        onClick={() => { setStudentUserId(s.user_id); setStudentLabel(`${s.full_name} (${s.reg_no}) — ${s.batch} Sec ${s.section}`); setStudentResults([]); }}
                      >
                        {s.full_name} ({s.reg_no}) — {s.batch} Sec {s.section}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}

        <div>
          <label className="label">Message</label>
          <textarea className="input" rows={4} value={content} onChange={e => setContent(e.target.value)} />
        </div>
        <div>
          <label className="label">Attach PDF (optional)</label>
          <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files[0])} />
        </div>
        <button className="btn-primary">Send</button>
      </form>
    </div>
  );
}
