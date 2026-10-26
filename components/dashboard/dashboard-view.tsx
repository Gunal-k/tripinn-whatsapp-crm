'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Award, 
  CalendarClock, 
  CreditCard, 
  CheckCircle2, 
  TrendingUp, 
  Filter, 
  Compass, 
  ArrowRight,
  Clock,
  Sparkles,
  Calendar,
  PhoneCall,
  MessageCircle
} from 'lucide-react';
import { Lead, LeadFilters, LeadSource } from '../../lib/types/crm';
import { leadService } from '../../lib/services/leads';
import { formatPhoneDisplay } from '../../lib/utils/phone';

interface DashboardViewProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  onNavigateToLeads: (statusFilter?: string) => void;
  onNavigateToFollowUps: () => void;
  onRefresh: () => void;
  currentRole?: 'admin' | 'sales';
  currentUserName?: string;
  currentUserId?: string;
  onOpenAddStaffModal?: () => void;
  onNavigateToStaff?: () => void;
}

const STAGES = [
  { key: 'NEW', label: 'New', color: 'bg-blue-500' },
  { key: 'CONTACTED', label: 'Contacted', color: 'bg-indigo-500' },
  { key: 'QUALIFIED', label: 'Qualified', color: 'bg-emerald-500' },
  { key: 'FOLLOW_UP', label: 'Follow Up', color: 'bg-amber-500' },
  { key: 'PAYMENT_PENDING', label: 'Payment', color: 'bg-cyan-500' },
  { key: 'BOOKED', label: 'Booked', color: 'bg-teal-500' },
  { key: 'COMPLETED', label: 'Completed', color: 'bg-green-500' },
  { key: 'LOST', label: 'Lost', color: 'bg-rose-500' },
];

