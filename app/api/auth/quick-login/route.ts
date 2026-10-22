import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '../../../../lib/supabase/admin';
import { isTestEnvironment } from '../../../../lib/services/leads';

/**
 * POST /api/auth/quick-login
 * Generates a direct verification token hash for a verified administrator.
 * Enables 1-click admin sign-in for development and local testing.
 */
export async function POST(req: NextRequest) {
  try {
    const isTest = isTestEnvironment();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (isTest || !serviceKey || !url || serviceKey.includes('placeholder')) {
      return NextResponse.json(
        { error: 'Supabase service role key is not configured.' },
        { status: 400 }
      );
    }

    let email = 'gunal@tripinnholidays.com';
    try {
      const body = await req.json();
      if (body?.email && typeof body.email === 'string') {
        email = body.email.trim().toLowerCase();
      }
    } catch {
      // Use default admin email
    }

    const adminClient = createAdminClient();

    // Verify that the requested email is an active administrator in public.profiles
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, email, full_name, role, is_active')
      .eq('email', email)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: `No staff profile found for email "${email}".` },
        { status: 404 }
      );
    }

    if (!profile.is_active) {
      return NextResponse.json(
        { error: `Account for "${email}" is currently deactivated.` },
        { status: 403 }
      );
    }

    if (profile.role !== 'admin') {
      return NextResponse.json(
        { error: `Account for "${email}" does not have administrator privileges.` },
        { status: 403 }
      );
    }

    // Generate token hash using Supabase Admin Auth
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      return NextResponse.json(
        { error: linkError?.message || 'Failed to generate verification token.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      email,
      full_name: profile.full_name,
      token_hash: linkData.properties.hashed_token,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Quick login failed';
    console.error('Error in POST /api/auth/quick-login:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
