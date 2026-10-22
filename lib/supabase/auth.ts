import { createClient as createServerSupabaseClient } from './server';
import { createAdminClient } from './admin';
import { UserRole } from '../types/crm';

export interface AuthenticatedStaffProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  phone: string | null;
  avatar_url: string | null;
}

export interface AuthStaffResult {
  user: {
    id: string;
    email?: string;
  } | null;
  profile: AuthenticatedStaffProfile | null;
  error?: string;
}

/**
 * Validates authentication on the server and loads the verified profile from public.profiles.
 * Supports dual authentication mechanisms:
 * 1. Authorization: Bearer <access_token> header (from client fetch calls)
 * 2. Supabase SSR session cookies (from browser navigation / NextRequest cookies)
 *
 * Enforces that:
 * 1. User is authenticated with Supabase Auth
 * 2. User has a corresponding profile row in public.profiles
 * 3. User is actively marked as is_active = true
 */
export async function getAuthenticatedStaff(
  req?: Request | { headers?: { get: (name: string) => string | null } }
): Promise<AuthStaffResult> {
  // Method 1: Check for Bearer token in the Authorization header
  try {
    const authHeader = req?.headers?.get('authorization') || req?.headers?.get('Authorization');
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.substring(7).trim();
      if (token) {
        try {
          const adminClient = createAdminClient();
          const {
            data: { user },
            error: userError,
          } = await adminClient.auth.getUser(token);

          if (!userError && user) {
            const { data: profile, error: profileError } = await adminClient
              .from('profiles')
              .select('id, email, full_name, role, is_active, phone')
              .eq('id', user.id)
              .maybeSingle();

            if (profileError || !profile) {
              return {
                user: { id: user.id, email: user.email },
                profile: null,
                error: 'Access Denied: Staff profile not found in database',
              };
            }

            if (!profile.is_active) {
              return {
                user: { id: user.id, email: user.email },
                profile: null,
                error: 'Access Denied: Staff account has been deactivated',
              };
            }

            const normalizedRole: UserRole = profile.role === 'admin' ? 'admin' : 'sales';

            return {
              user: { id: user.id, email: user.email },
              profile: {
                id: profile.id,
                email: profile.email || user.email || '',
                full_name: profile.full_name || user.email?.split('@')[0] || 'Staff User',
                role: normalizedRole,
                is_active: Boolean(profile.is_active),
                phone: profile.phone || null,
                avatar_url: null,
              },
            };
          }
        } catch (bearerErr) {
          console.warn('Bearer token validation error:', bearerErr);
        }
      }
    }
  } catch {
    // Continue to cookie-based validation
  }

  // Method 2: Check for active session in SSR cookies
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { user: null, profile: null, error: 'Unauthenticated: No active session' };
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, is_active, phone')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return {
        user: { id: user.id, email: user.email },
        profile: null,
        error: 'Access Denied: Staff profile not found in database',
      };
    }

    if (!profile.is_active) {
      return {
        user: { id: user.id, email: user.email },
        profile: null,
        error: 'Access Denied: Staff account has been deactivated',
      };
    }

    const normalizedRole: UserRole = profile.role === 'admin' ? 'admin' : 'sales';

    return {
      user: { id: user.id, email: user.email },
      profile: {
        id: profile.id,
        email: profile.email || user.email || '',
        full_name: profile.full_name || user.email?.split('@')[0] || 'Staff User',
        role: normalizedRole,
        is_active: Boolean(profile.is_active),
        phone: profile.phone || null,
        avatar_url: null,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server authentication error';
    return { user: null, profile: null, error: message };
  }
}

