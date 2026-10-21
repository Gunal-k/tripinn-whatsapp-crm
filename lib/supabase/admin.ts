import 'server-only';
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase Admin Client
 *
 * CRITICAL SECURITY CONSTRAINTS:
 * 1. Protected by 'server-only': Any attempt to import this in client-side code fails at build time.
 * 2. Uses SUPABASE_SERVICE_ROLE_KEY exclusively. Never falls back to NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * 3. Never expose this client or its credentials to browser bundles or client components.
 * 4. Only use in server environments (API routes, Webhooks, Server Actions).
 */
export function createAdminClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('FATAL SECURITY VIOLATION: createAdminClient cannot be executed in the browser context.');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      'Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_URL environment variable is required.'
    );
  }

  if (!serviceRoleKey || serviceRoleKey.includes('placeholder')) {
    throw new Error(
      'Missing Supabase admin configuration: SUPABASE_SERVICE_ROLE_KEY is required on the server. ' +
      'Ensure SUPABASE_SERVICE_ROLE_KEY is set in your environment variables. ' +
      'Falling back to NEXT_PUBLIC_SUPABASE_ANON_KEY is strictly disallowed for admin operations.'
    );
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

