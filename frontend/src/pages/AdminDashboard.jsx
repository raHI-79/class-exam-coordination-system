import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';
import DashboardShell from '../components/DashboardShell.jsx';
import { Loading, Empty, Alert, Badge } from '../components/Ui.jsx';

const NAV = [
  { key: 'overview', label: 'Overview', icon: '📊' },
  { key: 'pending', label: 'Student Approvals', icon: '🛂' },
  { key: 'students', label: 'All Students', icon: '👥' },
  { key: 'crs', label: 'Manage CRs', icon: '🧑‍🎓' },
  { key: 'teachers', label: 'Manage Teachers', icon: '👨‍🏫' },
  { key: 'courses', label: 'Courses', icon: '📘' },
  { key: 'routines', label: 'Fixed Routines', icon: '🗂️' },
  { key: 'notices', label: 'Notices', icon: '📣' },
  { key: 'materials', label: 'Materials', icon: '📚' },
];

export default function AdminDashboard() {
  const { auth } = useAuth();
  const [tab, setTab] = useState('overview');
  return (
    <DashboardShell title="Administration Panel" roleLabel="Administration" navItems={NAV} active={tab} onSelect={setTab}>
      {tab === 'overview' && <Overview token={auth.token} />}
      {tab === 'pending' && <PendingApprovals token={auth.token} />}
      {tab === 'students' && <AllStudents token={auth.token} />}
      {tab === 'crs' && <ManageCRs token={auth.token} />}
      {tab === 'teachers' && <ManageTeachers token={auth.token} />}
      {tab === 'courses' && <Courses token={auth.token} />}
      {tab === 'routines' && <Routines token={auth.token} />}
      {tab === 'notices' && <Notices token={auth.token} />}
      {tab === 'materials' && <Materials token={auth.token} />}
    </DashboardShell>
  );
}

function Overview({ token }) {
  const [stats, setStats] = useState(null);
  useEffect(() => { api.get('/admin/stats', token).then(setStats); }, [token]);
  if (!stats) return <Loading />;
  const cards = [
    ['Total Students', stats.totalStudents],
    ['Total CRs', stats.totalCRs],
    ['Total Teachers', stats.totalTeachers],
    ['Pending Approvals', stats.pendingApprovals],
  ];
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(([label, value]) => (
        <div key={label} className="card">
          <div className="text-slate-400 text-sm">{label}</div>
          <div className="text-3xl font-bold text-brand-700 mt-1">{value}</div>
        </div>
      ))}
    </div>
  );
}