export function DashboardView({
  leads,
  onSelectLead,
  onNavigateToLeads,
  onNavigateToFollowUps,
  onRefresh,
  currentRole,
  currentUserName,
  currentUserId,
  onOpenAddStaffModal,
  onNavigateToStaff,
}: DashboardViewProps) {
  const [sourceFilter, setSourceFilter] = useState<LeadSource | 'ALL'>('ALL');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days' | 'this_month'>('all');
  const [currentTime, setCurrentTime] = useState<number>(0);

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

  const filteredMetrics = useMemo(() => {
    const filters: LeadFilters = {
      source: sourceFilter,
      dateRange: dateFilter,
    };
    return leadService.calculateMetrics(relevantLeads, filters);
  }, [relevantLeads, sourceFilter, dateFilter]);

  // Due / Overdue follow-ups
  const dueFollowUps = useMemo(() => {
    return relevantLeads
      .filter((l) => l.follow_up_date && !l.follow_up_completed && !l.is_archived)
      .sort((a, b) => new Date(a.follow_up_date!).getTime() - new Date(b.follow_up_date!).getTime())
      .slice(0, 5);
  }, [relevantLeads]);

  // Recent high intent leads
  const recentLeads = useMemo(() => {
    return [...relevantLeads]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [relevantLeads]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    STAGES.forEach((s) => (counts[s.key] = 0));
    relevantLeads.forEach((l) => {
      if (counts[l.lead_status] !== undefined) {
        counts[l.lead_status]++;
      }
    });
    return counts;
  }, [relevantLeads]);

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      {/* Filters Bar with Apple Segmented Control */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#0b132b] p-3.5 sm:p-4 rounded-2xl border border-white/[0.08] shadow-sm">
        <div className="flex items-center space-x-2 text-slate-300">
          <Filter className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-bold text-white tracking-tight">Performance Filters</span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Apple iOS Segmented Control for Date Filter */}
          <div className="flex items-center space-x-1 p-1 rounded-2xl bg-[#070d1a] border border-white/[0.06] overflow-x-auto scrollbar-none w-full sm:w-auto">
            {[
              { key: 'all', label: 'All Time' },
              { key: 'today', label: 'Today' },
              { key: '7days', label: '7 Days' },
              { key: '30days', label: '30 Days' },
              { key: 'this_month', label: 'This Month' },
            ].map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setDateFilter(d.key as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all active:scale-95 cursor-pointer flex-1 sm:flex-initial text-center ${
                  dateFilter === d.key
                    ? 'bg-[#111d3d] text-emerald-400 font-bold shadow-sm border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Source Filter Dropdown */}
          <div className="flex items-center space-x-1.5 bg-[#070d1a] px-3 py-2 rounded-2xl border border-white/[0.06] text-xs text-slate-300">
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as LeadSource | 'ALL')}
              className="bg-transparent text-slate-200 outline-none cursor-pointer"
            >
              <option value="ALL">All Channels</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Instagram">Instagram</option>
              <option value="Facebook">Facebook</option>
              <option value="website">Website</option>
              <option value="referral">Referral</option>
              <option value="manual">Manual</option>
            </select>
          </div>

          {(sourceFilter !== 'ALL' || dateFilter !== 'all') && (
            <button
              onClick={() => {
                setSourceFilter('ALL');
                setDateFilter('all');
              }}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold underline px-2 cursor-pointer active:scale-95"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Primary KPI Cards Grid (Apple HIG squircle cards with tactile feedback) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* 1. Total Leads */}
        <div 
          onClick={() => onNavigateToLeads()}
          className="bg-[#0b132b] p-4 rounded-2xl border border-white/[0.08] hover:border-emerald-500/30 transition-all cursor-pointer group shadow-sm active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Total Leads</span>
            <div className="w-7 h-7 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-emerald-400 group-hover:bg-emerald-500/10 transition">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white tracking-tight">
            {filteredMetrics.totalLeads}
          </div>
          <p className="text-[10px] text-slate-500 mt-1 font-medium">Across all channels</p>
        </div>

        {/* 2. New Leads */}
        <div 
          onClick={() => onNavigateToLeads('NEW')}
          className="bg-[#0b132b] p-4 rounded-2xl border border-blue-500/25 hover:border-blue-500/50 transition-all cursor-pointer group shadow-sm active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-blue-400">New Leads</span>
            <div className="w-7 h-7 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-400">
              <UserPlus className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-blue-300 tracking-tight">
            {filteredMetrics.newLeads}
          </div>
          <p className="text-[10px] text-blue-400/80 mt-1 font-medium">Awaiting contact</p>
        </div>

        {/* 3. Qualified Leads */}
        <div 
          onClick={() => onNavigateToLeads('QUALIFIED')}
          className="bg-gradient-to-br from-[#0b132b] to-[#0e2427] p-4 rounded-2xl border border-emerald-500/35 hover:border-emerald-500/60 transition-all cursor-pointer group shadow-md shadow-emerald-500/10 active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-emerald-400">Qualified</span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-300">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-300 tracking-tight">
            {filteredMetrics.qualifiedLeads}
          </div>
          <p className="text-[10px] text-emerald-400/90 mt-1 font-medium">Sales confirmed</p>
        </div>

        {/* 4. Follow-ups Due */}
        <div 
          onClick={onNavigateToFollowUps}
          className="bg-[#0b132b] p-4 rounded-2xl border border-amber-500/25 hover:border-amber-500/50 transition-all cursor-pointer group shadow-sm active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-amber-400">Call Queue</span>
            <div className="w-7 h-7 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-400">
              <CalendarClock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-300 tracking-tight">
            {filteredMetrics.followUpsDue}
          </div>
          <p className="text-[10px] text-amber-400/80 mt-1 font-medium">Action required</p>
        </div>

        {/* 5. Bookings Confirmed */}
        <div 
          onClick={() => onNavigateToLeads('BOOKED')}
          className="bg-[#0b132b] p-4 rounded-2xl border border-cyan-500/25 hover:border-cyan-500/50 transition-all cursor-pointer group shadow-sm active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-cyan-400">Booked</span>
            <div className="w-7 h-7 rounded-xl bg-cyan-500/15 flex items-center justify-center text-cyan-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-cyan-300 tracking-tight">
            {filteredMetrics.bookingsConfirmed}
          </div>
          <p className="text-[10px] text-cyan-400/80 mt-1 font-medium">Advance received</p>
        </div>

        {/* 6. Completed Bookings */}
        <div 
          onClick={() => onNavigateToLeads('COMPLETED')}
          className="bg-[#0b132b] p-4 rounded-2xl border border-green-500/25 hover:border-green-500/50 transition-all cursor-pointer group shadow-sm active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-green-400">Completed</span>
            <div className="w-7 h-7 rounded-xl bg-green-500/15 flex items-center justify-center text-green-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-green-300 tracking-tight">
            {filteredMetrics.completedBookings}
          </div>
          <p className="text-[10px] text-green-400/80 mt-1 font-medium">Tour fulfilled</p>
        </div>

        {/* 7. Conversion Rate */}
        <div className="bg-gradient-to-br from-[#0b132b] to-[#12233f] p-4 rounded-2xl border border-teal-500/35 shadow-sm col-span-2 md:col-span-4 lg:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-teal-300">Conversion</span>
            <div className="w-7 h-7 rounded-xl bg-teal-500/20 flex items-center justify-center text-teal-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white tracking-tight">
            {filteredMetrics.conversionRate}%
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(filteredMetrics.conversionRate, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Admin Quick Action: Staff Provisioning Banner */}
      {currentRole === 'admin' && onOpenAddStaffModal && (
        <div className="bg-gradient-to-r from-purple-950/40 via-[#0b132b] to-[#0b132b] p-4.5 rounded-xl border border-purple-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg shadow-purple-950/20">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white">Staff &amp; Team Management</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  ADMIN ONLY
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Add telecallers or administrator accounts directly from this dashboard without accessing Supabase.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2.5 w-full sm:w-auto">
            {onNavigateToStaff && (
              <button
                onClick={onNavigateToStaff}
                className="flex-1 sm:flex-none px-3.5 py-2 rounded-lg bg-[#111d3d] hover:bg-[#1a2c5a] text-slate-300 text-xs font-semibold border border-[#1e293b] transition cursor-pointer"
              >
                View Staff
              </button>
            )}
            <button
              onClick={onOpenAddStaffModal}
              className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#070d1a] text-xs font-bold shadow-md shadow-emerald-500/20 transition cursor-pointer active:scale-95"
            >
              <UserPlus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Staff Directly</span>
            </button>
          </div>
        </div>
      )}

      {/* Pipeline Funnel Distribution */}
      <div className="bg-[#0b132b] p-5 rounded-xl border border-[#1e293b]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              Lead Pipeline Stage Distribution
            </h3>
            <p className="text-xs text-slate-400">Active enquiries across sales workflow stages</p>
          </div>
          <button
            onClick={() => onNavigateToLeads()}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center space-x-1"
          >
            <span>View Full Pipeline</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {STAGES.map((stage) => {
            const count = stageCounts[stage.key] || 0;
            return (
              <button
                key={stage.key}
                onClick={() => onNavigateToLeads(stage.key)}
                className="p-3 rounded-lg bg-[#070d1a] border border-[#1e293b] hover:border-emerald-500/40 text-left transition"
              >
                <div className="flex items-center space-x-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${stage.color}`} />
                  <span className="text-[11px] font-semibold text-slate-300 truncate">
                    {stage.label}
                  </span>
                </div>
                <div className="text-lg font-bold text-white">{count}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Split Section: Due Follow-ups & Recent Enquiries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Due Follow-ups Box */}
        <div className="bg-[#0b132b] rounded-xl border border-[#1e293b] p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <CalendarClock className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">Upcoming & Overdue Follow-ups</h3>
            </div>
            <button
              onClick={onNavigateToFollowUps}
              className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center space-x-1"
            >
              <span>Manage All</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2.5 flex-1">
            {dueFollowUps.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-[#1e293b] rounded-lg">
                No pending follow-ups due. Great job staying on top of client communications!
              </div>
            ) : (
              dueFollowUps.map((item) => {
                const isOverdue = currentTime > 0 && item.follow_up_date
                  ? new Date(item.follow_up_date).getTime() < currentTime
                  : false;
                return (
                  <div
                    key={item.id}
                    onClick={() => onSelectLead(item)}
                    className="p-3 rounded-lg bg-[#070d1a] border border-[#1e293b] hover:border-amber-500/40 transition cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-xs text-white">{item.name}</span>
                        {isOverdue && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            Overdue
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">
                          {formatPhoneDisplay(item.phone)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 line-clamp-1">
                        {item.follow_up_notes || 'Scheduled customer consultation'}
                      </p>
                      <div className="flex items-center space-x-1 text-[10px] text-slate-500 mt-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(item.follow_up_date!).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                      <a
                        href={`tel:+${item.phone}`}
                        className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-black border border-emerald-500/30 transition min-w-[32px] min-h-[32px] flex items-center justify-center"
                        title={`Call ${item.name}`}
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                      </a>
                      <a
                        href={`https://wa.me/${item.phone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500 text-teal-400 hover:text-black border border-teal-500/30 transition min-w-[32px] min-h-[32px] flex items-center justify-center"
                        title={`WhatsApp ${item.name}`}
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => {
                          leadService.completeFollowUp(item.id);
                          onRefresh();
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold transition cursor-pointer min-h-[32px]"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Leads & CTWA Ads Box */}
        <div className="bg-[#0b132b] rounded-xl border border-[#1e293b] p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Recent Inquiries & CTWA Leads</h3>
            </div>
            <button
              onClick={() => onNavigateToLeads()}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center space-x-1"
            >
              <span>All Leads</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2.5 flex-1">
            {recentLeads.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectLead(item)}
                className="p-3 rounded-lg bg-[#070d1a] border border-[#1e293b] hover:border-emerald-500/40 transition cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-xs text-white">{item.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#111d3d] text-slate-300 border border-slate-700">
                      {item.lead_source}
                    </span>
                    {item.ctwa_clid && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium">
                        Meta Ad
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-emerald-400 font-medium mt-1 truncate max-w-xs">
                    {item.interested_destination || 'General Travel Enquiry'}
                  </p>

                  <div className="flex items-center space-x-3 text-[10px] text-slate-500 mt-1">
                    <span>{formatPhoneDisplay(item.phone)}</span>
                    {item.estimated_budget && (
                      <span>₹{Number(item.estimated_budget).toLocaleString('en-IN')}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                    <a
                      href={`tel:+${item.phone}`}
                      className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-black border border-emerald-500/30 transition min-w-[32px] min-h-[32px] flex items-center justify-center"
                      title={`Call ${item.name}`}
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                    </a>
                    <a
                      href={`https://wa.me/${item.phone}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500 text-teal-400 hover:text-black border border-teal-500/30 transition min-w-[32px] min-h-[32px] flex items-center justify-center"
                      title={`WhatsApp ${item.name}`}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.lead_status === 'QUALIFIED'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : item.lead_status === 'BOOKED'
                          ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                          : item.lead_status === 'NEW'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {item.lead_status}
                    </span>
                    <div className="text-[10px] text-slate-500 mt-1">
                      {new Date(item.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
