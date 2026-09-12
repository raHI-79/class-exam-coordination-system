import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';
import DashboardShell from '../components/DashboardShell.jsx';
import { Loading, Empty, Alert, Badge } from '../components/Ui.jsx';

const NAV = [
  { key: 'routine', label: 'Fixed Routine', icon: '🗂️' },
  { key: 'create', label: 'Create Class / Exam', icon: '📅' },
  { key: 'extra', label: 'Create Extra Class', icon: '➕' },
  { key: 'requests', label: 'My Requests', icon: '📋' },
  { key: 'messages', label: 'Messaging', icon: '💬' },
  { key: 'teachermsgs', label: 'Teacher Messages', icon: '📨' },
  { key: 'notices', label: 'Post Notice', icon: '📣' },
  { key: 'materials', label: 'Materials', icon: '📚' },
  { key: 'teachers', label: 'Teachers Info', icon: '👨‍🏫' },
  { key: 'polls', label: 'Polls', icon: '🗳️' },
];

export default function CRDashboard() {
  const { auth } = useAuth();
  const [tab, setTab] = useState('routine');

  return (
    <DashboardShell title={`CR Dashboard — ${auth.profile?.batch} Sec ${auth.profile?.section}`} roleLabel="Class Representative" navItems={NAV} active={tab} onSelect={setTab}>
      {tab === 'routine' && <FixedRoutine token={auth.token} />}
      {tab === 'create' && <CreateClassExam token={auth.token} profile={auth.profile} />}
      {tab === 'extra' && <ExtraClass token={auth.token} profile={auth.profile} />}
      {tab === 'requests' && <MyRequests token={auth.token} />}
      {tab === 'messages' && <Messaging token={auth.token} profile={auth.profile} />}
      {tab === 'teachermsgs' && <TeacherMessages token={auth.token} />}
      {tab === 'notices' && <PostNotice token={auth.token} profile={auth.profile} />}
      {tab === 'materials' && <Materials token={auth.token} profile={auth.profile} />}
      {tab === 'teachers' && <TeachersInfo token={auth.token} />}
      {tab === 'polls' && <CreatePoll token={auth.token} />}
    </DashboardShell>
  );
}

