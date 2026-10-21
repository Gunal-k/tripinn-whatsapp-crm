'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  CalendarClock, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Calendar
} from 'lucide-react';
import { Lead } from '../../lib/types/crm';
import { leadService } from '../../lib/services/leads';
import { formatPhoneDisplay } from '../../lib/utils/phone';

interface FollowUpsViewProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  onRefresh: () => void;
}

export function FollowUpsView({
  leads,
  onSelectLead,
  onRefresh,
}: FollowUpsViewProps) {
  const [rescheduleLeadId, setRescheduleLeadId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleNotes, setRescheduleNotes] = useState('');
  const [currentTime, setCurrentTime] = useState<number>(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentTime(Date.now());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const { overdue, today, upcoming, completed } = useMemo(() => {
    const nowTime = currentTime > 0 ? currentTime : 1776770000000;
    const now = new Date(nowTime);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = startOfToday + 24 * 60 * 60 * 1000;

    const over: Lead[] = [];
    const tod: Lead[] = [];
    const upc: Lead[] = [];
    const comp: Lead[] = [];

    leads.forEach((l) => {
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
  }, [leads, currentTime]);

  const handleComplete = (id: string) => {
    leadService.completeFollowUp(id);
    onRefresh();
  };

  const handleRescheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleLeadId || !rescheduleDate) return;
    leadService.scheduleFollowUp(rescheduleLeadId, rescheduleDate, rescheduleNotes);
    setRescheduleLeadId(null);
    setRescheduleDate('');
    setRescheduleNotes('');
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Reschedule Modal */}
      {rescheduleLeadId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#0b132b] border border-[#1e293b] rounded-xl max-w-md w-full p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Reschedule Consultation</h3>
            <p className="text-xs text-slate-400 mb-4">Set a revised contact date and customer follow-up notes.</p>

            <form onSubmit={handleRescheduleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">New Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#070d1a] border border-[#1e293b] text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Notes / Call Agenda</label>
                <input
                  type="text"
                  placeholder="e.g. Client requested callback after work hours"
                  value={rescheduleNotes}
                  onChange={(e) => setRescheduleNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#070d1a] border border-[#1e293b] text-xs text-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRescheduleLeadId(null)}
                  className="px-3 py-1.5 rounded bg-[#111d3d] text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition"
                >
                  Save Reschedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Summary KPI Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-[#0b132b] to-[#25101a] p-4 rounded-xl border border-rose-500/30">
          <div className="flex items-center justify-between text-xs font-semibold text-rose-400 mb-1">
            <span>Overdue Consultations</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-300">{overdue.length}</div>
          <p className="text-[10px] text-rose-400/70 mt-1">Immediate action needed</p>
        </div>

        <div className="bg-[#0b132b] p-4 rounded-xl border border-amber-500/30">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-400 mb-1">
            <span>Scheduled Today</span>
            <Calendar className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-300">{today.length}</div>
          <p className="text-[10px] text-amber-400/70 mt-1">Due before end of day</p>
        </div>

        <div className="bg-[#0b132b] p-4 rounded-xl border border-[#1e293b]">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-1">
            <span>Upcoming (Next 7 Days)</span>
            <CalendarClock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">{upcoming.length}</div>
          <p className="text-[10px] text-slate-500 mt-1">Planned consultations</p>
        </div>

        <div className="bg-[#0b132b] p-4 rounded-xl border border-emerald-500/20">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-400 mb-1">
            <span>Recently Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-300">{completed.length}</div>
          <p className="text-[10px] text-emerald-400/70 mt-1">Fulfilled reminders</p>
        </div>
      </div>

      {/* 1. OVERDUE FOLLOW-UPS LIST */}
      {overdue.length > 0 && (
        <div className="bg-[#0b132b] rounded-xl border border-rose-500/40 p-5">
          <div className="flex items-center space-x-2 text-rose-400 mb-4">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="text-sm font-bold text-white">Overdue Follow-ups</h3>
            <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-xs font-bold">
              {overdue.length}
            </span>
          </div>

          <div className="space-y-3">
            {overdue.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectLead(item)}
                className="p-3.5 rounded-xl bg-[#070d1a] border border-rose-500/30 hover:border-rose-500 transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-white">{item.name}</span>
                    <span className="text-xs text-slate-400 font-mono">{formatPhoneDisplay(item.phone)}</span>
                    <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[10px] font-bold">
                      Overdue since {new Date(item.follow_up_date!).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 font-medium">
                    {item.follow_up_notes || 'Pending follow-up note'}
                  </p>
                  <p className="text-[11px] text-emerald-400 mt-0.5">
                    Package: {item.interested_destination || 'General Enquiry'}
                  </p>
                </div>

                <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => {
                      setRescheduleLeadId(item.id);
                      setRescheduleDate(item.follow_up_date || '');
                      setRescheduleNotes(item.follow_up_notes || '');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#111d3d] hover:bg-[#1b2d5a] text-slate-200 text-xs font-semibold border border-slate-700 transition"
                  >
                    Reschedule
                  </button>
                  <button
                    onClick={() => handleComplete(item.id)}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition flex items-center space-x-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Done</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. TODAY'S FOLLOW-UPS */}
      <div className="bg-[#0b132b] rounded-xl border border-[#1e293b] p-5">
        <div className="flex items-center space-x-2 text-amber-400 mb-4">
          <Calendar className="w-5 h-5" />
          <h3 className="text-sm font-bold text-white">Today&apos;s Scheduled Consultations</h3>
          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
            {today.length}
          </span>
        </div>

        {today.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-[#1e293b] rounded-xl">
            No further follow-ups scheduled for today.
          </div>
        ) : (
          <div className="space-y-3">
            {today.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectLead(item)}
                className="p-3.5 rounded-xl bg-[#070d1a] border border-[#1e293b] hover:border-amber-500/50 transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-white">{item.name}</span>
                    <span className="text-xs text-slate-400 font-mono">{formatPhoneDisplay(item.phone)}</span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(item.follow_up_date!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">{item.follow_up_notes || 'Review trip customization'}</p>
                </div>

                <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => {
                      setRescheduleLeadId(item.id);
                      setRescheduleDate(item.follow_up_date || '');
                      setRescheduleNotes(item.follow_up_notes || '');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#111d3d] hover:bg-[#1b2d5a] text-slate-200 text-xs font-semibold border border-slate-700 transition"
                  >
                    Reschedule
                  </button>
                  <button
                    onClick={() => handleComplete(item.id)}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition flex items-center space-x-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Done</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. UPCOMING FOLLOW-UPS */}
      <div className="bg-[#0b132b] rounded-xl border border-[#1e293b] p-5">
        <div className="flex items-center space-x-2 text-slate-400 mb-4">
          <CalendarClock className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">Upcoming Consultations</h3>
          <span className="px-2 py-0.5 rounded-full bg-[#111d3d] text-slate-300 text-xs font-bold">
            {upcoming.length}
          </span>
        </div>

        {upcoming.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-[#1e293b] rounded-xl">
            No upcoming follow-ups queued.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {upcoming.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectLead(item)}
                className="p-3.5 rounded-xl bg-[#070d1a] border border-[#1e293b] hover:border-emerald-500/40 transition cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white">{item.name}</span>
                  <span className="text-[10px] text-emerald-400 font-semibold">
                    {new Date(item.follow_up_date!).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 line-clamp-1">{item.follow_up_notes || 'Consultation'}</p>
                <div className="text-[11px] text-slate-500 mt-2 flex justify-between">
                  <span>{formatPhoneDisplay(item.phone)}</span>
                  <span>{item.interested_destination || 'Travel package'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
