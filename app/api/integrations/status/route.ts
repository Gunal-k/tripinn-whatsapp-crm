import { NextResponse } from 'next/server';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasAnonKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  const hasWaAccessToken = Boolean(process.env.WHATSAPP_ACCESS_TOKEN);
  const waPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const waBusinessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const hasWaWebhookVerifyToken = Boolean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN);
  const hasWaAppSecret = Boolean(process.env.WHATSAPP_APP_SECRET);
  const waApiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';

  const metaDatasetId = process.env.META_DATASET_ID;
  const hasMetaCapiToken = Boolean(process.env.META_CONVERSIONS_API_TOKEN);
  const hasMetaTestEventCode = Boolean(process.env.META_TEST_EVENT_CODE);

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    supabase: {
      configured: Boolean(supabaseUrl && hasAnonKey),
      url: supabaseUrl ? supabaseUrl.replace(/^(https?:\/\/[^.]+).*/, '$1.supabase.co') : null,
      serviceRoleConfigured: hasServiceRoleKey,
    },
    whatsapp_cloud_api: {
      configured: Boolean(hasWaAccessToken && waPhoneNumberId),
      phoneNumberId: waPhoneNumberId ? `${waPhoneNumberId.slice(0, 4)}...${waPhoneNumberId.slice(-4)}` : null,
      businessAccountId: waBusinessAccountId ? `${waBusinessAccountId.slice(0, 4)}...${waBusinessAccountId.slice(-4)}` : null,
      apiVersion: waApiVersion,
    },
    whatsapp_webhook: {
      verifyTokenConfigured: hasWaWebhookVerifyToken,
      appSecretConfigured: hasWaAppSecret,
      endpointPath: '/api/webhook/whatsapp',
    },
    meta_conversions_api: {
      configured: Boolean(metaDatasetId && hasMetaCapiToken),
      datasetId: metaDatasetId ? `${metaDatasetId.slice(0, 4)}...` : null,
      testModeActive: hasMetaTestEventCode,
    },
  });
}
