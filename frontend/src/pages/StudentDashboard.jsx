import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';
import DashboardShell from '../components/DashboardShell.jsx';
import { Loading, Empty, Alert } from '../components/Ui.jsx';

const NAV = [
  { key: 'tomorrow', label: "Tomorrow's Routine", icon: '📅' },
  { key: 'drop', label: 'Drop Course Routine', icon: '🔁' },
  { key: 'exams', label: 'Upcoming Exams', icon: '📝' },
  { key: 'semester', label: 'Semester Routine', icon: '🗂️' },
  { key: 'crnotices', label: 'CR Notices', icon: '📣' },
  { key: 'adminnotices', label: 'Admin Notices', icon: '🏛️' },
  { key: 'materials', label: 'Materials', icon: '📚' },
  { key: 'directory', label: 'All Batch Students', icon: '👥' },
  { key: 'teachers', label: 'Teachers Info', icon: '👨‍🏫' },
  { key: 'inbox', label: 'Messages', icon: '💬' },
  { key: 'polls', label: 'Polls', icon: '🗳️' },
];

function ClassRow({ item }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 py-2.5 last:border-0">
      <div>
        <div className="font-medium text-sm text-slate-800">{item.course_code} — {item.course_title}</div>
        <div className="text-xs text-slate-400">{item.teacher_name || 'TBA'} · Room {item.room}</div>
      </div>
      <div className="text-sm text-slate-600 font-medium">{item.start_time} - {item.end_time}</div>
    </div>
  );
}

export default function StudentDashboard() {
  const { auth } = useAuth();
  const [tab, setTab] = useState('tomorrow');

  return (
    <DashboardShell
      title="Student Dashboard"
      roleLabel="Student"
      navItems={NAV}
      active={tab}
      onSelect={setTab}
    >
      {tab === 'tomorrow' && <Tomorrow token={auth.token} />}
      {tab === 'drop' && <DropCourse token={auth.token} />}
      {tab === 'exams' && <Exams token={auth.token} />}
      {tab === 'semester' && <Semester token={auth.token} />}
      {tab === 'crnotices' && <CRNotices token={auth.token} profile={auth.profile} />}
      {tab === 'adminnotices' && <Notices token={auth.token} endpoint="/students/notices/admin" title="Administration Notices" />}
      {tab === 'materials' && <Materials token={auth.token} />}
      {tab === 'directory' && <Directory token={auth.token} />}
      {tab === 'teachers' && <TeachersInfo token={auth.token} />}
      {tab === 'inbox' && <MessagesInbox token={auth.token} />}
      {tab === 'polls' && <Polls token={auth.token} />}
    </DashboardShell>
  );
}

function Tomorrow({ token }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/students/routine/tomorrow', token).then(setData); }, [token]);
  if (!data) return <Loading />;
  const combined = [...data.fixedClasses, ...data.scheduledEvents].sort((a, b) => a.start_time.localeCompare(b.start_time));
  return (
    <div className="card">
      <h2 className="font-semibold text-slate-800 mb-1">Tomorrow — {data.day}, {data.date}</h2>
      <p className="text-sm text-slate-400 mb-4">Classes and exams organized by time, section and room.</p>
      {combined.length === 0 ? <Empty text="No classes scheduled for tomorrow." /> : combined.map((c, i) => <ClassRow key={i} item={c} />)}
    </div>
  );
}

