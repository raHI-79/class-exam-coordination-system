import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert } from '../components/Ui.jsx';
import heroMonument from '../assets/hero-monument.jpg';
import heroBuilding from '../assets/hero-building.jpg';
import heroEntrance from '../assets/hero-entrance.jpg';

const SLIDES = [heroMonument, heroBuilding, heroEntrance];

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.post('/auth/login', { identifier, password });
      login(data.token, data.role, data.profile);
      if (data.role === 'cr') navigate('/cr');
      else if (data.role === 'teacher') navigate('/teacher');
      else navigate('/student');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {SLIDES.map((src, i) => (
        <div key={i} className="hero-slide" style={{ backgroundImage: `url(${src})` }} />
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-brand-900/80 via-brand-900/55 to-brand-900/80" />
      <div className="w-full max-w-md relative z-10 animate-fadeInUp">
        <div className="text-center mb-6 text-white">
          <div className="text-2xl font-bold font-brand tracking-wide">SUST CSE</div>
          <div className="text-white/70 text-sm">Class &amp; Exam Coordination System</div>
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold mb-1">Sign in</h2>
          <p className="text-sm text-slate-500 mb-4">For Students, Class Representatives, and Teachers</p>

          {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Registration Number / Teacher ID</label>
              <input className="input" value={identifier} onChange={e => setIdentifier(e.target.value)} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="flex justify-between mt-4 text-sm">
            <Link to="/forgot-password" className="text-brand-600 hover:underline">Forgot password?</Link>
            <Link to="/register" className="text-brand-600 hover:underline">New student? Register</Link>
          </div>
        </div>
        <p className="text-center text-white/70 text-xs mt-4">
          Teachers and CRs log in here too, using the account created for them by Administration.
        </p>
      </div>
    </div>
  );
}
