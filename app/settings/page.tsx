'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck, ShieldAlert } from 'lucide-react';
import { SettingsView } from '../../components/settings/settings-view';
import { createClient } from '../../lib/supabase/client';

export default function SettingsPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkRole() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login?next=/settings');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role, is_active')
          .eq('id', user.id)
          .maybeSingle();

        if (!profile || !profile.is_active || profile.role !== 'admin') {
          setIsAdmin(false);
        } else {
          setIsAdmin(true);
        }
      } catch {
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    }

    checkRole();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070d1a] flex items-center justify-center text-emerald-400">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-[#070d1a] text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-[#0b132b] border border-rose-500/30 rounded-2xl p-6 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-full bg-rose-500/15 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-white">Administrator Access Required</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            API credentials, webhook tokens, and Meta cloud integrations are restricted to system administrators.
          </p>
          <Link
            href="/"
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#070d1a] font-bold text-xs transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to CRM Workspace</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070d1a] text-slate-100 flex flex-col">
      {/* Settings Header */}
      <header className="h-18 bg-[#0b132b] border-b border-[#1e293b] px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center space-x-4">
          <Link
            href="/"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#111d3d] hover:bg-[#1a2c5a] text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to CRM Dashboard</span>
          </Link>

          <div>
            <h1 className="text-base font-bold text-white flex items-center space-x-2">
              <span>API Integrations &amp; Cloud Configuration</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                ADMIN
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Server-Side Secured</span>
        </div>
      </header>

      {/* Main Settings Body */}
      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        <SettingsView />
      </main>
    </div>
  );
}
