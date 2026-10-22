'use client';

import React, { useState } from 'react';
import { 
  X, 
  UserPlus, 
  Mail, 
  Lock, 
  Phone, 
  ShieldCheck, 
  Headphones, 
  Users,
  Eye, 
  EyeOff, 
  AlertCircle 
} from 'lucide-react';
import { UserProfile, UserRole } from '../../lib/types/crm';
import { staffService } from '../../lib/services/staff';
import { createStaffSchema, CreateStaffInput } from '../../lib/validations/staff';
import { showToast, showErrorAlert } from '../../lib/utils/swal';

interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStaffCreated: (staff: UserProfile) => void;
}

export function AddStaffModal({ isOpen, onClose, onStaffCreated }: AddStaffModalProps) {
  const [formData, setFormData] = useState<CreateStaffInput>({
    full_name: '',
    email: '',
    password: '',
    role: 'sales',
    phone: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setFormData({
      full_name: '',
      email: '',
      password: '',
      role: 'sales',
      phone: '',
    });
    setFieldErrors({});
    setGeneralError(null);
    setShowPassword(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});

    const result = createStaffSchema.safeParse(formData);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        if (field && !errs[field]) {
          errs[field] = issue.message;
        }
      });
      setFieldErrors(errs);
      return;
    }

    setIsSubmitting(true);
    try {
      const newStaff = await staffService.createStaffMember(result.data);
      showToast(`Staff member ${newStaff.full_name} created successfully!`, 'success');
      handleClose();
      onStaffCreated(newStaff);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to provision staff member';
      setGeneralError(message);
      showErrorAlert('Could Not Add Staff', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div 
        className="w-full max-w-lg bg-[#0b132b] border border-[#1e293b] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#1e293b] flex items-center justify-between bg-[#070d1a]/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Add New Staff Member</h2>
              <p className="text-xs text-slate-400">Directly provision staff members or CRM administrators</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#111d3d] transition cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {generalError && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{generalError}</span>
            </div>
          )}

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Full Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Priya Sharma"
              value={formData.full_name}
              onChange={(e) => {
                setFormData({ ...formData, full_name: e.target.value });
                if (fieldErrors.full_name) setFieldErrors({ ...fieldErrors, full_name: '' });
              }}
              className={`w-full px-3.5 py-2.5 rounded-xl bg-[#070d1a] border text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                fieldErrors.full_name
                  ? 'border-rose-500/60 focus:border-rose-400 focus:ring-rose-400'
                  : 'border-[#1e293b] focus:border-emerald-500 focus:ring-emerald-500'
              }`}
            />
            {fieldErrors.full_name && (
              <p className="text-[11px] text-rose-400 mt-1 font-medium">{fieldErrors.full_name}</p>
            )}
          </div>

          {/* Work Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Work Email Address <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type="email"
                required
                placeholder="e.g. priya@tripinnholidays.com"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: '' });
                }}
                className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#070d1a] border text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                  fieldErrors.email
                    ? 'border-rose-500/60 focus:border-rose-400 focus:ring-rose-400'
                    : 'border-[#1e293b] focus:border-emerald-500 focus:ring-emerald-500'
                }`}
              />
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
            </div>
            {fieldErrors.email && (
              <p className="text-[11px] text-rose-400 mt-1 font-medium">{fieldErrors.email}</p>
            )}
          </div>

          {/* Temporary Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Initial Login Password <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="At least 6 characters"
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value });
                  if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: '' });
                }}
                className={`w-full pl-9 pr-10 py-2.5 rounded-xl bg-[#070d1a] border text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                  fieldErrors.password
                    ? 'border-rose-500/60 focus:border-rose-400 focus:ring-rose-400'
                    : 'border-[#1e293b] focus:border-emerald-500 focus:ring-emerald-500'
                }`}
              />
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="text-[11px] text-rose-400 mt-1 font-medium">{fieldErrors.password}</p>
            )}
            <p className="text-[10px] text-slate-400 mt-1">
              Staff will use this password to sign in immediately.
            </p>
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Assigned Role &amp; Permissions <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Staff Member */}
              <div
                onClick={() => setFormData({ ...formData, role: 'sales' })}
                className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                  formData.role === 'sales'
                    ? 'bg-emerald-500/10 border-emerald-500/60 ring-1 ring-emerald-500/40 text-emerald-300'
                    : 'bg-[#070d1a] border-[#1e293b] hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1.5">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">Staff Member</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Access assigned leads, call logs, and WhatsApp follow-ups.
                </p>
              </div>

              {/* Administrator */}
              <div
                onClick={() => setFormData({ ...formData, role: 'admin' })}
                className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                  formData.role === 'admin'
                    ? 'bg-purple-500/10 border-purple-500/60 ring-1 ring-purple-500/40 text-purple-300'
                    : 'bg-[#070d1a] border-[#1e293b] hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1.5">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-white">Administrator</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Full agency control: pipeline, staff management &amp; API keys.
                </p>
              </div>
            </div>
          </div>

          {/* Contact Phone (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Contact Phone / WhatsApp <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <input
                type="tel"
                placeholder="+91 98200 11223"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#070d1a] border border-[#1e293b] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              />
              <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-[#1e293b] flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl bg-[#111d3d] hover:bg-[#1a2c5a] text-slate-300 text-xs font-semibold border border-[#1e293b] transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#070d1a] text-xs font-bold shadow-md shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50 flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-[#070d1a] border-t-transparent rounded-full animate-spin" />
                  <span>Provisioning Account...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Create Staff Account</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
