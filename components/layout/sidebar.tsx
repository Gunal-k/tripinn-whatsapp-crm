'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Compass, 
  Users, 
  CalendarClock, 
  MessageSquare, 
  Settings, 
  CheckCircle2, 
  LogOut,
  PhoneCall,
  ShieldCheck,
  UserCheck,
  BarChart3,
  QrCode,
  X
} from 'lucide-react';
import { ThemeToggle } from '../theme/theme-toggle';

export type NavigationTab = 'dashboard' | 'leads' | 'follow-ups' | 'messages' | 'staff' | 'settings' | 'website-analytics' | 'whatsapp-qr';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  followUpsCount: number;
  unreadMessagesCount: number;
  currentRole: 'admin' | 'sales';
  currentUserName: string;
  onToggleRole?: () => void;
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
      id: 'website-analytics' as NavigationTab,
      label: 'Website Analytics',
      icon: BarChart3,
      badge: null,
      adminOnly: false,
    },
    {
      id: 'whatsapp-qr' as NavigationTab,
      label: 'WhatsApp QR (Beta)',
      icon: QrCode,
      badge: 'BETA',
      badgeColor: 'bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px]',
      adminOnly: false,
    },
    {
      id: 'staff' as NavigationTab,
      label: 'Staff & Team',
      icon: UserCheck,
      badge: null,
      adminOnly: true, // Only visible to admins
    },
    {
      id: 'settings' as NavigationTab,
      label: 'Integrations & API',
      icon: Settings,
      badge: null,
      adminOnly: true, // Hidden for staff members
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
        className={`fixed md:static inset-y-0 left-0 z-50 w-80 max-w-[85vw] bg-[#0b132b] border-r border-[#1e293b] flex flex-col shrink-0 transition-transform duration-200 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-[#1e293b] flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-xl p-0.5 bg-white/5 border border-emerald-500/30 flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0 overflow-hidden">
              <img 
                src="/icon.png" 
                alt="Tripinn Holidays Logo" 
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-sm tracking-wide text-white whitespace-nowrap">TRIPINN HOLIDAYS</span>
                <span className="text-[9px] uppercase font-semibold px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                  CRM
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium tracking-tight truncate">Luxury Tours &amp; Travel</p>
            </div>
          </div>

          {/* Close button on mobile */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 md:hidden cursor-pointer shrink-0 ml-2"
              title="Close Navigation Menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Current Role Indicator Pill */}
        <div className="px-4 py-2.5 bg-[#070d1a] border-b border-[#1e293b] flex items-center justify-between">
          <div className="flex items-center space-x-2 min-w-0">
            {currentRole === 'admin' ? (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <PhoneCall className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            )}
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-200 whitespace-nowrap">
              {currentRole === 'admin' ? 'Role: Administrator' : 'Role: Staff'}
            </span>
          </div>

          <div className="text-[10px] text-emerald-400/80 font-mono px-2 py-0.5 rounded bg-[#111d3d] border border-emerald-500/20 shrink-0">
            Active
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          <div className="px-3.5 pb-2 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
            {currentRole === 'admin' ? 'Administration' : 'Staff Workspace'}
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
                <div className="flex items-center space-x-3 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span className="whitespace-nowrap tracking-tight">{item.label}</span>
                </div>

                {item.badge !== null && (
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2 ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Visual Theme Mode Switcher */}
        <div className="px-4 pb-3 pt-2">
          <ThemeToggle variant="sidebar" />
        </div>

        {/* Staff User Footer Profile */}
        <div className="p-4 border-t border-[#1e293b] flex items-center justify-between bg-[#070d1a]/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-slate-700 border border-emerald-500/40 flex items-center justify-center font-bold text-xs text-white">
              {currentUserName
                .split(' ')
                .map((n) => n[0])
                .filter(Boolean)
                .slice(0, 2)
                .join('')
                .toUpperCase() || (currentRole === 'admin' ? 'AD' : 'SL')}
            </div>
            <div className="text-left">
              <div className="flex items-center space-x-1">
                <span className="text-xs font-semibold text-white truncate max-w-[120px]">{currentUserName}</span>
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
              </div>
              <p className="text-[10px] text-emerald-400/90 font-medium">
                {currentRole === 'admin' ? 'System Administrator' : 'Staff Member'}
              </p>
            </div>
          </div>

          <button 
            title="Sign Out"
            className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
            onClick={async () => {
              const { showConfirmDialog } = await import('../../lib/utils/swal');
              const confirmed = await showConfirmDialog({
                title: 'Sign Out of Tripinn CRM?',
                text: 'Are you sure you want to securely end your active staff workspace session?',
                confirmButtonText: 'Yes, Sign Out',
                cancelButtonText: 'Stay in Workspace',
                isDanger: true,
              });
              if (!confirmed) return;
              try {
                const { createClient } = await import('../../lib/supabase/client');
                const supabase = createClient();
                await supabase.auth.signOut();
              } catch (err) {
                console.warn('Sign out error:', err);
              } finally {
                router.push('/login');
                router.refresh();
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
