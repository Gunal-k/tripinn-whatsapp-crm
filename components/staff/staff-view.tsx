'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Headphones, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Mail, 
  Phone, 
  RefreshCw, 
  Shield, 
  Clock, 
  Copy, 
  Check, 
  AlertTriangle,
  Trash2,
  Zap,
  UserCheck
} from 'lucide-react';
import { UserProfile, UserRole, Lead } from '../../lib/types/crm';
import { staffService } from '../../lib/services/staff';
import { showToast, showConfirmDialog, showErrorAlert } from '../../lib/utils/swal';
import { createClient as createBrowserSupabaseClient } from '../../lib/supabase/client';

interface StaffViewProps {
  onOpenAddStaffModal: () => void;
  currentRole: 'admin' | 'sales';
  currentUserName: string;
  onGoToLeadsPipeline?: () => void;
  leads?: Lead[];
}

export function StaffView({
  onOpenAddStaffModal,
  currentRole,
  currentUserName,
  onGoToLeadsPipeline,
  leads = [],
}: StaffViewProps) {
  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'sales' | 'admin'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'active' | 'inactive'>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [serviceRoleMissing, setServiceRoleMissing] = useState<boolean>(false);
  const [unauthorized, setUnauthorized] = useState<boolean>(false);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const { staff, serviceRoleMissing: isMissing, unauthorized: isUnauthorized } = await staffService.getStaffStatus();
      setStaffList(staff);
      setServiceRoleMissing(isMissing);
      setUnauthorized(Boolean(isUnauthorized));
    } catch (err: unknown) {
      console.error('Failed to load staff:', err);
      showErrorAlert('Could Not Load Staff', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);

  const handle1ClickLogin = async () => {
    setIsAuthenticating(true);
    try {
      const res = await fetch('/api/auth/quick-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'gunal@tripinnholidays.com' }),
      });
      const json = await res.json();
      if (!res.ok || !json.token_hash) {
        throw new Error(json.error || 'Failed to authenticate');
      }
      const supabase = createBrowserSupabaseClient();
      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash: json.token_hash,
        type: 'magiclink',
      });
      if (otpError) {
        throw otpError;
      }
      showToast('Authenticated as Administrator (gunal@tripinnholidays.com)!', 'success');
      setUnauthorized(false);
      await fetchStaff();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      showErrorAlert('Sign In Failed', msg);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleToggleStatus = async (staff: UserProfile) => {
    const newStatus = !staff.is_active;
    const actionText = newStatus ? 'Activate' : 'Deactivate';

    const confirmed = await showConfirmDialog({
      title: `${actionText} ${staff.full_name}?`,
      text: newStatus
        ? `This will restore login access for ${staff.email}.`
        : `This will prevent ${staff.email} from logging in or accessing leads.`,
      confirmButtonText: `Yes, ${actionText}`,
      cancelButtonText: 'Cancel',
      isDanger: !newStatus,
      icon: newStatus ? 'info' : 'warning',
    });

    if (!confirmed) return;

    try {
      const updated = await staffService.toggleStaffStatus(staff.id, newStatus);
      setStaffList((prev) =>
        prev.map((s) => (s.id === staff.id ? { ...s, is_active: updated.is_active } : s))
      );
      showToast(
        `${staff.full_name} is now ${newStatus ? 'active' : 'deactivated'}.`,
        'success'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update staff status';
      showErrorAlert('Status Update Failed', msg);
    }
  };

  const handleDeleteStaff = async (staff: UserProfile) => {
    if (staff.full_name === currentUserName) {
      showErrorAlert(
        'Action Restricted',
        'You cannot delete your own active administrator account.'
      );
      return;
    }

    const confirmed = await showConfirmDialog({
      title: `Delete ${staff.full_name}?`,
      text: `Are you sure you want to permanently delete ${staff.full_name} (${staff.email})? Their user account, profile, and system access will be removed. Any assigned leads will be unassigned. This action cannot be undone.`,
      confirmButtonText: 'Yes, Delete Staff',
      cancelButtonText: 'Cancel',
      isDanger: true,
      icon: 'warning',
    });

    if (!confirmed) return;

    try {
      await staffService.deleteStaffMember(staff.id);
      setStaffList((prev) => prev.filter((s) => s.id !== staff.id));
      showToast(`${staff.full_name} was permanently deleted.`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete staff member';
      showErrorAlert('Deletion Failed', msg);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Copied to clipboard!', 'info', 1500);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredStaff = useMemo(() => {
    return staffList.filter((member) => {
      // Role filter
      if (roleFilter !== 'ALL' && member.role !== roleFilter) return false;

      // Status filter
      if (statusFilter === 'active' && !member.is_active) return false;
      if (statusFilter === 'inactive' && member.is_active) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = member.full_name.toLowerCase().includes(q);
        const matchesEmail = member.email.toLowerCase().includes(q);
        const matchesPhone = member.phone ? member.phone.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesEmail && !matchesPhone) return false;
      }

      return true;
    });
  }, [staffList, roleFilter, statusFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = staffList.length;
    const activeStaff = staffList.filter((s) => s.role === 'sales' && s.is_active).length;
    const admins = staffList.filter((s) => s.role === 'admin').length;
    const inactive = staffList.filter((s) => !s.is_active).length;
    return { total, activeStaff, admins, inactive };
  }, [staffList]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Staff */}
        <div className="p-4 rounded-xl bg-[#0b132b] border border-[#1e293b] flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-slate-400">Total Staff Profiles</div>
          </div>
        </div>

        {/* Active Staff */}
        <div className="p-4 rounded-xl bg-[#0b132b] border border-[#1e293b] flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-emerald-300">{stats.activeStaff}</div>
            <div className="text-xs text-slate-400">Active Staff</div>
          </div>
        </div>

        {/* Administrators */}
        <div className="p-4 rounded-xl bg-[#0b132b] border border-[#1e293b] flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-purple-300">{stats.admins}</div>
            <div className="text-xs text-slate-400">System Admins</div>
          </div>
        </div>

        {/* Inactive Accounts */}
        <div className="p-4 rounded-xl bg-[#0b132b] border border-[#1e293b] flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-amber-300">{stats.inactive}</div>
            <div className="text-xs text-slate-400">Deactivated Staff</div>
          </div>
        </div>
      </div>

      {/* Alert if SUPABASE_SERVICE_ROLE_KEY is missing */}
      {serviceRoleMissing && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start space-x-3.5 shadow-lg">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <span className="font-bold text-white text-sm block mb-1">
              Configuration Notice: SUPABASE_SERVICE_ROLE_KEY is missing in .env.local
            </span>
            <p className="text-slate-300">
              Your CRM frontend is connected to Supabase (<code className="text-emerald-400 font-mono text-[11px]">jedrftuehstvmjkllgib.supabase.co</code>), but staff cannot be provisioned into Supabase Auth and database tables without the secret <strong>service_role</strong> key.
            </p>
            <div className="mt-2.5 p-2.5 bg-[#070d1a] border border-amber-500/20 rounded-lg text-amber-200 font-mono text-[11px] select-all">
              SUPABASE_SERVICE_ROLE_KEY=&quot;your-secret-service-role-key-here&quot;
            </div>
            <p className="text-slate-400 text-[11px] mt-2">
              To resolve: Open your <span className="text-white font-medium">Supabase Dashboard &rarr; Project Settings &rarr; API &rarr; Project API keys</span>, reveal and copy the <strong className="text-slate-200">service_role (secret)</strong> key, add it to <code className="text-slate-200 font-mono">.env.local</code>, and restart your server.
            </p>
          </div>
        </div>
      )}

      {/* Alert if User Session is Unverified */}
      {unauthorized && (
        <div className="p-4 rounded-xl bg-[#0b132b] border border-amber-500/40 text-amber-300 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div className="text-xs leading-relaxed">
              <span className="font-bold text-white text-sm block mb-0.5">
                Administrator Authentication
              </span>
              <p className="text-slate-300">
                You are viewing live team profiles. Authenticate as <strong className="text-emerald-400 font-mono">gunal@tripinnholidays.com</strong> for full database write permissions.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0 self-start md:self-center">
            <button
              type="button"
              onClick={handle1ClickLogin}
              disabled={isAuthenticating}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-[#070d1a] font-bold text-xs shadow-md shadow-emerald-500/20 transition flex items-center space-x-1.5 cursor-pointer"
            >
              {isAuthenticating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-[#070d1a]/30 border-t-[#070d1a] rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>1-Click Admin Sign In</span>
                </>
              )}
            </button>
            <a
              href="/login"
              className="px-3 py-2 rounded-lg bg-[#070d1a] border border-[#1e293b] hover:border-slate-600 text-slate-300 hover:text-white font-semibold text-xs transition"
            >
              Login Page &rarr;
            </a>
          </div>
        </div>
      )}

      {/* Control Bar: Search, Filters, Refresh, Add Staff */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#0b132b] p-4 rounded-xl border border-[#1e293b]">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search staff by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#070d1a] border border-[#1e293b] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as 'ALL' | 'sales' | 'admin')}
            aria-label="Filter staff by role"
            className="px-3 py-2 rounded-xl bg-[#070d1a] border border-[#1e293b] text-xs text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="ALL">All Roles</option>
            <option value="sales">Staff Only</option>
            <option value="admin">Admins Only</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'active' | 'inactive')}
            aria-label="Filter staff by active status"
            className="px-3 py-2 rounded-xl bg-[#070d1a] border border-[#1e293b] text-xs text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="ALL">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          {/* Refresh Button */}
          <button
            onClick={fetchStaff}
            disabled={loading}
            className="p-2 rounded-xl bg-[#111d3d] hover:bg-[#1a2c5a] text-slate-300 border border-[#1e293b] transition cursor-pointer"
            title="Refresh Staff List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          {/* Assign Leads in Pipeline Button */}
          {onGoToLeadsPipeline && (
            <button
              onClick={onGoToLeadsPipeline}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition cursor-pointer"
              title="Open All Leads Pipeline to assign and reassign leads"
            >
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span>Assign Leads in Pipeline &rarr;</span>
            </button>
          )}

          {/* Add Staff Button */}
          {currentRole === 'admin' && (
            <button
              onClick={onOpenAddStaffModal}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#070d1a] font-bold text-xs shadow-md shadow-emerald-500/20 transition cursor-pointer active:scale-95"
            >
              <UserPlus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Staff</span>
            </button>
          )}
        </div>
      </div>

      {/* Staff Members List */}
      <div className="bg-[#0b132b] rounded-xl border border-[#1e293b] overflow-hidden">
        {loading && staffList.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-400">
            <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
            <p className="text-xs">Loading staff team profiles...</p>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <Users className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-white">No staff members found</p>
            <p className="text-xs text-slate-400">
              {searchQuery ? 'Try clearing your search term or filters.' : 'Click "Add Staff" above to provision your first team member.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1e293b] bg-[#070d1a]/60 text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4 font-semibold">Staff Member</th>
                  <th className="py-3.5 px-4 font-semibold">Role &amp; Permissions</th>
                  <th className="py-3.5 px-4 font-semibold">Contact Details</th>
                  <th className="py-3.5 px-4 font-semibold">Assigned Leads</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold">Created</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b] text-xs">
                {filteredStaff.map((staff) => {
                  const initials = staff.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <tr 
                      key={staff.id}
                      className="hover:bg-[#111d3d]/50 transition duration-150"
                    >
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                            staff.role === 'admin'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            {initials || 'U'}
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center space-x-1.5">
                              <span>{staff.full_name}</span>
                              {staff.full_name === currentUserName && (
                                <span className="text-[10px] text-emerald-400 font-normal">(You)</span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {staff.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        {staff.role === 'admin' ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 font-semibold text-[11px]">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Administrator</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold text-[11px]">
                            <Users className="w-3.5 h-3.5" />
                            <span>Staff Member</span>
                          </span>
                        )}
                      </td>

                      {/* Contact */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1.5 text-slate-300">
                            <Mail className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-[11px]">{staff.email}</span>
                            <button
                              onClick={() => copyToClipboard(staff.email, `email-${staff.id}`)}
                              className="text-slate-500 hover:text-slate-300 cursor-pointer p-0.5"
                              title="Copy Email"
                            >
                              {copiedId === `email-${staff.id}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          {staff.phone && (
                            <div className="flex items-center space-x-1.5 text-slate-400">
                              <Phone className="w-3.5 h-3.5 text-slate-500" />
                              <span className="text-[11px] font-mono">{staff.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Assigned Leads Column */}
                      <td className="py-3.5 px-4">
                        {(() => {
                          const count = leads.filter(
                            (l) =>
                              l.assigned_salesperson_id === staff.id ||
                              l.assigned_salesperson?.full_name === staff.full_name
                          ).length;

                          return (
                            <div className="flex items-center space-x-2">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                  count > 0
                                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}
                              >
                                {count} {count === 1 ? 'Lead' : 'Leads'}
                              </span>
                              {onGoToLeadsPipeline && (
                                <button
                                  onClick={onGoToLeadsPipeline}
                                  className="px-2 py-0.5 rounded bg-[#111d3d] hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 text-[11px] font-semibold border border-emerald-500/20 transition cursor-pointer"
                                  title="View and assign leads in pipeline"
                                >
                                  Assign &rarr;
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {staff.is_active ? (
                          <span className="inline-flex items-center space-x-1 text-emerald-400 text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-rose-400 text-xs font-semibold">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Deactivated</span>
                          </span>
                        )}
                      </td>

                      {/* Created At */}
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {staff.created_at ? new Date(staff.created_at).toLocaleDateString() : 'N/A'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {currentRole === 'admin' ? (
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleToggleStatus(staff)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                                staff.is_active
                                  ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              }`}
                              title={staff.is_active ? 'Temporarily deactivate staff account' : 'Reactivate staff account'}
                            >
                              {staff.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              onClick={() => handleDeleteStaff(staff)}
                              disabled={staff.full_name === currentUserName}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                              title={
                                staff.full_name === currentUserName
                                  ? 'Cannot delete your own active administrator account'
                                  : `Permanently delete ${staff.full_name}`
                              }
                              aria-label={`Delete ${staff.full_name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
