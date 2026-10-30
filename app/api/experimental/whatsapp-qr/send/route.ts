import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStaff } from '../../../../../lib/supabase/auth';
import { isSupabaseConfigured, isTestEnvironment } from '../../../../../lib/services/leads';
import { normalizePhoneNumber, isValidInternationalPhone } from '../../../../../lib/utils/phone';

const SERVICE_URL = process.env.WHATSAPP_QR_SERVICE_URL || 'http://127.0.0.1:3001';
const SERVICE_SECRET = process.env.WHATSAPP_QR_SERVICE_SECRET || 'dev_experimental_qr_secret_12345';

export async function POST(req: NextRequest) {
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

  try {
    const body = await req.json();
    const rawTo = body.to || body.toPhone || '';
    const textContent = body.text || body.messageText || '';
    const sessionId = body.sessionId || 'default_test_session';

    if (!rawTo || typeof rawTo !== 'string' || !rawTo.trim()) {
      return NextResponse.json({ error: 'Recipient phone number is required (field: "to" or "toPhone")' }, { status: 400 });
    }

    if (!textContent || typeof textContent !== 'string' || textContent.trim().length === 0) {
      return NextResponse.json({ error: 'Message text cannot be empty (field: "text" or "messageText")' }, { status: 400 });
    }

    if (!isValidInternationalPhone(rawTo)) {
      return NextResponse.json({ error: 'Invalid recipient phone number format' }, { status: 400 });
    }

    const normalizedTo = normalizePhoneNumber(rawTo);

    // Forward to Baileys Daemon with both naming conventions
    const res = await fetch(`${SERVICE_URL}/message/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_SECRET}`,
      },
      body: JSON.stringify({
        sessionId,
        to: normalizedTo,
        toPhone: normalizedTo,
        text: textContent.trim(),
        messageText: textContent.trim(),
      }),
      cache: 'no-store',
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || `Failed to send experimental message (${res.status})` },
        { status: res.status }
      );
    }

    return NextResponse.json({
      status: 'success',
      data,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Send failed';
    return NextResponse.json(
      { error: `Could not reach Baileys QR Daemon at ${SERVICE_URL}. (${msg})` },
      { status: 503 }
    );
  }
}
