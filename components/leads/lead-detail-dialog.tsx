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
  UserCheck
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
}

export function LeadDetailDialog({
  lead,
  isOpen,
  onClose,
  onLeadUpdated,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#0b132b] border border-[#1e293b] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#1e293b] bg-[#070d1a] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-full bg-slate-800 border border-emerald-500/30 flex items-center justify-center text-sm font-bold text-white">
              {lead.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white">{lead.name}</h2>
                <span className="text-[11px] px-2 py-0.5 rounded bg-[#111d3d] text-emerald-400 font-semibold border border-emerald-500/20">
                  {lead.lead_source}
                </span>
                {lead.ctwa_clid && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 flex items-center space-x-1">
                    <Sparkles className="w-3 h-3" />
                    <span>Meta CTWA Ad</span>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
                <span>{formatPhoneDisplay(lead.phone)}</span>
                {lead.email && <span>• {lead.email}</span>}
                <span className="text-slate-600">•</span>
                <div className="flex items-center space-x-1.5 bg-[#111d3d] px-2.5 py-1 rounded-lg border border-slate-700/60 shadow-xs">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-[11px] text-slate-300 font-medium">Assigned to:</span>
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
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {lead.qualification_status === 'QUALIFIED' ? (
              <div className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                <Award className="w-4 h-4 text-emerald-400" />
                <span>Verified Qualified</span>
              </div>
            ) : (
              <button
                onClick={() => setShowQualifyBox(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#070d1a] text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <Award className="w-4 h-4" />
                <span>Mark as Qualified</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Pipeline Stage Bar */}
        <div className="px-5 py-3 bg-[#0a1024] border-b border-[#1e293b] overflow-x-auto">
          <div className="flex items-center space-x-1 min-w-max">
            {pipelineStages.map((stg) => {
              const isActive = lead.lead_status === stg;
              return (
                <button
                  key={stg}
                  onClick={() => handleStageChange(stg)}
                  className={`px-3 py-1 rounded text-[11px] font-semibold transition cursor-pointer ${
                    isActive
                      ? 'bg-emerald-500 text-[#070d1a] shadow-xs'
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
          <div className="p-4 mx-5 mt-4 rounded-xl bg-gradient-to-r from-[#0d2826] to-[#0b1b36] border border-emerald-500/40">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2 text-emerald-300 font-bold text-xs">
                <Award className="w-4 h-4 text-emerald-400" />
                <span>Sales Qualification Criteria Verification</span>
              </div>
              <button 
                onClick={() => setShowQualifyBox(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Cancel
              </button>
            </div>
            <p className="text-[11px] text-slate-300 mb-3">
              Per Tripinn Holidays policy, verify client viability before marking qualified. This triggers the official Meta Conversions API event if this lead originated from a Click-to-WhatsApp ad.
            </p>

            <form onSubmit={handleExplicitQualify} className="space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="flex items-center space-x-2 text-xs text-slate-200 cursor-pointer p-2 rounded bg-[#070d1a]/80 border border-slate-700">
                  <input
                    type="checkbox"
                    checked={qualifyCriteria.verifiedTravelDates}
                    onChange={(e) => setQualifyCriteria({ ...qualifyCriteria, verifiedTravelDates: e.target.checked })}
                    className="rounded text-emerald-500 focus:ring-0"
                  />
                  <span>Travel Dates Confirmed</span>
                </label>

                <label className="flex items-center space-x-2 text-xs text-slate-200 cursor-pointer p-2 rounded bg-[#070d1a]/80 border border-slate-700">
                  <input
                    type="checkbox"
                    checked={qualifyCriteria.verifiedBudget}
                    onChange={(e) => setQualifyCriteria({ ...qualifyCriteria, verifiedBudget: e.target.checked })}
                    className="rounded text-emerald-500 focus:ring-0"
                  />
                  <span>Viable Budget (₹)</span>
                </label>

                <label className="flex items-center space-x-2 text-xs text-slate-200 cursor-pointer p-2 rounded bg-[#070d1a]/80 border border-slate-700">
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
                  className="w-full px-3 py-1.5 rounded bg-[#070d1a] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {qualifyError && <p className="text-rose-400 text-[11px] font-medium">{qualifyError}</p>}

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-[#070d1a] font-bold text-xs transition cursor-pointer"
                >
                  Confirm Qualification & Record CAPI
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-[#1e293b] px-5 bg-[#0b132b]">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center space-x-2 ${
              activeTab === 'overview'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Lead Specifications</span>
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center space-x-2 ${
              activeTab === 'chat'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>WhatsApp Chat</span>
            {loadingDetails ? (
              <div className="w-2.5 h-2.5 border border-emerald-400/40 border-t-emerald-400 rounded-full animate-spin" />
            ) : (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400">
                {messages.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition flex items-center space-x-2 ${
              activeTab === 'timeline'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Activity Timeline</span>
            {loadingDetails ? (
              <div className="w-2.5 h-2.5 border border-slate-400/40 border-t-slate-400 rounded-full animate-spin" />
            ) : (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
                {activities.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Trip Package Specs */}
              <div className="p-4 rounded-xl bg-[#070d1a] border border-[#1e293b] space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Travel & Package Details
                </h3>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Destination / Package</span>
                    <span className="font-semibold text-white text-sm">
                      {lead.interested_destination || 'Not specified'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Tentative Dates</span>
                      <span className="font-medium text-slate-200">
                        {lead.travel_dates || 'Flexible'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px]">Travelers</span>
                      <span className="font-medium text-slate-200">
                        {lead.number_of_travelers ? `${lead.number_of_travelers} Persons` : 'Not specified'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-1">
                    <span className="text-slate-400 block text-[11px]">Estimated Budget</span>
                    <span className="font-bold text-emerald-300 text-sm">
                      {lead.estimated_budget
                        ? `₹${Number(lead.estimated_budget).toLocaleString('en-IN')}`
                        : 'Unspecified'}
                    </span>
                  </div>

                  {lead.internal_notes && (
                    <div className="pt-2 border-t border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Internal Notes</span>
                      <p className="text-slate-300 text-xs italic">{lead.internal_notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Follow-up & Meta CTWA Attribution */}
              <div className="space-y-4">
                {/* Follow-up Manager */}
                <div className="p-4 rounded-xl bg-[#070d1a] border border-[#1e293b]">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
                    Follow-up Consultation
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-0.5">Date &amp; Time</label>
                      <DateTimePicker
                        value={followUpDateInput}
                        onChange={(val) => setFollowUpDateInput(val)}
                        enableTime={true}
                        placeholder="Pick follow-up date & time"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-0.5">Agenda / Notes</label>
                      <input
                        type="text"
                        value={followUpNotesInput}
                        onChange={(e) => setFollowUpNotesInput(e.target.value)}
                        placeholder="e.g. Review customized itinerary with client"
                        className="w-full px-2.5 py-1.5 rounded bg-[#0b132b] border border-slate-700 text-xs text-white"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-400">
                        Status:{' '}
                        <strong className={lead.follow_up_completed ? 'text-green-400' : 'text-amber-400'}>
                          {lead.follow_up_completed ? 'Completed' : 'Pending'}
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={handleSaveFollowUp}
                        className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition cursor-pointer"
                      >
                        Update Follow-up
                      </button>
                    </div>
                  </div>
                </div>

                {/* Meta Attribution Card */}
                <div className="p-4 rounded-xl bg-[#070d1a] border border-emerald-500/20">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-400 mb-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Meta Ads Attribution & Conversions</span>
                  </div>

                  <div className="text-xs space-y-1 text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">CTWA Click ID:</span>
                      <span className="font-mono text-emerald-400 text-[11px]">
                        {lead.ctwa_clid || 'N/A (Organic Lead)'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Campaign ID:</span>
                      <span className="font-mono text-slate-400 text-[11px]">
                        {lead.meta_campaign_id || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">CAPI Event Status:</span>
                      <span className="font-semibold text-emerald-400">
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
            <div className="flex flex-col h-[400px]">
              {/* Message List */}
              <div className="flex-1 overflow-y-auto space-y-3 p-3 bg-[#070d1a] rounded-xl border border-[#1e293b] mb-3">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    No WhatsApp messages exchanged yet. Use the composer below to message this customer.
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
                          className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs shadow-sm ${
                            isOutbound
                              ? 'bg-emerald-600/90 text-white rounded-br-xs'
                              : 'bg-[#111d3d] text-slate-200 border border-slate-700/60 rounded-bl-xs'
                          }`}
                        >
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.message_body}</p>
                          <div
                            className={`flex items-center justify-end space-x-1 text-[10px] mt-1 ${
                              isOutbound ? 'text-emerald-200/80' : 'text-slate-400'
                            }`}
                          >
                            <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {isOutbound && (
                              <span>
                                {msg.status === 'read' ? (
                                  <CheckCheck className="w-3 h-3 text-cyan-300" />
                                ) : msg.status === 'delivered' ? (
                                  <CheckCheck className="w-3 h-3 text-emerald-200" />
                                ) : (
                                  <Check className="w-3 h-3" />
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

              {/* Message Composer */}
              <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Type WhatsApp reply to customer..."
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#070d1a] border border-[#1e293b] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={!newMessageText.trim()}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-[#070d1a] font-bold text-xs transition flex items-center space-x-1 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: ACTIVITY TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
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
                      <p className="text-slate-300 text-xs mt-0.5 leading-relaxed">
                        {act.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
