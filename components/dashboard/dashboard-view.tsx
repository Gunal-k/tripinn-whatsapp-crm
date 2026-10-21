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
  Calendar
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

  const filteredMetrics = useMemo(() => {
    // Touch leads.length so the hook properly tracks lead array updates
    if (leads.length < 0) return leadService.getDashboardMetrics();
    const filters: LeadFilters = {
      source: sourceFilter,
      dateRange: dateFilter,
    };
    return leadService.getDashboardMetrics(filters);
  }, [leads, sourceFilter, dateFilter]);

  // Due / Overdue follow-ups
  const dueFollowUps = useMemo(() => {
    return leads
      .filter((l) => l.follow_up_date && !l.follow_up_completed && !l.is_archived)
      .sort((a, b) => new Date(a.follow_up_date!).getTime() - new Date(b.follow_up_date!).getTime())
      .slice(0, 5);
  }, [leads]);

  // Recent high intent leads
  const recentLeads = useMemo(() => {
    return [...leads]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [leads]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    STAGES.forEach((s) => (counts[s.key] = 0));
    leads.forEach((l) => {
      if (counts[l.lead_status] !== undefined) {
        counts[l.lead_status]++;
      }
    });
    return counts;
  }, [leads]);

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0b132b] p-4 rounded-xl border border-[#1e293b]">
        <div className="flex items-center space-x-2 text-slate-300">
          <Filter className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold">Dashboard Filters</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Date Filter */}
          <div className="flex items-center space-x-1.5 bg-[#070d1a] px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as 'all' | 'today' | '7days' | '30days' | 'this_month')}
              className="bg-transparent text-slate-200 outline-none cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="this_month">This Month</option>
            </select>
          </div>

          {/* Source Filter */}
          <div className="flex items-center space-x-1.5 bg-[#070d1a] px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-300">
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as LeadSource | 'ALL')}
              className="bg-transparent text-slate-200 outline-none cursor-pointer"
            >
              <option value="ALL">All Sources</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Instagram">Instagram</option>
              <option value="Facebook">Facebook</option>
              <option value="website">Website</option>
              <option value="referral">Referral</option>
              <option value="manual">Manual Entry</option>
            </select>
          </div>

          {(sourceFilter !== 'ALL' || dateFilter !== 'all') && (
            <button
              onClick={() => {
                setSourceFilter('ALL');
                setDateFilter('all');
              }}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium underline"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Primary KPI Cards Grid (7 Key Metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* 1. Total Leads */}
        <div 
          onClick={() => onNavigateToLeads()}
          className="bg-[#0b132b] p-4 rounded-xl border border-[#1e293b] hover:border-slate-700 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Total Leads</span>
            <Users className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 transition" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {filteredMetrics.totalLeads}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Across all channels</p>
        </div>

        {/* 2. New Leads */}
        <div 
          onClick={() => onNavigateToLeads('NEW')}
          className="bg-[#0b132b] p-4 rounded-xl border border-[#1e293b] hover:border-blue-500/40 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-blue-400">New Leads</span>
            <UserPlus className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-300 tracking-tight">
            {filteredMetrics.newLeads}
          </div>
          <p className="text-[10px] text-blue-400/70 mt-1">Awaiting contact</p>
        </div>

        {/* 3. Qualified Leads */}
        <div 
          onClick={() => onNavigateToLeads('QUALIFIED')}
          className="bg-gradient-to-br from-[#0b132b] to-[#0e2427] p-4 rounded-xl border border-emerald-500/30 hover:border-emerald-500/60 transition cursor-pointer group shadow-sm shadow-emerald-500/10"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-emerald-400">Qualified</span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-300 tracking-tight">
            {filteredMetrics.qualifiedLeads}
          </div>
          <p className="text-[10px] text-emerald-400/80 mt-1">Sales confirmed</p>
        </div>

        {/* 4. Follow-ups Due */}
        <div 
          onClick={onNavigateToFollowUps}
          className="bg-[#0b132b] p-4 rounded-xl border border-amber-500/20 hover:border-amber-500/50 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-amber-400">Follow-ups Due</span>
            <CalendarClock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-300 tracking-tight">
            {filteredMetrics.followUpsDue}
          </div>
          <p className="text-[10px] text-amber-400/70 mt-1">Action required</p>
        </div>

        {/* 5. Bookings Confirmed */}
        <div 
          onClick={() => onNavigateToLeads('BOOKED')}
          className="bg-[#0b132b] p-4 rounded-xl border border-[#1e293b] hover:border-cyan-500/40 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-cyan-400">Booked</span>
            <CreditCard className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-cyan-300 tracking-tight">
            {filteredMetrics.bookingsConfirmed}
          </div>
          <p className="text-[10px] text-cyan-400/70 mt-1">Advance received</p>
        </div>

        {/* 6. Completed Bookings */}
        <div 
          onClick={() => onNavigateToLeads('COMPLETED')}
          className="bg-[#0b132b] p-4 rounded-xl border border-[#1e293b] hover:border-green-500/40 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-green-400">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          </div>
          <div className="text-2xl font-bold text-green-300 tracking-tight">
            {filteredMetrics.completedBookings}
          </div>
          <p className="text-[10px] text-green-400/70 mt-1">Tour fulfilled</p>
        </div>

        {/* 7. Conversion Rate */}
        <div className="bg-gradient-to-br from-[#0b132b] to-[#12233f] p-4 rounded-xl border border-teal-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-teal-300">Conversion</span>
            <TrendingUp className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
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

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        leadService.completeFollowUp(item.id);
                        onRefresh();
                      }}
                      className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-medium transition cursor-pointer"
                    >
                      Done
                    </button>
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
