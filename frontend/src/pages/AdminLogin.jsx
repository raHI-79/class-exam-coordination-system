import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert } from '../components/Ui.jsx';
import heroEntrance from '../assets/hero-entrance.jpg';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await api.post('/auth/admin-login', { username, password });
      login(data.token, 'admin', null);
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 bg-cover bg-center relative"
      style={{ backgroundImage: `url(${heroEntrance})` }}
    >
      {/* A single, static, heavily-darkened frame — deliberately quieter and
          more serious than the public slideshow, to signal restricted access. */}
      <div className="absolute inset-0 bg-slate-950/85" />
      <div className="w-full max-w-sm relative z-10 animate-fadeInUp">
        <div className="text-center mb-6 text-white">
          <div className="text-xl font-bold font-brand tracking-wide">SUST CSE Administration</div>
          <div className="text-white/50 text-xs mt-1">Restricted access</div>
        </div>
        <div className="card">
          {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Admin Username</label>
              <input className="input" value={username} onChange={e => setUsername(e.target.value)} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button className="btn-primary w-full" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
