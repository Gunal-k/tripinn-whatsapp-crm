'use client';

import React, { useState } from 'react';
import { X, AlertTriangle, UserCheck } from 'lucide-react';
import { leadService } from '../../lib/services/leads';
import { createLeadSchema, CreateLeadInput } from '../../lib/validations/lead';
import { Lead, LeadSource } from '../../lib/types/crm';
import { formatPhoneDisplay } from '../../lib/utils/phone';

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
    interested_destination: '',
    travel_dates: '',
    number_of_travelers: 2,
    estimated_budget: undefined,
    follow_up_date: '',
    follow_up_notes: '',
    internal_notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicateWarning, setDuplicateWarning] = useState<Lead | null>(null);

  if (!isOpen) return null;

  const handlePhoneBlur = (phoneVal: string) => {
    if (!phoneVal) {
      setDuplicateWarning(null);
      return;
    }
    const dup = leadService.checkDuplicatePhone(phoneVal);
    setDuplicateWarning(dup);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = createLeadSchema.safeParse(formData);
    if (!result.success) {
      const errMap: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        errMap[path] = issue.message;
      });
      setErrors(errMap);
      return;
    }

    // Check duplicate
    const existing = leadService.checkDuplicatePhone(result.data.phone);
    if (existing && !duplicateWarning) {
      setDuplicateWarning(existing);
      return;
    }

    const { lead } = leadService.createLead(result.data);
    onLeadCreated(lead);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#0b132b] border border-[#1e293b] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#1e293b] flex items-center justify-between bg-[#070d1a]">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Create New Travel Lead</h2>
              <p className="text-xs text-slate-400">Record enquiry details, travel requirements, and follow-up</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
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
              <input
                type="datetime-local"
                value={formData.follow_up_date || ''}
                onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#070d1a] border border-[#1e293b] text-sm text-white focus:outline-none focus:border-emerald-500"
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

          {/* Form Actions */}
          <div className="pt-4 border-t border-[#1e293b] flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#111d3d] text-slate-300 hover:text-white text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#070d1a] font-bold text-xs shadow-md shadow-emerald-500/20 transition cursor-pointer"
            >
              Save & Create Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
