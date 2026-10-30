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

  // 2. Query Daemon for Recent Messages
  try {
    const res = await fetch(`${SERVICE_URL}/messages?sessionId=${encodeURIComponent(sessionId)}`, {
      headers: {
        Authorization: `Bearer ${SERVICE_SECRET}`,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: errJson.error || `Failed to fetch messages (${res.status})` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({
      status: 'success',
      data: data.messages || [],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Connection failed';
    return NextResponse.json(
      { error: `Could not reach Baileys QR Daemon at ${SERVICE_URL}. (${msg})`, data: [] },
      { status: 503 }
    );
  }
}

