// app/login/page.jsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function LoginPage() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { login, checkAuth } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(formData);

      if (result.success) {
        const user = result.user;
        const token = result.token;

        if (user.role_id === 3 && token) {
          router.push('/');
          return;
        }

        await checkAuth();

        if (user.role_id === 1) router.push('/dashboard/authors');
        else if (user.role_id === 2) router.push('/author/books');
        else router.push('/');

        router.refresh();
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-10 font-sans">
      <div className="w-full max-w-md bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-3xl p-10 shadow-2xl">

        {/* ── Brand ── */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">PlabCoach</h1>
          <p className="text-sm text-slate-500">Welcome back! Sign in to continue</p>
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 text-red-400 text-sm rounded-xl px-4 py-3 mb-6">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          {/* Email */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-slate-400 tracking-wide uppercase">
              Email address
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
              </span>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-3 bg-white/[0.06] border border-white/10 rounded-xl text-slate-100 text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
              />
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-400 tracking-wide uppercase">
                Password
              </label>
              <Link href="/forgot-password"
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                placeholder="Enter your password"
                className="w-full pl-10 pr-11 py-3 bg-white/[0.06] border border-white/10 rounded-xl text-slate-100 text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-1 py-3 rounded-xl font-semibold text-sm text-white
              bg-gradient-to-r from-indigo-500 to-violet-600
              hover:from-indigo-400 hover:to-violet-500
              disabled:opacity-50 disabled:cursor-not-allowed
              shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40
              transition-all duration-200 active:scale-[0.98]
              flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                </svg>
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* ── Footer ── */}
        <p className="mt-7 text-center text-sm text-slate-500">
          Don&apos;t have an account?{' '}
          <Link href="/register"
            className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
            Create one free
          </Link>
        </p>

      </div>
    </div>
  );
}