function DropCourse({ token }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/students/routine/drop-course', token).then(setData); }, [token]);
  if (!data) return <Loading />;
  if (!data.hasDropCourse) return <Empty text="You did not register a drop course, so only your own batch routine applies." />;
  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="font-semibold text-slate-800 mb-3">Junior Batch Routine — {data.dropCourseCode}</h2>
        {data.dropCourseRoutine.length === 0 ? <Empty text="No junior batch routine found for this course yet." /> :
          data.dropCourseRoutine.map((r, i) => (
            <div key={i} className="flex flex-wrap justify-between gap-2 border-b border-slate-200 py-2.5 last:border-0 text-sm">
              <span className="font-medium">{r.batch} · Sec {r.section} · {r.day_of_week}</span>
              <span className="text-slate-400">{r.course_code} — {r.teacher_name}</span>
              <span>{r.start_time}-{r.end_time} @ {r.room}</span>
            </div>
          ))}
      </div>
      <div className="card">
        <h2 className="font-semibold text-slate-800 mb-3">Your Own Batch Routine</h2>
        {data.ownBatchRoutine.map((r, i) => (
          <div key={i} className="flex flex-wrap justify-between gap-2 border-b border-slate-200 py-2.5 last:border-0 text-sm">
            <span className="font-medium">{r.day_of_week}</span>
            <span className="text-slate-400">{r.course_code} — {r.teacher_name}</span>
            <span>{r.start_time}-{r.end_time} @ {r.room}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Exams({ token }) {
  const [exams, setExams] = useState(null);
  useEffect(() => { api.get('/students/exams/upcoming', token).then(setExams); }, [token]);
  if (!exams) return <Loading />;
  return (
    <div className="card">
      <h2 className="font-semibold text-slate-800 mb-3">Upcoming Exams / Assignments</h2>
      {exams.length === 0 ? <Empty text="No upcoming exams scheduled." /> : (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-400 border-b border-slate-200">
            <th className="py-2">Date</th><th>Time</th><th>Course</th><th>Room</th>
          </tr></thead>
          <tbody>
            {exams.map(e => (
              <tr key={e.id} className="border-b border-slate-200 last:border-0">
                <td className="py-2">{e.date}</td>
                <td>{e.start_time}-{e.end_time}</td>
                <td>{e.course_code} — {e.course_title}</td>
                <td>{e.room}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Semester({ token }) {
  const [routine, setRoutine] = useState(null);
  const [batches, setBatches] = useState([]);
  const [sections, setSections] = useState([]);
  const [batch, setBatch] = useState(''); // '' = student's own batch (default, set once loaded)
  const [section, setSection] = useState(''); // '' = student's own section (default)
  const [day, setDay] = useState('');
  const [course, setCourse] = useState('');

  // Load the batch dropdown once, and default `batch` to whatever the API
  // resolves to (the student's own batch) so the label isn't blank.
  useEffect(() => {
    api.get('/students/routine/lookups/batches', token).then(setBatches);
  }, [token]);

  // Whenever the chosen batch changes, refresh the section dropdown for it.
  useEffect(() => {
    const qs = new URLSearchParams();
    if (batch) qs.set('batch', batch);
    api.get('/students/routine/lookups/sections?' + qs.toString(), token).then(setSections);
  }, [token, batch]);

  const load = () => {
    const qs = new URLSearchParams();
    if (batch) qs.set('batch', batch);
    if (section) qs.set('section', section);
    if (day) qs.set('day', day);
    if (course) qs.set('course', course);
    api.get('/students/routine/semester?' + qs.toString(), token).then(setRoutine);
  };
  useEffect(() => { load(); }, [token, batch, section, day, course]);

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="font-semibold text-slate-800">Current Semester Fixed Routine</h2>
        <div className="flex flex-wrap gap-2">
          <select className="input" value={batch} onChange={e => { setBatch(e.target.value); setSection(''); }}>
            <option value="">My batch</option>
            {batches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select className="input" value={section} onChange={e => setSection(e.target.value)}>
            <option value="">My section</option>
            {sections.map(s => <option key={s} value={s}>Section {s}</option>)}
          </select>
          <select className="input" value={day} onChange={e => setDay(e.target.value)}>
            <option value="">All days</option>
            {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(d => <option key={d}>{d}</option>)}
          </select>
          <input className="input" placeholder="Course code" value={course} onChange={e => setCourse(e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-slate-400 -mt-2 mb-3">
        "My batch" / "My section" always means your own — pick a different batch or section above to browse another one's fixed routine.
      </p>
      {!routine ? <Loading /> : routine.length === 0 ? <Empty text="No routine entries match this filter." /> : (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-400 border-b border-slate-200">
            <th className="py-2">Batch</th><th>Sec</th><th>Day</th><th>Time</th><th>Course</th><th>Teacher</th><th>Room</th>
          </tr></thead>
          <tbody>
            {routine.map(r => (
              <tr key={r.id} className="border-b border-slate-200 last:border-0">
                <td className="py-2">{r.batch}</td>
                <td>{r.section}</td>
                <td>{r.day_of_week}</td>
                <td>{r.start_time}-{r.end_time}</td>
                <td>{r.course_code} — {r.course_title}</td>
                <td>{r.teacher_name}</td>
                <td>{r.room}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CRNotices({ token, profile }) {
  const [notices, setNotices] = useState(null);
  const [filter, setFilter] = useState('own'); // 'own' | 'other'
  useEffect(() => { api.get('/students/notices/cr', token).then(setNotices); }, [token]);
  if (!notices) return <Loading />;

  const filtered = notices.filter(n =>
    filter === 'own' ? n.batch === profile?.batch : n.batch !== profile?.batch
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-800">CR Notices</h2>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
          <button
            className={`px-3 py-1 rounded-md ${filter === 'own' ? 'bg-brand-600 text-white font-medium' : 'text-slate-400'}`}
            onClick={() => setFilter('own')}
          >
            My Batch ({profile?.batch})
          </button>
          <button
            className={`px-3 py-1 rounded-md ${filter === 'other' ? 'bg-brand-600 text-white font-medium' : 'text-slate-400'}`}
            onClick={() => setFilter('other')}
          >
            Other Batches
          </button>
        </div>
      </div>
      {filtered.length === 0 ? (
        <Empty text={filter === 'own' ? 'No notices for your batch yet.' : 'No notices from other batches yet.'} />
      ) : filtered.map(n => (
        <div key={n.id} className="card">
          <div className="flex justify-between items-start gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{n.title}</span>
                {filter === 'other' && <span className="badge bg-brand-50 text-brand-700">{n.batch}</span>}
              </div>
              <div className="text-sm text-slate-400 mt-1 whitespace-pre-wrap">{n.description}</div>
            </div>
            <div className="text-xs text-slate-400 whitespace-nowrap">{new Date(n.created_at).toLocaleDateString()}</div>
          </div>
          {n.file_path && (
            <a href={n.file_path} target="_blank" rel="noreferrer" className="text-brand-600 text-sm hover:underline inline-block mt-2">📎 View attachment</a>
          )}
        </div>
      ))}
    </div>
  );
}

function Notices({ token, endpoint, title }) {
  const [notices, setNotices] = useState(null);
  useEffect(() => { api.get(endpoint, token).then(setNotices); }, [token, endpoint]);
  if (!notices) return <Loading />;
  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-slate-800">{title}</h2>
      {notices.length === 0 ? <Empty text="No notices yet." /> : notices.map(n => (
        <div key={n.id} className="card">
          <div className="flex justify-between items-start gap-3">
            <div>
              <div className="font-medium">{n.title}</div>
              <div className="text-sm text-slate-400 mt-1 whitespace-pre-wrap">{n.description}</div>
            </div>
            <div className="text-xs text-slate-400 whitespace-nowrap">{new Date(n.created_at).toLocaleDateString()}</div>
          </div>
          {n.file_path && (
            <a href={n.file_path} target="_blank" rel="noreferrer" className="text-brand-600 text-sm hover:underline inline-block mt-2">📎 View attachment</a>
          )}
        </div>
      ))}
    </div>
  );
}

function Materials({ token }) {
  const [materials, setMaterials] = useState(null);
  useEffect(() => { api.get('/students/materials', token).then(setMaterials); }, [token]);
  if (!materials) return <Loading />;
  return (
    <div className="card">
      <h2 className="font-semibold text-slate-800 mb-1">Materials (Drive Links)</h2>
      <p className="text-sm text-slate-400 mb-3">Shared by CRs and Administration, across all batches.</p>
      {materials.length === 0 ? <Empty text="No materials shared yet." /> : (
        <ul className="divide-y divide-slate-100">
          {materials.map(m => (
            <li key={m.id} className="py-2.5 flex justify-between items-center gap-3">
              <div>
                <div className="text-sm font-medium">{m.title}</div>
                <div className="text-xs text-slate-400">{m.batch}</div>
              </div>
              <a href={m.link} target="_blank" rel="noreferrer" className="text-brand-600 text-sm hover:underline whitespace-nowrap">Open ↗</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Directory({ token }) {
  const [students, setStudents] = useState(null);
  const [q, setQ] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [bloodFilter, setBloodFilter] = useState('');
  useEffect(() => { api.get('/students/directory', token).then(setStudents); }, [token]);
  if (!students) return <Loading />;

  const batchOptions = [...new Set(students.map(s => s.batch))].sort();
  const bloodOptions = [...new Set(students.map(s => s.blood_group).filter(Boolean))].sort();
  const filtered = students
    .filter(s => !batchFilter || s.batch === batchFilter)
    .filter(s => !bloodFilter || s.blood_group === bloodFilter)
    .filter(s => (s.full_name + s.reg_no + s.batch).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="card">
      <div className="flex flex-wrap justify-between items-center mb-3 gap-3">
        <h2 className="font-semibold text-slate-800">All Batch Students</h2>
        <div className="flex flex-wrap gap-2">
          <select className="input" value={batchFilter} onChange={e => setBatchFilter(e.target.value)}>
            <option value="">All batches</option>
            {batchOptions.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select className="input" value={bloodFilter} onChange={e => setBloodFilter(e.target.value)}>
            <option value="">Any blood group</option>
            {bloodOptions.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <input className="input max-w-xs" placeholder="Search name / reg no" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-slate-400 border-b border-slate-200">
            <th className="py-2">Name</th><th>Reg No</th><th>Batch</th><th>Sec</th><th>Phone</th><th>Email</th><th>Blood</th>
          </tr></thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={i} className="border-b border-slate-200 last:border-0">
                <td className="py-2">{s.full_name} {s.is_cr ? <span className="badge-approved ml-1">CR</span> : null}</td>
                <td>{s.reg_no}</td><td>{s.batch}</td><td>{s.section}</td><td>{s.phone}</td><td>{s.email}</td><td>{s.blood_group}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

function MessagesInbox({ token }) {
  const [messages, setMessages] = useState(null);
  useEffect(() => { api.get('/students/messages', token).then(setMessages); }, [token]);
  if (!messages) return <Loading />;
  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-slate-800">Messages</h2>
      <p className="text-sm text-slate-400 -mt-2">Direct messages to you, and batch/section announcements from your CR or teachers.</p>
      {messages.length === 0 ? <Empty text="No messages yet." /> : messages.map(m => (
        <div key={m.id} className="card">
          <div className="flex justify-between items-start gap-3">
            <div>
              <div className="font-medium text-sm">{m.sender_name} <span className="text-slate-400 font-normal">({m.sender_role})</span></div>
              <div className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{m.content}</div>
            </div>
            <div className="text-xs text-slate-400 whitespace-nowrap">{new Date(m.created_at).toLocaleDateString()}</div>
          </div>
          {m.file_path && (
            <a href={m.file_path} target="_blank" rel="noreferrer" className="text-brand-600 text-sm hover:underline inline-block mt-2">📎 View attachment</a>
          )}
        </div>
      ))}
    </div>
  );
}

function Polls({ token }) {
  const [polls, setPolls] = useState(null);
  const [msg, setMsg] = useState('');

  const load = () => api.get('/students/polls', token).then(setPolls);
  useEffect(() => { load(); }, [token]);

  const vote = async (pollId, optionId) => {
    try {
      await api.post(`/students/polls/${pollId}/vote`, { optionId }, token);
      setMsg('Vote recorded.');
      load();
    } catch (e) { setMsg(e.message); }
  };

  if (!polls) return <Loading />;
  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-slate-800">Polls</h2>
      {msg && <Alert type="info" onClose={() => setMsg('')}>{msg}</Alert>}
      {polls.length === 0 ? <Empty text="No active polls." /> : polls.map(p => {
        const totalVotes = p.options.reduce((s, o) => s + o.vote_count, 0);
        return (
          <div key={p.id} className="card">
            <div className="flex justify-between items-center">
              <div className="font-medium">{p.question}</div>
              <span className={p.status === 'open' ? 'badge-approved' : 'badge-cancelled'}>{p.status}</span>
            </div>
            <div className="mt-3 space-y-2">
              {p.options.map(o => {
                const pct = totalVotes ? Math.round((o.vote_count / totalVotes) * 100) : 0;
                const isMine = p.myVoteOptionId === o.id;
                return (
                  <button
                    key={o.id}
                    disabled={!!p.myVoteOptionId || p.status !== 'open'}
                    onClick={() => vote(p.id, o.id)}
                    className={`w-full text-left rounded-lg border px-3 py-2 text-sm relative overflow-hidden
                      ${isMine ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}
                      disabled:cursor-default`}
                  >
                    <div className="absolute left-0 top-0 bottom-0 bg-brand-600/20" style={{ width: `${pct}%` }} />
                    <span className="relative flex justify-between">
                      <span>{o.option_text} {isMine && '✓'}</span>
                      <span className="text-slate-400">{pct}% ({o.vote_count})</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {p.myVoteOptionId && <div className="text-xs text-slate-400 mt-2">You already voted in this poll.</div>}
          </div>
        );
      })}
    </div>
  );
}
