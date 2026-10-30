'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, QrCode } from 'lucide-react';
import { ExperimentalQrCard } from '../../components/settings/experimental-qr-card';

export default function WhatsAppQrPage() {
  return (
    <div className="min-h-screen bg-[#070d1a] text-slate-100 flex flex-col font-sans">
      {/* Header Bar */}
      <header className="h-16 bg-[#0b132b] border-b border-[#1e293b] px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <Link
            href="/"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#111d3d] hover:bg-[#1a2c5a] text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back to CRM Workspace</span>
            <span className="sm:hidden">Back</span>
          </Link>

          <div className="flex items-center space-x-2">
            <span className="text-slate-500 hidden sm:inline">/</span>
            <div className="flex items-center space-x-2">
              <QrCode className="w-4 h-4 text-purple-400" />
              <h1 className="text-sm sm:text-base font-bold text-white">
                Experimental WhatsApp QR (Beta)
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/settings"
            className="text-xs text-slate-400 hover:text-slate-200 transition"
          >
            Settings &amp; Integrations
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
        <ExperimentalQrCard standalone={true} />
      </main>
    </div>
  );
}

