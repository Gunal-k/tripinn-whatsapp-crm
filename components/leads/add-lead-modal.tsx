'use client';

import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, UserCheck } from 'lucide-react';
import { leadService } from '../../lib/services/leads';
import { staffService } from '../../lib/services/staff';
import { createLeadSchema, CreateLeadInput } from '../../lib/validations/lead';
import { Lead, LeadSource, UserProfile } from '../../lib/types/crm';
import { formatPhoneDisplay } from '../../lib/utils/phone';
import { showToast } from '../../lib/utils/swal';
import { DateTimePicker } from '../ui/date-time-picker';

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeadCreated: (lead: Lead) => void;
  onSelectExistingLead: (lead: Lead) => void;
}

export function AddLeadModal({
  isOpen,
  onClose,
  onLeadCreated,
  onSelectExistingLead,
}: AddLeadModalProps) {
  const [formData, setFormData] = useState<Partial<CreateLeadInput>>({
    name: '',
    phone: '',
    email: '',
    lead_source: 'WhatsApp',
    assigned_salesperson_id: '',
    interested_destination: '',
    travel_dates: '',
    number_of_travelers: 2,
    estimated_budget: undefined,
    follow_up_date: '',
    follow_up_notes: '',
    internal_notes: '',
  });

  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicateWarning, setDuplicateWarning] = useState<Lead | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
        console.warn('Failed to load staff list in AddLeadModal:', err);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!isOpen) return null;

  const handlePhoneBlur = async (phoneVal: string) => {
    if (!phoneVal) {
      setDuplicateWarning(null);
      return;
    }
    try {
      const dup = await leadService.checkDuplicatePhone(phoneVal);
      setDuplicateWarning(dup);
    } catch {
      // ignore probe error
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSubmitError(null);

    const payload: Partial<CreateLeadInput> = {
      ...formData,
      assigned_salesperson_id:
        formData.assigned_salesperson_id &&
        formData.assigned_salesperson_id !== 'unassigned' &&
        formData.assigned_salesperson_id.trim() !== ''
          ? formData.assigned_salesperson_id
          : null,
      follow_up_date:
        formData.follow_up_date && formData.follow_up_date.trim() !== ''
          ? formData.follow_up_date
          : null,
    };

    const result = createLeadSchema.safeParse(payload);
    if (!result.success) {
      const errMap: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        errMap[path] = issue.message;
      });
      setErrors(errMap);
      return;
    }

    setIsSubmitting(true);
    try {
      // Check duplicate
      const existing = await leadService.checkDuplicatePhone(result.data.phone);
      if (existing && !duplicateWarning) {
        setDuplicateWarning(existing);
        setIsSubmitting(false);
        return;
      }

      const { lead } = await leadService.createLead(result.data);
      onLeadCreated(lead);
      showToast(`Lead created for ${lead.name}!`, 'success');
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create lead in database';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md overflow-hidden">
      <div className="bg-[#0b132b] sm:border border-white/[0.08] rounded-t-[28px] sm:rounded-2xl w-full max-w-2xl max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col relative transition-all">
        {/* Apple iOS Sheet Grabber for Mobile */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center bg-[#070d1a] shrink-0">
          <div className="w-12 h-1.5 rounded-full bg-slate-600/50" />
        </div>

        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-[#1e293b] flex items-center justify-between bg-[#070d1a] shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-xs shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Create New Travel Lead</h2>
              <p className="text-[11px] sm:text-xs text-slate-400">Record customer requirements and consultation schedule</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center transition cursor-pointer active:scale-95"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Duplicate Phone Alert Banner */}
        {duplicateWarning && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs flex-1">
              <span className="font-bold text-amber-300 block mb-0.5">
                Existing Lead Detected for this Phone Number!
              </span>
              <p className="text-slate-300">
                A lead for <strong className="text-white">{duplicateWarning.name}</strong> ({formatPhoneDisplay(duplicateWarning.phone)}) already exists under stage <strong className="text-emerald-400">{duplicateWarning.lead_status}</strong>.
              </p>
              <div className="mt-2 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    onSelectExistingLead(duplicateWarning);
                    onClose();
                  }}
                  className="px-2.5 py-1 rounded bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition"
                >
                  View Existing Lead
                </button>
                <button
                  type="button"
                  onClick={() => setDuplicateWarning(null)}
                  className="text-xs text-slate-400 hover:text-white underline"
                >
                  Ignore & Continue Adding
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Customer Full Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Rahul Sharma"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#070d1a] border border-[#1e293b] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              {errors.name && <p className="text-rose-400 text-[11px] mt-1">{errors.name}</p>}
            </div>

            {/* Phone Number (International) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Phone Number (with Country Code) <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. +91 98201 23456"
                value={formData.phone || ''}
                onBlur={(e) => handlePhoneBlur(e.target.value)}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#070d1a] border border-[#1e293b] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              {errors.phone && <p className="text-rose-400 text-[11px] mt-1">{errors.phone}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Email Address (Optional)
              </label>
              <input
                type="email"
                placeholder="e.g. client@example.com"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#070d1a] border border-[#1e293b] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              {errors.email && <p className="text-rose-400 text-[11px] mt-1">{errors.email}</p>}
            </div>

            {/* Lead Source */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Lead Source
              </label>
              <select
                value={formData.lead_source}
                onChange={(e) => setFormData({ ...formData, lead_source: e.target.value as LeadSource })}
                className="w-full px-3 py-2 rounded-lg bg-[#070d1a] border border-[#1e293b] text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="WhatsApp">WhatsApp (Organic / Business)</option>
                <option value="Instagram">Instagram Direct / Ads</option>
                <option value="Facebook">Facebook Ads</option>
                <option value="website">Tripinn Website Inquiry</option>
                <option value="referral">Customer Referral</option>
                <option value="manual">Manual Entry / Phone Call</option>
              </select>
            </div>

            {/* Assign to Staff Member */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Assign to Staff Member
              </label>
              <select
                value={formData.assigned_salesperson_id || 'unassigned'}
                onChange={(e) => setFormData({ ...formData, assigned_salesperson_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#070d1a] border border-[#1e293b] text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="unassigned">Unassigned (Pool Queue)</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Interested Destination */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Interested Destination or Tour Package
              </label>
              <input
                type="text"
                placeholder="e.g. Bali Honeymoon 7D/6N or Dubai Family Special"
                value={formData.interested_destination || ''}
                onChange={(e) => setFormData({ ...formData, interested_destination: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#070d1a] border border-[#1e293b] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Travel Dates */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tentative Travel Dates
              </label>
              <input
                type="text"
                placeholder="e.g. 15 Nov to 22 Nov 2026"
                value={formData.travel_dates || ''}
                onChange={(e) => setFormData({ ...formData, travel_dates: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#070d1a] border border-[#1e293b] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Number of Travelers & Budget */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Travelers
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="2"
                  value={formData.number_of_travelers || ''}
                  onChange={(e) => setFormData({ ...formData, number_of_travelers: parseInt(e.target.value) || undefined })}
                  className="w-full px-3 py-2 rounded-lg bg-[#070d1a] border border-[#1e293b] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Est. Budget (₹)
                </label>
                <input
                  type="number"
                  placeholder="150000"
                  value={formData.estimated_budget || ''}
                  onChange={(e) => setFormData({ ...formData, estimated_budget: parseFloat(e.target.value) || undefined })}
                  className="w-full px-3 py-2 rounded-lg bg-[#070d1a] border border-[#1e293b] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Follow-up Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Follow-up Date & Time
              </label>
              <DateTimePicker
                value={formData.follow_up_date || ''}
                onChange={(val) => setFormData({ ...formData, follow_up_date: val })}
                enableTime={true}
                placeholder="Pick follow-up date & time"
              />
            </div>

            {/* Follow-up Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Follow-up Agenda / Note
              </label>
              <input
                type="text"
                placeholder="e.g. Call to discuss flight departure preferences"
                value={formData.follow_up_notes || ''}
                onChange={(e) => setFormData({ ...formData, follow_up_notes: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#070d1a] border border-[#1e293b] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Internal Notes */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Internal Sales Notes
              </label>
              <textarea
                rows={2}
                placeholder="Customer preferences, dietary requirements, hotel tier (4-star vs 5-star)..."
                value={formData.internal_notes || ''}
                onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#070d1a] border border-[#1e293b] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Submit Error Banner */}
          {submitError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              <span className="font-bold block mb-0.5">Database Error</span>
              {submitError}
            </div>
          )}

          {/* Form Actions with Mobile Safe-Area */}
          <div className="pt-4 border-t border-[#1e293b] flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:space-x-3 pb-[max(env(safe-area-inset-bottom,0px),0.75rem)]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-3 rounded-2xl bg-[#111d3d] text-slate-300 hover:text-white text-xs font-semibold transition disabled:opacity-50 min-h-[44px] flex items-center justify-center cursor-pointer active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-[#070d1a] font-bold text-xs shadow-md shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-2 min-h-[46px] active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-[#070d1a] border-t-transparent rounded-full animate-spin" />
                  <span>Saving to Database...</span>
                </>
              ) : (
                <span>Save &amp; Create Lead</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
