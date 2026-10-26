'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Send, 
  Search, 
  Check, 
  CheckCheck, 
  Sparkles,
  ChevronLeft
} from 'lucide-react';
import { Lead, WhatsAppMessage } from '../../lib/types/crm';
import { leadService } from '../../lib/services/leads';
import { formatPhoneDisplay } from '../../lib/utils/phone';

interface MessagesViewProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  onRefresh: () => void;
}

export function MessagesView({
  leads,
  onSelectLead,
  onRefresh,
}: MessagesViewProps) {
  const [selectedLeadId, setSelectedLeadId] = useState<string>(leads[0]?.id || '');
  const [composerText, setComposerText] = useState('');
  const [search, setSearch] = useState('');
  const [showMobileChat, setShowMobileChat] = useState(false);

  const currentLead = useMemo(() => {
    return leads.find((l) => l.id === selectedLeadId) || leads[0] || null;
  }, [leads, selectedLeadId]);

  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (!currentLead?.id) {
        setMessages([]);
        return;
      }
      setLoadingMessages(true);
      leadService.getLeadMessages(currentLead.id).then((data) => {
        if (active) {
          setMessages(data);
          setLoadingMessages(false);
        }
      }).catch(() => {
        if (active) setLoadingMessages(false);
      });
    }, 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [currentLead?.id]);

  const filteredConversations = useMemo(() => {
    return leads.filter((l) => {
      const q = search.toLowerCase();
      return (
        l.name.toLowerCase().includes(q) ||
        l.phone.includes(q) ||
        (l.interested_destination && l.interested_destination.toLowerCase().includes(q))
      );
    });
  }, [leads, search]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composerText.trim() || !currentLead) return;

    const text = composerText.trim();
    setComposerText('');
    await leadService.sendWhatsAppMessage(currentLead.id, text);
    const updated = await leadService.getLeadMessages(currentLead.id);
    setMessages(updated);
    onRefresh();
  };

  const handleTemplateSelect = (templateText: string) => {
    setComposerText(templateText);
  };

  const travelTemplates = [
    {
      title: 'Bali Brochure',
      text: 'Hello! Here is the customized Bali 7D/6N itinerary with private luxury pool villas in Seminyak and Ubud. Let us know if you would like floating breakfast included!',
    },
    {
      title: 'Token Payment Link',
      text: 'Your custom holiday package has been prepared. To lock the booking at this price, please complete the initial token advance here: https://tripinnholidays.com/pay/token',
    },
    {
      title: 'Visa & Passport Checklist',
      text: 'For your upcoming tour, please ensure your passport has at least 6 months validity. Our visa team will assist with seamless approvals.',
    },
  ];

  return (
    <div className="bg-[#0b132b] rounded-2xl border border-white/[0.08] flex flex-col md:flex-row h-[78vh] overflow-hidden shadow-2xl relative">
      {/* Left Column: Conversations List (Shown when no chat active on mobile, or on desktop) */}
      <div className={`w-full md:w-80 border-r border-[#1e293b] flex flex-col bg-[#070d1a] ${showMobileChat ? 'hidden md:flex' : 'flex'}`}>
        {/* Search Header */}
        <div className="p-3.5 border-b border-[#1e293b]">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0b132b] border border-white/[0.06] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 min-h-[38px]"
            />
          </div>
        </div>

        {/* Conversations Scroll */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#1e293b]/60">
          {filteredConversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No conversations found.
            </div>
          ) : (
            filteredConversations.map((item) => {
              const isSelected = item.id === currentLead?.id;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedLeadId(item.id);
                    setShowMobileChat(true);
                  }}
                  className={`p-3.5 transition cursor-pointer flex items-start space-x-3 active:scale-[0.99] ${
                    isSelected ? 'bg-[#111d3d] md:border-l-4 md:border-emerald-400' : 'hover:bg-[#0e172e]'
                  }`}
                >
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center font-bold text-xs text-emerald-300 shrink-0 shadow-xs">
                    {item.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white truncate tracking-tight">{item.name}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-400 truncate mt-0.5 font-medium">
                      {item.interested_destination || 'Trip Enquiry'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {formatPhoneDisplay(item.phone)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Active Conversation (Shown on mobile when chat selected, or on desktop) */}
      {currentLead ? (
        <div className={`flex-1 flex flex-col bg-[#0b132b] ${showMobileChat ? 'flex' : 'hidden md:flex'}`}>
          {/* Conversation Header with iOS Back button */}
          <div className="px-4 sm:px-5 py-3 border-b border-[#1e293b] bg-[#070d1a] flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
              {/* iOS Mobile Back to Chats Button */}
              <button
                type="button"
                onClick={() => setShowMobileChat(false)}
                className="md:hidden p-1.5 -ml-1 rounded-xl bg-slate-800 text-emerald-400 flex items-center justify-center active:scale-90 cursor-pointer min-w-[34px] min-h-[34px]"
                title="Back to Conversations"
                aria-label="Back to conversations list"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                {currentLead.name.substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-1.5 flex-wrap gap-y-0.5">
                  <h3 className="font-bold text-sm text-white truncate max-w-[150px] sm:max-w-none">{currentLead.name}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
                    {currentLead.lead_status}
                  </span>
                  {currentLead.ctwa_clid && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/40 flex items-center space-x-1">
                      <Sparkles className="w-3 h-3" />
                      <span className="hidden xs:inline">Meta Ad</span>
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 font-mono flex items-center space-x-2 truncate">
                  <span>{formatPhoneDisplay(currentLead.phone)}</span>
                  {currentLead.interested_destination && (
                    <span className="hidden sm:inline">• {currentLead.interested_destination}</span>
                  )}
                  {loadingMessages && <span className="text-[10px] text-emerald-400 animate-pulse">(syncing...)</span>}
                </div>
              </div>
            </div>

            <button
              onClick={() => onSelectLead(currentLead)}
              className="px-3 py-1.5 rounded-xl bg-[#111d3d] hover:bg-[#1b2d5a] text-slate-200 text-xs font-semibold border border-white/[0.08] transition active:scale-95 shrink-0"
            >
              <span className="hidden xs:inline">View </span>Profile
            </button>
          </div>

          {/* Quick Travel Templates Bar - Horizontal Carousel */}
          <div className="px-4 sm:px-5 py-2 bg-[#091124] border-b border-[#1e293b] flex items-center space-x-2 overflow-x-auto scrollbar-none text-xs shrink-0">
            <span className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider shrink-0">Quick Templates:</span>
            {travelTemplates.map((t, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleTemplateSelect(t.text)}
                className="px-3 py-1 rounded-full bg-[#111d3d] hover:bg-emerald-500/20 hover:text-emerald-300 text-slate-300 text-[11px] font-medium border border-white/[0.06] shrink-0 transition active:scale-95 cursor-pointer"
              >
                {t.title}
              </button>
            ))}
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-[#080e21]">
            {messages.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                No chat messages recorded yet for this client. Type below to send an official WhatsApp message.
              </div>
            ) : (
              messages.map((msg) => {
                const isOutbound = msg.direction === 'outbound';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-xs shadow-md ${
                        isOutbound
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-br-xs'
                          : 'bg-[#111d3d] text-slate-200 border border-slate-700/60 rounded-bl-xs'
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.message_body}</p>
                      <div
                        className={`flex items-center justify-end space-x-1 text-[10px] mt-1.5 ${
                          isOutbound ? 'text-emerald-200/90' : 'text-slate-400'
                        }`}
                      >
                        <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {isOutbound && (
                          <span title={msg.status === 'read' ? 'Read by customer' : msg.status === 'delivered' ? 'Delivered' : 'Sent to WhatsApp Server'}>
                            {msg.status === 'read' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-cyan-200" />
                            ) : msg.status === 'delivered' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-emerald-200" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Message Input Box with Apple styling */}
          <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t border-[#1e293b] bg-[#070d1a] flex items-center space-x-2 sm:space-x-3 shrink-0">
            <input
              type="text"
              placeholder={`Reply to ${currentLead.name} on WhatsApp...`}
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-2xl bg-[#0b132b] border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 min-h-[44px]"
            />
            <button
              type="submit"
              disabled={!composerText.trim()}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 disabled:opacity-50 text-[#070d1a] font-bold text-xs transition flex items-center space-x-1.5 shadow-md shadow-emerald-500/20 cursor-pointer min-h-[44px] active:scale-95 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Send</span>
            </button>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
          Select a conversation from the left to view messages.
        </div>
      )}
    </div>
  );
}
