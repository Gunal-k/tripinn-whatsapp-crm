'use client';

import React from 'react';
import { Menu, Plus, Bell, MessageCircle, FileSpreadsheet, UserPlus } from 'lucide-react';
import { NavigationTab } from './sidebar';
import { ThemeToggle } from '../theme/theme-toggle';

interface TopNavProps {
  currentTab: NavigationTab;
  onOpenMobileMenu: () => void;
  onOpenAddLeadModal: () => void;
  onOpenAddStaffModal?: () => void;
  onOpenTelecallerExport: () => void;
  followUpsDueCount: number;
  currentRole: 'admin' | 'sales';
}

export function TopNav({
  currentTab,
  onOpenMobileMenu,
  onOpenAddLeadModal,
  onOpenAddStaffModal,
  onOpenTelecallerExport,
  followUpsDueCount,
  currentRole,
}: TopNavProps) {

  const titles: Record<NavigationTab, { title: string; subtitle: string }> = {
    dashboard: {
      title: currentRole === 'admin' ? 'Travel CRM Agency Dashboard' : 'Staff Calling Dashboard',
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
    staff: {
      title: 'Staff & Team Directory',
      subtitle: 'Provision staff members, assign roles, and manage system access',
    },
    settings: {
      title: 'Integrations & Cloud API Settings',
      subtitle: 'Supabase, WhatsApp Cloud API, and Meta Conversions API',
    },
  };

  const currentInfo = titles[currentTab] || titles.dashboard;

  return (
    <header className="h-16 md:h-18 bg-[#0b132b]/80 backdrop-blur-xl border-b border-white/[0.08] px-3 md:px-8 flex items-center justify-between sticky top-0 z-30 transition-colors">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center space-x-2.5 md:space-x-3 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          className="w-11 h-11 rounded-xl bg-[#111d3d] border border-white/[0.08] text-slate-300 hover:text-white md:hidden cursor-pointer shrink-0 flex items-center justify-center active:scale-95 transition-all shadow-xs"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <h1 className="text-sm sm:text-base md:text-lg font-bold text-white tracking-tight truncate max-w-[150px] xs:max-w-[220px] sm:max-w-none">
              {currentInfo.title}
            </h1>
            <span
              className={`hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                currentRole === 'admin'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
              }`}
            >
              {currentRole === 'admin' ? 'ADMIN' : 'STAFF'}
            </span>
          </div>
          <p className="hidden sm:block text-xs text-slate-400 truncate mt-0.5">
            {currentInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Actions & Indicators */}
      <div className="flex items-center space-x-1.5 sm:space-x-2 md:space-x-3 shrink-0">
        {/* System Health Badges */}
        <div className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-[#111d3d] border border-white/[0.08] text-xs shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-300 font-medium">WhatsApp Cloud API</span>
          <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
        </div>

        {/* Theme Mode Switcher (Light / Dark) */}
        <ThemeToggle variant="top-nav" />

        {/* Excel Calling Sheet Export Button */}
        <button
          onClick={onOpenTelecallerExport}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl bg-[#111d3d] hover:bg-[#1a2c5a] text-emerald-300 font-semibold text-xs border border-white/[0.08] shadow-xs transition-all cursor-pointer active:scale-95"
          title="Download Staff Calling Sheet in Microsoft Excel (.xlsx) format"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="hidden sm:inline">Calling Sheet</span>
        </button>

        {/* Follow-up Reminder Bell */}
        {followUpsDueCount > 0 && (
          <div className="relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[#111d3d] text-amber-400 border border-amber-500/30">
            <Bell className="w-4 h-4" />
            <span className="absolute 1 top-1.5 right-1.5 w-4 h-4 rounded-full bg-amber-500 text-[10px] font-bold text-black flex items-center justify-center shadow-xs">
              {followUpsDueCount}
            </span>
          </div>
        )}

        {/* Add Staff Quick Action (Admin Only) */}
        {currentRole === 'admin' && onOpenAddStaffModal && (
          <button
            onClick={onOpenAddStaffModal}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 font-semibold text-xs border border-purple-500/30 shadow-xs transition-all cursor-pointer active:scale-95"
            title="Directly provision a new staff member or administrator"
          >
            <UserPlus className="w-4 h-4 text-purple-400 stroke-[2] shrink-0" />
            <span className="hidden sm:inline">Add Staff</span>
          </button>
        )}

        {/* New Lead Quick Action Button */}
        <button
          onClick={onOpenAddLeadModal}
          className="min-h-[44px] flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#070d1a] font-bold text-xs md:text-sm shadow-md shadow-emerald-500/20 transition-all cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
          <span className="whitespace-nowrap">Add Lead</span>
        </button>
      </div>
    </header>
  );
}
