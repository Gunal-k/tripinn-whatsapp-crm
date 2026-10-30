'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  QrCode,
  Smartphone,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Power,
  Send,
  Loader2,
  Clock,
  Radio,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  Info,
  Check,
  CheckCheck,
  MessageSquare,
  Search,
  Plus,
  ArrowLeft,
  Paperclip,
  Smile,
  Phone,
  MoreVertical,
  Users,
  User,
  Image as ImageIcon,
  FileText,
  Mic,
  MapPin,
  X,
  ChevronRight,
  Filter,
  LogOut,
  SendHorizontal,
} from 'lucide-react';
import { formatPhoneDisplay, normalizePhoneNumber } from '../../lib/utils/phone';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'qr_ready' | 'connected' | 'reconnecting' | 'failed';

interface SessionStatusData {
  sessionId: string;
  status: ConnectionStatus;
  qrCode?: string | null;
  phoneNumber?: string | null;
  pushName?: string | null;
  platform?: string | null;
  connectedAt?: string | null;
  error?: string | null;
}

interface MessageRecord {
  providerMessageId: string;
  direction: 'inbound' | 'outbound';
  fromPhone: string;
  toPhone: string;
  messageBody: string;
  messageType?: string;
  chatType?: 'direct' | 'group';
  senderPhone?: string;
  senderName?: string;
  groupJid?: string;
  groupName?: string;
  matchedLeadName?: string;
  createdAt?: string;
}

interface ChatThread {
  chatId: string;
  name: string;
  phone: string;
  chatType: 'direct' | 'group';
  groupName?: string;
  senderName?: string;
  matchedLeadName?: string;
  lastMessage: string;
  lastTimestamp: string;
  lastDirection: 'inbound' | 'outbound';
  messages: MessageRecord[];
}

interface CrmLeadOption {
  id: string;
  name: string;
  phone: string;
  lead_status?: string;
}

interface ExperimentalQrCardProps {
  standalone?: boolean;
}

const CANNED_TEMPLATES = [
  {
    label: '👋 Welcome Greeting',
    text: 'Hello from TripInn Holidays! 🌴 Thank you for connecting with us. How can our travel specialists assist with your holiday plans today?',
  },
  {
    label: '✈️ Custom Itinerary',
    text: 'We have prepared your customized travel package itinerary! Would you like us to share the day-wise schedule and hotel options here?',
  },
  {
    label: '📞 Quick Call Request',
    text: 'Are you available for a quick 2-minute call to finalize your travel dates and preferred hotel category?',
  },
  {
    label: '🏷️ Holiday Discount',
    text: 'Exciting news! We have an exclusive seasonal discount voucher applicable for your requested destination. Let us know if you would like us to apply it!',
  },
];

const QUICK_EMOJIS = ['👍', '🌴', '✈️', '🏨', '📞', '💬', '🎉', '😊', '🏖️', '❤️'];