function PendingApprovals({ token }) {
  const [rows, setRows] = useState(null);
  const [msg, setMsg] = useState('');
  const load = () => api.get('/admin/students/pending', token).then(setRows);
  useEffect(() => { load(); }, [token]);

  const act = async (id, action) => {
    try {
      const res = await api.post(`/admin/students/${id}/${action}`, {}, token);
      setMsg(res.message); load();
    } catch (e) { setMsg(e.message); }
  };

  if (!rows) return <Loading />;
  return (
    <div className="card">
      <h2 className="font-semibold text-slate-800 mb-3">Pending Student Registrations</h2>
      {msg && <Alert type="info" onClose={() => setMsg('')}>{msg}</Alert>}
      {rows.length === 0 ? <Empty text="No pending registrations." /> : (
        <div className="space-y-3">
          {rows.map(s => (
            <div key={s.id} className="border border-slate-200 rounded-lg p-3 flex flex-wrap justify-between items-center gap-3">
              <div className="text-sm">
                <div className="font-medium">{s.full_name} · {s.reg_no}</div>
                <div className="text-slate-400">{s.batch} Sec {s.section} · {s.email} · {s.phone}</div>
                {s.has_drop_course ? <div className="text-xs text-amber-600 mt-0.5">Drop course: {s.drop_course_code}</div> : null}
              </div>
              <div className="flex gap-2">
                <button className="btn-success" onClick={() => act(s.id, 'approve')}>Approve</button>
                <button className="btn-danger" onClick={() => act(s.id, 'reject')}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AllStudents({ token }) {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const load = () => api.get('/admin/students', token).then(setRows);
  useEffect(() => { load(); }, [token]);

  const remove = async (id) => {
    if (!confirm('Remove this student from the system?')) return;
    try {
      const res = await api.del(`/admin/students/${id}`, token);
      setMsg(res.message); load();
    } catch (e) { setMsg(e.message); }
  };

  if (!rows) return <Loading />;
  const filtered = rows.filter(s => (s.full_name + s.reg_no).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="card">
      <div className="flex justify-between items-center mb-3 gap-3">
        <h2 className="font-semibold text-slate-800">All Students</h2>
        <input className="input max-w-xs" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      {msg && <Alert type="info" onClose={() => setMsg('')}>{msg}</Alert>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-400 border-b border-slate-200">
            <th className="py-2">Name</th><th>Reg No</th><th>Batch</th><th>Sec</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} className="border-b border-slate-200 last:border-0">
                <td className="py-2">{s.full_name} {s.is_cr ? <span className="badge-approved ml-1">CR</span> : null}</td>
                <td>{s.reg_no}</td><td>{s.batch}</td><td>{s.section}</td>
                <td><Badge status={s.status === 'active' ? 'approved' : s.status} /></td>
                <td>{s.status !== 'removed' && <button className="text-red-500 text-xs hover:underline" onClick={() => remove(s.id)}>Remove</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ManageCRs({ token }) {
  const [crs, setCrs] = useState(null);
  const [form, setForm] = useState({ name: '', regNo: '', batch: '', section: '', email: '', phone: '', bloodGroup: '', password: '' });
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');

  const load = () => api.get('/admin/crs', token).then(setCrs);
  useEffect(() => { load(); }, [token]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const submit = async (e) => {
    e.preventDefault(); setMsg(''); setErr('');
    try {
      const res = await api.post('/admin/cr', form, token);
      setMsg(res.message);
      setForm({ name: '', regNo: '', batch: '', section: '', email: '', phone: '', bloodGroup: '', password: '' });
      load();
    } catch (e) { setErr(e.message); }
  };

  const remove = async (id) => {
    if (!confirm('Remove this CR?')) return;
    try { await api.del(`/admin/cr/${id}`, token); load(); } catch (e) { setErr(e.message); }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="card">
        <h2 className="font-semibold text-slate-800 mb-3">Add CR</h2>
        {msg && <Alert type="success" onClose={() => setMsg('')}>{msg}</Alert>}
        {err && <Alert type="error" onClose={() => setErr('')}>{err}</Alert>}
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <input className="input col-span-2" placeholder="Full name" value={form.name} onChange={e => set('name', e.target.value)} required />
          <input className="input" placeholder="Reg No" value={form.regNo} onChange={e => set('regNo', e.target.value)} required />
          <input className="input" placeholder="Batch" value={form.batch} onChange={e => set('batch', e.target.value)} required />
          <input className="input" placeholder="Section" value={form.section} onChange={e => set('section', e.target.value)} required />
          <input className="input" placeholder="Blood group" value={form.bloodGroup} onChange={e => set('bloodGroup', e.target.value)} />
          <input className="input" placeholder="Email" value={form.email} onChange={e => set('email', e.target.value)} />
          <input className="input" placeholder="Phone" value={form.phone} onChange={e => set('phone', e.target.value)} />
          <input className="input col-span-2" placeholder="Password" type="password" value={form.password} onChange={e => set('password', e.target.value)} required />
          <button className="btn-primary col-span-2">Add CR</button>
        </form>
      </div>
      <div className="card">
        <h2 className="font-semibold text-slate-800 mb-3">Current CRs</h2>
        {!crs ? <Loading /> : crs.length === 0 ? <Empty text="No CRs added yet." /> : (
          <div className="space-y-2">
            {crs.map(c => (
              <div key={c.id} className="flex justify-between items-center border-b border-slate-200 py-2 last:border-0 text-sm">
                <div>
                  <div className="font-medium">{c.full_name}</div>
                  <div className="text-slate-400">{c.batch} Sec {c.section} · {c.reg_no}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge status={c.status === 'active' ? 'approved' : c.status} />
                  {c.status !== 'removed' && <button className="text-red-500 text-xs hover:underline" onClick={() => remove(c.id)}>Remove</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ManageTeachers({ token }) {
  const [teachers, setTeachers] = useState(null);
  const [form, setForm] = useState({ name: '', teacherId: '', email: '', phone: '', password: '' });
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');

  const load = () => api.get('/admin/teachers', token).then(setTeachers);
  useEffect(() => { load(); }, [token]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const submit = async (e) => {
    e.preventDefault(); setMsg(''); setErr('');
    try {
      const res = await api.post('/admin/teacher', form, token);
      setMsg(res.message);
      setForm({ name: '', teacherId: '', email: '', phone: '', password: '' });
      load();
    } catch (e) { setErr(e.message); }
  };

  const remove = async (id) => {
    if (!confirm('Remove this teacher?')) return;
    try { await api.del(`/admin/teacher/${id}`, token); load(); } catch (e) { setErr(e.message); }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="card">
        <h2 className="font-semibold text-slate-800 mb-3">Add Teacher</h2>
        {msg && <Alert type="success" onClose={() => setMsg('')}>{msg}</Alert>}
        {err && <Alert type="error" onClose={() => setErr('')}>{err}</Alert>}
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <input className="input col-span-2" placeholder="Teacher name" value={form.name} onChange={e => set('name', e.target.value)} required />
          <input className="input" placeholder="Teacher ID" value={form.teacherId} onChange={e => set('teacherId', e.target.value)} required />
          <input className="input" placeholder="Email" value={form.email} onChange={e => set('email', e.target.value)} />
          <input className="input" placeholder="Phone" value={form.phone} onChange={e => set('phone', e.target.value)} />
          <input className="input" placeholder="Password" type="password" value={form.password} onChange={e => set('password', e.target.value)} required />
          <button className="btn-primary col-span-2">Add Teacher</button>
        </form>
      </div>
      <div className="card">
        <h2 className="font-semibold text-slate-800 mb-3">Current Teachers</h2>
        {!teachers ? <Loading /> : teachers.length === 0 ? <Empty text="No teachers added yet." /> : (
          <div className="space-y-2">
            {teachers.map(t => (
              <div key={t.id} className="flex justify-between items-center border-b border-slate-200 py-2 last:border-0 text-sm">
                <div>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-slate-400">{t.teacher_id} · {t.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge status={t.status === 'active' ? 'approved' : t.status} />
                  {t.status !== 'removed' && <button className="text-red-500 text-xs hover:underline" onClick={() => remove(t.id)}>Remove</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Courses({ token }) {
  const [courses, setCourses] = useState(null);
  const [form, setForm] = useState({ code: '', title: '' });
  const [err, setErr] = useState('');
  const load = () => api.get('/admin/courses', token).then(setCourses);
  useEffect(() => { load(); }, [token]);

  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try {
      await api.post('/admin/courses', form, token);
      setForm({ code: '', title: '' }); load();
    } catch (e) { setErr(e.message); }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="card">
        <h2 className="font-semibold text-slate-800 mb-3">Add Course</h2>
        {err && <Alert type="error" onClose={() => setErr('')}>{err}</Alert>}
        <form onSubmit={submit} className="flex gap-3">
          <input className="input" placeholder="Code (e.g. CSE-231)" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} required />
          <input className="input" placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
          <button className="btn-primary whitespace-nowrap">Add</button>
        </form>
      </div>
      <div className="card">
        <h2 className="font-semibold text-slate-800 mb-3">All Courses</h2>
        {!courses ? <Loading /> : (
          <ul className="text-sm divide-y divide-slate-100">
            {courses.map(c => <li key={c.id} className="py-2">{c.code} — {c.title}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}

function Routines({ token }) {
  const [routines, setRoutines] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({ batch: '', section: '', courseId: '', teacherId: '', dayOfWeek: 'Sunday', startTime: '', endTime: '', room: '', type: 'class' });
  const [filterBatch, setFilterBatch] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [err, setErr] = useState('');

  const load = () => api.get('/admin/routines', token).then(setRoutines);
  useEffect(() => {
    load();
    api.get('/admin/teachers', token).then(setTeachers);
    api.get('/admin/courses', token).then(setCourses);
  }, [token]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try {
      await api.post('/admin/routines', form, token);
      load();
    } catch (e) { setErr(e.message); }
  };
  const remove = async (id) => { await api.del(`/admin/routines/${id}`, token); load(); };

  // Distinct batch / section values pulled straight from the loaded routine
  // entries, so the filter dropdowns always match what's actually in the DB.
  const batchOptions = routines ? [...new Set(routines.map(r => r.batch))].sort() : [];
  const sectionOptions = routines
    ? [...new Set(routines.filter(r => !filterBatch || r.batch === filterBatch).map(r => r.section))].sort()
    : [];

  const filtered = (routines || []).filter(r =>
    (!filterBatch || r.batch === filterBatch) && (!filterSection || r.section === filterSection)
  );

  const dayOrder = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const sortedFiltered = [...filtered].sort((a, b) => {
    if (a.batch !== b.batch) return a.batch.localeCompare(b.batch);
    if (a.section !== b.section) return a.section.localeCompare(b.section);
    if (a.day_of_week !== b.day_of_week) return dayOrder.indexOf(a.day_of_week) - dayOrder.indexOf(b.day_of_week);
    return a.start_time.localeCompare(b.start_time);
  });

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="font-semibold text-slate-800 mb-3">Add Fixed Routine Entry</h2>
        {err && <Alert type="error" onClose={() => setErr('')}>{err}</Alert>}
        <form onSubmit={submit} className="grid sm:grid-cols-3 gap-3">
          <input className="input" placeholder="Batch" value={form.batch} onChange={e => set('batch', e.target.value)} required />
          <input className="input" placeholder="Section" value={form.section} onChange={e => set('section', e.target.value)} required />
          <select className="input" value={form.dayOfWeek} onChange={e => set('dayOfWeek', e.target.value)}>
            {dayOrder.map(d => <option key={d}>{d}</option>)}
          </select>
          <select className="input" value={form.courseId} onChange={e => set('courseId', e.target.value)} required>
            <option value="">Course</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
          </select>
          <select className="input" value={form.teacherId} onChange={e => set('teacherId', e.target.value)} required>
            <option value="">Teacher</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select className="input" value={form.type} onChange={e => set('type', e.target.value)}>
            <option value="class">Class</option><option value="lab">Lab</option>
          </select>
          <input type="time" className="input" min="08:00" max="17:00" value={form.startTime} onChange={e => set('startTime', e.target.value)} required />
          <input type="time" className="input" min="08:00" max="17:00" value={form.endTime} onChange={e => set('endTime', e.target.value)} required />
          <input className="input" placeholder="Room" value={form.room} onChange={e => set('room', e.target.value)} required />
          <button className="btn-primary sm:col-span-3">Add Routine Entry</button>
        </form>
      </div>
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="font-semibold text-slate-800">Fixed Routine — Batch &amp; Section wise</h2>
          <div className="flex gap-2">
            <select
              className="input"
              value={filterBatch}
              onChange={e => { setFilterBatch(e.target.value); setFilterSection(''); }}
            >
              <option value="">All batches</option>
              {batchOptions.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select className="input" value={filterSection} onChange={e => setFilterSection(e.target.value)}>
              <option value="">All sections</option>
              {sectionOptions.map(s => <option key={s} value={s}>Section {s}</option>)}
            </select>
          </div>
        </div>
        {!routines ? <Loading /> : sortedFiltered.length === 0 ? <Empty text="No routine entries match this filter." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-slate-400 border-b border-slate-200">
                <th className="py-2">Batch</th><th>Sec</th><th>Day</th><th>Time</th><th>Course</th><th>Teacher</th><th>Room</th><th></th>
              </tr></thead>
              <tbody>
                {sortedFiltered.map(r => (
                  <tr key={r.id} className="border-b border-slate-200 last:border-0">
                    <td className="py-2">{r.batch}</td><td>{r.section}</td><td>{r.day_of_week}</td>
                    <td>{r.start_time}-{r.end_time}</td><td>{r.course_code}</td><td>{r.teacher_name}</td><td>{r.room}</td>
                    <td><button className="text-red-500 text-xs hover:underline" onClick={() => remove(r.id)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Notices({ token }) {
  const [notices, setNotices] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [batch, setBatch] = useState('');
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState('');

  const load = () => api.get('/admin/notices', token).then(setNotices);
  useEffect(() => { load(); }, [token]);

  const submit = async (e) => {
    e.preventDefault(); setMsg('');
    const fd = new FormData();
    fd.append('title', title); fd.append('description', description); fd.append('batch', batch);
    if (file) fd.append('file', file);
    try {
      const res = await api.postForm('/admin/notices', fd, token);
      setMsg(res.message); setTitle(''); setDescription(''); setBatch(''); setFile(null);
      load();
    } catch (e) { setMsg(e.message); }
  };
  const remove = async (id) => { await api.del(`/admin/notices/${id}`, token); load(); };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="card">
        <h2 className="font-semibold text-slate-800 mb-3">Publish Notice</h2>
        {msg && <Alert type="info" onClose={() => setMsg('')}>{msg}</Alert>}
        <form onSubmit={submit} className="space-y-3">
          <input className="input" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} required />
          <textarea className="input" rows={3} placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />
          <input className="input" placeholder="Batch (leave blank for all batches)" value={batch} onChange={e => setBatch(e.target.value)} />
          <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files[0])} />
          <button className="btn-primary">Publish</button>
        </form>
      </div>
      <div className="card">
        <h2 className="font-semibold text-slate-800 mb-3">Published Notices</h2>
        {!notices ? <Loading /> : notices.length === 0 ? <Empty text="No notices published yet." /> : (
          <div className="space-y-2">
            {notices.map(n => (
              <div key={n.id} className="border-b border-slate-200 py-2 last:border-0 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{n.title}</span>
                  <button className="text-red-500 text-xs hover:underline" onClick={() => remove(n.id)}>Delete</button>
                </div>
                <p className="text-slate-400">{n.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Materials({ token }) {
  const [materials, setMaterials] = useState(null);
  const [form, setForm] = useState({ batch: '', title: '', link: '' });
  const [msg, setMsg] = useState('');

  const load = () => api.get('/admin/materials', token).then(setMaterials);
  useEffect(() => { load(); }, [token]);

  const submit = async (e) => {
    e.preventDefault(); setMsg('');
    try {
      const res = await api.post('/admin/materials', form, token);
      setMsg(res.message); setForm({ batch: '', title: '', link: '' }); load();
    } catch (e) { setMsg(e.message); }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="card">
        <h2 className="font-semibold text-slate-800 mb-3">Add Material (Drive Link)</h2>
        {msg && <Alert type="info" onClose={() => setMsg('')}>{msg}</Alert>}
        <form onSubmit={submit} className="space-y-3">
          <input className="input" placeholder="Batch" value={form.batch} onChange={e => setForm(f => ({ ...f, batch: e.target.value }))} required />
          <input className="input" placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
          <input className="input" placeholder="Drive link (https://...)" value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} required />
          <button className="btn-primary">Add</button>
        </form>
      </div>
      <div className="card">
        <h2 className="font-semibold text-slate-800 mb-3">All Materials</h2>
        {!materials ? <Loading /> : materials.length === 0 ? <Empty text="No materials added yet." /> : (
          <ul className="text-sm divide-y divide-slate-100">
            {materials.map(m => (
              <li key={m.id} className="py-2 flex justify-between">
                <span>{m.batch} — {m.title}</span>
                <a href={m.link} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">Open ↗</a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
