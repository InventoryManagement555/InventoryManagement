import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { Activity, ShieldAlert, ShieldCheck } from 'lucide-react';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }

    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const res = await api.post<{ detail: string }>('/auth/forgot-password', { email });
      setSuccess(res.detail || 'Password reset link sent to your email.');
    } catch (err: any) {
      setError(err.message || 'Recovery failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-teal-500/10 p-3 rounded-lg border border-teal-500/20">
            <Activity className="w-8 h-8 text-teal-400" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-zinc-100 tracking-tight font-mono">
          RECOVER ACCESS
        </h2>
        <p className="mt-2 text-center text-xs font-mono text-zinc-500 uppercase tracking-widest">
          PASSWORD RECOVERY PROTOCOL
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-zinc-900 py-8 px-4 border border-zinc-800 rounded sm:px-10 shadow-2xl panel-glow">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-950/20 border border-red-500/30 rounded p-3 flex items-start space-x-2.5">
                <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <span className="text-xs text-red-300 font-mono">{error}</span>
              </div>
            )}

            {success && (
              <div className="bg-emerald-950/20 border border-emerald-500/30 rounded p-3 flex items-start space-x-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-xs text-emerald-300 font-mono">{success}</span>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-mono text-zinc-400 uppercase tracking-wider">
                Console Identity (Email)
              </label>
              <div className="mt-1.5">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-zinc-800 rounded bg-zinc-950 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 font-mono text-sm"
                  placeholder="operator@dmart.com"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex justify-center py-2 px-4 border border-teal-500/30 rounded text-sm font-mono font-medium text-teal-300 bg-teal-950/20 hover:bg-teal-950/50 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-colors duration-150 disabled:opacity-50"
              >
                {submitting ? 'DISPATCHING RECOVERY ACCESS...' : 'SEND RESET LINK'}
              </button>
            </div>
          </form>

          <div className="mt-6 border-t border-zinc-800 pt-6 text-center">
            <p className="text-xs text-zinc-500 font-mono">
              Remember your access key?{' '}
              <Link to="/login" className="text-teal-400 hover:text-teal-300 transition-colors duration-150">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
