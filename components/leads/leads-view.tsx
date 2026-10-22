'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Download, 
  Award, 
  Plus, 
  Eye, 
  Kanban, 
  Table as TableIcon,
  Sparkles,
  PhoneCall,
  MessageCircle,
  FileSpreadsheet,
  UserCheck
} from 'lucide-react';
import { Lead, LeadFilters, LeadPipelineStage, LeadSource, QualificationStatus, UserProfile } from '../../lib/types/crm';
import { leadService } from '../../lib/services/leads';
import { staffService } from '../../lib/services/staff';
import { formatPhoneDisplay } from '../../lib/utils/phone';
import { exportTelecallerExcelSheet } from '../../lib/utils/excel';
import { CallOutcomeModal } from '../telecaller/call-outcome-modal';
import { showToast } from '../../lib/utils/swal';

interface LeadsViewProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  onOpenAddModal: () => void;
  onRefresh?: () => void;
  initialStatusFilter?: string;
  currentRole?: 'admin' | 'sales';
  currentUserName?: string;
}

export function LeadsView({
  leads,
  onSelectLead,
  onOpenAddModal,
  onRefresh,
  initialStatusFilter,
  currentRole = 'admin',
  currentUserName = 'Priya Sharma',
}: LeadsViewProps) {
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadPipelineStage | 'ALL'>(
    (initialStatusFilter as LeadPipelineStage) || 'ALL'
  );
  const [sourceFilter, setSourceFilter] = useState<LeadSource | 'ALL'>('ALL');
  const [qualificationFilter, setQualificationFilter] = useState<QualificationStatus | 'ALL'>('ALL');
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('ALL');
  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [onlyMyLeads, setOnlyMyLeads] = useState<boolean>(currentRole === 'sales');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [leadForCallOutcome, setLeadForCallOutcome] = useState<Lead | null>(null);

  const unassignedCount = useMemo(
    () => leads.filter((l) => !l.assigned_salesperson_id).length,
    [leads]
  );

  const handleQuickAssign = async (leadId: string, newStaffId: string) => {
    try {
      if (!newStaffId || newStaffId === 'unassigned') {
        await leadService.reassignLead(leadId, '', 'Unassigned', '');
        showToast('Lead marked as Unassigned.', 'info');
      } else {
        const target = staffList.find((s) => s.id === newStaffId);
        if (target) {
          await leadService.reassignLead(leadId, target.id, target.full_name, target.email);
          showToast(`Lead assigned to ${target.full_name}!`, 'success');
        }
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to assign lead', 'error');
    }
  };

  useEffect(() => {
    let active = true;
    staffService
      .getStaffMembers()
      .then((list) => {
        if (active) {
          setStaffList(list.filter((s) => s.is_active && s.role !== 'admin'));
        }
      })
      .catch((err) => {
        console.warn('Failed to load staff list in LeadsView:', err);
      });

    const timer = setTimeout(() => {
      setCurrentTime(Date.now());
    }, 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  const filteredLeads = useMemo(() => {
    // Touch leads.length so the hook properly tracks lead array updates
    if (leads.length < 0) return [];
    const filters: LeadFilters = {
      search,
      status: statusFilter,
      source: sourceFilter,
      qualification: qualificationFilter,
      showArchived: false,
    };
    let list = leadService.filterLeads(leads, filters);

    if (currentRole === 'admin') {
      if (selectedStaffFilter === 'UNASSIGNED') {
        list = list.filter((l) => !l.assigned_salesperson_id);
      } else if (selectedStaffFilter !== 'ALL') {
        list = list.filter((l) => l.assigned_salesperson_id === selectedStaffFilter);
      }
    }

    if (onlyMyLeads) {
      list = list.filter(
        (l) => l.assigned_salesperson?.full_name === currentUserName || !l.assigned_salesperson_id
      );
    }

    return list;
  }, [leads, search, statusFilter, sourceFilter, qualificationFilter, selectedStaffFilter, currentRole, onlyMyLeads, currentUserName]);

  const handleExportExcel = () => {
    exportTelecallerExcelSheet(filteredLeads, {
      telecallerName: onlyMyLeads ? currentUserName : 'ALL',
      stageFilter: statusFilter,
    });
    showToast('Excel calling sheet downloaded!', 'success');
  };

  const handleExportCsv = () => {
    const csvData = leadService.exportToCsv(filteredLeads);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `tripinn_leads_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV export downloaded!', 'success');
  };

  const stages: LeadPipelineStage[] = [
    'NEW',
    'CONTACTED',
    'QUALIFIED',
    'FOLLOW_UP',
    'PAYMENT_PENDING',
    'BOOKED',
    'COMPLETED',
    'LOST',
  ];

  return (
    <div className="space-y-5">
      {/* Call Outcome Quick Logger Modal */}
      <CallOutcomeModal
        lead={leadForCallOutcome}
        isOpen={Boolean(leadForCallOutcome)}
        onClose={() => setLeadForCallOutcome(null)}
        onCallLogged={() => {
          if (onRefresh) onRefresh();
        }}
        telecallerName={currentUserName}
      />

      {/* Role Optimization Callout Banner for Staff */}
      {currentRole === 'sales' && (
        <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs">
            <PhoneCall className="w-4 h-4 text-blue-400" />
            <span className="text-white font-medium">
              Staff Calling Mode: Showing leads assigned to <strong>{currentUserName}</strong> with 1-click calling &amp; call logging.
            </span>
          </div>
          <button
            onClick={() => setOnlyMyLeads(!onlyMyLeads)}
            className="text-xs text-blue-300 hover:text-white font-semibold underline cursor-pointer"
          >
            {onlyMyLeads ? 'View All Leads' : 'View Only My Queue'}
          </button>
        </div>
      )}

      {/* Search and Action Bar */}
      <div className="bg-[#0b132b] p-4 rounded-xl border border-[#1e293b] flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search customer name, phone, destination..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#070d1a] border border-[#1e293b] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* My Leads Filter Toggle for Admins */}
          {currentRole === 'admin' && (
            <button
              onClick={() => setOnlyMyLeads(!onlyMyLeads)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                onlyMyLeads
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'bg-[#070d1a] text-slate-400 border-[#1e293b] hover:text-white'
              }`}
            >
              {onlyMyLeads ? 'My Leads' : 'All Staff'}
            </button>
          )}

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as LeadPipelineStage | 'ALL')}
            className="px-2.5 py-1.5 rounded-lg bg-[#070d1a] border border-[#1e293b] text-xs text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="ALL">All Stages</option>
            {stages.map((stg) => (
              <option key={stg} value={stg}>{stg}</option>
            ))}
          </select>

          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as LeadSource | 'ALL')}
            className="px-2.5 py-1.5 rounded-lg bg-[#070d1a] border border-[#1e293b] text-xs text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="ALL">All Sources</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="Instagram">Instagram</option>
            <option value="Facebook">Facebook</option>
            <option value="website">Website</option>
            <option value="referral">Referral</option>
            <option value="manual">Manual Entry</option>
          </select>

          {/* Qualification Filter */}
          <select
            value={qualificationFilter}
            onChange={(e) => setQualificationFilter(e.target.value as QualificationStatus | 'ALL')}
            className="px-2.5 py-1.5 rounded-lg bg-[#070d1a] border border-[#1e293b] text-xs text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="ALL">All Qualifications</option>
            <option value="QUALIFIED">Qualified Only</option>
            <option value="PENDING">Pending</option>
            <option value="UNQUALIFIED">Unqualified</option>
            <option value="DISQUALIFIED">Disqualified</option>
          </select>

          {/* Staff Filter (Admin Only) */}
          {currentRole === 'admin' && (
            <select
              value={selectedStaffFilter}
              onChange={(e) => setSelectedStaffFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-[#070d1a] border border-[#1e293b] text-xs text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="ALL">All Staff</option>
              <option value="UNASSIGNED">Unassigned Leads</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          )}

          {/* Unassigned Leads Quick Filter Button */}
          {currentRole === 'admin' && unassignedCount > 0 && (
            <button
              onClick={() => setSelectedStaffFilter((prev) => (prev === 'UNASSIGNED' ? 'ALL' : 'UNASSIGNED'))}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                selectedStaffFilter === 'UNASSIGNED'
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                  : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30'
              }`}
              title="Click to view all unassigned leads"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Unassigned ({unassignedCount})</span>
            </button>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#070d1a] p-1 rounded-lg border border-[#1e293b]">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded cursor-pointer ${viewMode === 'table' ? 'bg-[#111d3d] text-emerald-400' : 'text-slate-400'}`}
              title="Table View"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded cursor-pointer ${viewMode === 'kanban' ? 'bg-[#111d3d] text-emerald-400' : 'text-slate-400'}`}
              title="Pipeline Kanban View"
            >
              <Kanban className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Export Staff Excel Sheet */}
          <button
            onClick={handleExportExcel}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30 transition cursor-pointer"
            title="Download formatted Excel calling sheet (.xlsx) for staff"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Excel Sheet</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-[#111d3d] hover:bg-[#192b56] text-slate-300 text-xs font-semibold border border-slate-700 transition cursor-pointer"
            title="Download CSV export"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">CSV</span>
          </button>

          {/* Add Lead */}
          <button
            onClick={onOpenAddModal}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#070d1a] text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Lead</span>
          </button>
        </div>
      </div>

      {/* Leads Table View */}
      {viewMode === 'table' ? (
        <div className="bg-[#0b132b] rounded-xl border border-[#1e293b] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#070d1a] text-slate-400 border-b border-[#1e293b] uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Customer &amp; Phone</th>
                  <th className="py-3 px-4">Quick Contact</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Destination &amp; Budget</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4">Qualification</th>
                  <th className="py-3 px-4">Follow-up Call</th>
                  <th className="py-3 px-4 text-right">Staff Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b]">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No leads match your criteria. Try adjusting your filters or click &ldquo;+ New Lead&rdquo; to add one.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((item) => {
                    const isOverdue =
                      currentTime > 0 &&
                      item.follow_up_date &&
                      !item.follow_up_completed &&
                      new Date(item.follow_up_date).getTime() < currentTime;

                    return (
                      <tr
                        key={item.id}
                        onClick={() => onSelectLead(item)}
                        className="hover:bg-[#111d3d]/50 transition cursor-pointer group"
                      >
                        {/* Customer */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white group-hover:text-emerald-400 transition">
                            {item.name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {formatPhoneDisplay(item.phone)}
                          </div>
                          <div className="text-[10px] mt-1.5 flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                            {currentRole === 'admin' ? (
                              <div className="flex items-center space-x-1 bg-[#070d1a] border border-slate-700/80 rounded px-1.5 py-0.5">
                                <UserCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                                <select
                                  value={item.assigned_salesperson_id || 'unassigned'}
                                  onChange={(e) => handleQuickAssign(item.id, e.target.value)}
                                  className="bg-transparent text-[10px] font-semibold text-emerald-400 focus:outline-none cursor-pointer"
                                  title="Quick Assign Staff Member"
                                >
                                  <option value="unassigned" className="bg-[#0b132b] text-amber-400">
                                    Unassigned
                                  </option>
                                  {staffList.map((s) => (
                                    <option key={s.id} value={s.id} className="bg-[#0b132b] text-white">
                                      {s.full_name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <span className="text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                Staff: {item.assigned_salesperson?.full_name || 'Unassigned'}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Quick Contact Buttons (Click to Call & WhatsApp) */}
                        <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center space-x-1.5">
                            <a
                              href={`tel:+${item.phone}`}
                              className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-black border border-emerald-500/30 transition cursor-pointer"
                              title={`Call ${item.name} via phone dialer`}
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={`https://wa.me/${item.phone}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500 text-teal-400 hover:text-black border border-teal-500/30 transition cursor-pointer"
                              title={`Message ${item.name} on WhatsApp`}
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </td>

                        {/* Source */}
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-1">
                            <span className="px-2 py-0.5 rounded bg-[#070d1a] border border-slate-700 text-slate-300 font-medium text-[11px]">
                              {item.lead_source}
                            </span>
                            {item.ctwa_clid && (
                              <span title="Meta Click-to-WhatsApp Ad" className="p-1 rounded bg-emerald-500/20 text-emerald-300">
                                <Sparkles className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Destination & Budget */}
                        <td className="py-3 px-4 max-w-xs">
                          <div className="font-medium text-slate-200 truncate">
                            {item.interested_destination || 'General Enquiry'}
                          </div>
                          <div className="text-[11px] text-emerald-400 font-semibold">
                            {item.estimated_budget
                              ? `₹${Number(item.estimated_budget).toLocaleString('en-IN')}`
                              : 'Budget unquoted'}
                          </div>
                        </td>

                        {/* Stage */}
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.lead_status === 'QUALIFIED'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : item.lead_status === 'BOOKED'
                                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                                : item.lead_status === 'PAYMENT_PENDING'
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                : item.lead_status === 'NEW'
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                : item.lead_status === 'LOST'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {item.lead_status}
                          </span>
                        </td>

                        {/* Qualification */}
                        <td className="py-3 px-4">
                          {item.qualification_status === 'QUALIFIED' ? (
                            <span className="flex items-center space-x-1 text-emerald-400 font-bold text-[11px]">
                              <Award className="w-3.5 h-3.5" />
                              <span>Qualified</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">
                              {item.qualification_status}
                            </span>
                          )}
                        </td>

                        {/* Follow-up */}
                        <td className="py-3 px-4">
                          {item.follow_up_date ? (
                            <div className="text-[11px]">
                              <div
                                className={`font-semibold ${
                                  item.follow_up_completed
                                    ? 'text-slate-400 line-through'
                                    : isOverdue
                                    ? 'text-rose-400 font-bold'
                                    : 'text-amber-400'
                                }`}
                              >
                                {isOverdue && '⚠️ '}
                                {new Date(item.follow_up_date).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </div>
                              <div className="text-slate-400 truncate max-w-[120px]">
                                {item.follow_up_notes || 'Pending follow-up'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">None</span>
                          )}
                        </td>

                        {/* Actions: Log Call & Profile */}
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => onSelectLead(item)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-black text-xs font-bold border border-emerald-500/30 transition cursor-pointer flex items-center space-x-1"
                              title="Assign or reassign this lead"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Assign</span>
                            </button>
                            <button
                              onClick={() => setLeadForCallOutcome(item)}
                              className="px-2.5 py-1 rounded-lg bg-[#111d3d] hover:bg-emerald-500/20 hover:text-emerald-300 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
                              title="Log Call Outcome & Remarks"
                            >
                              Log Call
                            </button>
                            <button
                              onClick={() => onSelectLead(item)}
                              className="p-1 rounded-lg bg-[#070d1a] border border-slate-700 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/50 transition cursor-pointer"
                              title="View Full Profile"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Kanban Pipeline View */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stg) => {
            const colLeads = filteredLeads.filter((l) => l.lead_status === stg);
            return (
              <div
                key={stg}
                className="w-72 shrink-0 bg-[#0b132b] rounded-xl border border-[#1e293b] flex flex-col max-h-[75vh]"
              >
                {/* Column Header */}
                <div className="p-3 border-b border-[#1e293b] flex items-center justify-between bg-[#070d1a] rounded-t-xl">
                  <span className="font-bold text-xs text-white uppercase tracking-wider">
                    {stg.replace('_', ' ')}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#111d3d] text-emerald-400 border border-emerald-500/20">
                    {colLeads.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="p-2 space-y-2 overflow-y-auto flex-1">
                  {colLeads.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs italic">
                      Empty stage
                    </div>
                  ) : (
                    colLeads.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => onSelectLead(item)}
                        className="p-3 rounded-lg bg-[#070d1a] border border-[#1e293b] hover:border-emerald-500/50 transition cursor-pointer shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-white">{item.name}</span>
                          <span className="text-[10px] text-slate-400">{item.lead_source}</span>
                        </div>
                        <p className="text-xs text-emerald-400 font-medium mt-1 truncate">
                          {item.interested_destination || 'Trip Enquiry'}
                        </p>
                        <div className="text-[10px] mt-1.5 flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                          {currentRole === 'admin' ? (
                            <div className="flex items-center space-x-1 bg-[#0b132b] border border-slate-700 rounded px-1.5 py-0.5 w-full">
                              <UserCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                              <select
                                value={item.assigned_salesperson_id || 'unassigned'}
                                onChange={(e) => handleQuickAssign(item.id, e.target.value)}
                                className="bg-transparent text-[10px] font-semibold text-emerald-400 focus:outline-none cursor-pointer w-full truncate"
                                title="Quick Assign Staff Member"
                              >
                                <option value="unassigned" className="bg-[#0b132b] text-amber-400">
                                  Unassigned
                                </option>
                                {staffList.map((s) => (
                                  <option key={s.id} value={s.id} className="bg-[#0b132b] text-white">
                                    {s.full_name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <span className="text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 truncate">
                              Staff: {item.assigned_salesperson?.full_name || 'Unassigned'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 pt-1 border-t border-slate-800">
                          <span>{formatPhoneDisplay(item.phone)}</span>
                          {item.estimated_budget && (
                            <span className="font-semibold text-slate-300">
                              ₹{Number(item.estimated_budget).toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 pt-1 border-t border-slate-800/60 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                          <a
                            href={`tel:+${item.phone}`}
                            className="text-[10px] text-emerald-400 hover:underline flex items-center space-x-1"
                          >
                            <PhoneCall className="w-3 h-3" />
                            <span>Call</span>
                          </a>
                          <button
                            onClick={() => setLeadForCallOutcome(item)}
                            className="text-[10px] text-slate-300 hover:text-white px-2 py-0.5 rounded bg-[#111d3d]"
                          >
                            Log Outcome
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
