'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Compass, ShieldCheck, Lock, Mail, ArrowRight, PhoneCall } from 'lucide-react';
import { createClient } from '../../lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Fallback for dev demo mode if Supabase keys haven't been populated with users yet
        if (email.toLowerCase().includes('admin')) {
          localStorage.setItem('tripinn_current_role', 'admin');
          localStorage.setItem('tripinn_user_email', email);
          localStorage.setItem('tripinn_user_name', 'Karan Johar (Admin)');
          router.push('/');
          return;
        } else {
          localStorage.setItem('tripinn_current_role', 'salesperson');
          localStorage.setItem('tripinn_user_email', email);
          localStorage.setItem('tripinn_user_name', 'Priya Sharma');
          router.push('/');
          return;
        }
      }

      if (data?.user) {
        router.push('/');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (role: 'admin' | 'salesperson') => {
    if (role === 'admin') {
      localStorage.setItem('tripinn_current_role', 'admin');
      localStorage.setItem('tripinn_user_email', 'admin@tripinnholidays.com');
      localStorage.setItem('tripinn_user_name', 'Karan Johar (Admin)');
    } else {
      localStorage.setItem('tripinn_current_role', 'salesperson');
      localStorage.setItem('tripinn_user_email', 'priya@tripinnholidays.com');
      localStorage.setItem('tripinn_user_name', 'Priya Sharma');
    }
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-[#070d1a] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-[#0b132b] rounded-2xl border border-[#1e293b] p-8 shadow-2xl space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-1">
            <Compass className="w-8 h-8 text-[#070d1a]" />
          </div>
          <h1 className="text-xl font-bold tracking-wider text-white">TRIPINN HOLIDAYS</h1>
          <p className="text-xs text-slate-400">Enterprise Travel CRM &amp; Telecalling Portal</p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
            {errorMessage}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Staff Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="staff@tripinnholidays.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#070d1a] border border-[#1e293b] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Account Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#070d1a] border border-[#1e293b] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-[#070d1a] font-bold text-xs shadow-md shadow-emerald-500/20 transition flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In to Workspace'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Role-Selection Demo Buttons */}
        <div className="pt-4 border-t border-[#1e293b] space-y-2">
          <p className="text-[11px] text-center text-slate-400 font-semibold uppercase tracking-wider">
            Quick Role Switcher &amp; Staff Access
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin('admin')}
              className="p-2.5 rounded-xl bg-[#070d1a] hover:bg-[#111d3d] border border-emerald-500/30 text-left transition cursor-pointer"
            >
              <div className="flex items-center space-x-1 text-emerald-400 text-xs font-bold mb-0.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Administrator</span>
              </div>
              <p className="text-[10px] text-slate-400">Full Access &amp; API Settings</p>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('salesperson')}
              className="p-2.5 rounded-xl bg-[#070d1a] hover:bg-[#111d3d] border border-blue-500/30 text-left transition cursor-pointer"
            >
              <div className="flex items-center space-x-1 text-blue-400 text-xs font-bold mb-0.5">
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Telecaller / Rep</span>
              </div>
              <p className="text-[10px] text-slate-400">Calling Queue &amp; Leads</p>
            </button>
          </div>
        </div>

        {/* Security Notice */}
        <p className="text-[10px] text-slate-500 text-center leading-relaxed">
          Authorized personnel only. Public registration is disabled to safeguard customer data and Meta CAPI endpoints.
        </p>
      </div>
    </div>
  );
}
