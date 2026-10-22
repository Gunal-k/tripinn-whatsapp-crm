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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#0b132b] border border-[#1e293b] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1e293b] bg-[#070d1a] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Log Call Outcome</h2>
              <p className="text-xs text-slate-400">
                {lead.name} • {formatPhoneDisplay(lead.phone)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                    className={`p-2.5 rounded-xl border text-left flex items-center space-x-2.5 transition cursor-pointer ${
                      isSelected
                        ? `${item.color} ring-1 ring-emerald-400`
                        : 'bg-[#070d1a] border-[#1e293b] text-slate-300 hover:border-slate-700'
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
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <label className="block text-xs font-bold text-amber-300 mb-1">
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
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Staff Call Notes &amp; Client Feedback
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Client confirmed 2 adults for Bali in mid-Nov. Requested 4-star vs 5-star pricing comparison."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#070d1a] border border-[#1e293b] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-[#1e293b] flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#111d3d] text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-md shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
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
