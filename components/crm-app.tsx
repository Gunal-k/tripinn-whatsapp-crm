'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar, NavigationTab } from './layout/sidebar';
import { TopNav } from './layout/top-nav';
import { DashboardView } from './dashboard/dashboard-view';
import { LeadsView } from './leads/leads-view';
import { FollowUpsView } from './follow-ups/follow-ups-view';
import { MessagesView } from './messages/messages-view';
import { SettingsView } from './settings/settings-view';
import { AddLeadModal } from './leads/add-lead-modal';
import { LeadDetailDialog } from './leads/lead-detail-dialog';
import { TelecallerExportModal } from './telecaller/telecaller-export-modal';
import { Lead } from '../lib/types/crm';
import { leadService } from '../lib/services/leads';

export default function CRMApp() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [currentRole, setCurrentRole] = useState<'admin' | 'salesperson'>('admin');
  const [currentUserName, setCurrentUserName] = useState<string>('Karan Johar (Admin)');
  const [leads, setLeads] = useState<Lead[]>(() => leadService.getLeads());
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTelecallerExportOpen, setIsTelecallerExportOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [statusFilterForLeads, setStatusFilterForLeads] = useState<string | undefined>(undefined);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const storedRole = localStorage.getItem('tripinn_current_role') as 'admin' | 'salesperson';
        const storedName = localStorage.getItem('tripinn_user_name');
        if (storedRole) {
          setCurrentRole(storedRole);
          setCurrentUserName(storedName || (storedRole === 'admin' ? 'Karan Johar (Admin)' : 'Priya Sharma'));
        }
      } catch {
        // ignore
      }
      setIsMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const toggleRole = () => {
    if (currentRole === 'admin') {
      setCurrentRole('salesperson');
      setCurrentUserName('Priya Sharma');
      localStorage.setItem('tripinn_current_role', 'salesperson');
      localStorage.setItem('tripinn_user_name', 'Priya Sharma');
      if (currentTab === 'settings') {
        setCurrentTab('dashboard');
      }
    } else {
      setCurrentRole('admin');
      setCurrentUserName('Karan Johar (Admin)');
      localStorage.setItem('tripinn_current_role', 'admin');
      localStorage.setItem('tripinn_user_name', 'Karan Johar (Admin)');
    }
  };

  // Refresh lead state when actions occur
  const refreshLeads = () => {
    const all = leadService.getLeads();
    setLeads([...all]);
    if (selectedLead) {
      const refreshedSelected = leadService.getLeadById(selectedLead.id);
      setSelectedLead(refreshedSelected);
    }
  };

  // Compute pending follow-ups count
  const followUpsDueCount = leads.filter(
    (l) => l.follow_up_date && !l.follow_up_completed && !l.is_archived
  ).length;

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

  if (!isMounted) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#070d1a] text-emerald-400">
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
    <div className="flex h-screen w-screen overflow-hidden bg-[#070d1a] text-slate-100 antialiased selection:bg-emerald-500 selection:text-black">
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
        onToggleRole={toggleRole}
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
          onOpenTelecallerExport={() => setIsTelecallerExportOpen(true)}
          followUpsDueCount={followUpsDueCount}
          currentRole={currentRole}
        />

        {/* Scrollable View Container */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {currentTab === 'dashboard' && (
            <DashboardView
              leads={leads}
              onSelectLead={handleOpenLeadDetail}
              onNavigateToLeads={handleNavigateToLeads}
              onNavigateToFollowUps={handleNavigateToFollowUps}
              onRefresh={refreshLeads}
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
            />
          )}

          {currentTab === 'follow-ups' && (
            <FollowUpsView
              leads={leads}
              onSelectLead={handleOpenLeadDetail}
              onRefresh={refreshLeads}
            />
          )}

          {currentTab === 'messages' && (
            <MessagesView
              leads={leads}
              onSelectLead={handleOpenLeadDetail}
              onRefresh={refreshLeads}
            />
          )}

          {currentTab === 'settings' && currentRole === 'admin' && <SettingsView />}
        </main>
      </div>

      {/* Add Lead Modal */}
      <AddLeadModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onLeadCreated={handleLeadCreated}
        onSelectExistingLead={handleOpenLeadDetail}
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
      />
    </div>
  );
}
