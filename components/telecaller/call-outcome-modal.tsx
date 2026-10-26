'use client';

import React, { useState } from 'react';
import { X, PhoneCall, CheckCircle, Clock, PhoneOff, XCircle, PhoneForwarded } from 'lucide-react';
import { Lead } from '../../lib/types/crm';
import { leadService } from '../../lib/services/leads';
import { formatPhoneDisplay } from '../../lib/utils/phone';
import { showToast } from '../../lib/utils/swal';
import { DateTimePicker } from '../ui/date-time-picker';

interface CallOutcomeModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onCallLogged: (updatedLead: Lead) => void;
  telecallerName?: string;
}

type CallOutcome = 
  | 'CONNECTED_INTERESTED' 
  | 'CALLBACK_REQUESTED' 
  | 'RINGING_NO_ANSWER' 
  | 'BUSY_DISCONNECTED' 
  | 'NOT_INTERESTED';

export function CallOutcomeModal({
  lead,
  isOpen,
  onClose,
  onCallLogged,
  telecallerName = 'Priya Sharma',
}: CallOutcomeModalProps) {
  const [outcome, setOutcome] = useState<CallOutcome>('CONNECTED_INTERESTED');
  const [notes, setNotes] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !lead) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const updated = await leadService.logCallOutcome(
        lead.id,
        outcome,
        notes,
        outcome === 'CALLBACK_REQUESTED' ? nextFollowUpDate : undefined,
        telecallerName
      );

      if (updated) {
        onCallLogged(updated);
        showToast('Call outcome logged successfully!', 'success');
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const outcomes: { key: CallOutcome; label: string; icon: React.ElementType; color: string }[] = [
    {
      key: 'CONNECTED_INTERESTED',
      label: 'Connected & Interested',
      icon: CheckCircle,
      color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    },
    {
      key: 'CALLBACK_REQUESTED',
      label: 'Callback Requested',
      icon: Clock,
      color: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    },
    {
      key: 'RINGING_NO_ANSWER',
      label: 'Ringing / No Answer',
      icon: PhoneForwarded,
      color: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
    },
    {
      key: 'BUSY_DISCONNECTED',
      label: 'Line Busy / Disconnected',
      icon: PhoneOff,
      color: 'bg-slate-700 text-slate-300 border-slate-600',
    },
    {
      key: 'NOT_INTERESTED',
      label: 'Not Interested / Lost',
      icon: XCircle,
      color: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md overflow-hidden">
      <div className="bg-[#0b132b] sm:border border-white/[0.08] rounded-t-[28px] sm:rounded-2xl w-full max-w-lg max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto shadow-2xl relative transition-all">
        {/* Apple iOS Sheet Grabber for Mobile */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center bg-[#070d1a] shrink-0">
          <div className="w-12 h-1.5 rounded-full bg-slate-600/50" />
        </div>

        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-[#1e293b] bg-[#070d1a] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-xs shrink-0">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Log Call Outcome</h2>
              <p className="text-xs text-slate-400">
                {lead.name} • <span className="font-mono text-slate-300">{formatPhoneDisplay(lead.phone)}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center transition cursor-pointer active:scale-95"
            title="Close Modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 pb-[max(env(safe-area-inset-bottom,0px),1.25rem)]">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Select Call Outcome
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {outcomes.map((item) => {
                const Icon = item.icon;
                const isSelected = outcome === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setOutcome(item.key)}
                    className={`p-3 rounded-2xl border text-left flex items-center space-x-3 transition cursor-pointer min-h-[46px] active:scale-95 ${
                      isSelected
                        ? `${item.color} ring-2 ring-emerald-400/50 shadow-md`
                        : 'bg-[#070d1a] border-white/[0.06] text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-semibold">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Callback Date Picker if Callback Requested */}
          {outcome === 'CALLBACK_REQUESTED' && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1.5 shadow-sm">
              <label className="block text-xs font-bold text-amber-300">
                Scheduled Callback Date &amp; Time
              </label>
              <DateTimePicker
                value={nextFollowUpDate}
                onChange={(val) => setNextFollowUpDate(val)}
                enableTime={true}
                placeholder="Pick callback date & time"
                required={true}
              />
            </div>
          )}

          {/* Call Remarks */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Staff Call Notes &amp; Client Feedback
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Client confirmed 2 adults for Bali in mid-Nov. Requested 4-star vs 5-star pricing comparison."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-[#070d1a] border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 leading-relaxed"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-[#1e293b] flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 rounded-2xl bg-[#111d3d] text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer min-h-[44px] flex items-center justify-center active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-black font-bold text-xs shadow-md shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-1.5 min-h-[46px] active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Saving Outcome...</span>
                </>
              ) : (
                <span>Save Call Outcome</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
