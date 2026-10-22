import { UserProfile } from '../types/crm';
import { CreateStaffInput, createStaffSchema } from '../validations/staff';
import { INITIAL_MOCK_STAFF } from '../data/mock-staff';
import { isTestEnvironment, isSupabaseConfigured } from './leads';
import { createClient as createBrowserSupabaseClient } from '../supabase/client';

// In-memory staff store for test mode or unconfigured dev environments
let mockStaffStore: UserProfile[] = [...INITIAL_MOCK_STAFF];

export function resetMockStaffStore(): void {
  mockStaffStore = [...INITIAL_MOCK_STAFF];
}

/**
 * Helper to build request headers, attaching the Supabase Auth Bearer token if present.
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (typeof window !== 'undefined') {
    try {
      const supabase = createBrowserSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    } catch {
      // Session extraction error, proceed with cookies
    }
  }

  return headers;
}

export const staffService = {
  /**
   * Fetches all registered staff members (profiles) and config status.
   */
  async getStaffStatus(): Promise<{
    staff: UserProfile[];
    serviceRoleMissing: boolean;
    unauthorized?: boolean;
    errorMessage?: string;
  }> {
    if (isTestEnvironment() || !isSupabaseConfigured()) {
      return { staff: [...mockStaffStore], serviceRoleMissing: false };
    }

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/staff', {
        method: 'GET',
        headers,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        if (res.status === 401) {
          return {
            staff: [...mockStaffStore],
            serviceRoleMissing: false,
            unauthorized: true,
            errorMessage: json.error || 'Active staff authentication session required',
          };
        }
        return { staff: [...mockStaffStore], serviceRoleMissing: false };
      }

      const json = await res.json();
      return {
        staff: json.data || [],
        serviceRoleMissing: Boolean(json.serviceRoleMissing),
        unauthorized: Boolean(json.unauthorized),
      };
    } catch (err: unknown) {
      return {
        staff: [...mockStaffStore],
        serviceRoleMissing: false,
        errorMessage: err instanceof Error ? err.message : 'Network error',
      };
    }
  },

  /**
   * Fetches all registered staff members (profiles) from the database or mock store.
   */
  async getStaffMembers(): Promise<UserProfile[]> {
    const { staff } = await this.getStaffStatus();
    return staff;
  },

  /**
   * Directly provisions a new staff member (telecaller or admin) from the CRM dashboard.
   */
  async createStaffMember(input: CreateStaffInput): Promise<UserProfile> {
    const validated = createStaffSchema.parse(input);

    if (isTestEnvironment() || !isSupabaseConfigured()) {
      // Check for duplicate email in mock store
      const exists = mockStaffStore.some(
        (s) => s.email.toLowerCase() === validated.email.toLowerCase()
      );
      if (exists) {
        throw new Error(`A staff member with email "${validated.email}" is already registered.`);
      }

      const newMockStaff: UserProfile = {
        id: `user-staff-${Date.now()}`,
        email: validated.email.toLowerCase(),
        full_name: validated.full_name.trim(),
        role: validated.role,
        phone: validated.phone?.trim() || null,
        avatar_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockStaffStore.unshift(newMockStaff);
      return newMockStaff;
    }

    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/staff', {
      method: 'POST',
      headers,
      body: JSON.stringify(validated),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(json.error || `Failed to create staff member (Status ${res.status})`);
    }

    return json.data;
  },

  /**
   * Activates or deactivates a staff member's access.
   */
  async toggleStaffStatus(id: string, is_active: boolean): Promise<UserProfile> {
    if (isTestEnvironment() || !isSupabaseConfigured()) {
      const index = mockStaffStore.findIndex((s) => s.id === id);
      if (index === -1) {
        throw new Error('Staff member not found in database');
      }
      mockStaffStore[index] = {
        ...mockStaffStore[index],
        is_active,
        updated_at: new Date().toISOString(),
      };
      return mockStaffStore[index];
    }

    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/staff', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ id, is_active }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(json.error || `Failed to update staff status (Status ${res.status})`);
    }

    return json.data;
  },

  /**
   * Permanently deletes a staff member's account and profile.
   */
  async deleteStaffMember(id: string): Promise<void> {
    if (isTestEnvironment() || !isSupabaseConfigured()) {
      const index = mockStaffStore.findIndex((s) => s.id === id);
      if (index === -1) {
        throw new Error('Staff member not found in database');
      }
      mockStaffStore.splice(index, 1);
      return;
    }

    const headers = await getAuthHeaders();
    const res = await fetch(`/api/admin/staff?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ id }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(json.error || `Failed to delete staff member (Status ${res.status})`);
    }
  },
};


