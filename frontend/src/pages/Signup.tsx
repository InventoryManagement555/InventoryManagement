import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Activity, ShieldAlert, ShieldCheck, KeyRound } from 'lucide-react';

export const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('All fields are required.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await api.post('/auth/signup', { name, email, password });
      setStep(2);
      setSuccess('Verification OTP has been sent. Please check your inbox.');
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP.');
      return;
    }

    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      await api.post('/auth/verify-otp', { email, otp });
      setSuccess('Account verified successfully! You can now log in.');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOTP = async () => {
    setError(null);
    setSuccess(null);
    setResending(true);
    try {
      await api.post('/auth/resend-otp', { email });
      setSuccess('A new 6-digit OTP has been sent to your email.');
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP.');
    } finally {
      setResending(false);
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
          REGISTER CONSOLE
        </h2>
        <p className="mt-2 text-center text-xs font-mono text-zinc-500 uppercase tracking-widest">
          {step === 1 ? 'NEW OPERATOR PROVISIONING' : 'SECURE IDENTITY VERIFICATION'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-zinc-900 py-8 px-4 border border-zinc-800 rounded sm:px-10 shadow-2xl panel-glow">
          {error && (
            <div className="bg-red-950/20 border border-red-500/30 rounded p-3 flex items-start space-x-2.5 mb-4">
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <span className="text-xs text-red-300 font-mono">{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-emerald-950/20 border border-emerald-500/30 rounded p-3 flex items-start space-x-2.5 mb-4">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <span className="text-xs text-emerald-300 font-mono">{success}</span>
            </div>
          )}

          {step === 1 ? (
            <form className="space-y-5" onSubmit={handleRegister}>
              <div>
                <label htmlFor="name" className="block text-xs font-mono text-zinc-400 uppercase tracking-wider">
                  Full Operator Name
                </label>
                <div className="mt-1.5">
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-zinc-800 rounded bg-zinc-950 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 font-mono text-sm"
                    placeholder="Operator Name"
                  />
                </div>
              </div>

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

              <div>
                <label htmlFor="password" className="block text-xs font-mono text-zinc-400 uppercase tracking-wider">
                  Access Key (Password)
                </label>
                <div className="mt-1.5">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-zinc-800 rounded bg-zinc-950 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 font-mono text-sm"
                    placeholder="Minimum 6 characters"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex justify-center py-2 px-4 border border-teal-500/30 rounded text-sm font-mono font-medium text-teal-300 bg-teal-950/20 hover:bg-teal-950/50 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-colors duration-150 disabled:opacity-50"
                >
                  {submitting ? 'COMMITTING SECURE KEY...' : 'INITIALIZE ACCESS'}
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-5" onSubmit={handleVerifyOTP}>
              <div className="text-center p-3 bg-zinc-950/50 border border-zinc-800/80 rounded space-y-1">
                <KeyRound className="w-6 h-6 text-teal-400 mx-auto mb-1" />
                <p className="text-[11px] font-mono text-zinc-400">ENTER 6-DIGIT SECURITY OTP</p>
                <p className="text-[10px] font-mono text-zinc-500">Sent to: {email}</p>
              </div>

              <div>
                <input
                  id="otp"
                  name="otp"
                  type="text"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="appearance-none block w-full text-center tracking-[10px] text-lg font-bold py-3 border border-zinc-800 rounded bg-zinc-950 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 font-mono"
                  placeholder="000000"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <button
                  type="submit"
                  disabled={submitting || otp.length !== 6}
                  className="w-full flex justify-center py-2 px-4 border border-teal-500/30 rounded text-sm font-mono font-medium text-teal-300 bg-teal-950/20 hover:bg-teal-950/50 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-colors duration-150 disabled:opacity-50"
                >
                  {submitting ? 'VALIDATING CODE...' : 'VERIFY SECURITY OTP'}
                </button>

                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={resending}
                  className="w-full text-center text-xs font-mono text-zinc-500 hover:text-zinc-300 py-1 transition-colors duration-100 disabled:opacity-50"
                >
                  {resending ? 'RESENDING...' : 'RESEND OTP CODE'}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 border-t border-zinc-800 pt-6 text-center">
            <p className="text-xs text-zinc-500 font-mono">
              Already registered?{' '}
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

export default Signup;
