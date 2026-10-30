import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStaff } from '../../../../../lib/supabase/auth';
import { isSupabaseConfigured, isTestEnvironment } from '../../../../../lib/services/leads';

const SERVICE_URL = process.env.WHATSAPP_QR_SERVICE_URL || 'http://127.0.0.1:3001';
const SERVICE_SECRET = process.env.WHATSAPP_QR_SERVICE_SECRET || 'dev_experimental_qr_secret_12345';

export async function GET(req: NextRequest) {
  // 1. Staff Authentication Check (Enforced in production, accessible in dev test)
  const isDev = process.env.NODE_ENV === 'development';
  if (!isTestEnvironment() && isSupabaseConfigured() && !isDev) {
    const { profile, error: authError } = await getAuthenticatedStaff(req);
    if (authError || !profile) {
      return NextResponse.json(
        { error: 'Unauthorized: Active staff authentication required' },
        { status: 401 }
      );
    }
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId') || 'default_test_session';

  // 2. Query the Baileys Daemon Service
  try {
    const res = await fetch(`${SERVICE_URL}/session/status?sessionId=${encodeURIComponent(sessionId)}`, {
      headers: {
        Authorization: `Bearer ${SERVICE_SECRET}`,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: errJson.error || `QR Service returned status ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({
      status: 'success',
      serviceOnline: true,
      data: {
        ...data,
        qrCode: data.qrCodeDataUrl || data.qrCode || null,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Connection failed';
    return NextResponse.json({
      status: 'offline',
      serviceOnline: false,
      error: `Baileys QR service unreachable at ${SERVICE_URL}. Run "npm run qr:service" to start. (${msg})`,
      data: {
        sessionId,
        status: 'disconnected',
        qrCode: null,
        phoneNumber: null,
      },
    });
  }
}
