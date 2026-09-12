import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Alert } from '../components/Ui.jsx';
import forgotBg from '../assets/hero-monument.jpg';

export default function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const requestReset = async (e) => {
    e.preventDefault();
    setError(''); setMessage(''); setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { identifier });
      setMessage(res.message + (res.resetToken ? ` Demo reset token: ${res.resetToken}` : ''));
      if (res.resetToken) setResetToken(res.resetToken);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const doReset = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const res = await api.post('/auth/reset-password', { resetToken, newPassword });
      setMessage(res.message);
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 bg-cover bg-center relative"
      style={{ backgroundImage: `url(${forgotBg})` }}
    >
      {/* A soft, calm treatment — a light wash over the photo rather than a
          dark scrim, distinct from the deeper overlay used on Login/Admin. */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/90 via-white/80 to-white/90" />
      <div className="w-full max-w-md relative z-10 animate-fadeInUp">
        <div className="text-center mb-6">
          <div className="text-2xl font-bold font-brand tracking-wide text-brand-800">SUST CSE</div>
          <div className="text-slate-500 text-sm">Reset your password</div>
        </div>
        <div className="card">
          {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
          {message && <Alert type="success" onClose={() => setMessage('')}>{message}</Alert>}

          {step === 1 && (
            <form onSubmit={requestReset} className="space-y-4">
              <div>
                <label className="label">Registration Number / Teacher ID</label>
                <input className="input" value={identifier} onChange={e => setIdentifier(e.target.value)} required />
              </div>
              <button className="btn-primary w-full" disabled={loading}>{loading ? 'Please wait...' : 'Send reset token'}</button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={doReset} className="space-y-4">
              <div>
                <label className="label">Reset Token</label>
                <input className="input" value={resetToken} onChange={e => setResetToken(e.target.value)} required />
              </div>
              <div>
                <label className="label">New Password</label>
                <input className="input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
              </div>
              <div>
                <label className="label">Confirm New Password</label>
                <input className="input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
              </div>
              <button className="btn-primary w-full" disabled={loading}>{loading ? 'Please wait...' : 'Reset password'}</button>
            </form>
          )}

          {step === 3 && (
            <Link to="/" className="btn-primary w-full block text-center">Go to sign in</Link>
          )}

          <div className="mt-4 text-sm text-center">
            <Link to="/" className="text-brand-600 hover:underline">Back to sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
