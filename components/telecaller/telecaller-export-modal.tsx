'use client';

import React, { useState, useMemo } from 'react';
import { X, FileSpreadsheet, Download } from 'lucide-react';
import { Lead } from '../../lib/types/crm';
import { exportTelecallerExcelSheet } from '../../lib/utils/excel';

interface TelecallerExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  leads: Lead[];
  currentRole: 'admin' | 'salesperson';
  currentUserName?: string;
}

export function TelecallerExportModal({
  isOpen,
  onClose,
  leads,
  currentRole,
  currentUserName = 'Priya Sharma',
}: TelecallerExportModalProps) {
  // If salesperson, default to their own leads; if admin, default to ALL
  const [selectedTelecaller, setSelectedTelecaller] = useState<string>(
    currentRole === 'salesperson' ? currentUserName : 'ALL'
  );
  const [selectedStage, setSelectedStage] = useState<string>('ALL');

  // Compute telecallers list from leads
  const telecallers = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      if (l.assigned_salesperson?.full_name) {
        set.add(l.assigned_salesperson.full_name);
      }
    });
    return Array.from(set);
  }, [leads]);

  // Compute filtered count preview
  const previewCount = useMemo(() => {
    let list = [...leads];
    if (selectedTelecaller !== 'ALL') {
      list = list.filter(
        (l) =>
          l.assigned_salesperson?.full_name === selectedTelecaller ||
          (selectedTelecaller === 'Unassigned' && !l.assigned_salesperson_id)
      );
    }
    if (selectedStage !== 'ALL') {
      list = list.filter((l) => l.lead_status === selectedStage);
    }
    return list.length;
  }, [leads, selectedTelecaller, selectedStage]);

  if (!isOpen) return null;

  const handleDownload = () => {
    exportTelecallerExcelSheet(leads, {
      telecallerName: selectedTelecaller,
      stageFilter: selectedStage,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#0b132b] border border-[#1e293b] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1e293b] bg-[#070d1a] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Export Telecaller Calling Sheet</h2>
              <p className="text-xs text-slate-400">Excel (.xlsx) workbook optimized for phone calling workflows</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* Telecaller Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Select Calling Agent / Telecaller
            </label>
            <div className="relative">
              <select
                disabled={currentRole === 'salesperson'}
                value={selectedTelecaller}
                onChange={(e) => setSelectedTelecaller(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#070d1a] border border-[#1e293b] text-xs text-white focus:outline-none focus:border-emerald-500 disabled:opacity-60 cursor-pointer"
              >
                {currentRole === 'admin' && <option value="ALL">All Telecallers (Full Master Sheet)</option>}
                {telecallers.map((t) => (
                  <option key={t} value={t}>
                    {t} {t === currentUserName ? '(You)' : ''}
                  </option>
                ))}
                {currentRole === 'admin' && <option value="Unassigned">Unassigned Leads (For New Allocation)</option>}
              </select>
            </div>
            {currentRole === 'salesperson' && (
              <p className="text-[11px] text-slate-400 mt-1">
                As a telecaller, you are exporting your assigned prospects.
              </p>
            )}
          </div>

          {/* Stage Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Filter by Pipeline Stage
            </label>
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#070d1a] border border-[#1e293b] text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="ALL">All Calling Stages</option>
              <option value="NEW">NEW (Fresh Inbound WhatsApp Leads)</option>
              <option value="CONTACTED">CONTACTED (Follow-up Calls)</option>
              <option value="QUALIFIED">QUALIFIED (High Intent Viable Prospects)</option>
              <option value="FOLLOW_UP">FOLLOW_UP (Scheduled Callbacks)</option>
              <option value="PAYMENT_PENDING">PAYMENT_PENDING (Advance Token Follow-up)</option>
            </select>
          </div>

          {/* Included Columns Feature Callout */}
          <div className="p-4 rounded-xl bg-[#070d1a] border border-[#1e293b] space-y-2">
            <span className="text-xs font-bold text-emerald-400 block">
              Optimized Telecaller Columns Included:
            </span>
            <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
              <li>Calling Priority &amp; Overdue Call flags</li>
              <li>Customer name, phone, click-to-call link, &amp; WhatsApp link</li>
              <li>Interested package, travel dates, travelers, &amp; estimated budget</li>
              <li>Past follow-up notes &amp; internal CRM remarks</li>
              <li>Blank outcome &amp; remarks columns for telecaller notes</li>
            </ul>
          </div>

          {/* Count Preview Banner */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
            <span className="text-slate-300 font-medium">Prospects in this calling sheet:</span>
            <span className="font-bold text-emerald-400 text-sm">{previewCount} Leads</span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-[#1e293b] bg-[#070d1a] flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#111d3d] text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={previewCount === 0}
            className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-[#070d1a] font-bold text-xs shadow-md shadow-emerald-500/20 transition flex items-center space-x-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Excel Sheet (.xlsx)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