export function ExperimentalQrCard({ standalone = false }: ExperimentalQrCardProps) {
  // Session Connection State
  const [session, setSession] = useState<SessionStatusData>({
    sessionId: 'default_test_session',
    status: 'disconnected',
    qrCode: null,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [daemonOnline, setDaemonOnline] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);

  // Chat and Messaging State
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState<string>('');
  const [sendingMessage, setSendingMessage] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'direct' | 'group' | 'leads'>('all');
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState<boolean>(false);

  // New Chat Modal State
  const [isNewChatOpen, setIsNewChatOpen] = useState<boolean>(false);
  const [newChatPhone, setNewChatPhone] = useState<string>('');
  const [newChatMessage, setNewChatMessage] = useState<string>('Hello from TripInn Holidays!');
  const [startingChat, setStartingChat] = useState<boolean>(false);
  const [crmLeads, setCrmLeads] = useState<CrmLeadOption[]>([]);

  // Auto-scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isPollingRef = useRef<boolean>(false);

  // 1. Fetch Session Status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/experimental/whatsapp-qr/status');
      if (res.ok) {
        const json = await res.json();
        setDaemonOnline(json.serviceOnline !== false);
        if (json.data) {
          setSession({
            sessionId: json.data.sessionId || 'default_test_session',
            status: json.data.status || 'disconnected',
            qrCode: json.data.qrCodeDataUrl || json.data.qrCode || null,
            phoneNumber: json.data.phoneNumber || null,
            pushName: json.data.pushName || null,
            platform: json.data.platform || null,
            connectedAt: json.data.connectedAt || null,
            error: json.data.lastError || null,
          });
        }
      } else {
        setDaemonOnline(false);
      }
    } catch {
      setDaemonOnline(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Fetch Messages Stream
  const fetchMessages = useCallback(async () => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;
    try {
      setLoadingMessages(true);
      const res = await fetch('/api/experimental/whatsapp-qr/messages');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data)) {
          setMessages(json.data);
        }
      }
    } catch (err) {
      console.warn('Could not fetch messages:', err);
    } finally {
      setLoadingMessages(false);
      isPollingRef.current = false;
    }
  }, []);

  // 3. Fetch CRM Leads for Quick Contact Picker
  useEffect(() => {
    async function loadLeads() {
      try {
        const res = await fetch('/api/admin/leads');
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.leads)) {
            setCrmLeads(
              json.leads.map((l: any) => ({
                id: l.id,
                name: l.name,
                phone: l.phone,
                lead_status: l.lead_status || l.status,
              }))
            );
          }
        }
      } catch {
        // Optional fallback for local dev
      }
    }
    loadLeads();
  }, []);

  // Initial poll & recurring status sync
  useEffect(() => {
    fetchStatus();
    const statusInterval = setInterval(fetchStatus, 4000);
    return () => clearInterval(statusInterval);
  }, [fetchStatus]);

  // Message polling when connected
  useEffect(() => {
    if (session.status === 'connected') {
      fetchMessages();
      const msgInterval = setInterval(fetchMessages, 3500);
      return () => clearInterval(msgInterval);
    }
  }, [session.status, fetchMessages]);

  // Derive conversation threads from messages
  const conversations = useMemo(() => {
    const threadMap = new Map<string, ChatThread>();

    for (const m of messages) {
      const isGrp =
        m.chatType === 'group' ||
        (m.fromPhone && m.fromPhone.length > 15) ||
        (m.toPhone && m.toPhone.length > 15);

      const chatId = isGrp
        ? (m.groupJid || (m.fromPhone.length > 15 ? m.fromPhone : m.toPhone))
        : (m.direction === 'outbound' ? m.toPhone : m.fromPhone);

      if (!chatId) continue;

      let name = '';
      if (isGrp) {
        name = m.groupName || (chatId.length > 15 ? `WhatsApp Group #${chatId.slice(-4)}` : 'WhatsApp Group');
      } else {
        name = m.matchedLeadName || m.senderName || formatPhoneDisplay(chatId);
      }

      if (!threadMap.has(chatId)) {
        threadMap.set(chatId, {
          chatId,
          name,
          phone: chatId,
          chatType: isGrp ? 'group' : 'direct',
          groupName: m.groupName,
          senderName: m.senderName,
          matchedLeadName: m.matchedLeadName,
          lastMessage: m.messageBody,
          lastTimestamp: m.createdAt || '',
          lastDirection: m.direction,
          messages: [],
        });
      }

      const thread = threadMap.get(chatId)!;
      thread.messages.push(m);

      // Keep latest message info
      if (
        !thread.lastTimestamp ||
        (m.createdAt && new Date(m.createdAt).getTime() >= new Date(thread.lastTimestamp).getTime())
      ) {
        thread.lastMessage = m.messageBody;
        thread.lastTimestamp = m.createdAt || '';
        thread.lastDirection = m.direction;
        if (m.matchedLeadName) thread.matchedLeadName = m.matchedLeadName;
        if (m.senderName && !thread.matchedLeadName) thread.senderName = m.senderName;
        if (m.groupName) thread.groupName = m.groupName;
      }
    }

    // Sort messages chronologically inside each thread
    for (const thread of threadMap.values()) {
      thread.messages.sort(
        (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
      );
    }

    // Return threads sorted by last activity (newest first)
    return Array.from(threadMap.values()).sort(
      (a, b) => new Date(b.lastTimestamp || 0).getTime() - new Date(a.lastTimestamp || 0).getTime()
    );
  }, [messages]);

  // Active chat object
  const activeChat = useMemo(() => {
    if (!selectedChatId) return null;
    return conversations.find((c) => c.chatId === selectedChatId) || null;
  }, [conversations, selectedChatId]);

  // Auto-scroll chat window when new message arrives or chat changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedChatId, activeChat?.messages.length]);

  // Connect / QR Generator
  const handleConnect = async () => {
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/experimental/whatsapp-qr/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'default_test_session' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to start pairing session.');
      } else if (data.data) {
        setSession(data.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setErrorMessage(`Request error: ${msg}`);
    } finally {
      setActionLoading(false);
      fetchStatus();
    }
  };

  // Disconnect Session
  const handleDisconnect = async () => {
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/experimental/whatsapp-qr/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'default_test_session' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to disconnect session.');
      } else {
        setSession({
          sessionId: 'default_test_session',
          status: 'disconnected',
          qrCode: null,
          phoneNumber: null,
        });
        setSelectedChatId(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Disconnect failed';
      setErrorMessage(`Disconnect error: ${msg}`);
    } finally {
      setActionLoading(false);
      fetchStatus();
    }
  };

  // Send Message in Active Chat
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeChat || !messageInput.trim() || sendingMessage) return;

    const textToSend = messageInput.trim();
    const targetRecipient = activeChat.phone;

    setMessageInput('');
    setSendingMessage(true);

    // Optimistic UI push
    const optimisticId = `optimistic_${Date.now()}`;
    const optimisticMsg: MessageRecord = {
      providerMessageId: optimisticId,
      direction: 'outbound',
      fromPhone: session.phoneNumber || '',
      toPhone: targetRecipient,
      messageBody: textToSend,
      messageType: 'text',
      chatType: activeChat.chatType,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [optimisticMsg, ...prev]);

    try {
      const res = await fetch('/api/experimental/whatsapp-qr/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: targetRecipient,
          toPhone: targetRecipient,
          text: textToSend,
          messageText: textToSend,
          sessionId: session.sessionId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to send message.');
      } else {
        fetchMessages();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Send error';
      setErrorMessage(`Send error: ${msg}`);
    } finally {
      setSendingMessage(false);
    }
  };

  // Start New Chat from modal
  const handleStartNewChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatPhone.trim() || !newChatMessage.trim()) return;

    const cleanPhone = normalizePhoneNumber(newChatPhone);
    if (!cleanPhone || cleanPhone.length < 8) {
      setErrorMessage('Please enter a valid phone number with country code (e.g. 918971997781).');
      return;
    }

    setStartingChat(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/experimental/whatsapp-qr/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: cleanPhone,
          toPhone: cleanPhone,
          text: newChatMessage.trim(),
          messageText: newChatMessage.trim(),
          sessionId: session.sessionId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to start chat.');
      } else {
        setSelectedChatId(cleanPhone);
        setIsNewChatOpen(false);
        setNewChatPhone('');
        setIsMobileChatOpen(true);
        fetchMessages();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error starting chat';
      setErrorMessage(`Request error: ${msg}`);
    } finally {
      setStartingChat(false);
    }
  };

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      // Filter tab
      if (activeFilter === 'direct' && c.chatType !== 'direct') return false;
      if (activeFilter === 'group' && c.chatType !== 'group') return false;
      if (activeFilter === 'leads' && !c.matchedLeadName) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesPhone = c.phone.toLowerCase().includes(q);
        const matchesLastMsg = c.lastMessage.toLowerCase().includes(q);
        const matchesLead = c.matchedLeadName?.toLowerCase().includes(q);
        return matchesName || matchesPhone || matchesLastMsg || matchesLead;
      }

      return true;
    });
  }, [conversations, activeFilter, searchQuery]);

  // Format timestamp helper
  const formatTime = (iso?: string) => {
    if (!iso) return '';
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Avatar background color generator
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-emerald-600',
      'bg-teal-600',
      'bg-cyan-600',
      'bg-blue-600',
      'bg-indigo-600',
      'bg-purple-600',
      'bg-rose-600',
      'bg-amber-600',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className={`w-full font-sans ${standalone ? 'h-[calc(100vh-120px)] min-h-[680px]' : 'h-[750px]'}`}>
      
      {/* ========================================================================= */}
      {/* CASE 1: NOT CONNECTED (WHATSAPP WEB LOGIN / QR CODE SCAN SCREEN) */}
      {/* ========================================================================= */}
      {session.status !== 'connected' ? (
        <div className="h-full w-full bg-[#111b21] rounded-2xl border border-[#222d34] shadow-2xl flex flex-col overflow-hidden">
          
          {/* WhatsApp Web Brand Header Bar */}
          <div className="bg-[#00a884] px-6 py-4 flex items-center justify-between shadow-md">
            <div className="flex items-center space-x-3 text-white">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold tracking-tight">TripInn WhatsApp Web</h2>
                <p className="text-xs text-emerald-100/90 font-medium">
                  Experimental Multi-Device Baileys Connection
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/30 text-emerald-100 border border-emerald-400/30">
                <Radio className="w-3 h-3 text-emerald-300 animate-pulse" />
                <span>Daemon Port 3001</span>
              </span>
              <button
                onClick={() => setShowInfoModal(true)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
                title="Sandbox Security & Architecture"
              >
                <Info className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Pairing Canvas */}
          <div className="flex-1 bg-[#111b21] flex items-center justify-center p-4 sm:p-8 overflow-y-auto">
            <div className="w-full max-w-4xl bg-[#202c33] rounded-2xl border border-[#2a3942] p-6 sm:p-10 shadow-2xl">
              
              {/* Error Banner if any */}
              {errorMessage && (
                <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                  <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-200">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* State: Connecting */}
              {session.status === 'connecting' || session.status === 'reconnecting' ? (
                <div className="py-16 flex flex-col items-center justify-center text-center space-y-5">
                  <div className="w-16 h-16 rounded-full bg-[#00a884]/15 border border-[#00a884]/30 flex items-center justify-center text-[#00a884]">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Connecting to WhatsApp...</h3>
                    {session.phoneNumber ? (
                      <div className="mt-2 inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#00a884]/20 border border-[#00a884]/40 text-[#00a884] font-mono text-xs font-bold">
                        <span>📱 Linked Number:</span>
                        <span>{formatPhoneDisplay(session.phoneNumber)}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 max-w-md mt-1">
                        Initializing Baileys cryptographic socket and generating a fresh QR code keypair.
                      </p>
                    )}
                  </div>
                </div>
              ) : session.status === 'qr_ready' && session.qrCode ? (
                /* State: QR Code Ready To Scan */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 items-center">
                  
                  {/* Left: Step-by-Step Instructions */}
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-bold text-white tracking-tight">
                        Use WhatsApp on TripInn CRM
                      </h3>
                      <p className="text-xs text-slate-400 mt-1.5">
                        Follow these instructions on your dedicated test phone:
                      </p>
                    </div>

                    <ol className="space-y-4 text-xs text-slate-300">
                      <li className="flex items-start space-x-3.5">
                        <span className="w-6 h-6 rounded-full bg-[#00a884]/20 text-[#00a884] font-bold text-xs flex items-center justify-center shrink-0 border border-[#00a884]/30">
                          1
                        </span>
                        <span>Open <strong>WhatsApp</strong> on your test smartphone.</span>
                      </li>
                      <li className="flex items-start space-x-3.5">
                        <span className="w-6 h-6 rounded-full bg-[#00a884]/20 text-[#00a884] font-bold text-xs flex items-center justify-center shrink-0 border border-[#00a884]/30">
                          2
                        </span>
                        <span>
                          Tap <strong>Menu (⋮)</strong> on Android or <strong>Settings (⚙️)</strong> on iPhone.
                        </span>
                      </li>
                      <li className="flex items-start space-x-3.5">
                        <span className="w-6 h-6 rounded-full bg-[#00a884]/20 text-[#00a884] font-bold text-xs flex items-center justify-center shrink-0 border border-[#00a884]/30">
                          3
                        </span>
                        <span>
                          Select <strong>Linked Devices</strong> and tap{' '}
                          <strong className="text-[#00a884]">Link a Device</strong>.
                        </span>
                      </li>
                      <li className="flex items-start space-x-3.5">
                        <span className="w-6 h-6 rounded-full bg-[#00a884]/20 text-[#00a884] font-bold text-xs flex items-center justify-center shrink-0 border border-[#00a884]/30">
                          4
                        </span>
                        <span>Point your phone camera to this screen to capture the QR code.</span>
                      </li>
                    </ol>

                    {session.phoneNumber && (
                      <div className="bg-[#182229] border border-[#2a3942] rounded-xl p-3 text-xs text-slate-300">
                        <div className="font-semibold text-white flex items-center space-x-1.5">
                          <Smartphone className="w-4 h-4 text-[#00a884]" />
                          <span>Last Paired Number:</span>
                        </div>
                        <p className="text-xs text-[#00a884] font-mono font-bold mt-1">
                          📱 {formatPhoneDisplay(session.phoneNumber)} {session.pushName ? `(${session.pushName})` : ''}
                        </p>
                      </div>
                    )}

                    <div className="pt-2 border-t border-[#2a3942] flex items-center justify-between text-xs">
                      <span className="text-slate-400 flex items-center space-x-1.5">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#00a884]" />
                        <span>Auto-refreshes periodically</span>
                      </span>
                      <button
                        onClick={handleConnect}
                        disabled={actionLoading}
                        className="text-[#00a884] hover:underline font-semibold cursor-pointer disabled:opacity-50"
                      >
                        Refresh Code
                      </button>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-[11px] text-amber-300 flex items-start space-x-2">
                      <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        <strong>Sandbox Notice:</strong> Only scan using a physical test number. Never use your official Meta WABA business number.
                      </span>
                    </div>
                  </div>

                  {/* Right: High-Resolution QR Display */}
                  <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-xl max-w-[280px] mx-auto border-4 border-[#00a884]/40">
                    <img
                      src={session.qrCode}
                      alt="WhatsApp Web QR Code"
                      className="w-56 h-56 object-contain"
                    />
                    <div className="mt-3 text-center">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900">
                        <span className="w-2 h-2 rounded-full bg-[#00a884] animate-ping" />
                        <span>Ready to scan</span>
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* State: Disconnected */
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-6">
                  <div className="w-20 h-20 rounded-full bg-[#111b21] border border-[#2a3942] flex items-center justify-center text-slate-400 shadow-inner">
                    <QrCode className="w-10 h-10 text-[#00a884]" />
                  </div>
                  <div className="space-y-2 max-w-md">
                    <h3 className="text-xl font-bold text-white tracking-tight">
                      Connect WhatsApp Web
                    </h3>
                    {session.phoneNumber ? (
                      <div className="p-3 rounded-xl bg-[#111b21] border border-[#2a3942] inline-block space-y-1">
                        <div className="text-[11px] text-slate-400">Previously Paired Device:</div>
                        <div className="text-sm font-bold text-[#00a884] font-mono">
                          📱 {formatPhoneDisplay(session.phoneNumber)} {session.pushName ? `(${session.pushName})` : ''}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Link your dedicated test smartphone to simulate real WhatsApp customer chats in an isolated sandbox without affecting official Meta Cloud API messages.
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleConnect}
                    disabled={actionLoading || !daemonOnline}
                    className="px-6 py-3 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-bold transition shadow-lg shadow-[#00a884]/20 flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <QrCode className="w-4 h-4" />
                    )}
                    <span>{session.phoneNumber ? 'Reconnect Saved WhatsApp' : 'Generate WhatsApp QR Code'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* CASE 2: CONNECTED (WHATSAPP WEB 2-COLUMN MESSAGING WORKSPACE)             */
        /* ========================================================================= */
        <div className="h-full w-full bg-[#111b21] rounded-2xl border border-[#222d34] shadow-2xl flex flex-col overflow-hidden">
          
          {/* Top Bar: Connected Device & Status */}
          <div className="h-14 bg-[#202c33] border-b border-[#222d34] px-4 flex items-center justify-between shrink-0 select-none">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-[#00a884] text-white font-bold text-xs flex items-center justify-center shadow">
                  {session.pushName?.charAt(0) || 'WA'}
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#202c33]" />
              </div>
              <div className="leading-tight">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-white">
                    {session.pushName || 'Connected WhatsApp Device'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#00a884] text-white shadow">
                    📱 {session.phoneNumber ? formatPhoneDisplay(session.phoneNumber) : 'Connecting...'}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    ● Active
                  </span>
                </div>
                <span className="text-[11px] text-[#8696a0] font-mono">
                  {session.platform || 'WhatsApp Multi-Device'} • Session: {session.sessionId}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsNewChatOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer shadow"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Chat</span>
              </button>

              <button
                onClick={fetchMessages}
                disabled={loadingMessages}
                className="p-2 text-[#8696a0] hover:text-white hover:bg-[#111b21] rounded-lg transition cursor-pointer"
                title="Refresh Messages"
              >
                <RefreshCw className={`w-4 h-4 ${loadingMessages ? 'animate-spin text-[#00a884]' : ''}`} />
              </button>

              <button
                onClick={() => setShowInfoModal(true)}
                className="p-2 text-[#8696a0] hover:text-white hover:bg-[#111b21] rounded-lg transition cursor-pointer"
                title="Experimental Sandbox Details"
              >
                <Info className="w-4 h-4" />
              </button>

              <button
                onClick={handleDisconnect}
                disabled={actionLoading}
                className="p-2 text-[#8696a0] hover:text-rose-400 hover:bg-[#111b21] rounded-lg transition cursor-pointer"
                title="Disconnect WhatsApp"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 2-Column WhatsApp Web Workspace */}
          <div className="flex-1 flex overflow-hidden">
            
            {/* ------------------------------------------------------------- */}
            {/* LEFT COLUMN: CHATS SIDEBAR                                    */}
            {/* ------------------------------------------------------------- */}
            <div
              className={`w-full md:w-80 lg:w-96 bg-[#111b21] border-r border-[#222d34] flex flex-col shrink-0 ${
                isMobileChatOpen ? 'hidden md:flex' : 'flex'
              }`}
            >
              {/* Search Bar */}
              <div className="p-2.5 border-b border-[#222d34] space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#8696a0]" />
                  <input
                    type="text"
                    placeholder="Search or start new chat"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#202c33] text-xs text-white rounded-lg pl-9 pr-8 py-2 placeholder-[#8696a0] focus:outline-none focus:ring-1 focus:ring-[#00a884] border border-transparent"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-[#8696a0] hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center space-x-1 text-[11px] overflow-x-auto pb-0.5">
                  <button
                    onClick={() => setActiveFilter('all')}
                    className={`px-2.5 py-1 rounded-full transition cursor-pointer font-medium whitespace-nowrap ${
                      activeFilter === 'all'
                        ? 'bg-[#00a884] text-white font-bold'
                        : 'bg-[#202c33] text-[#8696a0] hover:text-white'
                    }`}
                  >
                    All ({conversations.length})
                  </button>
                  <button
                    onClick={() => setActiveFilter('direct')}
                    className={`px-2.5 py-1 rounded-full transition cursor-pointer font-medium whitespace-nowrap ${
                      activeFilter === 'direct'
                        ? 'bg-[#00a884] text-white font-bold'
                        : 'bg-[#202c33] text-[#8696a0] hover:text-white'
                    }`}
                  >
                    Direct ({conversations.filter((c) => c.chatType === 'direct').length})
                  </button>
                  <button
                    onClick={() => setActiveFilter('group')}
                    className={`px-2.5 py-1 rounded-full transition cursor-pointer font-medium whitespace-nowrap ${
                      activeFilter === 'group'
                        ? 'bg-[#00a884] text-white font-bold'
                        : 'bg-[#202c33] text-[#8696a0] hover:text-white'
                    }`}
                  >
                    Groups ({conversations.filter((c) => c.chatType === 'group').length})
                  </button>
                  <button
                    onClick={() => setActiveFilter('leads')}
                    className={`px-2.5 py-1 rounded-full transition cursor-pointer font-medium whitespace-nowrap ${
                      activeFilter === 'leads'
                        ? 'bg-[#00a884] text-white font-bold'
                        : 'bg-[#202c33] text-[#8696a0] hover:text-white'
                    }`}
                  >
                    CRM Leads ({conversations.filter((c) => c.matchedLeadName).length})
                  </button>
                </div>
              </div>

              {/* Conversations List */}
              <div className="flex-1 overflow-y-auto divide-y divide-[#222d34]/60">
                {filteredConversations.length === 0 ? (
                  <div className="py-12 px-6 text-center text-xs text-[#8696a0] space-y-2">
                    <p>No conversations found.</p>
                    <button
                      onClick={() => setIsNewChatOpen(true)}
                      className="text-[#00a884] hover:underline font-semibold inline-flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Start a new chat</span>
                    </button>
                  </div>
                ) : (
                  filteredConversations.map((chat) => {
                    const isSelected = selectedChatId === chat.chatId;
                    const isGrp = chat.chatType === 'group';

                    return (
                      <div
                        key={chat.chatId}
                        onClick={() => {
                          setSelectedChatId(chat.chatId);
                          setIsMobileChatOpen(true);
                        }}
                        className={`px-3 py-3 flex items-start space-x-3 cursor-pointer transition select-none ${
                          isSelected ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]'
                        }`}
                      >
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          <div
                            className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                              isGrp ? 'bg-[#202c33] border border-[#2a3942]' : getAvatarColor(chat.name)
                            }`}
                          >
                            {isGrp ? <Users className="w-5 h-5 text-[#8696a0]" /> : chat.name.charAt(0).toUpperCase()}
                          </div>
                        </div>

                        {/* Thread Preview */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-white truncate max-w-[170px]">
                              {chat.name}
                            </span>
                            <span className="text-[10px] text-[#8696a0] shrink-0 font-mono">
                              {formatTime(chat.lastTimestamp)}
                            </span>
                          </div>

                          {/* Customer Phone Number */}
                          <div className="text-[11px] text-[#00a884] font-mono font-medium truncate mt-0.5">
                            {isGrp ? (
                              <span className="text-amber-300 flex items-center space-x-1">
                                <span>👥</span>
                                <span>Group Chat</span>
                              </span>
                            ) : (
                              <span>📱 {formatPhoneDisplay(chat.phone)}</span>
                            )}
                          </div>

                          <div className="flex items-center justify-between mt-1">
                            <p className="text-xs text-[#8696a0] truncate max-w-[200px] flex items-center space-x-1">
                              {chat.lastDirection === 'outbound' && (
                                <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] shrink-0 inline mr-1" />
                              )}
                              <span>{chat.lastMessage}</span>
                            </p>
                          </div>

                          {/* Badges */}
                          <div className="flex items-center space-x-1.5 mt-1.5 flex-wrap gap-y-1">
                            {chat.matchedLeadName && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                🎯 CRM Lead
                              </span>
                            )}
                            {isGrp && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                👥 Group
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* RIGHT COLUMN: ACTIVE CHAT CONVERSATION OR EMPTY SPLASH       */}
            {/* ------------------------------------------------------------- */}
            <div
              className={`flex-1 bg-[#0b141a] flex flex-col overflow-hidden ${
                !isMobileChatOpen ? 'hidden md:flex' : 'flex'
              }`}
            >
              {activeChat ? (
                <>
                  {/* Chat Header */}
                  <div className="h-14 bg-[#202c33] border-b border-[#222d34] px-4 flex items-center justify-between shrink-0 select-none">
                    <div className="flex items-center space-x-3 min-w-0">
                      <button
                        onClick={() => setIsMobileChatOpen(false)}
                        className="md:hidden p-1.5 text-[#8696a0] hover:text-white"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>

                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 ${
                          activeChat.chatType === 'group'
                            ? 'bg-[#111b21] border border-[#2a3942]'
                            : getAvatarColor(activeChat.name)
                        }`}
                      >
                        {activeChat.chatType === 'group' ? (
                          <Users className="w-4 h-4 text-[#8696a0]" />
                        ) : (
                          activeChat.name.charAt(0).toUpperCase()
                        )}
                      </div>

                      <div className="leading-tight truncate">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-xs font-bold text-white truncate">{activeChat.name}</h3>
                          {activeChat.matchedLeadName && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                              CRM Lead
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#00a884] font-mono font-semibold flex items-center space-x-1 mt-0.5">
                          <span>📱</span>
                          <span>
                            {activeChat.chatType === 'group'
                              ? 'WhatsApp Group Chat'
                              : formatPhoneDisplay(activeChat.phone)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => {
                          const num = normalizePhoneNumber(activeChat.phone);
                          if (num) window.open(`tel:+${num}`);
                        }}
                        className="p-2 text-[#8696a0] hover:text-white hover:bg-[#111b21] rounded-lg transition"
                        title="Voice Call"
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                      <button
                        onClick={fetchMessages}
                        className="p-2 text-[#8696a0] hover:text-white hover:bg-[#111b21] rounded-lg transition"
                        title="Refresh Conversation"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Messages Canvas with WhatsApp Chat Bubbles */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-[#0b141a]">
                    {/* Date Pill Divider */}
                    <div className="flex justify-center my-2 select-none">
                      <span className="px-3 py-1 rounded-lg text-[10px] font-bold bg-[#182229] text-[#8696a0] uppercase tracking-wider shadow">
                        Message History
                      </span>
                    </div>

                    {activeChat.messages.map((msg, index) => {
                      const isOutbound = msg.direction === 'outbound';
                      const isGrp = activeChat.chatType === 'group';

                      return (
                        <div
                          key={msg.providerMessageId || index}
                          className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`relative max-w-[85%] sm:max-w-[70%] px-3.5 py-2 rounded-2xl text-xs shadow ${
                              isOutbound
                                ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none'
                                : 'bg-[#202c33] text-[#e9edef] rounded-tl-none'
                            }`}
                          >
                            {/* Group Sender Name */}
                            {isGrp && !isOutbound && (
                              <div className="text-[10px] font-bold text-[#00a884] mb-0.5 select-none">
                                {msg.senderName || msg.senderPhone || 'Group Member'}
                              </div>
                            )}

                            {/* Message Body */}
                            <p className="whitespace-pre-line leading-relaxed break-words font-sans">
                              {msg.messageBody}
                            </p>

                            {/* Timestamp & Read Receipt Checkmarks */}
                            <div className="flex items-center justify-end space-x-1 mt-1 text-[10px] text-[#8696a0] select-none">
                              <span>{formatTime(msg.createdAt)}</span>
                              {isOutbound && (
                                <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] ml-0.5" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Quick Travel Canned Templates */}
                  <div className="px-4 py-2 bg-[#202c33] border-t border-[#222d34] flex items-center space-x-1.5 overflow-x-auto">
                    <span className="text-[10px] font-bold text-[#8696a0] shrink-0 uppercase tracking-wider mr-1">
                      Quick:
                    </span>
                    {CANNED_TEMPLATES.map((tmpl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setMessageInput(tmpl.text)}
                        className="px-2.5 py-1 rounded-full text-[11px] bg-[#111b21] hover:bg-[#2a3942] text-slate-300 hover:text-white border border-[#2a3942] transition shrink-0 cursor-pointer"
                      >
                        {tmpl.label}
                      </button>
                    ))}
                  </div>

                  {/* Quick Emoji Bar (Collapsible) */}
                  {showEmojiPicker && (
                    <div className="px-4 py-1.5 bg-[#111b21] border-t border-[#222d34] flex items-center space-x-2 overflow-x-auto">
                      {QUICK_EMOJIS.map((emoji, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setMessageInput((prev) => prev + emoji)}
                          className="text-base hover:scale-125 transition cursor-pointer p-1"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Chat Input Bar */}
                  <form
                    onSubmit={handleSendMessage}
                    className="h-16 bg-[#202c33] px-3 sm:px-4 flex items-center space-x-2 shrink-0 border-t border-[#222d34]"
                  >
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className={`p-2 rounded-full transition cursor-pointer ${
                        showEmojiPicker ? 'text-[#00a884]' : 'text-[#8696a0] hover:text-white'
                      }`}
                    >
                      <Smile className="w-5 h-5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setMessageInput((prev) => prev + ' 📎 ')}
                      className="p-2 text-[#8696a0] hover:text-white rounded-full transition cursor-pointer"
                      title="Attach Item"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>

                    <input
                      type="text"
                      placeholder="Type a message"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="flex-1 bg-[#2a3942] text-xs text-white rounded-lg px-4 py-2.5 placeholder-[#8696a0] focus:outline-none focus:ring-1 focus:ring-[#00a884] border border-transparent"
                    />

                    <button
                      type="submit"
                      disabled={!messageInput.trim() || sendingMessage}
                      className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#008f6f] text-white flex items-center justify-center transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md shrink-0"
                    >
                      {sendingMessage ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <SendHorizontal className="w-4 h-4" />
                      )}
                    </button>
                  </form>
                </>
              ) : (
                /* No Chat Selected Welcome Splash */
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#111b21] space-y-4 select-none">
                  <div className="w-20 h-20 rounded-full bg-[#202c33] flex items-center justify-center text-[#8696a0] shadow-inner">
                    <MessageSquare className="w-10 h-10 text-[#00a884]" />
                  </div>
                  <div className="space-y-1.5 max-w-sm">
                    <h3 className="text-lg font-bold text-white tracking-tight">
                      TripInn WhatsApp Web
                    </h3>
                    <p className="text-xs text-[#8696a0] leading-relaxed">
                      Select a customer conversation from the left to read or reply, or start a new chat with any travel lead.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsNewChatOpen(true)}
                    className="px-4 py-2 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-bold transition flex items-center space-x-1.5 shadow"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Start New Conversation</span>
                  </button>
                  <p className="text-[11px] text-[#8696a0] pt-6 flex items-center space-x-1.5">
                    <span>🔒 End-to-end encrypted</span>
                    <span>•</span>
                    <span>Experimental Sandbox</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: START NEW CHAT                                                     */}
      {/* ========================================================================= */}
      {isNewChatOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#202c33] rounded-2xl border border-[#2a3942] p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#2a3942] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-[#00a884]" />
                <span>Start New WhatsApp Chat</span>
              </h3>
              <button
                onClick={() => setIsNewChatOpen(false)}
                className="text-[#8696a0] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStartNewChat} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Recipient Phone Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. 918971997781 or +91 98765 43210"
                  value={newChatPhone}
                  onChange={(e) => setNewChatPhone(e.target.value)}
                  className="w-full bg-[#111b21] text-xs text-white rounded-lg px-3 py-2 border border-[#2a3942] focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                  required
                />
                <p className="text-[10px] text-[#8696a0] mt-1">
                  Enter full international phone number with country code.
                </p>
              </div>

              {/* Quick Select from CRM Leads if available */}
              {crmLeads.length > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold text-[#8696a0] mb-1.5 uppercase tracking-wider">
                    Or select from CRM Travel Leads:
                  </label>
                  <div className="max-h-32 overflow-y-auto divide-y divide-[#2a3942]/60 rounded-lg bg-[#111b21] border border-[#2a3942] p-1">
                    {crmLeads.slice(0, 8).map((lead) => (
                      <div
                        key={lead.id}
                        onClick={() => setNewChatPhone(lead.phone)}
                        className="p-1.5 hover:bg-[#202c33] rounded cursor-pointer flex items-center justify-between text-xs"
                      >
                        <span className="font-semibold text-white">{lead.name}</span>
                        <span className="font-mono text-[#8696a0] text-[11px]">
                          {formatPhoneDisplay(lead.phone)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Opening Message
                </label>
                <textarea
                  rows={3}
                  value={newChatMessage}
                  onChange={(e) => setNewChatMessage(e.target.value)}
                  className="w-full bg-[#111b21] text-xs text-white rounded-lg p-3 border border-[#2a3942] focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewChatOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-[#8696a0] hover:text-white hover:bg-[#111b21] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={startingChat}
                  className="px-4 py-2 rounded-lg bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-bold transition flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {startingChat ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Start Chat</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EXPERIMENTAL SANDBOX ARCHITECTURE INFO                             */}
      {/* ========================================================================= */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#202c33] rounded-2xl border border-[#2a3942] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#2a3942] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Experimental WhatsApp QR Architecture</span>
              </h3>
              <button
                onClick={() => setShowInfoModal(false)}
                className="text-[#8696a0] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
                <strong>Complete System Isolation:</strong> This feature uses the unofficial Baileys multi-device protocol running on dedicated daemon port 3001. It will <strong>never</strong> modify, intercept, or route through your production Meta WhatsApp Cloud API credentials.
              </div>

              <div className="space-y-2">
                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-[#00a884] shrink-0 mt-0.5" />
                  <span><strong>Meta Cloud API Safe:</strong> Official sends and webhooks are untouched.</span>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-[#00a884] shrink-0 mt-0.5" />
                  <span><strong>Process Isolation:</strong> Runs in a dedicated Node.js service daemon.</span>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-[#00a884] shrink-0 mt-0.5" />
                  <span><strong>Database Partition:</strong> Messages stored in isolated experimental tables.</span>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-[#00a884] shrink-0 mt-0.5" />
                  <span><strong>Zero Credential Exposure:</strong> Encryption keys never sent to the browser.</span>
                </div>
              </div>

              <div className="bg-[#111b21] p-3 rounded-xl border border-[#2a3942] font-mono text-[11px] text-[#8696a0]">
                Daemon Service: http://127.0.0.1:3001<br />
                Session ID: default_test_session<br />
                Connected Phone: {session.phoneNumber || 'Not connected'}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowInfoModal(false)}
                className="px-4 py-2 rounded-lg bg-[#00a884] text-white text-xs font-bold hover:bg-[#008f6f]"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
