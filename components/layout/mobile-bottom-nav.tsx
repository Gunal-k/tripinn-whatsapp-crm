'use client';

import React from 'react';
import { 
  Compass, 
  Users, 
  CalendarClock, 
  PhoneCall, 
  Plus, 
  Menu,
  MessageSquare
} from 'lucide-react';
import { NavigationTab } from './sidebar';

interface MobileBottomNavProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  followUpsCount: number;
  unreadMessagesCount: number;
  onOpenAddLeadModal: () => void;
  onOpenMobileMenu: () => void;
  currentRole: 'admin' | 'sales';
}

export function MobileBottomNav({
  currentTab,
  onSelectTab,
  followUpsCount,
  unreadMessagesCount,
  onOpenAddLeadModal,
  onOpenMobileMenu,
  currentRole,
}: MobileBottomNavProps) {
  const isQueueTab = currentTab === 'follow-ups';
  const isDashboardTab = currentTab === 'dashboard';
  const isLeadsTab = currentTab === 'leads';
  const isMessagesTab = currentTab === 'messages';

  return (
    <nav 
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#070d1a]/90 backdrop-blur-xl border-t border-white/[0.08] shadow-[0_-4px_20px_rgba(0,0,0,0.4)] px-3 pt-1.5 pb-[max(env(safe-area-inset-bottom,0px),0.5rem)]"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {/* 1. Dashboard Tab */}
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-all duration-150 active:scale-90 ${
            isDashboardTab ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Compass className={`w-5 h-5 transition-transform ${isDashboardTab ? 'scale-110 stroke-[2.3]' : 'stroke-[1.8]'}`} />
            {isDashboardTab && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Dashboard</span>
        </button>

        {/* 2. Leads Tab */}
        <button
          onClick={() => onSelectTab('leads')}
          className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-all duration-150 active:scale-90 ${
            isLeadsTab ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Users className={`w-5 h-5 transition-transform ${isLeadsTab ? 'scale-110 stroke-[2.3]' : 'stroke-[1.8]'}`} />
            {isLeadsTab && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Leads</span>
        </button>

        {/* 3. Apple-style Center Primary Action (+) */}
        <div className="flex items-center justify-center px-1">
          <button
            onClick={onOpenAddLeadModal}
            className="w-12 h-12 -mt-4 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-[#070d1a] shadow-[0_4px_16px_rgba(16,185,129,0.45)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.6)] flex items-center justify-center transition-all duration-150 active:scale-90 border-2 border-[#070d1a] cursor-pointer"
            title="Create New Lead"
            aria-label="Add New Lead"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        {/* 4. Queue / Follow-ups Tab */}
        <button
          onClick={() => onSelectTab('follow-ups')}
          className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-all duration-150 active:scale-90 ${
            isQueueTab ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            {currentRole === 'sales' ? (
              <PhoneCall className={`w-5 h-5 transition-transform ${isQueueTab ? 'scale-110 stroke-[2.3]' : 'stroke-[1.8]'}`} />
            ) : (
              <CalendarClock className={`w-5 h-5 transition-transform ${isQueueTab ? 'scale-110 stroke-[2.3]' : 'stroke-[1.8]'}`} />
            )}
            {followUpsCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 min-w-[16px] h-4 rounded-full bg-amber-500 text-black font-extrabold text-[9px] flex items-center justify-center shadow-xs">
                {followUpsCount > 99 ? '99+' : followUpsCount}
              </span>
            )}
            {isQueueTab && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">
            {currentRole === 'sales' ? 'Call Queue' : 'Follow-ups'}
          </span>
        </button>

        {/* 5. WhatsApp Inbox Tab */}
        <button
          onClick={() => onSelectTab('messages')}
          className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-all duration-150 active:scale-90 ${
            isMessagesTab ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <MessageSquare className={`w-5 h-5 transition-transform ${isMessagesTab ? 'scale-110 stroke-[2.3]' : 'stroke-[1.8]'}`} />
            {unreadMessagesCount > 0 && (
              <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#070d1a]" />
            )}
            {isMessagesTab && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Inbox</span>
        </button>

        {/* 6. More / Drawer Trigger */}
        <button
          onClick={onOpenMobileMenu}
          className="flex flex-col items-center justify-center flex-1 py-1 text-slate-400 hover:text-slate-200 cursor-pointer transition-all duration-150 active:scale-90"
          aria-label="Open More Options"
        >
          <Menu className="w-5 h-5 stroke-[1.8]" />
          <span className="text-[10px] mt-1 tracking-tight">More</span>
        </button>
      </div>
    </nav>
  );
}
