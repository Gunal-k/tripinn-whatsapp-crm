'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  CalendarClock, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Calendar,
  PhoneCall,
  MessageCircle,
  X
} from 'lucide-react';
import { Lead } from '../../lib/types/crm';
import { leadService } from '../../lib/services/leads';
import { formatPhoneDisplay } from '../../lib/utils/phone';
import { showToast } from '../../lib/utils/swal';
import { DateTimePicker } from '../ui/date-time-picker';

interface FollowUpsViewProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  onRefresh: () => void;
  currentRole?: 'admin' | 'sales';
  currentUserName?: string;
  currentUserId?: string;
}

export function FollowUpsView({
  leads,
  onSelectLead,
  onRefresh,
  currentRole = 'admin',
  currentUserName,
  currentUserId,
}: FollowUpsViewProps) {
  const [rescheduleLeadId, setRescheduleLeadId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleNotes, setRescheduleNotes] = useState('');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [mobileTab, setMobileTab] = useState<'all' | 'overdue' | 'today' | 'upcoming'>('all');

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentTime(Date.now());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const relevantLeads = useMemo(() => {
    if (currentRole !== 'sales') return leads;
    return leads.filter((l) => {
      if (currentUserId && (l.assigned_salesperson_id === currentUserId || l.assigned_salesperson?.id === currentUserId)) {
        return true;
      }
      if (currentUserName && l.assigned_salesperson?.full_name &&
          l.assigned_salesperson.full_name !== 'Assigned Staff' &&
          l.assigned_salesperson.full_name.toLowerCase() === currentUserName.toLowerCase()) {
        return true;
      }
      if (currentRole === 'sales' && l.assigned_salesperson_id && !currentUserId) {
        return true;
      }
      return false;
    });
  }, [leads, currentRole, currentUserId, currentUserName]);

  const { overdue, today, upcoming, completed } = useMemo(() => {
    const nowTime = currentTime > 0 ? currentTime : 1776770000000;
    const now = new Date(nowTime);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = startOfToday + 24 * 60 * 60 * 1000;

    const over: Lead[] = [];
    const tod: Lead[] = [];
    const upc: Lead[] = [];
    const comp: Lead[] = [];

    relevantLeads.forEach((l) => {
      if (!l.follow_up_date) return;
      if (l.follow_up_completed) {
        comp.push(l);
        return;
      }

      const fTime = new Date(l.follow_up_date).getTime();
      if (fTime < now.getTime()) {
        over.push(l);
      } else if (fTime >= startOfToday && fTime < endOfToday) {
        tod.push(l);
      } else {
        upc.push(l);
      }
    });

    return {
      overdue: over.sort((a, b) => new Date(a.follow_up_date!).getTime() - new Date(b.follow_up_date!).getTime()),
      today: tod.sort((a, b) => new Date(a.follow_up_date!).getTime() - new Date(b.follow_up_date!).getTime()),
      upcoming: upc.sort((a, b) => new Date(a.follow_up_date!).getTime() - new Date(b.follow_up_date!).getTime()),
      completed: comp.slice(0, 10),
    };
  }, [relevantLeads, currentTime]);

  const handleComplete = async (id: string) => {
    await leadService.completeFollowUp(id);
    showToast('Follow-up marked as completed!', 'success');
    onRefresh();
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleLeadId || !rescheduleDate) return;
    try {
      await leadService.scheduleFollowUp(rescheduleLeadId, rescheduleDate, rescheduleNotes);
      showToast('Consultation rescheduled successfully!', 'success');
      setRescheduleLeadId(null);
      setRescheduleDate('');
      setRescheduleNotes('');
      onRefresh();
    } catch (err) {
      console.error('Reschedule follow-up error:', err);
      showToast(err instanceof Error ? err.message : 'Failed to reschedule consultation', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Apple-style Reschedule Bottom Sheet Modal on mobile / centered dialog on desktop */}
      {rescheduleLeadId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0b132b] border-t sm:border border-white/10 rounded-t-[28px] sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl flex flex-col pb-[max(env(safe-area-inset-bottom,0px),1.25rem)] sm:pb-6 animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-300">
            {/* iOS Grabber Pill */}
            <div className="w-12 h-1.5 rounded-full bg-white/20 mx-auto mb-4 sm:hidden shrink-0" />

            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">Reschedule Consultation</h3>
                <p className="text-xs text-slate-400">Set a revised contact date and customer follow-up notes.</p>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleLeadId(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="space-y-4 mt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">New Date &amp; Time</label>
                <DateTimePicker
                  value={rescheduleDate}
                  onChange={(val) => setRescheduleDate(val)}
                  enableTime={true}
                  placeholder="Pick new date & time"
                  required={true}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Notes / Call Agenda</label>
                <input
                  type="text"
                  placeholder="e.g. Client requested callback after work hours"
                  value={rescheduleNotes}
                  onChange={(e) => setRescheduleNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#070d1a] border border-[#1e293b] text-xs text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRescheduleLeadId(null)}
                  className="min-h-[46px] rounded-xl bg-[#111d3d] hover:bg-[#1a2c5a] text-slate-300 text-xs font-semibold active:scale-95 transition flex items-center justify-center cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[46px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition flex items-center justify-center shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
                >
                  Save Reschedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Summary KPI Counters - Apple Squircle Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div 
          onClick={() => setMobileTab('overdue')}
          className="bg-gradient-to-br from-[#0b132b] to-[#25101a] p-3.5 sm:p-4 rounded-2xl border border-rose-500/30 cursor-pointer active:scale-98 transition-all shadow-sm"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-rose-400 mb-1">
            <span className="truncate">Overdue</span>
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-rose-300">{overdue.length}</div>
          <p className="text-[10px] text-rose-400/70 mt-1 truncate">Action required</p>
        </div>

        <div 
          onClick={() => setMobileTab('today')}
          className="bg-[#0b132b] p-3.5 sm:p-4 rounded-2xl border border-amber-500/30 cursor-pointer active:scale-98 transition-all shadow-sm"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-amber-400 mb-1">
            <span className="truncate">Due Today</span>
            <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-amber-300">{today.length}</div>
          <p className="text-[10px] text-amber-400/70 mt-1 truncate">Before end of day</p>
        </div>

        <div 
          onClick={() => setMobileTab('upcoming')}
          className="bg-[#0b132b] p-3.5 sm:p-4 rounded-2xl border border-white/[0.08] cursor-pointer active:scale-98 transition-all shadow-sm"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-1">
            <span className="truncate">Upcoming 7 Days</span>
            <CalendarClock className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">{upcoming.length}</div>
          <p className="text-[10px] text-slate-500 mt-1 truncate">Planned calls</p>
        </div>

        <div 
          onClick={() => setMobileTab('all')}
          className="bg-[#0b132b] p-3.5 sm:p-4 rounded-2xl border border-emerald-500/20 cursor-pointer active:scale-98 transition-all shadow-sm"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-400 mb-1">
            <span className="truncate">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-300">{completed.length}</div>
          <p className="text-[10px] text-emerald-400/70 mt-1 truncate">Fulfilled reminders</p>
        </div>
      </div>

      {/* Apple-style iOS Segmented Control on Mobile */}
      <div className="flex sm:hidden p-1 bg-black/30 dark:bg-black/30 backdrop-blur-md rounded-2xl border border-white/[0.08] gap-1 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setMobileTab('all')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            mobileTab === 'all'
              ? 'bg-white text-black shadow-sm font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          All ({overdue.length + today.length + upcoming.length})
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('overdue')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center justify-center gap-1 ${
            mobileTab === 'overdue'
              ? 'bg-rose-500 text-white shadow-sm font-bold'
              : 'text-rose-400 hover:text-rose-300'
          }`}
        >
          Overdue ({overdue.length})
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('today')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center justify-center gap-1 ${
            mobileTab === 'today'
              ? 'bg-amber-500 text-black shadow-sm font-bold'
              : 'text-amber-400 hover:text-amber-300'
          }`}
        >
          Today ({today.length})
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('upcoming')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center justify-center gap-1 ${
            mobileTab === 'upcoming'
              ? 'bg-emerald-500 text-black shadow-sm font-bold'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          Upcoming ({upcoming.length})
        </button>
      </div>

      {/* 1. OVERDUE FOLLOW-UPS LIST */}
      {overdue.length > 0 && (mobileTab === 'all' || mobileTab === 'overdue') && (
        <div className="bg-[#0b132b] rounded-2xl border border-rose-500/40 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center space-x-2 text-rose-400 mb-3 sm:mb-4">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h3 className="text-sm font-bold text-white tracking-tight">Overdue Follow-ups</h3>
            <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-xs font-bold">
              {overdue.length}
            </span>
          </div>

          <div className="space-y-3">
            {overdue.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectLead(item)}
                className="p-3.5 sm:p-4 rounded-2xl bg-[#070d1a] border border-rose-500/30 hover:border-rose-500 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-rose-500/15 text-rose-400 font-bold text-xs flex items-center justify-center shrink-0 border border-rose-500/25">
                    {(item.name || 'G').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-white">{item.name}</span>
                      <span className="text-xs text-slate-400 font-mono">{formatPhoneDisplay(item.phone)}</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-bold">
                        Overdue since {new Date(item.follow_up_date!).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 font-medium">
                      {item.follow_up_notes || 'Pending follow-up note'}
                    </p>
                    <p className="text-[11px] text-emerald-400 mt-0.5 font-medium">
                      Package: {item.interested_destination || 'General Enquiry'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 pt-1 md:pt-0" onClick={(e) => e.stopPropagation()}>
                  <a
                    href={`tel:+${item.phone}`}
                    className="min-h-[44px] px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-black border border-emerald-500/30 text-xs font-bold transition flex items-center justify-center space-x-1.5 active:scale-95"
                    title={`Call ${item.name}`}
                  >
                    <PhoneCall className="w-4 h-4" />
                    <span>Call</span>
                  </a>
                  <a
                    href={`https://wa.me/${item.phone}`}
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-[44px] px-3 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500 text-teal-400 hover:text-black border border-teal-500/30 text-xs font-bold transition flex items-center justify-center space-x-1.5 active:scale-95"
                    title={`WhatsApp ${item.name}`}
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>WhatsApp</span>
                  </a>
                  <button
                    onClick={() => {
                      setRescheduleLeadId(item.id);
                      setRescheduleDate(item.follow_up_date || '');
                      setRescheduleNotes(item.follow_up_notes || '');
                    }}
                    className="min-h-[44px] px-3 py-2 rounded-xl bg-[#111d3d] hover:bg-[#1b2d5a] text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center justify-center active:scale-95 cursor-pointer"
                  >
                    Reschedule
                  </button>
                  <button
                    onClick={() => handleComplete(item.id)}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Done</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. TODAY'S FOLLOW-UPS */}
      {(mobileTab === 'all' || mobileTab === 'today') && (
        <div className="bg-[#0b132b] rounded-2xl border border-white/[0.08] p-4 sm:p-5 shadow-sm">
          <div className="flex items-center space-x-2 text-amber-400 mb-3 sm:mb-4">
            <Calendar className="w-5 h-5 shrink-0" />
            <h3 className="text-sm font-bold text-white tracking-tight">Today&apos;s Scheduled Consultations</h3>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
              {today.length}
            </span>
          </div>

          {today.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-[#1e293b] rounded-2xl">
              No further follow-ups scheduled for today.
            </div>
          ) : (
            <div className="space-y-3">
              {today.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelectLead(item)}
                  className="p-3.5 sm:p-4 rounded-2xl bg-[#070d1a] border border-white/[0.08] hover:border-amber-500/50 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500/15 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0 border border-amber-500/25">
                      {(item.name || 'G').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-white">{item.name}</span>
                        <span className="text-xs text-slate-400 font-mono">{formatPhoneDisplay(item.phone)}</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(item.follow_up_date!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">{item.follow_up_notes || 'Review trip customization'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 pt-1 md:pt-0" onClick={(e) => e.stopPropagation()}>
                    <a
                      href={`tel:+${item.phone}`}
                      className="min-h-[44px] px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-black border border-emerald-500/30 text-xs font-bold transition flex items-center justify-center space-x-1.5 active:scale-95"
                      title={`Call ${item.name}`}
                    >
                      <PhoneCall className="w-4 h-4" />
                      <span>Call</span>
                    </a>
                    <a
                      href={`https://wa.me/${item.phone}`}
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-[44px] px-3 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500 text-teal-400 hover:text-black border border-teal-500/30 text-xs font-bold transition flex items-center justify-center space-x-1.5 active:scale-95"
                      title={`WhatsApp ${item.name}`}
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>WhatsApp</span>
                    </a>
                    <button
                      onClick={() => {
                        setRescheduleLeadId(item.id);
                        setRescheduleDate(item.follow_up_date || '');
                        setRescheduleNotes(item.follow_up_notes || '');
                      }}
                      className="min-h-[44px] px-3 py-2 rounded-xl bg-[#111d3d] hover:bg-[#1b2d5a] text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center justify-center active:scale-95 cursor-pointer"
                    >
                      Reschedule
                    </button>
                    <button
                      onClick={() => handleComplete(item.id)}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Done</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. UPCOMING FOLLOW-UPS */}
      {(mobileTab === 'all' || mobileTab === 'upcoming') && (
        <div className="bg-[#0b132b] rounded-2xl border border-white/[0.08] p-4 sm:p-5 shadow-sm">
          <div className="flex items-center space-x-2 text-slate-400 mb-3 sm:mb-4">
            <CalendarClock className="w-5 h-5 text-emerald-400 shrink-0" />
            <h3 className="text-sm font-bold text-white tracking-tight">Upcoming Consultations</h3>
            <span className="px-2 py-0.5 rounded-full bg-[#111d3d] text-slate-300 text-xs font-bold">
              {upcoming.length}
            </span>
          </div>

          {upcoming.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-[#1e293b] rounded-2xl">
              No upcoming follow-ups queued.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {upcoming.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelectLead(item)}
                  className="p-3.5 sm:p-4 rounded-2xl bg-[#070d1a] border border-white/[0.08] hover:border-emerald-500/40 transition-all cursor-pointer shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">{item.name}</span>
                    <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                      {new Date(item.follow_up_date!).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 line-clamp-1">{item.follow_up_notes || 'Consultation'}</p>
                  <div className="text-[11px] text-slate-500 mt-2 flex justify-between">
                    <span>{formatPhoneDisplay(item.phone)}</span>
                    <span>{item.interested_destination || 'Travel package'}</span>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <a
                      href={`tel:+${item.phone}`}
                      className="flex-1 min-h-[44px] py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-black border border-emerald-500/30 text-xs font-bold transition flex items-center justify-center space-x-1.5 active:scale-95"
                      title={`Call ${item.name}`}
                    >
                      <PhoneCall className="w-4 h-4" />
                      <span>Call</span>
                    </a>
                    <a
                      href={`https://wa.me/${item.phone}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 min-h-[44px] py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500 text-teal-400 hover:text-black border border-teal-500/30 text-xs font-bold transition flex items-center justify-center space-x-1.5 active:scale-95"
                      title={`WhatsApp ${item.name}`}
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>WhatsApp</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