function FixedRoutine({ token }) {
  const [routine, setRoutine] = useState(null);
  useEffect(() => { api.get('/cr/routine/fixed', token).then(setRoutine); }, [token]);
  if (!routine) return <Loading />;
  return (
    <div className="card">
      <h2 className="font-semibold text-slate-800 mb-3">Your Section's Fixed Routine</h2>
      {routine.length === 0 ? <Empty text="No fixed routine set by Administration yet." /> : (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-400 border-b border-slate-200"><th className="py-2">Day</th><th>Time</th><th>Course</th><th>Teacher</th><th>Room</th></tr></thead>
          <tbody>
            {routine.map(r => (
              <tr key={r.id} className="border-b border-slate-200 last:border-0">
                <td className="py-2">{r.day_of_week}</td><td>{r.start_time}-{r.end_time}</td>
                <td>{r.course_code} — {r.course_title}</td><td>{r.teacher_name}</td><td>{r.room}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function useLookups(token) {
  const [teachers, setTeachers] = useState([]);
  const [courses, setCourses] = useState([]);
  useEffect(() => {
    api.get('/cr/lookups/teachers', token).then(setTeachers);
    api.get('/cr/lookups/courses', token).then(setCourses);
  }, [token]);
  return { teachers, courses };
}

// Shows what's already booked (room, time, batch/section, course) on the
// chosen date — both one-off bookings and the recurring Fixed Routine for
// that day — so the CR can see room & time availability up front. Their own
// batch's fixed routine slots are shown but don't block them; another
// batch's slots (fixed or dated) do.
function RoomAvailability({ token, date }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!date) { setData(null); return; }
    api.get('/cr/room-schedule?date=' + date, token).then(setData);
  }, [token, date]);

  if (!date) return null;
  return (
    <div className="sm:col-span-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
      <div className="text-sm font-medium text-slate-700 mb-1">
        Room availability on {date} {data?.dayOfWeek ? `(${data.dayOfWeek})` : ''}
      </div>
      <div className="text-xs text-slate-400 mb-2">Class hours: 8:00 AM – 5:00 PM. Rooms/times not listed below are free.</div>
      {!data ? <div className="text-xs text-slate-400">Checking...</div> : data.bookings.length === 0 ? (
        <div className="text-xs text-emerald-600">No bookings yet — every room is free all day.</div>
      ) : (
        <ul className="text-xs text-slate-600 space-y-1">
          {data.bookings.map((b, i) => (
            <li key={i} className="flex justify-between items-center gap-2">
              <span>Room {b.room} — {b.start_time}-{b.end_time}</span>
              <span className={`text-right ${b.isOwnBatch ? 'text-emerald-600' : 'text-red-500'}`}>
                {b.course_code} · {b.batch} Sec {b.section}
                {b.source === 'fixed_routine' ? ' (fixed routine)' : ` (${b.status})`}
                {b.isOwnBatch ? ' — yours' : ' — unavailable'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateClassExam({ token, profile }) {
  const { teachers, courses } = useLookups(token);
  const [form, setForm] = useState({ courseId: '', teacherId: '', date: '', startTime: '', endTime: '', room: '', eventType: 'class' });
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const submit = async (e) => {
    e.preventDefault(); setMsg(''); setErr('');
    try {
      const res = await api.post('/cr/class-events', form, token);
      setMsg(res.message);
      setForm({ courseId: '', teacherId: '', date: '', startTime: '', endTime: '', room: '', eventType: 'class' });
    } catch (e) { setErr(e.message); }
  };

  return (
    <div className="card max-w-xl">
      <h2 className="font-semibold text-slate-800 mb-1">Create Class or Exam Date</h2>
      <p className="text-sm text-slate-400 mb-4">
        For {profile?.batch} Section {profile?.section}. Classes must be between 8:00 AM and 5:00 PM.
        The selected teacher must approve — for next-day classes, approval is needed by 11:59 PM tonight,
        or it's auto-cancelled.
      </p>
      {msg && <Alert type="success" onClose={() => setMsg('')}>{msg}</Alert>}
      {err && <Alert type="error" onClose={() => setErr('')}>{err}</Alert>}
      <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Type</label>
          <select className="input" value={form.eventType} onChange={e => set('eventType', e.target.value)}>
            <option value="class">Class</option>
            <option value="exam">Exam</option>
          </select>
        </div>
        <div>
          <label className="label">Course</label>
          <select className="input" value={form.courseId} onChange={e => set('courseId', e.target.value)} required>
            <option value="">Select course</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Teacher</label>
          <select className="input" value={form.teacherId} onChange={e => set('teacherId', e.target.value)} required>
            <option value="">Select teacher</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={form.date} onChange={e => set('date', e.target.value)} required />
        </div>
        <RoomAvailability token={token} date={form.date} />
        <div>
          <label className="label">Start Time (8 AM – 5 PM)</label>
          <input type="time" className="input" min="08:00" max="17:00" value={form.startTime} onChange={e => set('startTime', e.target.value)} required />
        </div>
        <div>
          <label className="label">End Time (8 AM – 5 PM)</label>
          <input type="time" className="input" min="08:00" max="17:00" value={form.endTime} onChange={e => set('endTime', e.target.value)} required />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Room</label>
          <input className="input" value={form.room} onChange={e => set('room', e.target.value)} required />
        </div>
        <div className="sm:col-span-2">
          <button className="btn-primary">Send for Teacher Approval</button>
        </div>
      </form>
    </div>
  );
}

function ExtraClass({ token, profile }) {
  const { teachers, courses } = useLookups(token);
  const [form, setForm] = useState({ batch: profile?.batch || '', section: profile?.section || '', courseId: '', teacherId: '', date: '', startTime: '', endTime: '', room: '' });
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const submit = async (e) => {
    e.preventDefault(); setMsg(''); setErr('');
    try {
      const res = await api.post('/cr/extra-class', form, token);
      setMsg(res.message);
    } catch (e) { setErr(e.message); }
  };

  return (
    <div className="card max-w-xl">
      <h2 className="font-semibold text-slate-800 mb-1">Create Extra Class</h2>
      <p className="text-sm text-slate-400 mb-4">Room availability is checked automatically before submitting.</p>
      {msg && <Alert type="success" onClose={() => setMsg('')}>{msg}</Alert>}
      {err && <Alert type="error" onClose={() => setErr('')}>{err}</Alert>}
      <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4">
        <div><label className="label">Batch</label><input className="input" value={form.batch} onChange={e => set('batch', e.target.value)} required /></div>
        <div><label className="label">Section</label><input className="input" value={form.section} onChange={e => set('section', e.target.value)} required /></div>
        <div>
          <label className="label">Course</label>
          <select className="input" value={form.courseId} onChange={e => set('courseId', e.target.value)} required>
            <option value="">Select course</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Teacher</label>
          <select className="input" value={form.teacherId} onChange={e => set('teacherId', e.target.value)} required>
            <option value="">Select teacher</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div><label className="label">Date</label><input type="date" className="input" value={form.date} onChange={e => set('date', e.target.value)} required /></div>
        <RoomAvailability token={token} date={form.date} />
        <div><label className="label">Room</label><input className="input" value={form.room} onChange={e => set('room', e.target.value)} required /></div>
        <div><label className="label">Start Time (8 AM – 5 PM)</label><input type="time" className="input" min="08:00" max="17:00" value={form.startTime} onChange={e => set('startTime', e.target.value)} required /></div>
        <div><label className="label">End Time (8 AM – 5 PM)</label><input type="time" className="input" min="08:00" max="17:00" value={form.endTime} onChange={e => set('endTime', e.target.value)} required /></div>
        <div className="sm:col-span-2"><button className="btn-primary">Check &amp; Submit Request</button></div>
      </form>
    </div>
  );
}

function MyRequests({ token }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get('/cr/class-events', token).then(setRows); }, [token]);
  if (!rows) return <Loading />;
  return (
    <div className="card">
      <h2 className="font-semibold text-slate-800 mb-3">Your Class / Exam / Extra-Class Requests</h2>
      {rows.length === 0 ? <Empty text="You haven't created any requests yet." /> : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 py-2.5 last:border-0 text-sm">
              <div>
                <div className="font-medium">{r.course_code} · {r.event_type} · {r.date}</div>
                <div className="text-slate-400">{r.teacher_name} · {r.start_time}-{r.end_time} @ {r.room}</div>
              </div>
              <Badge status={r.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Messaging({ token, profile }) {
  const { teachers } = useLookups(token);
  const [targetType, setTargetType] = useState('batch_group');
  const [targetBatch, setTargetBatch] = useState(profile?.batch || '');
  const [targetSection, setTargetSection] = useState('');
  const [targetTeacherId, setTargetTeacherId] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault(); setMsg(''); setErr('');
    const fd = new FormData();
    fd.append('targetType', targetType);
    fd.append('targetBatch', targetBatch);
    fd.append('targetSection', targetSection);
    fd.append('targetTeacherId', targetTeacherId);
    fd.append('content', content);
    if (file) fd.append('file', file);
    try {
      const res = await api.postForm('/cr/messages', fd, token);
      setMsg(res.message);
      setContent(''); setFile(null);
    } catch (e) { setErr(e.message); }
  };

  return (
    <div className="card max-w-xl">
      <h2 className="font-semibold text-slate-800 mb-1">Send Message / PDF</h2>
      <p className="text-sm text-slate-400 mb-4">To your batch group, another batch group, or a specific teacher.</p>
      {msg && <Alert type="success" onClose={() => setMsg('')}>{msg}</Alert>}
      {err && <Alert type="error" onClose={() => setErr('')}>{err}</Alert>}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Send to</label>
          <select className="input" value={targetType} onChange={e => setTargetType(e.target.value)}>
            <option value="batch_group">My batch group</option>
            <option value="student_broadcast">Another batch group</option>
            <option value="teacher">A specific teacher</option>
          </select>
        </div>
        {targetType !== 'teacher' && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Batch</label><input className="input" value={targetBatch} onChange={e => setTargetBatch(e.target.value)} /></div>
            <div><label className="label">Section (optional)</label><input className="input" value={targetSection} onChange={e => setTargetSection(e.target.value)} /></div>
          </div>
        )}
        {targetType === 'teacher' && (
          <div>
            <label className="label">Teacher</label>
            <select className="input" value={targetTeacherId} onChange={e => setTargetTeacherId(e.target.value)} required>
              <option value="">Select teacher</option>
              {teachers.map(t => <option key={t.id} value={t.user_id}>{t.name}</option>)}
            </select>
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

function PostNotice({ token, profile }) {
  const [scope, setScope] = useState('own'); // 'own' | 'other'
  const [targetBatch, setTargetBatch] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault(); setMsg(''); setErr('');
    const fd = new FormData();
    fd.append('title', title); fd.append('description', description);
    fd.append('scope', scope);
    if (scope === 'other') fd.append('targetBatch', targetBatch);
    if (file) fd.append('file', file);
    try {
      const res = await api.postForm('/cr/notices', fd, token);
      setMsg(res.message); setTitle(''); setDescription(''); setFile(null); setTargetBatch('');
    } catch (e) { setErr(e.message); }
  };

  return (
    <div className="card max-w-xl">
      <h2 className="font-semibold text-slate-800 mb-1">Post Notice</h2>
      <p className="text-sm text-slate-400 mb-4">
        Share course material or announcements with your own batch, or a specific other batch.
      </p>
      {msg && <Alert type="success" onClose={() => setMsg('')}>{msg}</Alert>}
      {err && <Alert type="error" onClose={() => setErr('')}>{err}</Alert>}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Post to</label>
          <select className="input" value={scope} onChange={e => setScope(e.target.value)}>
            <option value="own">My own batch ({profile?.batch})</option>
            <option value="other">A specific other batch</option>
          </select>
        </div>
        {scope === 'other' && (
          <div>
            <label className="label">Target Batch</label>
            <input className="input" placeholder="e.g. CSE-22" value={targetBatch} onChange={e => setTargetBatch(e.target.value)} required />
          </div>
        )}
        <div><label className="label">Title</label><input className="input" value={title} onChange={e => setTitle(e.target.value)} required /></div>
        <div><label className="label">Description</label><textarea className="input" rows={4} value={description} onChange={e => setDescription(e.target.value)} /></div>
        <div><label className="label">Attach PDF (optional)</label><input type="file" accept="application/pdf" onChange={e => setFile(e.target.files[0])} /></div>
        <button className="btn-primary">Post Notice</button>
      </form>
    </div>
  );
}

function Materials({ token, profile }) {
  const [materials, setMaterials] = useState(null);
  const [scope, setScope] = useState('own'); // 'own' | 'all' | 'other'
  const [targetBatch, setTargetBatch] = useState('');
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');

  const load = () => api.get('/cr/materials', token).then(setMaterials);
  useEffect(() => { load(); }, [token]);

  const submit = async (e) => {
    e.preventDefault(); setMsg(''); setErr('');
    const payload = { title, link, scope };
    if (scope === 'other') payload.targetBatch = targetBatch;
    try {
      const res = await api.post('/cr/materials', payload, token);
      setMsg(res.message); setTitle(''); setLink(''); setTargetBatch('');
      load();
    } catch (e) { setErr(e.message); }
  };

  const remove = async (id) => {
    if (!confirm('Remove this material?')) return;
    try { await api.del(`/cr/materials/${id}`, token); load(); } catch (e) { setErr(e.message); }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="card">
        <h2 className="font-semibold text-slate-800 mb-1">Add Material (Drive Link)</h2>
        <p className="text-sm text-slate-400 mb-4">Choose who should see this in their "Materials" tab.</p>
        {msg && <Alert type="success" onClose={() => setMsg('')}>{msg}</Alert>}
        {err && <Alert type="error" onClose={() => setErr('')}>{err}</Alert>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Visible to</label>
            <select className="input" value={scope} onChange={e => setScope(e.target.value)}>
              <option value="own">My batch only ({profile?.batch})</option>
              <option value="other">A specific other batch</option>
              <option value="all">All batches (every student)</option>
            </select>
          </div>
          {scope === 'other' && (
            <div>
              <label className="label">Target Batch</label>
              <input className="input" placeholder="e.g. CSE-22" value={targetBatch} onChange={e => setTargetBatch(e.target.value)} required />
            </div>
          )}
          <div>
            <label className="label">Title</label>
            <input className="input" placeholder="e.g. DLD Lab Sheets" value={title} onChange={e => setTitle(e.target.value)} required />
          </div>
          <div>
            <label className="label">Drive Link</label>
            <input className="input" placeholder="https://drive.google.com/..." value={link} onChange={e => setLink(e.target.value)} required />
          </div>
          <button className="btn-primary">Add Material</button>
        </form>
      </div>
      <div className="card">
        <h2 className="font-semibold text-slate-800 mb-3">Materials You've Added</h2>
        {!materials ? <Loading /> : materials.length === 0 ? <Empty text="No materials added yet." /> : (
          <ul className="text-sm divide-y divide-slate-100">
            {materials.map(m => (
              <li key={m.id} className="py-2.5 flex justify-between items-center gap-2">
                <div>
                  <div className="font-medium">{m.title}</div>
                  <div className="text-xs text-slate-400">{m.batch === 'ALL' ? 'All batches' : m.batch}</div>
                </div>
                <div className="flex items-center gap-3">
                  <a href={m.link} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">Open ↗</a>
                  <button className="text-red-500 text-xs hover:underline" onClick={() => remove(m.id)}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CreatePoll({ token }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [scope, setScope] = useState('section');
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');

  const setOpt = (i, v) => setOptions(o => o.map((x, idx) => idx === i ? v : x));
  const addOpt = () => setOptions(o => [...o, '']);

  const submit = async (e) => {
    e.preventDefault(); setMsg(''); setErr('');
    try {
      const res = await api.post('/cr/polls', { question, options: options.filter(Boolean), scope }, token);
      setMsg(res.message); setQuestion(''); setOptions(['', '']);
    } catch (e) { setErr(e.message); }
  };

  return (
    <div className="card max-w-xl">
      <h2 className="font-semibold text-slate-800 mb-1">Create Poll</h2>
      {msg && <Alert type="success" onClose={() => setMsg('')}>{msg}</Alert>}
      {err && <Alert type="error" onClose={() => setErr('')}>{err}</Alert>}
      <form onSubmit={submit} className="space-y-4">
        <div><label className="label">Question</label><input className="input" value={question} onChange={e => setQuestion(e.target.value)} required /></div>
        <div>
          <label className="label">Options</label>
          <div className="space-y-2">
            {options.map((o, i) => (
              <input key={i} className="input" placeholder={`Option ${i + 1}`} value={o} onChange={e => setOpt(i, e.target.value)} />
            ))}
          </div>
          <button type="button" onClick={addOpt} className="text-sm text-brand-600 hover:underline mt-2">+ Add option</button>
        </div>
        <div>
          <label className="label">Visible to</label>
          <select className="input" value={scope} onChange={e => setScope(e.target.value)}>
            <option value="section">My section only</option>
            <option value="batch">Whole batch</option>
          </select>
        </div>
        <button className="btn-primary">Create Poll</button>
      </form>
    </div>
  );
}

function TeacherMessages({ token }) {
  const [inbox, setInbox] = useState(null);
  useEffect(() => { api.get('/cr/messages/inbox', token).then(setInbox); }, [token]);
  if (!inbox) return <Loading />;
  return (
    <div className="card">
      <h2 className="font-semibold text-slate-800 mb-1">Messages from Teachers</h2>
      <p className="text-sm text-slate-400 mb-3">Messages teachers have sent you directly. Reply from the "Messaging" tab.</p>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TeachersInfo({ token }) {
  const [teachers, setTeachers] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => { api.get('/students/teachers-info', token).then(setTeachers); }, [token]);
  if (!teachers) return <Loading />;
  const filtered = teachers.filter(t => t.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="card">
      <div className="flex flex-wrap justify-between items-center mb-3 gap-3">
        <h2 className="font-semibold text-slate-800">Teachers</h2>
        <input className="input max-w-xs" placeholder="Search by name" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      {filtered.length === 0 ? <Empty text="No teachers found." /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-400 border-b border-slate-200">
              <th className="py-2">Name</th><th>Phone</th><th>Email</th>
            </tr></thead>
            <tbody>
              {filtered.map((t, i) => (
                <tr key={i} className="border-b border-slate-200 last:border-0">
                  <td className="py-2 font-medium">{t.name}</td>
                  <td>{t.phone || '—'}</td>
                  <td>{t.email || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
