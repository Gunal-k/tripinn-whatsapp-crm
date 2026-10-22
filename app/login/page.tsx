'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  KeyRound, 
  ArrowLeft,
  ShieldAlert,
  Zap
} from 'lucide-react';
import { createClient } from '../../lib/supabase/client';
import { ThemeToggle } from '../../components/theme/theme-toggle';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Mode: 'login' | 'forgot_password'
  const [mode, setMode] = useState<'login' | 'forgot_password'>('login');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quickLoginLoading, setQuickLoginLoading] = useState(false);

  // Status messages
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Derive initial status messages from URL query parameters
  const errorParam = searchParams.get('error');
  const resetParam = searchParams.get('reset');

  const urlErrorMessage = errorParam === 'inactive'
    ? 'Access Denied: Your staff account is deactivated. Please contact your Tripinn administrator.'
    : errorParam === 'profile_missing'
    ? 'Access Denied: Staff profile record not found. Please contact your administrator.'
    : errorParam === 'unauthorized'
    ? 'Please sign in to access the Tripinn Holidays CRM workspace.'
    : '';

  const urlSuccessMessage = resetParam === 'success'
    ? 'Password updated successfully! Please sign in with your new password.'
    : '';

  const displayError = errorMessage || urlErrorMessage;
  const displaySuccess = successMessage || urlSuccessMessage;

  // Handle Supabase Email & Password Sign In
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const supabase = createClient();

      // 1. Authenticate with Supabase Auth
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        if (authError.message.toLowerCase().includes('invalid login credentials')) {
          setErrorMessage('Invalid email address or password. Please verify your staff credentials.');
        } else if (authError.message.toLowerCase().includes('email not confirmed')) {
          setErrorMessage('Email address is not confirmed. Please verify your email or ask an administrator to confirm your account.');
        } else {
          setErrorMessage(authError.message || 'Authentication failed. Please try again.');
        }
        return;
      }

      if (!data.user) {
        setErrorMessage('Authentication failed: No user record returned.');
        return;
      }

      // 2. Verify Profile in public.profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, is_active')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError) {
        await supabase.auth.signOut();
        setErrorMessage(`Database verification error: ${profileError.message}`);
        return;
      }

      // 3. Deny access if profile record does not exist
      if (!profile) {
        await supabase.auth.signOut();
        setErrorMessage(
          'Access Denied: No staff profile record exists for this account in public.profiles. Please contact your administrator to provision your profile.'
        );
        return;
      }

      // 4. Deny access if staff member is marked inactive
      if (!profile.is_active) {
        await supabase.auth.signOut();
        setErrorMessage(
          'Access Denied: Your staff account has been deactivated. Please contact your Tripinn administrator.'
        );
        return;
      }

      // 5. Successful login: Route to intended page or dashboard
      const nextPath = searchParams.get('next') || '/';
      router.push(nextPath);
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to connect to authentication server.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  // Direct 1-Click Authentication for Administrator
  const handleQuickAdminLogin = async () => {
    setQuickLoginLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/auth/quick-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'gunal@tripinnholidays.com' }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.token_hash) {
        throw new Error(json.error || 'Failed to initialize administrator session');
      }

      const supabase = createClient();
      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash: json.token_hash,
        type: 'magiclink',
      });

      if (otpError) {
        throw otpError;
      }

      setSuccessMessage('Authenticated successfully as Administrator! Opening workspace...');
      const nextPath = searchParams.get('next') || '/';
      router.push(nextPath);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Quick login failed';
      setErrorMessage(msg);
    } finally {
      setQuickLoginLoading(false);
    }
  };

  // Handle Supabase Password Reset Request
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.trim()) {
      setErrorMessage('Please enter your registered staff email address.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const supabase = createClient();
      const redirectUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/auth/reset-password`
        : undefined;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl,
      });

      if (resetError) {
        setErrorMessage(resetError.message || 'Unable to send password reset request.');
        return;
      }

      setSuccessMessage(
        `Password reset instructions sent to ${email.trim()}. Please check your email inbox to set a new password.`
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send password reset email.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070d1a] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-[#0b132b] rounded-2xl border border-[#1e293b] p-8 shadow-2xl space-y-6">
        {/* Top-Right Theme Toggle */}
        <div className="flex justify-end -mt-2 -mb-2">
          <ThemeToggle variant="icon-only" />
        </div>

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl p-1 bg-white/5 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-1 overflow-hidden">
            <img 
              src="/icon.png" 
              alt="Tripinn Holidays Logo" 
              className="w-full h-full object-contain rounded-xl"
            />
          </div>
          <h1 className="text-xl font-bold tracking-wider text-white">TRIPINN HOLIDAYS</h1>
          <p className="text-xs text-slate-400">
            {mode === 'login' 
              ? 'Enterprise Travel CRM & Staff Portal' 
              : 'Password Recovery Assistance'}
          </p>
        </div>

        {/* Error Alert Banner */}
        {displayError && (
          <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start space-x-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <div className="flex-1 leading-relaxed">{displayError}</div>
          </div>
        )}

        {/* Success Alert Banner */}
        {displaySuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-start space-x-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <div className="flex-1 leading-relaxed">{displaySuccess}</div>
          </div>
        )}

        {/* Quick Admin Credential Hint & 1-Click Login */}
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between text-[11px] text-slate-300">
            <span>Admin: <strong className="text-emerald-400 font-mono">gunal@tripinnholidays.com</strong></span>
            <button
              type="button"
              onClick={() => setEmail('gunal@tripinnholidays.com')}
              className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded border border-[#1e293b] hover:border-slate-500 transition cursor-pointer"
            >
              Fill Email
            </button>
          </div>
          <button
            type="button"
            onClick={handleQuickAdminLogin}
            disabled={quickLoginLoading || loading}
            className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-[#070d1a] font-bold text-xs shadow-md shadow-emerald-500/20 transition flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            {quickLoginLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-[#070d1a]/30 border-t-[#070d1a] rounded-full animate-spin" />
                <span>Verifying Administrator Session...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>1-Click Sign In as Gunal (Admin)</span>
              </>
            )}
          </button>
        </div>

        {/* LOGIN FORM */}
        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Staff Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="staff@tripinnholidays.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[#070d1a] border border-[#1e293b] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Account Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage('');
                    setSuccessMessage('');
                    setMode('forgot_password');
                  }}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 rounded-lg bg-[#070d1a] border border-[#1e293b] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-[#070d1a] font-bold text-xs shadow-md shadow-emerald-500/20 transition flex items-center justify-center space-x-1.5 cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-[#070d1a]/30 border-t-[#070d1a] rounded-full animate-spin" />
                  <span>Verifying credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* FORGOT PASSWORD FORM */
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="p-3 rounded-lg bg-[#070d1a] border border-[#1e293b] text-xs text-slate-400 leading-relaxed">
              Enter your registered staff email address below. We will send you a secure link to reset your password.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Staff Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="staff@tripinnholidays.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[#070d1a] border border-[#1e293b] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-[#070d1a] font-bold text-xs shadow-md shadow-emerald-500/20 transition flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-[#070d1a]/30 border-t-[#070d1a] rounded-full animate-spin" />
                  <span>Sending reset link...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Send Password Reset Link</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setErrorMessage('');
                setSuccessMessage('');
                setMode('login');
              }}
              className="w-full py-2 rounded-lg bg-transparent hover:bg-slate-800/50 text-slate-400 hover:text-white text-xs font-semibold transition flex items-center justify-center space-x-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </button>
          </form>
        )}

        {/* Security & Access Notice */}
        <div className="pt-4 border-t border-[#1e293b] flex items-center justify-center space-x-2 text-[10px] text-slate-500 text-center leading-relaxed">
          <ShieldAlert className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span>
            Authorized personnel only. Public registration is disabled to protect client data.
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070d1a] flex items-center justify-center text-emerald-400">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
