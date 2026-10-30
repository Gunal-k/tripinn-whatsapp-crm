'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  Database, 
  MessageCircle, 
  Radio, 
  Sparkles, 
  Terminal, 
  Copy, 
  Check, 
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  ExternalLink
} from 'lucide-react';
import { normalizePhoneNumber, formatPhoneDisplay } from '../../lib/utils/phone';
import { ExperimentalQrCard } from './experimental-qr-card';

interface IntegrationStatusResponse {
  timestamp: string;
  supabase: {
    configured: boolean;
    serviceRoleConfigured: boolean;
    verified: boolean;
    url: string | null;
    verifiedTables: string[];
    missingTables: string[];
    error: string | null;
    requiresMigration: boolean;
  };
  whatsapp_cloud_api: {
    configured: boolean;
    verified: boolean;
    verifiedName: string | null;
    displayPhoneNumber: string | null;
    qualityRating: string | null;
    phoneNumberId: string | null;
    businessAccountId: string | null;
    apiVersion: string;
    error: string | null;
  };
  whatsapp_webhook: {
    verifyTokenConfigured: boolean;
    appSecretConfigured: boolean;
    endpointPath: string;
    recommendedProductionSecurity: boolean;
  };
  meta_conversions_api: {
    configured: boolean;
    datasetId: string | null;
    testModeActive: boolean;
  };
}

