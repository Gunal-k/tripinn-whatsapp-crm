import { NextResponse } from 'next/server';
import { getAuthenticatedStaff } from '../../../../lib/supabase/auth';
import { createAdminClient } from '../../../../lib/supabase/admin';
import { isTestEnvironment } from '../../../../lib/services/leads';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const hasAnonKey = Boolean(anonKey && !anonKey.includes('placeholder'));
  const hasServiceRoleKey = Boolean(serviceRoleKey && !serviceRoleKey.includes('placeholder'));
  const isSupabaseConfigured = Boolean(supabaseUrl && !supabaseUrl.includes('placeholder') && hasAnonKey);

  // Enforce server-side Admin authentication
  if (!isTestEnvironment() && isSupabaseConfigured) {
    const { profile, error: authError } = await getAuthenticatedStaff();
    if (authError || !profile) {
      return NextResponse.json(
        { error: 'Unauthorized: Active staff authentication required' },
        { status: 401 }
      );
    }
    if (profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Administrator privileges required to inspect cloud integrations' },
        { status: 403 }
      );
    }
  }

  // 1. Verify Supabase Database Connection & Schema Health
  let supabaseVerified = false;
  let supabaseError: string | null = null;
  const verifiedTables: string[] = [];
  const missingTables: string[] = [];

  if (isSupabaseConfigured && hasServiceRoleKey) {
    try {
      const probeClient = createAdminClient();
      const tablesToCheck = ['leads', 'whatsapp_messages', 'lead_activities', 'webhook_events', 'profiles'];

      for (const tableName of tablesToCheck) {
        const { error } = await probeClient.from(tableName).select('id').limit(1);
        if (!error || error.code === '42501') {
          // Table exists
          verifiedTables.push(tableName);
        } else if (error.code === 'PGRST205' || error.message.includes('schema cache')) {
          missingTables.push(tableName);
        } else {
          verifiedTables.push(tableName);
        }
      }

      supabaseVerified = verifiedTables.includes('leads');
    } catch (err) {
      supabaseError = err instanceof Error ? err.message : 'Connection test failed';
    }
  }

  // 2. Verify WhatsApp Cloud API Credentials against Meta Graph API
  const waAccessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const waPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const waBusinessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const waApiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
  const hasWaCredentials = Boolean(waAccessToken && waPhoneNumberId);

  let waVerified = false;
  let waVerifiedName: string | null = null;
  let waDisplayPhone: string | null = null;
  let waQualityRating: string | null = null;
  let waVerificationError: string | null = null;

  if (hasWaCredentials) {
    try {
      const res = await fetch(`https://graph.facebook.com/${waApiVersion}/${waPhoneNumberId}`, {
        headers: {
          Authorization: `Bearer ${waAccessToken}`,
        },
        next: { revalidate: 60 },
      });
      const data = await res.json();
      if (res.ok && data.id) {
        waVerified = true;
        waVerifiedName = data.verified_name || 'Verified Number';
        waDisplayPhone = data.display_phone_number || null;
        waQualityRating = data.quality_rating || 'GREEN';
      } else {
        waVerificationError = data.error?.message || 'Meta API returned error';
      }
    } catch (err) {
      waVerificationError = err instanceof Error ? err.message : 'Meta network request failed';
    }
  }

  // 3. Webhook Configuration
  const hasWaWebhookVerifyToken = Boolean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN);
  const hasWaAppSecret = Boolean(process.env.WHATSAPP_APP_SECRET);

  // 4. Meta Conversions API
  const metaDatasetId = process.env.META_DATASET_ID;
  const hasMetaCapiToken = Boolean(process.env.META_CONVERSIONS_API_TOKEN);
  const hasMetaTestEventCode = Boolean(process.env.META_TEST_EVENT_CODE);

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    supabase: {
      configured: isSupabaseConfigured,
      serviceRoleConfigured: hasServiceRoleKey,
      verified: supabaseVerified,
      url: supabaseUrl ? supabaseUrl.replace(/^(https?:\/\/[^.]+).*/, '$1.supabase.co') : null,
      verifiedTables,
      missingTables,
      error: supabaseError,
      requiresMigration: missingTables.length > 0,
    },
    whatsapp_cloud_api: {
      configured: hasWaCredentials,
      verified: waVerified,
      verifiedName: waVerifiedName,
      displayPhoneNumber: waDisplayPhone,
      qualityRating: waQualityRating,
      phoneNumberId: waPhoneNumberId ? `${waPhoneNumberId.slice(0, 4)}...${waPhoneNumberId.slice(-4)}` : null,
      businessAccountId: waBusinessAccountId ? `${waBusinessAccountId.slice(0, 4)}...${waBusinessAccountId.slice(-4)}` : null,
      apiVersion: waApiVersion,
      error: waVerificationError,
    },
    whatsapp_webhook: {
      verifyTokenConfigured: hasWaWebhookVerifyToken,
      appSecretConfigured: hasWaAppSecret,
      endpointPath: '/api/webhook/whatsapp',
      recommendedProductionSecurity: hasWaAppSecret && hasWaWebhookVerifyToken,
    },
    meta_conversions_api: {
      configured: Boolean(metaDatasetId && hasMetaCapiToken),
      datasetId: metaDatasetId ? `${metaDatasetId.slice(0, 4)}...` : null,
      testModeActive: hasMetaTestEventCode,
    },
  });
}
