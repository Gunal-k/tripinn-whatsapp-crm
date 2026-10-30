'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar, NavigationTab } from './layout/sidebar';
import { TopNav } from './layout/top-nav';
import { MobileBottomNav } from './layout/mobile-bottom-nav';
import { DashboardView } from './dashboard/dashboard-view';
import { LeadsView } from './leads/leads-view';
import { FollowUpsView } from './follow-ups/follow-ups-view';
import { MessagesView } from './messages/messages-view';
import { SettingsView } from './settings/settings-view';
import { StaffView } from './staff/staff-view';
import { WebsiteAnalyticsView } from './analytics/website-analytics-view';
import { ExperimentalQrCard } from './settings/experimental-qr-card';
import { AddLeadModal } from './leads/add-lead-modal';
import { AddStaffModal } from './staff/add-staff-modal';
import { LeadDetailDialog } from './leads/lead-detail-dialog';
import { TelecallerExportModal } from './telecaller/telecaller-export-modal';
import { Lead } from '../lib/types/crm';
import { leadService, isSupabaseConfigured, isTestEnvironment } from '../lib/services/leads';
import { createClient } from '../lib/supabase/client';

export default function CRMApp() {
  const router = useRouter();
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [currentRole, setCurrentRole] = useState<'admin' | 'sales'>('admin');
  const [currentUserName, setCurrentUserName] = useState<string>('Staff User');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState<boolean>(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState(false);
  const [isTelecallerExportOpen, setIsTelecallerExportOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [statusFilterForLeads, setStatusFilterForLeads] = useState<string | undefined>(undefined);
  const [isMounted, setIsMounted] = useState(false);

  const fetchLeads = useCallback(async () => {
    try {
      const data = await leadService.getLeads();
      setLeads(data);
    } catch (err) {
      console.warn('Could not load leads from database:', err);
    } finally {
      setLoadingLeads(false);
    }
  }, []);

  useEffect(() => {
    let isSubscribed = true;

    async function initSessionAndLeads() {
      // In test mode or unconfigured dev environments, allow mock capability
      if (isTestEnvironment() || !isSupabaseConfigured()) {
        try {
          const storedRole = typeof window !== 'undefined' ? localStorage.getItem('tripinn_current_role') : null;
          const storedName = typeof window !== 'undefined' ? localStorage.getItem('tripinn_user_name') : null;
          const storedId = typeof window !== 'undefined' ? localStorage.getItem('tripinn_user_id') : null;
          if (storedRole) {
            const normalized = storedRole === 'admin' ? 'admin' : 'sales';
            if (isSubscribed) {
              setCurrentRole(normalized);
              setCurrentUserName(storedName || (normalized === 'admin' ? 'Karan Johar (Admin)' : 'Priya Sharma'));
              setCurrentUserId(storedId || (normalized === 'admin' ? 'user-admin-01' : 'user-sales-01'));
            }
          }
        } catch {
          // ignore
        }
        if (isSubscribed) {
          setIsMounted(true);
          await fetchLeads();
        }
        return;
      }

      try {
        const supabase = createClient();
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session || !session.user) {
          router.push('/login?error=unauthorized');
          return;
        }

        const user = session.user;

        // Fetch verified profile from public.profiles
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, email, full_name, role, is_active')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError || !profile || !profile.is_active) {
          await supabase.auth.signOut();
          router.push('/login?error=inactive');
          return;
        }

        if (isSubscribed) {
          const verifiedRole: 'admin' | 'sales' = profile.role === 'admin' ? 'admin' : 'sales';
          setCurrentRole(verifiedRole);
          setCurrentUserName(profile.full_name || user.email?.split('@')[0] || 'Staff User');
          setCurrentUserId(profile.id);
          setIsMounted(true);
          await fetchLeads();
        }
      } catch (err) {
        console.warn('Session verification error:', err);
        router.push('/login?error=unauthorized');
      }
    }

    initSessionAndLeads();

    // Listen to Supabase auth state changes (e.g. sign out from another tab)
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (!session && !isTestEnvironment() && isSupabaseConfigured())) {
        router.push('/login');
      }
    });

    return () => {
      isSubscribed = false;
      subscription.unsubscribe();
    };
  }, [fetchLeads, router]);

  // Refresh lead state asynchronously when actions occur
  const refreshLeads = async () => {
    try {
      const all = await leadService.getLeads();
      setLeads([...all]);
      if (selectedLead) {
        const refreshedSelected = await leadService.getLeadById(selectedLead.id);
        setSelectedLead(refreshedSelected);
      }
    } catch (err) {
      console.error('Failed to refresh leads from database:', err);
    }
  };

  // Compute pending follow-ups count
  const followUpsDueCount = leads.filter((l) => {
    if (!l.follow_up_date || l.follow_up_completed || l.is_archived) return false;
    if (currentRole === 'sales' && currentUserId) {
      return (
        l.assigned_salesperson_id === currentUserId ||
        l.assigned_salesperson?.id === currentUserId ||
        (currentUserName && l.assigned_salesperson?.full_name?.toLowerCase() === currentUserName.toLowerCase())
      );
    }
    return true;
  }).length;

  const handleNavigateToLeads = (statusFilter?: string) => {
    setStatusFilterForLeads(statusFilter);
    setCurrentTab('leads');
  };

  const handleNavigateToFollowUps = () => {
    setCurrentTab('follow-ups');
  };

  const handleOpenLeadDetail = (lead: Lead) => {
    setSelectedLead(lead);
  };

  const handleLeadCreated = (newLead: Lead) => {
    refreshLeads();
    setSelectedLead(newLead);
  };

  const handleLeadUpdated = (updatedLead: Lead) => {
    refreshLeads();
    setSelectedLead(updatedLead);
  };

  const handleLeadDeleted = (deletedLeadId: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== deletedLeadId));
    if (selectedLead?.id === deletedLeadId) {
      setSelectedLead(null);
    }
  };

  if (!isMounted) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-[#070d1a] text-emerald-400">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin" />
          <span className="text-xs font-semibold tracking-widest uppercase text-slate-400">
            TRIPINN HOLIDAYS CRM
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] w-full max-w-full overflow-hidden bg-[#070d1a] text-slate-100 antialiased selection:bg-emerald-500 selection:text-black">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (tab === 'leads') setStatusFilterForLeads(undefined);
          setCurrentTab(tab);
        }}
        followUpsCount={followUpsDueCount}
        unreadMessagesCount={2}
        currentRole={currentRole}
        currentUserName={currentUserName}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navigation */}
        <TopNav
          currentTab={currentTab}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onOpenAddLeadModal={() => setIsAddModalOpen(true)}
          onOpenAddStaffModal={() => setIsAddStaffModalOpen(true)}
          onOpenTelecallerExport={() => setIsTelecallerExportOpen(true)}
          followUpsDueCount={followUpsDueCount}
          currentRole={currentRole}
        />

        {/* Scrollable View Container */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-8 space-y-4 sm:space-y-6 pb-24 md:pb-8">
          {loadingLeads && leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
              <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
              <p className="text-xs font-medium">Connecting to Supabase PostgreSQL database...</p>
            </div>
          ) : (
            <>
              {currentTab === 'dashboard' && (
                <DashboardView
                  leads={leads}
                  onSelectLead={handleOpenLeadDetail}
                  onNavigateToLeads={handleNavigateToLeads}
                  onNavigateToFollowUps={handleNavigateToFollowUps}
                  onRefresh={refreshLeads}
                  currentRole={currentRole}
                  currentUserName={currentUserName}
                  currentUserId={currentUserId}
                  onOpenAddStaffModal={() => setIsAddStaffModalOpen(true)}
                  onNavigateToStaff={() => setCurrentTab('staff')}
                />
              )}

              {currentTab === 'leads' && (
                <LeadsView
                  leads={leads}
                  onSelectLead={handleOpenLeadDetail}
                  onOpenAddModal={() => setIsAddModalOpen(true)}
                  onRefresh={refreshLeads}
                  initialStatusFilter={statusFilterForLeads}
                  currentRole={currentRole}
                  currentUserName={currentUserName}
                  currentUserId={currentUserId}
                />
              )}

              {currentTab === 'follow-ups' && (
                <FollowUpsView
                  leads={leads}
                  onSelectLead={handleOpenLeadDetail}
                  onRefresh={refreshLeads}
                  currentRole={currentRole}
                  currentUserName={currentUserName}
                  currentUserId={currentUserId}
                />
              )}

              {currentTab === 'messages' && (
                <MessagesView
                  leads={leads}
                  onSelectLead={handleOpenLeadDetail}
                  onRefresh={refreshLeads}
                />
              )}

              {currentTab === 'staff' && currentRole === 'admin' && (
                <StaffView
                  leads={leads}
                  onGoToLeadsPipeline={() => setCurrentTab('leads')}
                  onOpenAddStaffModal={() => setIsAddStaffModalOpen(true)}
                  currentRole={currentRole}
                  currentUserName={currentUserName}
                />
              )}

              {currentTab === 'settings' && currentRole === 'admin' && <SettingsView />}

              {currentTab === 'website-analytics' && (
                <WebsiteAnalyticsView embedded={true} />
              )}

              {currentTab === 'whatsapp-qr' && (
                <div className="p-4 sm:p-8 max-w-7xl mx-auto">
                  <ExperimentalQrCard standalone={true} />
                </div>
              )}
            </>
          )}
        </main>

        {/* Mobile Apple-style Bottom Navigation Bar */}
        <MobileBottomNav
          currentTab={currentTab}
          onSelectTab={(tab) => {
            if (tab === 'leads') setStatusFilterForLeads(undefined);
            setCurrentTab(tab);
          }}
          followUpsCount={followUpsDueCount}
          unreadMessagesCount={2}
          onOpenAddLeadModal={() => setIsAddModalOpen(true)}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          currentRole={currentRole}
        />
      </div>

      {/* Add Lead Modal */}
      <AddLeadModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onLeadCreated={handleLeadCreated}
        onSelectExistingLead={handleOpenLeadDetail}
      />

      {/* Add Staff Modal (Direct Staff Provisioning) */}
      <AddStaffModal
        isOpen={isAddStaffModalOpen}
        onClose={() => setIsAddStaffModalOpen(false)}
        onStaffCreated={() => {
          // If on staff tab, StaffView will refresh or state persists
        }}
      />

      {/* Telecaller Calling Sheet Excel Export Modal */}
      <TelecallerExportModal
        isOpen={isTelecallerExportOpen}
        onClose={() => setIsTelecallerExportOpen(false)}
        leads={leads}
        currentRole={currentRole}
        currentUserName={currentUserName}
      />

      {/* Lead Detail & Timeline & WhatsApp Dialog */}
      <LeadDetailDialog
        lead={selectedLead}
        isOpen={Boolean(selectedLead)}
        onClose={() => setSelectedLead(null)}
        onLeadUpdated={handleLeadUpdated}
        onLeadDeleted={handleLeadDeleted}
        currentRole={currentRole}
      />
    </div>
  );
}
