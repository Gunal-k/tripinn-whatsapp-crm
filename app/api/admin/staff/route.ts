import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStaff } from '../../../../lib/supabase/auth';
import { createAdminClient } from '../../../../lib/supabase/admin';
import { isTestEnvironment } from '../../../../lib/services/leads';
import { createStaffSchema } from '../../../../lib/validations/staff';
import { INITIAL_MOCK_STAFF } from '../../../../lib/data/mock-staff';
import { UserProfile } from '../../../../lib/types/crm';

// Local cache for non-Supabase fallback environments
let mockStaffCache: UserProfile[] = [...INITIAL_MOCK_STAFF];

function getSupabaseConfigState() {
  const isTest = isTestEnvironment();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const hasUrl = Boolean(url && !url.includes('placeholder'));
  const hasAnon = Boolean(anon && !anon.includes('placeholder'));
  const hasServiceKey = Boolean(serviceKey && !serviceKey.includes('placeholder'));

  const isConfigured = Boolean(!isTest && hasUrl && hasServiceKey);
  const isServiceRoleMissing = Boolean(!isTest && hasUrl && !hasServiceKey);

  return { isTest, hasUrl, hasAnon, hasServiceKey, isConfigured, isServiceRoleMissing };
}

function isSupabaseServerConfigured(): boolean {
  return getSupabaseConfigState().isConfigured;
}

/**
 * GET /api/admin/staff
 * Lists all staff members and administrators.
 */
