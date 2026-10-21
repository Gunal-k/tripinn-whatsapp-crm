'use client';

import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Database, 
  MessageCircle, 
  Radio, 
  Sparkles, 
  Terminal, 
  Copy, 
  Check, 
  RefreshCw
} from 'lucide-react';
import { normalizePhoneNumber, formatPhoneDisplay } from '../../lib/utils/phone';

export function SettingsView() {
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);
  const [diagOutput, setDiagOutput] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState('+91 98201 23456');

  const webhookUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/webhook/whatsapp` 
    : 'https://your-domain.com/api/webhook/whatsapp';

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhookUrl(true);
    setTimeout(() => setCopiedWebhookUrl(false), 2000);
  };

  const runDiagnostics = () => {
    const norm = normalizePhoneNumber(testPhone);
    const mockCapiPayload = {
      event_name: 'Lead',
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'business_messaging',
      messaging_channel: 'whatsapp',
      user_data: {
        ctwa_clid: 'ctwa_bali_ad_sample_987',
        phone: [norm],
      },
      custom_data: {
        lead_qualification: 'QUALIFIED',
        destination: 'Bali 7D/6N',
      },
    };

    setDiagOutput(
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          phone_normalization: {
            input: testPhone,
            normalized_e164: norm,
            formatted_display: formatPhoneDisplay(norm),
            valid: norm.length >= 8,
          },
          meta_conversions_api: {
            endpoint: 'https://graph.facebook.com/v21.0/{DATASET_ID}/events',
            sample_payload_structure: mockCapiPayload,
            idempotency_key_pattern: `lead-001_Lead`,
          },
          whatsapp_webhook: {
            configured_url: webhookUrl,
            required_challenge_param: 'hub.challenge',
            required_verify_token_param: 'hub.verify_token',
            signature_header: 'x-hub-signature-256',
          },
        },
        null,
        2
      )
    );
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header Notice */}
      <div className="p-4 rounded-xl bg-[#0b132b] border border-[#1e293b] flex items-start space-x-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
        <div className="text-xs">
          <span className="font-bold text-white block">Administrator Integration Dashboard</span>
          <p className="text-slate-400 mt-0.5 leading-relaxed">
            All server-side secrets (Meta App Secret, Access Tokens, Supabase Service Role Key) remain protected on the secure server runtime. This dashboard displays integration configuration health and safe diagnostic status.
          </p>
        </div>
      </div>

      {/* Integration Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Supabase */}
        <div className="bg-[#0b132b] p-5 rounded-xl border border-[#1e293b] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Supabase PostgreSQL & Auth</h3>
                  <p className="text-[11px] text-slate-400">Database, RLS policies & staff profiles</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Ready
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-slate-300 bg-[#070d1a] p-3 rounded-lg border border-[#1e293b]">
              <div className="flex justify-between">
                <span className="text-slate-400">Migration File:</span>
                <span className="font-mono text-emerald-400 text-[11px]">20261021_initial_schema.sql</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tables Defined:</span>
                <span className="font-mono text-white text-[11px]">profiles, leads, activities, messages</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Row Level Security:</span>
                <span className="text-emerald-400 font-semibold">Enforced on all tables</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. WhatsApp Cloud API */}
        <div className="bg-[#0b132b] p-5 rounded-xl border border-[#1e293b] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-lg bg-teal-500/15 text-teal-400 border border-teal-500/30">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">WhatsApp Cloud API</h3>
                  <p className="text-[11px] text-slate-400">Official Meta Graph API messaging engine</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                Active Client
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-slate-300 bg-[#070d1a] p-3 rounded-lg border border-[#1e293b]">
              <div className="flex justify-between">
                <span className="text-slate-400">API Version:</span>
                <span className="font-mono text-white text-[11px]">v21.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Messaging Window:</span>
                <span className="text-white font-medium">24-Hour Customer Service Session</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tokens:</span>
                <span className="text-slate-400 italic">Protected in server environment</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. WhatsApp Webhook Configuration */}
        <div className="bg-[#0b132b] p-5 rounded-xl border border-[#1e293b] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/30">
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">WhatsApp Webhook</h3>
                  <p className="text-[11px] text-slate-400">Real-time incoming message & status listener</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Configured
              </span>
            </div>

            <div className="space-y-2 text-xs bg-[#070d1a] p-3 rounded-lg border border-[#1e293b]">
              <div>
                <span className="text-slate-400 block text-[11px] mb-1">Callback URL (Meta App Dashboard):</span>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="flex-1 px-2.5 py-1 rounded bg-[#0b132b] border border-slate-700 text-[11px] font-mono text-emerald-300 select-all"
                  />
                  <button
                    onClick={handleCopyWebhook}
                    className="p-1.5 rounded bg-[#111d3d] hover:bg-[#1a2c5a] text-slate-200 transition"
                    title="Copy Webhook URL"
                  >
                    {copiedWebhookUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-between text-[11px] pt-1">
                <span className="text-slate-400">Signature Security:</span>
                <span className="text-emerald-400 font-semibold">HMAC-SHA256 (timingSafeEqual)</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Meta Messaging Conversions API */}
        <div className="bg-[#0b132b] p-5 rounded-xl border border-[#1e293b] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Meta Messaging Conversions API</h3>
                  <p className="text-[11px] text-slate-400">Click-to-WhatsApp ad qualified lead attribution</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Ready
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-slate-300 bg-[#070d1a] p-3 rounded-lg border border-[#1e293b]">
              <div className="flex justify-between">
                <span className="text-slate-400">Attribution Key:</span>
                <span className="font-mono text-emerald-400 text-[11px]">ctwa_clid parameter</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Trigger Policy:</span>
                <span className="text-white font-medium">Explicit Salesperson Qualification Only</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Idempotency Guard:</span>
                <span className="text-emerald-400 font-semibold">Duplicate event prevention active</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Local Development & Tunnel Instructions */}
      <div className="bg-[#0b132b] p-5 rounded-xl border border-[#1e293b]">
        <h3 className="text-sm font-bold text-white mb-2 flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span>Local Development Webhook Testing Guide</span>
        </h3>
        <p className="text-xs text-slate-400 mb-3 leading-relaxed">
          Because Meta webhooks require a publicly reachable HTTPS endpoint, use a development tunnel (such as ngrok or Cloudflare Tunnel) when testing incoming WhatsApp messages locally.
        </p>

        <div className="bg-[#070d1a] p-4 rounded-xl border border-[#1e293b] font-mono text-xs text-slate-300 space-y-2">
          <p className="text-slate-400"># 1. Start your local tunnel pointing to your dev server (port 3000):</p>
          <div className="p-2 rounded bg-black/50 text-emerald-300">
            ngrok http 3000
          </div>
          <p className="text-slate-400 mt-2"># 2. Paste the generated public HTTPS URL into Meta App Dashboard under WhatsApp &gt; Configuration:</p>
          <div className="p-2 rounded bg-black/50 text-emerald-300">
            https://&lt;your-tunnel-subdomain&gt;.ngrok-free.app/api/webhook/whatsapp
          </div>
          <p className="text-slate-400 mt-2"># 3. Enter your WHATSAPP_WEBHOOK_VERIFY_TOKEN to complete Meta verification handshake.</p>
        </div>
      </div>

      {/* Safe Diagnostics Runner */}
      <div className="bg-[#0b132b] p-5 rounded-xl border border-[#1e293b]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-white">Safe Diagnostics & Normalization Test</h3>
            <p className="text-xs text-slate-400">Simulate phone number formatting and CAPI payload structure without modifying live records.</p>
          </div>
          <button
            onClick={runDiagnostics}
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Run Diagnostic</span>
          </button>
        </div>

        <div className="flex items-center space-x-2 mb-3">
          <label className="text-xs text-slate-300 font-semibold">Test Phone Input:</label>
          <input
            type="text"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-[#070d1a] border border-[#1e293b] text-xs text-white"
          />
        </div>

        {diagOutput && (
          <pre className="p-4 rounded-xl bg-[#070d1a] border border-[#1e293b] text-emerald-400 font-mono text-xs overflow-x-auto max-h-72">
            {diagOutput}
          </pre>
        )}
      </div>
    </div>
  );
}
