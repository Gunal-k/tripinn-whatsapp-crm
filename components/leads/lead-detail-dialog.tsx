'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Award, 
  MessageSquare, 
  History, 
  Check, 
  CheckCheck, 
  Sparkles,
  Send,
  UserCheck,
  Trash2,
  PhoneCall,
  MessageCircle,
  MapPin,
  Calendar,
  Users,
  CreditCard
} from 'lucide-react';
import { Lead, LeadPipelineStage, LeadActivity, WhatsAppMessage, UserProfile } from '../../lib/types/crm';
import { leadService } from '../../lib/services/leads';
import { staffService } from '../../lib/services/staff';
import { formatPhoneDisplay } from '../../lib/utils/phone';
import { showToast } from '../../lib/utils/swal';
import { DateTimePicker } from '../ui/date-time-picker';

interface LeadDetailDialogProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onLeadUpdated: (lead: Lead) => void;
  onLeadDeleted?: (leadId: string) => void;
  currentRole?: 'admin' | 'sales';
}

export function LeadDetailDialog({
  lead,
  isOpen,
  onClose,
  onLeadUpdated,
  onLeadDeleted,
  currentRole = 'admin',
}: LeadDetailDialogProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'chat'>('overview');
  const [newMessageText, setNewMessageText] = useState('');
  
  // Explicit Qualification Modal State
  const [showQualifyBox, setShowQualifyBox] = useState(false);
  const [qualifyCriteria, setQualifyCriteria] = useState({
    verifiedTravelDates: false,
    verifiedBudget: false,
    verifiedTravelers: false,
    qualificationNotes: '',
  });
  const [qualifyError, setQualifyError] = useState('');

  // Follow-up editing state
  const [followUpDateInput, setFollowUpDateInput] = useState('');
  const [followUpNotesInput, setFollowUpNotesInput] = useState('');

  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    if (!lead?.id) return;
    let active = true;

    // Fetch active staff (excluding administrators) for assignment dropdown
    staffService.getStaffMembers().then((list) => {
      if (active) {
        setStaffList(list.filter((s) => s.is_active && s.role !== 'admin'));
      }
    }).catch((err) => {
      console.warn('Failed to load staff list for assignment:', err);
    });

    const timer = setTimeout(() => {
      setFollowUpDateInput(lead.follow_up_date || '');
      setFollowUpNotesInput(lead.follow_up_notes || '');
      setLoadingDetails(true);

      Promise.all([
        leadService.getLeadActivities(lead.id),
        leadService.getLeadMessages(lead.id),
      ]).then(([acts, msgs]) => {
        if (active) {
          setActivities(acts);
          setMessages(msgs);
          setLoadingDetails(false);
        }
      }).catch(() => {
        if (active) setLoadingDetails(false);
      });
    }, 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [lead?.id, lead?.follow_up_date, lead?.follow_up_notes, lead?.updated_at]);

  const handleAssignStaff = async (newStaffId: string) => {
    if (!lead || isAssigning) return;
    if (currentRole !== 'admin') {
      showToast('Only administrators can assign leads.', 'error');
      return;
    }
    setIsAssigning(true);
    try {
      if (!newStaffId || newStaffId === 'unassigned') {
        const updated = await leadService.reassignLead(lead.id, '', 'Unassigned', '');
        if (updated) {
          onLeadUpdated(updated);
          const acts = await leadService.getLeadActivities(lead.id);
          setActivities(acts);
          showToast('Lead marked as Unassigned.', 'info');
        }
        return;
      }

      const target = staffList.find((s) => s.id === newStaffId);
      if (!target) return;

      const updated = await leadService.reassignLead(
        lead.id,
        target.id,
        target.full_name,
        target.email
      );

      if (updated) {
        onLeadUpdated(updated);
        const acts = await leadService.getLeadActivities(lead.id);
        setActivities(acts);
        showToast(`Lead assigned to ${target.full_name}!`, 'success');
      }
    } catch (err) {
      console.error('Assign staff error:', err);
      showToast(err instanceof Error ? err.message : 'Failed to assign lead', 'error');
    } finally {
      setIsAssigning(false);
    }
  };

  if (!isOpen || !lead) return null;

  const pipelineStages: LeadPipelineStage[] = [
    'NEW',
    'CONTACTED',
    'QUALIFIED',
    'FOLLOW_UP',
    'PAYMENT_PENDING',
    'BOOKED',
    'COMPLETED',
    'LOST',
  ];

  const handleStageChange = async (newStage: LeadPipelineStage) => {
    if (newStage === 'QUALIFIED' && lead.qualification_status !== 'QUALIFIED') {
      setShowQualifyBox(true);
      return;
    }
    const updated = await leadService.updateLeadStatus(lead.id, newStage);
    if (updated) {
      onLeadUpdated(updated);
      const acts = await leadService.getLeadActivities(lead.id);
      setActivities(acts);
    }
  };

  const handleExplicitQualify = async (e: React.FormEvent) => {
    e.preventDefault();
    setQualifyError('');

    if (!qualifyCriteria.verifiedBudget || !qualifyCriteria.verifiedTravelDates || !qualifyCriteria.verifiedTravelers) {
      setQualifyError('All three criteria (Travel Dates, Budget Viability, Traveler Count) must be verified.');
      return;
    }

    if (qualifyCriteria.qualificationNotes.trim().length < 5) {
      setQualifyError('Please enter explicit verification notes for the record.');
      return;
    }

    const res = await leadService.qualifyLead(lead.id, qualifyCriteria);
    if (res.success && res.lead) {
      onLeadUpdated(res.lead);
      setShowQualifyBox(false);
      const acts = await leadService.getLeadActivities(lead.id);
      setActivities(acts);
      showToast(
        res.metaCapiTriggered
          ? 'Lead Qualified & Meta CAPI event dispatched!'
          : 'Lead marked as Qualified!',
        'success'
      );
    } else {
      setQualifyError(res.message);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim()) return;

    await leadService.sendWhatsAppMessage(lead.id, newMessageText.trim());
    setNewMessageText('');
    const refreshedMsgs = await leadService.getLeadMessages(lead.id);
    const refreshedActs = await leadService.getLeadActivities(lead.id);
    setMessages(refreshedMsgs);
    setActivities(refreshedActs);
    onLeadUpdated({ ...lead, updated_at: new Date().toISOString() });
    showToast('WhatsApp message sent to Meta Cloud API', 'success');
  };

  const handleSaveFollowUp = async () => {
    try {
      if (!followUpDateInput && !followUpNotesInput.trim()) {
        showToast('Please select a follow-up date or enter notes.', 'error');
        return;
      }
      const updated = await leadService.scheduleFollowUp(lead.id, followUpDateInput || null, followUpNotesInput);
      if (updated) {
        onLeadUpdated(updated);
        const acts = await leadService.getLeadActivities(lead.id);
        setActivities(acts);
        showToast(
          followUpDateInput 
            ? 'Follow-up scheduled successfully!' 
            : 'Follow-up consultation notes updated!', 
          'success'
        );
      }
    } catch (err) {
      console.error('Follow-up schedule error:', err);
      showToast(err instanceof Error ? err.message : 'Failed to schedule follow-up', 'error');
    }
  };

  const handleDeleteLead = async () => {
    if (!lead) return;
    if (currentRole !== 'admin') {
      showToast('Only administrators can delete leads.', 'error');
      return;
    }
    try {
      const { showConfirmDialog } = await import('../../lib/utils/swal');
      const confirmed = await showConfirmDialog({
        title: 'Delete this Lead?',
        text: `Are you sure you want to permanently delete "${lead.name}"? This action cannot be undone.`,
        confirmButtonText: 'Yes, Delete Lead',
        cancelButtonText: 'Cancel',
        isDanger: true,
      });
      if (!confirmed) return;

      await leadService.deleteLead(lead.id);
      showToast('Lead deleted successfully.', 'success');
      if (onLeadDeleted) onLeadDeleted(lead.id);
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete lead', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md overflow-hidden">
      <div className="bg-[#0b132b] sm:border border-white/[0.08] rounded-t-[28px] sm:rounded-2xl w-full max-w-4xl h-[92dvh] sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl relative transition-all">
        {/* Apple iOS Sheet Grabber for Mobile */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center bg-[#070d1a] shrink-0">
          <div className="w-12 h-1.5 rounded-full bg-slate-600/50" />
        </div>

        {/* Modal Header */}
        <div className="p-3.5 sm:p-5 border-b border-[#1e293b] bg-[#070d1a] flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
          <div className="flex items-start sm:items-center space-x-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center text-sm font-bold text-emerald-300 shadow-sm shrink-0 mt-0.5 sm:mt-0">
              {lead.name.substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate max-w-[170px] xs:max-w-[220px] sm:max-w-none">{lead.name}</h2>
                <span className="text-[10px] sm:text-[11px] px-2.5 py-0.5 rounded-full bg-[#111d3d] text-emerald-400 font-semibold border border-emerald-500/20">
                  {lead.lead_source}
                </span>
                {lead.ctwa_clid && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 flex items-center space-x-1">
                    <Sparkles className="w-3 h-3" />
                    <span className="hidden xs:inline">Meta CTWA Ad</span>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
                <div className="flex items-center space-x-1.5">
                  <span className="font-mono text-slate-200">{formatPhoneDisplay(lead.phone)}</span>
                  {/* Quick Call & WhatsApp icon links in header for instant access */}
                  <a
                    href={`tel:+${lead.phone}`}
                    className="p-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-black border border-emerald-500/30 transition cursor-pointer min-w-[34px] min-h-[34px] flex items-center justify-center active:scale-95"
                    title={`Call ${lead.name}`}
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href={`https://wa.me/${lead.phone}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500 text-teal-400 hover:text-black border border-teal-500/30 transition cursor-pointer min-w-[34px] min-h-[34px] flex items-center justify-center active:scale-95"
                    title={`WhatsApp ${lead.name}`}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </a>
                </div>
                {lead.email && <span className="hidden sm:inline">• {lead.email}</span>}
                <span className="hidden sm:inline text-slate-600">•</span>
                <div className="flex items-center space-x-1.5 bg-[#111d3d] px-2.5 py-1 rounded-xl border border-slate-700/60 shadow-xs">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-[11px] text-slate-300 font-medium">Assigned:</span>
                  {currentRole === 'admin' ? (
                    <select
                      value={lead.assigned_salesperson_id || 'unassigned'}
                      disabled={isAssigning}
                      onChange={(e) => handleAssignStaff(e.target.value)}
                      className="bg-transparent text-emerald-400 font-semibold text-[11px] focus:outline-none cursor-pointer disabled:opacity-50"
                    >
                      <option value="unassigned" className="bg-[#0b132b] text-slate-400">
                        Unassigned
                      </option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id} className="bg-[#0b132b] text-white">
                          {s.full_name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-emerald-400 font-semibold text-[11px]">
                      {lead.assigned_salesperson?.full_name || 'Unassigned'}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* Mobile Close and Delete in top header */}
            <div className="flex items-center space-x-1.5 shrink-0 sm:hidden">
              {currentRole === 'admin' && (
                <button
                  onClick={handleDeleteLead}
                  className="w-8 h-8 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center transition cursor-pointer active:scale-95"
                  title="Delete Lead"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center transition cursor-pointer active:scale-95"
                title="Close Dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Desktop action buttons */}
          <div className="hidden sm:flex items-center space-x-2">
            {lead.qualification_status === 'QUALIFIED' ? (
              <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                <Award className="w-4 h-4 text-emerald-400" />
                <span>Verified Qualified</span>
              </div>
            ) : (
              <button
                onClick={() => setShowQualifyBox(true)}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#070d1a] text-xs font-bold transition shadow-sm cursor-pointer active:scale-95"
              >
                <Award className="w-4 h-4" />
                <span>Mark as Qualified</span>
              </button>
            )}

            {/* Delete Lead Button (Admin Only) */}
            {currentRole === 'admin' && (
              <button
                onClick={handleDeleteLead}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition cursor-pointer"
                title="Delete Lead"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Pipeline Stage Bar */}
        <div className="px-3 sm:px-5 py-2.5 bg-[#0a1024] border-b border-[#1e293b] overflow-x-auto scrollbar-none shrink-0">
          <div className="flex items-center space-x-1.5 min-w-max">
            {pipelineStages.map((stg) => {
              const isActive = lead.lead_status === stg;
              return (
                <button
                  key={stg}
                  onClick={() => handleStageChange(stg)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition cursor-pointer whitespace-nowrap active:scale-95 ${
                    isActive
                      ? 'bg-emerald-500 text-[#070d1a] font-bold shadow-md shadow-emerald-500/20'
                      : 'bg-[#111d3d] text-slate-400 hover:text-slate-200 hover:bg-[#16254e]'
                  }`}
                >
                  {stg.replace('_', ' ')}
                </button>
              );
            })}
          </div>
        </div>

        {/* Explicit Qualification Box */}
        {showQualifyBox && (
          <div className="p-4 mx-3 sm:mx-5 mt-4 rounded-2xl bg-gradient-to-r from-[#0d2826] to-[#0b1b36] border border-emerald-500/40 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2 text-emerald-300 font-bold text-xs">
                <Award className="w-4 h-4 text-emerald-400" />
                <span>Sales Qualification Criteria Verification</span>
              </div>
              <button 
                onClick={() => setShowQualifyBox(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer p-1"
              >
                Cancel
              </button>
            </div>
            <p className="text-[11px] text-slate-300 mb-3">
              Per Tripinn Holidays policy, verify client viability before marking qualified. This triggers the official Meta Conversions API event if this lead originated from a Click-to-WhatsApp ad.
            </p>

            <form onSubmit={handleExplicitQualify} className="space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="flex items-center space-x-2 text-xs text-slate-200 cursor-pointer p-2.5 rounded-xl bg-[#070d1a]/80 border border-slate-700/80">
                  <input
                    type="checkbox"
                    checked={qualifyCriteria.verifiedTravelDates}
                    onChange={(e) => setQualifyCriteria({ ...qualifyCriteria, verifiedTravelDates: e.target.checked })}
                    className="rounded text-emerald-500 focus:ring-0"
                  />
                  <span>Travel Dates Confirmed</span>
                </label>

                <label className="flex items-center space-x-2 text-xs text-slate-200 cursor-pointer p-2.5 rounded-xl bg-[#070d1a]/80 border border-slate-700/80">
                  <input
                    type="checkbox"
                    checked={qualifyCriteria.verifiedBudget}
                    onChange={(e) => setQualifyCriteria({ ...qualifyCriteria, verifiedBudget: e.target.checked })}
                    className="rounded text-emerald-500 focus:ring-0"
                  />
                  <span>Viable Budget (₹)</span>
                </label>

                <label className="flex items-center space-x-2 text-xs text-slate-200 cursor-pointer p-2.5 rounded-xl bg-[#070d1a]/80 border border-slate-700/80">
                  <input
                    type="checkbox"
                    checked={qualifyCriteria.verifiedTravelers}
                    onChange={(e) => setQualifyCriteria({ ...qualifyCriteria, verifiedTravelers: e.target.checked })}
                    className="rounded text-emerald-500 focus:ring-0"
                  />
                  <span>Travelers Count Verified</span>
                </label>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Verification note (e.g. Discussed with client, confirmed 5-star hotel requirements and Nov dates)"
                  value={qualifyCriteria.qualificationNotes}
                  onChange={(e) => setQualifyCriteria({ ...qualifyCriteria, qualificationNotes: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#070d1a] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {qualifyError && <p className="text-rose-400 text-[11px] font-medium">{qualifyError}</p>}

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#070d1a] font-bold text-xs transition cursor-pointer active:scale-95 shadow-md shadow-emerald-500/20"
                >
                  Confirm Qualification & Record CAPI
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Apple iOS Segmented Control Tabs */}
        <div className="px-3 sm:px-5 py-2.5 bg-[#0b132b] border-b border-[#1e293b] shrink-0">
          <div className="bg-[#070d1a] p-1 rounded-2xl flex items-center gap-1 border border-white/[0.06]">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition-all flex items-center justify-center space-x-1.5 min-h-[38px] active:scale-95 cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-[#111d3d] text-emerald-400 font-bold shadow-sm border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Lead Specs</span>
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition-all flex items-center justify-center space-x-1.5 min-h-[38px] active:scale-95 cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-[#111d3d] text-emerald-400 font-bold shadow-sm border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <span>WhatsApp</span>
              {loadingDetails ? (
                <div className="w-2.5 h-2.5 border border-emerald-400/40 border-t-emerald-400 rounded-full animate-spin" />
              ) : (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                  {messages.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('timeline')}
              className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl transition-all flex items-center justify-center space-x-1.5 min-h-[38px] active:scale-95 cursor-pointer ${
                activeTab === 'timeline'
                  ? 'bg-[#111d3d] text-emerald-400 font-bold shadow-sm border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5 shrink-0" />
              <span>Timeline</span>
              {loadingDetails ? (
                <div className="w-2.5 h-2.5 border border-slate-400/40 border-t-slate-400 rounded-full animate-spin" />
              ) : (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-bold">
                  {activities.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tab Contents (With generous pb-28 on mobile so sticky bottom bar doesn't obstruct inputs) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 pb-28 sm:pb-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              {/* Trip Package Specs - Apple Inset Grouped Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#070d1a] border border-white/[0.08] space-y-4 shadow-sm">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Travel &amp; Package Details</span>
                  </h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    Client Specs
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">Destination / Package</span>
                    <span className="font-bold text-white text-base tracking-tight flex items-center space-x-1.5">
                      <span>{lead.interested_destination || 'General Travel Enquiry'}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="p-2.5 rounded-xl bg-[#0b132b] border border-white/[0.05]">
                      <div className="flex items-center space-x-1 text-slate-400 text-[11px] mb-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>Dates</span>
                      </div>
                      <span className="font-semibold text-slate-100 text-xs truncate block">
                        {lead.travel_dates || 'Flexible'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#0b132b] border border-white/[0.05]">
                      <div className="flex items-center space-x-1 text-slate-400 text-[11px] mb-1">
                        <Users className="w-3 h-3 text-slate-400" />
                        <span>Travelers</span>
                      </div>
                      <span className="font-semibold text-slate-100 text-xs block">
                        {lead.number_of_travelers ? `${lead.number_of_travelers} Persons` : 'Not specified'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        Estimated Budget
                      </span>
                      <span className="font-extrabold text-emerald-400 text-base sm:text-lg">
                        {lead.estimated_budget
                          ? `₹${Number(lead.estimated_budget).toLocaleString('en-IN')}`
                          : 'Budget Unspecified'}
                      </span>
                    </div>
                    <CreditCard className="w-5 h-5 text-emerald-400/60" />
                  </div>

                  {lead.internal_notes && (
                    <div className="pt-2 border-t border-slate-800">
                      <span className="text-slate-400 block text-[11px] font-semibold mb-1">Internal Notes</span>
                      <p className="text-slate-300 text-xs italic bg-[#0b132b] p-3 rounded-xl border border-white/[0.05] leading-relaxed">
                        &ldquo;{lead.internal_notes}&rdquo;
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Follow-up & Meta CTWA Attribution */}
              <div className="space-y-4">
                {/* Follow-up Manager */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#070d1a] border border-white/[0.08] shadow-sm">
                  <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
                      <History className="w-3.5 h-3.5 text-amber-400" />
                      <span>Follow-up Consultation</span>
                    </h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${lead.follow_up_completed ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                      {lead.follow_up_completed ? 'Completed' : 'Pending'}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">Date &amp; Time</label>
                      <DateTimePicker
                        value={followUpDateInput}
                        onChange={(val) => setFollowUpDateInput(val)}
                        enableTime={true}
                        placeholder="Pick follow-up date & time"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">Agenda / Consultation Notes</label>
                      <input
                        type="text"
                        value={followUpNotesInput}
                        onChange={(e) => setFollowUpNotesInput(e.target.value)}
                        placeholder="e.g. Review customized Bali villa quotation with customer"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b132b] border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={handleSaveFollowUp}
                        className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition cursor-pointer min-h-[42px] flex items-center justify-center shadow-md shadow-amber-500/20 active:scale-95"
                      >
                        Update Follow-up Schedule
                      </button>
                    </div>
                  </div>
                </div>

                {/* Meta Attribution Card */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#070d1a] border border-emerald-500/25 shadow-sm">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-400 mb-3 pb-2 border-b border-white/[0.06]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Meta Ads Attribution &amp; Conversions</span>
                  </div>

                  <div className="text-xs space-y-2 text-slate-300">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[11px]">CTWA Click ID:</span>
                      <span className="font-mono text-emerald-400 text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 max-w-[180px] truncate">
                        {lead.ctwa_clid || 'N/A (Organic Lead)'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[11px]">Campaign ID:</span>
                      <span className="font-mono text-slate-400 text-[11px]">
                        {lead.meta_campaign_id || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[11px]">CAPI Status:</span>
                      <span className={`font-semibold text-[11px] ${lead.meta_conversion_sent ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {lead.meta_conversion_sent ? 'Delivered to Meta' : 'Not triggered'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WHATSAPP CHAT */}
          {activeTab === 'chat' && (
            <div className="flex flex-col h-[430px] sm:h-[450px]">
              {/* Message List */}
              <div className="flex-1 overflow-y-auto space-y-3 p-3.5 bg-[#070d1a] rounded-2xl border border-white/[0.08] mb-3 shadow-inner">
                {messages.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 text-xs">
                    No WhatsApp messages exchanged yet. Send a personalized itinerary update below.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isOutbound = msg.direction === 'outbound';
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs shadow-sm ${
                            isOutbound
                              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-br-xs'
                              : 'bg-[#111d3d] text-slate-200 border border-slate-700/60 rounded-bl-xs'
                          }`}
                        >
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.message_body}</p>
                          <div
                            className={`flex items-center justify-end space-x-1 text-[10px] mt-1.5 ${
                              isOutbound ? 'text-emerald-200/90' : 'text-slate-400'
                            }`}
                          >
                            <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {isOutbound && (
                              <span>
                                {msg.status === 'read' ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-cyan-200" />
                                ) : msg.status === 'delivered' ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-emerald-200" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Quick Suggestion Chips for Mobile Thumb Speed */}
              <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none pb-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setNewMessageText(`Hello ${lead.name}! Here is your personalized tour quotation from Tripinn Holidays. Let us know if you would like to proceed.`)}
                  className="px-2.5 py-1 rounded-full bg-[#111d3d] hover:bg-slate-700 text-slate-300 text-[10px] font-medium border border-white/[0.06] whitespace-nowrap active:scale-95 cursor-pointer"
                >
                  ✨ Send Itinerary
                </button>
                <button
                  type="button"
                  onClick={() => setNewMessageText('To lock this package at the offered pricing, please complete the token advance here: https://tripinnholidays.com/pay')}
                  className="px-2.5 py-1 rounded-full bg-[#111d3d] hover:bg-slate-700 text-slate-300 text-[10px] font-medium border border-white/[0.06] whitespace-nowrap active:scale-95 cursor-pointer"
                >
                  💳 Payment Link
                </button>
                <button
                  type="button"
                  onClick={() => setNewMessageText('Our destination specialist is ready for a quick 5-minute call. What time works best for you today?')}
                  className="px-2.5 py-1 rounded-full bg-[#111d3d] hover:bg-slate-700 text-slate-300 text-[10px] font-medium border border-white/[0.06] whitespace-nowrap active:scale-95 cursor-pointer"
                >
                  📞 Request Call
                </button>
              </div>

              {/* Message Composer */}
              <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Type WhatsApp reply to customer..."
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-2xl bg-[#070d1a] border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 min-h-[44px]"
                />
                <button
                  type="submit"
                  disabled={!newMessageText.trim()}
                  className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 disabled:opacity-50 text-[#070d1a] font-bold text-xs transition flex items-center space-x-1.5 cursor-pointer active:scale-95 shadow-md shadow-emerald-500/20 min-h-[44px]"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Send</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: ACTIVITY TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="space-y-4 p-2">
              {activities.map((act, idx) => (
                <div key={act.id} className="flex space-x-3 text-xs">
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-4 ring-emerald-500/20" />
                    {idx !== activities.length - 1 && (
                      <div className="w-0.5 flex-1 bg-slate-800 my-1" />
                    )}
                  </div>
                  <div className="pb-4 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{act.title}</span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(act.created_at).toLocaleString()}
                      </span>
                    </div>
                    {act.description && (
                      <p className="text-slate-300 text-xs mt-0.5 leading-relaxed bg-[#070d1a] p-2.5 rounded-xl border border-white/[0.04]">
                        {act.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mobile Sticky Quick-Action Bar */}
        <div className="sm:hidden fixed bottom-0 left-0 right-0 p-3 pb-[max(env(safe-area-inset-bottom,0px),0.75rem)] bg-[#070d1a]/95 backdrop-blur-xl border-t border-white/[0.08] flex items-center gap-2 z-30 shadow-2xl">
          <a
            href={`tel:+${lead.phone}`}
            className="flex-1 flex items-center justify-center space-x-1.5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-[#070d1a] font-bold text-xs shadow-md shadow-emerald-500/25 transition active:scale-95 min-h-[46px]"
          >
            <PhoneCall className="w-4 h-4 shrink-0" />
            <span>Call</span>
          </a>
          <a
            href={`https://wa.me/${lead.phone}`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 flex items-center justify-center space-x-1.5 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:brightness-110 text-[#070d1a] font-bold text-xs shadow-md shadow-teal-500/25 transition active:scale-95 min-h-[46px]"
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            <span>WhatsApp</span>
          </a>
          {lead.qualification_status !== 'QUALIFIED' ? (
            <button
              onClick={() => setShowQualifyBox(true)}
              className="px-4 py-3 rounded-2xl bg-[#111d3d] hover:bg-[#1a2c5a] text-emerald-400 border border-emerald-500/30 font-bold text-xs transition active:scale-95 flex items-center space-x-1 min-h-[46px]"
              title="Sales Qualification"
            >
              <Award className="w-4 h-4 shrink-0" />
              <span>Qualify</span>
            </button>
          ) : (
            <div className="px-4 py-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center space-x-1 min-h-[46px]">
              <Award className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Qualified</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
