'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Compass, 
  Users, 
  CalendarClock, 
  MessageSquare, 
  Settings, 
  CheckCircle2, 
  LogOut,
  Sparkles,
  PhoneCall,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

export type NavigationTab = 'dashboard' | 'leads' | 'follow-ups' | 'messages' | 'settings';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  followUpsCount: number;
  unreadMessagesCount: number;
  currentRole: 'admin' | 'salesperson';
  currentUserName: string;
  onToggleRole: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({
  currentTab,
  onSelectTab,
  followUpsCount,
  unreadMessagesCount,
  currentRole,
  currentUserName,
  onToggleRole,
  isMobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const router = useRouter();

  const allNavItems = [
    {
      id: 'dashboard' as NavigationTab,
      label: currentRole === 'admin' ? 'Dashboard & Analytics' : 'My Performance',
      icon: Compass,
      badge: null,
      adminOnly: false,
    },
    {
      id: 'leads' as NavigationTab,
      label: currentRole === 'admin' ? 'All Leads Pipeline' : 'My Calling Leads',
      icon: Users,
      badge: null,
      adminOnly: false,
    },
    {
      id: 'follow-ups' as NavigationTab,
      label: currentRole === 'admin' ? 'Consultations & Follow-ups' : "Today's Call Queue",
      icon: currentRole === 'admin' ? CalendarClock : PhoneCall,
      badge: followUpsCount > 0 ? followUpsCount : null,
      badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
      adminOnly: false,
    },
    {
      id: 'messages' as NavigationTab,
      label: 'WhatsApp Inbox',
      icon: MessageSquare,
      badge: unreadMessagesCount > 0 ? unreadMessagesCount : null,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
      adminOnly: false,
    },
    {
      id: 'settings' as NavigationTab,
      label: 'Integrations & API',
      icon: Settings,
      badge: null,
      adminOnly: true, // Hidden for telecallers/sales reps
    },
  ];

  // Role-based navigation filtering
  const visibleNavItems = allNavItems.filter((item) => {
    if (item.adminOnly && currentRole !== 'admin') return false;
    return true;
  });

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-[#0b132b] border-r border-[#1e293b] flex flex-col transition-transform duration-200 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-[#1e293b] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Compass className="w-6 h-6 text-[#070d1a]" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-base tracking-wider text-white">TRIPINN</span>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  CRM
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium tracking-tight">Holidays &amp; Luxury Tours</p>
            </div>
          </div>
        </div>

        {/* Current Role Indicator Pill */}
        <div className="px-4 py-2.5 bg-[#070d1a] border-b border-[#1e293b] flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            {currentRole === 'admin' ? (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <PhoneCall className="w-3.5 h-3.5 text-blue-400" />
            )}
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-200">
              {currentRole === 'admin' ? 'Role: Administrator' : 'Role: Telecaller'}
            </span>
          </div>

          <button
            onClick={onToggleRole}
            className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold px-2 py-0.5 rounded bg-[#111d3d] border border-emerald-500/30 flex items-center space-x-1 cursor-pointer transition"
            title="Switch View to test Administrator vs Telecaller role screen optimization"
          >
            <RefreshCw className="w-2.5 h-2.5" />
            <span>Switch</span>
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
            {currentRole === 'admin' ? 'Administration' : 'Telecaller Workspace'}
          </div>

          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10'
                    : 'text-slate-300 hover:bg-[#111d3d] hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>

                {item.badge !== null && (
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Attribution & CTWA Live Badge */}
        <div className="p-4 mx-3 mb-3 rounded-xl bg-gradient-to-br from-[#111d3d] to-[#0b132b] border border-emerald-500/20">
          <div className="flex items-center space-x-2 text-xs font-medium text-emerald-400 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Meta CTWA &amp; CAPI Ready</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {currentRole === 'admin'
              ? 'Click-to-WhatsApp ad attribution & server-side qualified lead events enabled.'
              : 'Qualified leads automatically signal Meta Conversions API upon verification.'}
          </p>
        </div>

        {/* Staff User Footer Profile */}
        <div className="p-4 border-t border-[#1e293b] flex items-center justify-between bg-[#070d1a]/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-slate-700 border border-emerald-500/40 flex items-center justify-center font-bold text-xs text-white">
              {currentRole === 'admin' ? 'KJ' : 'PS'}
            </div>
            <div className="text-left">
              <div className="flex items-center space-x-1">
                <span className="text-xs font-semibold text-white">{currentUserName}</span>
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              </div>
              <p className="text-[10px] text-emerald-400/90 font-medium">
                {currentRole === 'admin' ? 'System Administrator' : 'Senior Telecaller / Rep'}
              </p>
            </div>
          </div>

          <button 
            title="Sign Out"
            className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
            onClick={() => {
              if (confirm('Are you sure you want to log out?')) {
                router.push('/login');
              }
            }}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </>
  );
}