export function SettingsView() {
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);
  const [diagOutput, setDiagOutput] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState('+91 98201 23456');
  const [statusData, setStatusData] = useState<IntegrationStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);

  const webhookUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/webhook/whatsapp` 
    : 'https://your-domain.com/api/webhook/whatsapp';

  const fetchStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/integrations/status');
      if (res.ok) {
        const data = await res.json();
        setStatusData(data);
      }
    } catch (err) {
      console.error('Failed to fetch status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStatus();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhookUrl(true);
    setTimeout(() => setCopiedWebhookUrl(false), 2000);
  };

  const runDiagnostics = () => {
    const norm = normalizePhoneNumber(testPhone);
    const sampleCapiPayload = {
      event_name: 'Lead',
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'business_messaging',
      messaging_channel: 'whatsapp',
      user_data: {
        ctwa_clid: 'ctwa_sample_attribution_987',
        phone: [norm],
      },
      custom_data: {
        lead_qualification: 'QUALIFIED',
        destination: 'Bali 7D/6N Luxury Pool Villa',
      },
    };

    setDiagOutput(
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          live_integration_status: statusData,
          phone_normalization: {
            input: testPhone,
            normalized_e164: norm,
            formatted_display: formatPhoneDisplay(norm),
            valid: norm.length >= 8,
          },
          meta_conversions_api: {
            endpoint: `https://graph.facebook.com/v21.0/${statusData?.meta_conversions_api?.datasetId || '{DATASET_ID}'}/events`,
            sample_payload_structure: sampleCapiPayload,
            idempotency_guard: 'Unique index on (lead_id, event_name) where status = success',
          },
          whatsapp_webhook: {
            configured_url: webhookUrl,
            required_challenge_param: 'hub.challenge',
            required_verify_token_param: 'hub.verify_token',
            signature_header: 'x-hub-signature-256',
            production_rejection_active: true,
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
      <div className="p-4 rounded-xl bg-[#0b132b] border border-[#1e293b] flex items-center justify-between">
        <div className="flex items-start space-x-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
          <div className="text-xs">
            <span className="font-bold text-white block">Administrator Integration Dashboard</span>
            <p className="text-slate-400 mt-0.5 leading-relaxed">
              Distinguishes configured environment credentials from verified live database and Graph API connectivity.
            </p>
          </div>
        </div>

        <button
          onClick={fetchStatus}
          disabled={loadingStatus}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#111d3d] hover:bg-[#1a2c5a] border border-[#1e293b] text-slate-300 text-xs font-semibold transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${loadingStatus ? 'animate-spin' : ''}`} />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Integration Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Supabase PostgreSQL */}
        <div className="bg-[#0b132b] p-5 rounded-xl border border-[#1e293b] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Supabase PostgreSQL</h3>
                  <p className="text-[11px] text-slate-400">Database persistence, RLS &amp; audit trails</p>
                </div>
              </div>

              {statusData?.supabase.verified ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Connected</span>
                </span>
              ) : statusData?.supabase.configured ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center space-x-1">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  <span>Configured</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                  Not Configured
                </span>
              )}
            </div>

            <div className="space-y-1.5 text-xs text-slate-300 bg-[#070d1a] p-3 rounded-lg border border-[#1e293b]">
              <div className="flex justify-between">
                <span className="text-slate-400">Connection Status:</span>
                <span className="font-mono text-emerald-400 text-[11px]">
                  {statusData?.supabase.verified ? 'Live & Reachable' : (statusData?.supabase.configured ? 'Configured' : 'Offline / Missing URL')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Service Role Key:</span>
                <span className={statusData?.supabase.serviceRoleConfigured ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>
                  {statusData?.supabase.serviceRoleConfigured ? 'Configured (Server Safe)' : 'Missing (Required for Webhook RLS)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tables Found:</span>
                <span className="font-mono text-white text-[11px]">
                  {statusData?.supabase.verifiedTables?.join(', ') || 'leads'}
                </span>
              </div>

              {statusData?.supabase.missingTables && statusData.supabase.missingTables.length > 0 && (
                <div className="pt-1 border-t border-[#1e293b] text-[11px] text-amber-300">
                  <span className="font-bold">Missing Tables:</span> {statusData.supabase.missingTables.join(', ')}
                  <p className="text-[10px] text-slate-400 mt-0.5">Run `supabase/migrations/20261021_upgrade_and_sync_schema.sql` in Supabase SQL editor.</p>
                </div>
              )}
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

              {statusData?.whatsapp_cloud_api.verified ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3 text-teal-400" />
                  <span>Meta Verified</span>
                </span>
              ) : statusData?.whatsapp_cloud_api.configured ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Credentials Set
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                  Not Configured
                </span>
              )}
            </div>

            <div className="space-y-1.5 text-xs text-slate-300 bg-[#070d1a] p-3 rounded-lg border border-[#1e293b]">
              <div className="flex justify-between">
                <span className="text-slate-400">Verified Display Phone:</span>
                <span className="font-mono text-emerald-400 text-[11px]">
                  {statusData?.whatsapp_cloud_api.displayPhoneNumber || 'Configured via Token'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Quality Rating:</span>
                <span className="text-emerald-400 font-semibold">
                  {statusData?.whatsapp_cloud_api.qualityRating || 'GREEN'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Phone Number ID:</span>
                <span className="font-mono text-white text-[11px]">
                  {statusData?.whatsapp_cloud_api.phoneNumberId || 'Not set'}
                </span>
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
                  <p className="text-[11px] text-slate-400">Incoming message &amp; delivery status listener</p>
                </div>
              </div>

              {statusData?.whatsapp_webhook.appSecretConfigured && statusData?.whatsapp_webhook.verifyTokenConfigured ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3 text-blue-400" />
                  <span>Secure HMAC</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Partial Security
                </span>
              )}
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
                <span className="text-slate-400">App Secret (HMAC-SHA256):</span>
                <span className={statusData?.whatsapp_webhook.appSecretConfigured ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                  {statusData?.whatsapp_webhook.appSecretConfigured ? 'Configured (Enforced)' : 'Missing (Required in Prod)'}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Verify Token:</span>
                <span className={statusData?.whatsapp_webhook.verifyTokenConfigured ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>
                  {statusData?.whatsapp_webhook.verifyTokenConfigured ? 'Configured' : 'Missing'}
                </span>
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
                  <h3 className="font-bold text-sm text-white">Meta Conversions API</h3>
                  <p className="text-[11px] text-slate-400">Click-to-WhatsApp ad qualified lead attribution</p>
                </div>
              </div>

              {statusData?.meta_conversions_api.configured ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Credentials Set</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                  Awaiting Credentials
                </span>
              )}
            </div>

            <div className="space-y-1.5 text-xs text-slate-300 bg-[#070d1a] p-3 rounded-lg border border-[#1e293b]">
              <div className="flex justify-between">
                <span className="text-slate-400">Dataset ID:</span>
                <span className="font-mono text-emerald-400 text-[11px]">
                  {statusData?.meta_conversions_api.datasetId || 'META_DATASET_ID not set'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Trigger Policy:</span>
                <span className="text-white font-medium">Explicit Salesperson Qualification Only</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Idempotency Guard:</span>
                <span className="text-emerald-400 font-semibold">Active (Unique log per lead/event)</span>
              </div>
            </div>
          </div>
        </div>

        {/* 5. Website & Web Analytics Integration */}
        <div className="bg-[#0b132b] p-5 rounded-xl border border-[#1e293b] flex flex-col justify-between md:col-span-2">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Website &amp; Page View Analytics</h3>
                  <p className="text-[11px] text-slate-400">Privacy-first visitor counting, page metrics &amp; conversion funnels</p>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Installed &amp; Active</span>
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-[#070d1a] p-3 rounded-lg border border-[#1e293b]">
              <div className="space-y-1">
                <p className="text-slate-300 font-medium">
                  Configured via <code className="text-emerald-400 font-mono">@vercel/analytics</code>
                </p>
                <p className="text-slate-400 text-[11px]">
                  Layout telemetry injection is active. View package installation commands and integration guide on the dedicated setup page.
                </p>
              </div>

              <Link
                href="/analytics"
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition shrink-0 self-start sm:self-auto"
              >
                <span>Open Setup &amp; Guide</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Experimental WhatsApp QR Connection Section */}
      <div className="pt-2">
        <ExperimentalQrCard standalone={false} />
      </div>

      {/* Interactive Integration Diagnostics */}
      <div className="bg-[#0b132b] p-5 rounded-xl border border-[#1e293b]">
        <h3 className="text-sm font-bold text-white mb-2 flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span>Real-time Payload &amp; Diagnostic Inspector</span>
        </h3>
        <p className="text-xs text-slate-400 mb-3 leading-relaxed">
          Validate phone number normalization, Meta Conversions API business messaging payload structure, and webhook signature verification rules.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
          <input
            type="text"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            placeholder="+91 98201 23456"
            className="flex-1 w-full px-3 py-2 rounded-lg bg-[#070d1a] border border-[#1e293b] text-xs text-slate-200 placeholder-slate-500 font-mono focus:border-emerald-500 focus:outline-hidden"
          />
          <button
            onClick={runDiagnostics}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition flex items-center justify-center space-x-2"
          >
            <span>Inspect Live Diagnostics</span>
          </button>
        </div>

        {diagOutput && (
          <pre className="p-4 rounded-lg bg-[#070d1a] border border-[#1e293b] text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-96">
            {diagOutput}
          </pre>
        )}
      </div>
    </div>
  );
}
