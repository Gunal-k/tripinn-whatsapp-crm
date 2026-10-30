import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStaff } from '../../../../../lib/supabase/auth';
import { isSupabaseConfigured, isTestEnvironment } from '../../../../../lib/services/leads';

const SERVICE_URL = process.env.WHATSAPP_QR_SERVICE_URL || 'http://127.0.0.1:3001';
const SERVICE_SECRET = process.env.WHATSAPP_QR_SERVICE_SECRET || 'dev_experimental_qr_secret_12345';

export async function POST(req: NextRequest) {
  // 1. Staff Authentication Check - require admin in production
  const isDev = process.env.NODE_ENV === 'development';
  if (!isTestEnvironment() && isSupabaseConfigured() && !isDev) {
    const { profile, error: authError } = await getAuthenticatedStaff(req);
    if (authError || !profile) {
      return NextResponse.json(
        { error: 'Unauthorized: Active staff authentication required' },
        { status: 401 }
      );
    }
    if (profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required to manage experimental WhatsApp connections' },
        { status: 403 }
      );
    }
  }

  let sessionId = 'default_test_session';
  try {
    const body = await req.json();
    if (body.sessionId) sessionId = body.sessionId;
  } catch {
    // Body optional, fallback to default
  }

  // 2. Delegate session start to Baileys QR Daemon
  try {
    const res = await fetch(`${SERVICE_URL}/session/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_SECRET}`,
      },
      body: JSON.stringify({ sessionId }),
      cache: 'no-store',
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || `QR Service failed to initialize session (${res.status})` },
        { status: res.status }
      );
    }

    return NextResponse.json({
      status: 'success',
      data: {
        ...data,
        qrCode: data.qrCodeDataUrl || data.qrCode || null,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Connection failed';
    return NextResponse.json(
      {
        error: `Could not connect to Baileys QR Daemon at ${SERVICE_URL}. Is it running? (${msg})`,
      },
      { status: 503 }
    );
  }
}