export async function GET(req: NextRequest) {
  const config = getSupabaseConfigState();

  if (config.isConfigured) {
    const { profile, error: authError } = await getAuthenticatedStaff(req);
    const isUnverifiedSession = Boolean(authError || !profile);

    try {
      const adminClient = createAdminClient();
      const { data: staffList, error: queryError } = await adminClient
        .from('profiles')
        .select('id, email, full_name, role, phone, is_active, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (queryError) {
        console.error('Error querying profiles:', queryError);
        return NextResponse.json(
          { error: `Database query failed: ${queryError.message}` },
          { status: 500 }
        );
      }

      const normalizedStaffList = (staffList || []).map((staff) => ({
        ...staff,
        avatar_url: null,
      }));

      return NextResponse.json({
        success: true,
        data: normalizedStaffList,
        isLiveSupabase: true,
        serviceRoleConfigured: true,
        unauthorized: isUnverifiedSession,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Internal Server Error';
      console.error('Server error in GET /api/admin/staff:', err);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // Fallback / mock mode
  return NextResponse.json({
    success: true,
    data: mockStaffCache,
    isLiveSupabase: false,
    serviceRoleConfigured: !config.isServiceRoleMissing,
    serviceRoleMissing: config.isServiceRoleMissing,
  });
}

/**
 * POST /api/admin/staff
 * Provisions a new staff member (admin or sales rep).
 * Enforces strict Administrator permissions.
 */
export async function POST(req: NextRequest) {
  const config = getSupabaseConfigState();

  // If Supabase URL is configured but service role key is missing, notify admin directly
  if (config.isServiceRoleMissing) {
    return NextResponse.json(
      {
        error:
          'SUPABASE_SERVICE_ROLE_KEY is required in .env.local to provision staff in your Supabase project. ' +
          'Please copy the service_role key from Supabase Dashboard -> Project Settings -> API and add it to .env.local.',
      },
      { status: 500 }
    );
  }

  const isConfigured = config.isConfigured;

  let currentAdminId: string | null = null;
  if (isConfigured) {
    const { profile, error: authError } = await getAuthenticatedStaff(req);
    if (authError || !profile) {
      return NextResponse.json(
        { error: 'Unauthorized: Active staff authentication session required' },
        { status: 401 }
      );
    }

    if (profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators are authorized to provision new staff' },
        { status: 403 }
      );
    }

    currentAdminId = profile.id;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  const parsed = createStaffSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Validation error in staff data';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { email, password, full_name, role, phone } = parsed.data;

  if (isConfigured) {
    try {
      const adminClient = createAdminClient();

      // 1. Create auth user with confirmed email
      const { data: authData, error: createError } = await adminClient.auth.admin.createUser({
        email: email.toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: {
          full_name: full_name.trim(),
          role,
          phone: phone?.trim() || null,
        },
      });

      if (createError) {
        if (createError.message.toLowerCase().includes('already registered')) {
          return NextResponse.json(
            { error: `A user account with email "${email}" already exists in the system.` },
            { status: 409 }
          );
        }
        return NextResponse.json(
          { error: `Authentication service error: ${createError.message}` },
          { status: 400 }
        );
      }

      if (!authData.user) {
        return NextResponse.json(
          { error: 'Failed to create user account record' },
          { status: 500 }
        );
      }

      // 2. Insert or update public.profiles
      const { data: profileRow, error: profileError } = await adminClient
        .from('profiles')
        .upsert(
          {
            id: authData.user.id,
            email: email.toLowerCase(),
            full_name: full_name.trim(),
            role,
            phone: phone?.trim() || null,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
        .select()
        .single();

      if (profileError) {
        console.error('Error creating profile entry after auth creation:', profileError);
        // Clean up created auth user if profile creation completely failed
        return NextResponse.json(
          { error: `Staff profile creation failed: ${profileError.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: profileRow,
        message: `Staff member ${full_name} (${role}) provisioned successfully.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to provision staff';
      console.error('Error in POST /api/admin/staff:', err);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // Fallback / mock mode
  const duplicate = mockStaffCache.some(
    (s) => s.email.toLowerCase() === email.toLowerCase()
  );
  if (duplicate) {
    return NextResponse.json(
      { error: `A staff member with email "${email}" is already registered.` },
      { status: 409 }
    );
  }

  const newMockProfile: UserProfile = {
    id: `user-staff-${Date.now()}`,
    email: email.toLowerCase(),
    full_name: full_name.trim(),
    role,
    phone: phone?.trim() || null,
    avatar_url: null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  mockStaffCache.unshift(newMockProfile);

  return NextResponse.json({
    success: true,
    data: newMockProfile,
    message: `Staff member ${full_name} provisioned successfully in local environment.`,
  });
}

/**
 * PATCH /api/admin/staff
 * Toggles a staff member's active status (activate / deactivate).
 */
export async function PATCH(req: NextRequest) {
  const config = getSupabaseConfigState();
  if (config.isServiceRoleMissing) {
    return NextResponse.json(
      {
        error:
          'SUPABASE_SERVICE_ROLE_KEY is required in .env.local to update staff in your Supabase project.',
      },
      { status: 500 }
    );
  }
  const isConfigured = config.isConfigured;

  let adminProfileId: string | null = null;
  if (isConfigured) {
    const { profile, error: authError } = await getAuthenticatedStaff(req);
    if (authError || !profile) {
      return NextResponse.json(
        { error: 'Unauthorized: Active staff authentication session required' },
        { status: 401 }
      );
    }

    if (profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators are authorized to update staff status' },
        { status: 403 }
      );
    }
    adminProfileId = profile.id;
  }

  let body: { id?: string; is_active?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  const { id, is_active } = body;
  if (!id || typeof is_active !== 'boolean') {
    return NextResponse.json(
      { error: 'Missing required fields: id and boolean is_active' },
      { status: 400 }
    );
  }

  // Prevent self-deactivation of current admin
  if (adminProfileId && adminProfileId === id && !is_active) {
    return NextResponse.json(
      { error: 'Safety restriction: You cannot deactivate your own active administrator account.' },
      { status: 400 }
    );
  }

  if (isConfigured) {
    try {
      const adminClient = createAdminClient();
      const { data: updated, error: updateError } = await adminClient
        .from('profiles')
        .update({
          is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json(
          { error: `Database update failed: ${updateError.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, data: updated });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update staff status';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // Fallback / mock mode
  const found = mockStaffCache.find((s) => s.id === id);
  if (!found) {
    return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
  }

  found.is_active = is_active;
  found.updated_at = new Date().toISOString();

  return NextResponse.json({ success: true, data: found });
}

/**
 * DELETE /api/admin/staff
 * Permanently removes a staff member and their credentials.
 */
export async function DELETE(req: NextRequest) {
  const config = getSupabaseConfigState();
  if (config.isServiceRoleMissing) {
    return NextResponse.json(
      {
        error:
          'SUPABASE_SERVICE_ROLE_KEY is required in .env.local to delete staff from your Supabase project.',
      },
      { status: 500 }
    );
  }
  const isConfigured = config.isConfigured;

  let adminProfileId: string | null = null;
  if (isConfigured) {
    const { profile, error: authError } = await getAuthenticatedStaff(req);
    if (authError || !profile) {
      return NextResponse.json(
        { error: 'Unauthorized: Active staff authentication session required' },
        { status: 401 }
      );
    }

    if (profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators are authorized to delete staff accounts' },
        { status: 403 }
      );
    }
    adminProfileId = profile.id;
  }

  // Extract ID from query param or JSON body
  let id = req.nextUrl?.searchParams?.get('id');
  if (!id) {
    try {
      const body = await req.json();
      id = body?.id;
    } catch {
      // Body not provided or invalid JSON
    }
  }

  if (!id) {
    return NextResponse.json(
      { error: 'Missing required staff member id' },
      { status: 400 }
    );
  }

  // Prevent self-deletion of active admin
  if (adminProfileId && adminProfileId === id) {
    return NextResponse.json(
      { error: 'Safety restriction: You cannot delete your own active administrator account.' },
      { status: 400 }
    );
  }

  if (isConfigured) {
    try {
      const adminClient = createAdminClient();

      // 1. Unassign any leads currently assigned to this salesperson
      await adminClient
        .from('leads')
        .update({ assigned_salesperson_id: null })
        .eq('assigned_salesperson_id', id);

      // 2. Remove profile from public.profiles
      const { error: profileDeleteError } = await adminClient
        .from('profiles')
        .delete()
        .eq('id', id);

      if (profileDeleteError) {
        console.error('Error deleting staff profile:', profileDeleteError);
        return NextResponse.json(
          { error: `Failed to delete staff profile: ${profileDeleteError.message}` },
          { status: 500 }
        );
      }

      // 3. Remove user from Supabase Auth
      try {
        await adminClient.auth.admin.deleteUser(id);
      } catch (authErr) {
        console.warn('Note: Could not delete user from auth (may already be deleted):', authErr);
      }

      return NextResponse.json({
        success: true,
        message: 'Staff member permanently deleted successfully.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete staff member';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // Fallback / mock mode
  const index = mockStaffCache.findIndex((s) => s.id === id);
  if (index === -1) {
    return NextResponse.json({ error: 'Staff member not found in database' }, { status: 404 });
  }

  mockStaffCache.splice(index, 1);

  return NextResponse.json({
    success: true,
    message: 'Staff member permanently deleted from local environment.',
  });
}

