import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { Alert } from '../components/Ui.jsx';
import registerBg from '../assets/hero-building.jpg';

const empty = {
  fullName: '', regNo: '', batch: '', section: '', email: '', phone: '',
  bloodGroup: '', password: '', confirmPassword: '', hasDropCourse: false, dropCourseCode: ''
};

export default function Register() {
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    setLoading(true);
    try {
      const res = await api.post('/auth/register', form);
      setSuccess(res.message);
      setForm(empty);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl animate-fadeInUp">
        {/* Decorative banner treatment — distinct from the full-bleed cover used on Login */}
        <div
          className="rounded-2xl overflow-hidden mb-6 relative h-32 bg-cover bg-center flex items-end"
          style={{ backgroundImage: `url(${registerBg})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-brand-900/85 via-brand-900/30 to-transparent" />
          <div className="relative z-10 p-5 text-white">
            <div className="text-xl font-bold font-brand tracking-wide">SUST CSE</div>
            <div className="text-white/70 text-sm">Student Registration</div>
          </div>
        </div>
        <div className="card">
          {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
          {success && <Alert type="success" onClose={() => setSuccess('')}>{success}</Alert>}

          <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Full Name</label>
              <input className="input" value={form.fullName} onChange={e => set('fullName', e.target.value)} required />
            </div>
            <div>
              <label className="label">Registration Number</label>
              <input className="input" value={form.regNo} onChange={e => set('regNo', e.target.value)} required />
            </div>
            <div>
              <label className="label">Batch (e.g. CSE-23)</label>
              <input className="input" value={form.batch} onChange={e => set('batch', e.target.value)} required />
            </div>
            <div>
              <label className="label">Section</label>
              <input className="input" placeholder="A / B" value={form.section} onChange={e => set('section', e.target.value)} required />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} required />
            </div>
            <div>
              <label className="label">Phone Number</label>
              <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div>
              <label className="label">Blood Group</label>
              <input className="input" placeholder="A+ / O- / ..." value={form.bloodGroup} onChange={e => set('bloodGroup', e.target.value)} />
            </div>
            <div>
              <label className="label">New Password</label>
              <input className="input" type="password" value={form.password} onChange={e => set('password', e.target.value)} required />
            </div>
            <div>
              <label className="label">Confirm Password</label>
              <input className="input" type="password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} required />
            </div>

            <div className="sm:col-span-2 border-t border-slate-200 pt-4">
              <label className="label mb-2">Do you have any drop course?</label>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={!form.hasDropCourse} onChange={() => set('hasDropCourse', false)} /> No
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={form.hasDropCourse} onChange={() => set('hasDropCourse', true)} /> Yes
                </label>
              </div>
              {form.hasDropCourse && (
                <input
                  className="input mt-2"
                  placeholder="Drop course code (e.g. CSE-231)"
                  value={form.dropCourseCode}
                  onChange={e => set('dropCourseCode', e.target.value)}
                  required
                />
              )}
            </div>

            <div className="sm:col-span-2 flex items-center gap-3 pt-2">
              <button className="btn-primary" disabled={loading}>{loading ? 'Submitting...' : 'Register'}</button>
              <Link to="/" className="text-sm text-brand-600 hover:underline">Already have an account? Sign in</Link>
            </div>
          </form>
        </div>
        <p className="text-center text-xs text-slate-400 mt-4">
          After registering, your account must be approved by Administration before you can log in.
        </p>
      </div>
    </div>
  );
}
