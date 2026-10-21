'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { SettingsView } from '../../components/settings/settings-view';

export default function SettingsPage() {
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
