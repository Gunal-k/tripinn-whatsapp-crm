'use client';

import React from 'react';
import { Menu, Plus, Bell, MessageCircle, FileSpreadsheet } from 'lucide-react';
import { NavigationTab } from './sidebar';

interface TopNavProps {
  currentTab: NavigationTab;
  onOpenMobileMenu: () => void;
  onOpenAddLeadModal: () => void;
  onOpenTelecallerExport: () => void;
  followUpsDueCount: number;
  currentRole: 'admin' | 'sales';
}

export function TopNav({
  currentTab,
  onOpenMobileMenu,
  onOpenAddLeadModal,
  onOpenTelecallerExport,
  followUpsDueCount,
  currentRole,
}: TopNavProps) {
  const titles: Record<NavigationTab, { title: string; subtitle: string }> = {
    dashboard: {
      title: currentRole === 'admin' ? 'Travel CRM Agency Dashboard' : 'Telecaller Calling Dashboard',
      subtitle: currentRole === 'admin' 
        ? 'Real-time overview of leads, qualified pipeline, and bookings'
        : 'Your assigned leads, calling targets, and today\'s follow-ups',
    },
    leads: {
      title: currentRole === 'admin' ? 'All Leads & Pipeline Management' : 'My Calling Leads & Enquiries',
      subtitle: currentRole === 'admin'
        ? 'Comprehensive lead tracking from enquiry to completed tours'
        : 'Call prospects, log call outcomes, and verify qualifications',
    },
    'follow-ups': {
      title: currentRole === 'admin' ? 'Agency Follow-ups & Consultations' : 'My Calling Queue & Callbacks',
      subtitle: 'Actionable customer reminders and overdue consultations',
    },
    messages: {
      title: 'WhatsApp Business Cloud Inbox',
      subtitle: 'Real-time customer conversations and booking updates',
    },
    settings: {
      title: 'Integrations & Cloud API Settings',
      subtitle: 'Supabase, WhatsApp Cloud API, and Meta Conversions API',
    },
  };

  const currentInfo = titles[currentTab];

  return (
    <header className="h-18 bg-[#0b132b]/80 backdrop-blur-md border-b border-[#1e293b] px-4 md:px-8 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onOpenMobileMenu}
          className="p-2 rounded-lg bg-[#111d3d] text-slate-300 hover:text-white md:hidden cursor-pointer"
          aria-label="Open Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base md:text-lg font-bold text-white tracking-tight">
              {currentInfo.title}
            </h1>
            <span
              className={`hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded ${
                currentRole === 'admin'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
              }`}
            >
              {currentRole === 'admin' ? 'ADMIN' : 'TELECALLER'}
            </span>
          </div>
          <p className="hidden sm:block text-xs text-slate-400">
            {currentInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Actions & Indicators */}
      <div className="flex items-center space-x-2 md:space-x-3">
        {/* System Health Badges */}
        <div className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-[#111d3d] border border-slate-700/60 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-300 font-medium">WhatsApp Cloud API</span>
          <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
        </div>

        {/* Excel Calling Sheet Export Button */}
        <button
          onClick={onOpenTelecallerExport}
          className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-[#111d3d] hover:bg-[#1a2c5a] text-emerald-300 font-semibold text-xs border border-emerald-500/30 shadow-xs transition cursor-pointer"
          title="Download Telecaller Calling Sheet in Microsoft Excel (.xlsx) format"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span className="hidden sm:inline">Excel Calling Sheet</span>
          <span className="sm:hidden">Excel</span>
        </button>

        {/* Follow-up Reminder Bell */}
        {followUpsDueCount > 0 && (
          <div className="relative p-2 rounded-lg bg-[#111d3d] text-amber-400 border border-amber-500/30">
            <Bell className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-[10px] font-bold text-black flex items-center justify-center">
              {followUpsDueCount}
            </span>
          </div>
        )}

        {/* New Lead Quick Action Button */}
        <button
          onClick={onOpenAddLeadModal}
          className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#070d1a] font-semibold text-xs md:text-sm shadow-md shadow-emerald-500/20 transition-all cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Lead</span>
        </button>
      </div>
    </header>
  );
}
