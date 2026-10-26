import { 
  Lead, 
  LeadActivity, 
  WhatsAppMessage, 
  DashboardMetrics, 
  LeadFilters, 
  LeadPipelineStage,
  LeadSource,
  QualificationStatus,
  MessageStatus
} from '../types/crm';
import { INITIAL_MOCK_LEADS, INITIAL_MOCK_ACTIVITIES, INITIAL_MOCK_MESSAGES } from '../data/mock-leads';
import { normalizePhoneNumber } from '../utils/phone';
import { CreateLeadInput, UpdateLeadInput, QualifyLeadCriteria } from '../validations/lead';
import { createClient as createBrowserSupabaseClient } from '../supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

// In-memory test store (used only when Supabase is not configured or in explicit test mode)
let mockLeadsStore: Lead[] = [...INITIAL_MOCK_LEADS];
let mockActivitiesStore: Record<string, LeadActivity[]> = { ...INITIAL_MOCK_ACTIVITIES };
let mockMessagesStore: Record<string, WhatsAppMessage[]> = { ...INITIAL_MOCK_MESSAGES };

export function isTestEnvironment(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.npm_lifecycle_event === 'test' ||
    Boolean(process.env.VITEST) ||
    process.argv.includes('--test') ||
    process.argv.some((arg) => arg.includes('test'))
  );
}

export function isSupabaseConfigured(): boolean {
  if (isTestEnvironment()) {
    return false;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(
    url && 
    !url.includes('placeholder') && 
    anon && 
    !anon.includes('placeholder')
  );
}

/**
 * Returns the appropriate Supabase client:
 * - If custom client provided (e.g. createAdminClient() from a server API route), uses it.
 * - Otherwise: defaults to createBrowserSupabaseClient() (anon key only, safe from leaks).
 * - Admin client is protected by 'server-only' and never imported into browser bundles.
 */
export function getServiceClient(customClient?: SupabaseClient): SupabaseClient {
  if (customClient) return customClient;
  return createBrowserSupabaseClient();
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

/**
 * Maps a Supabase database row to our strongly typed Lead object.
 * Reconciles column naming differences between initial tables (source/status)
 * and full migration (lead_source/lead_status).
 */
export function mapDbRowToLead(row: Record<string, unknown>): Lead {
  return {
    id: String(row.id),
    name: String(row.name || 'Unnamed Customer'),
    phone: String(row.phone || ''),
    email: (row.email as string) || null,
    lead_source: (row.lead_source || row.source || 'WhatsApp') as LeadSource,
    interested_destination: ((row.interested_destination || row.destination) as string) || null,
    travel_dates: (row.travel_dates as string) || null,
    number_of_travelers: row.number_of_travelers ? Number(row.number_of_travelers) : null,
    estimated_budget: row.estimated_budget ? Number(row.estimated_budget) : (row.budget ? Number(row.budget) : null),
    lead_status: (row.lead_status || row.status || 'NEW') as LeadPipelineStage,
    qualification_status: (row.qualification_status || 'UNQUALIFIED') as QualificationStatus,
    qualified_at: (row.qualified_at as string) || null,
    qualified_by: (row.qualified_by as string) || null,
    assigned_salesperson_id: (row.assigned_salesperson_id as string) || null,
    assigned_salesperson: row.assigned_salesperson_id
      ? {
          id: String(row.assigned_salesperson_id),
          full_name:
            ((Array.isArray(row.profiles) ? row.profiles[0] : row.profiles) as { full_name?: string })?.full_name ||
            'Assigned Staff',
          email:
            ((Array.isArray(row.profiles) ? row.profiles[0] : row.profiles) as { email?: string })?.email ||
            'staff@tripinnholidays.com',
        }
      : null,
    last_contact_date: (row.last_contact_date as string) || (row.created_at as string) || null,
    follow_up_date: (row.follow_up_date as string) || null,
    follow_up_notes: (row.follow_up_notes as string) || null,
    follow_up_completed: Boolean(row.follow_up_completed),
    internal_notes: ((row.internal_notes || row.notes) as string) || null,
    ctwa_clid: (row.ctwa_clid as string) || null,
    meta_campaign_id: (row.meta_campaign_id as string) || null,
    meta_ad_id: (row.meta_ad_id as string) || null,
    meta_source_id: (row.meta_source_id as string) || null,
    meta_conversion_sent: Boolean(row.meta_conversion_sent),
    meta_conversion_sent_at: (row.meta_conversion_sent_at as string) || null,
    meta_conversion_response: (row.meta_conversion_response as Record<string, unknown>) || null,
    is_archived: Boolean(row.is_archived),
    created_at: (row.created_at as string) || new Date().toISOString(),
    updated_at: (row.updated_at as string) || new Date().toISOString(),
  };
}

export function mapDbRowToActivity(row: Record<string, unknown>): LeadActivity {
  return {
    id: String(row.id),
    lead_id: String(row.lead_id),
    activity_type: (row.activity_type as LeadActivity['activity_type']) || 'note_added',
    title: String(row.title || 'Activity'),
    description: (row.description as string) || null,
    performed_by: (row.performed_by as string) || null,
    performer: (row.profiles as { full_name?: string })?.full_name ? { full_name: (row.profiles as { full_name: string }).full_name } : null,
    metadata: (row.metadata as Record<string, unknown>) || {},
    created_at: (row.created_at as string) || new Date().toISOString(),
  };
}

export function mapDbRowToMessage(row: Record<string, unknown>): WhatsAppMessage {
  return {
    id: String(row.id),
    lead_id: row.lead_id ? String(row.lead_id) : null,
    wamid: String(row.wamid || row.wa_message_id || `msg-${row.id}`),
    direction: (row.direction as 'inbound' | 'outbound') || 'inbound',
    from_phone: String(row.from_phone || ''),
    to_phone: String(row.to_phone || ''),
    message_body: String(row.message_body || row.body || ''),
    message_type: (row.message_type as WhatsAppMessage['message_type']) || 'text',
    status: (row.status as MessageStatus) || 'received',
    error_details: (row.error_details as Record<string, unknown>) || null,
    raw_payload: (row.raw_payload as Record<string, unknown>) || null,
    created_at: (row.created_at as string) || new Date().toISOString(),
    updated_at: (row.updated_at as string) || new Date().toISOString(),
  };
}

export const leadService = {
  /**
   * Reset mock store (useful for clean unit tests)
   */
  resetMockStore(): void {
    mockLeadsStore = [...INITIAL_MOCK_LEADS];
    mockActivitiesStore = { ...INITIAL_MOCK_ACTIVITIES };
    mockMessagesStore = { ...INITIAL_MOCK_MESSAGES };
  },

  /**
   * Synchronously filter a list of leads (pure utility)
   */
  filterLeads(list: Lead[], filters?: LeadFilters): Lead[] {
    let result = [...list];
    if (!filters) return result;

    if (!filters.showArchived) {
      result = result.filter((l) => !l.is_archived);
    } else {
      result = result.filter((l) => l.is_archived);
    }

    if (filters.status && filters.status !== 'ALL') {
      result = result.filter((l) => l.lead_status === filters.status);
    }

    if (filters.source && filters.source !== 'ALL') {
      result = result.filter((l) => l.lead_source === filters.source);
    }

    if (filters.qualification && filters.qualification !== 'ALL') {
      result = result.filter((l) => l.qualification_status === filters.qualification);
    }

    if (filters.search && filters.search.trim() !== '') {
      const q = filters.search.toLowerCase().trim();
      result = result.filter((l) => {
        return (
          l.name.toLowerCase().includes(q) ||
          l.phone.includes(q) ||
          (l.email && l.email.toLowerCase().includes(q)) ||
          (l.interested_destination && l.interested_destination.toLowerCase().includes(q))
        );
      });
    }

    if (filters.dateRange && filters.dateRange !== 'all') {
      const now = Date.now();
      result = result.filter((l) => {
        const created = new Date(l.created_at).getTime();
        const diffHours = (now - created) / (1000 * 60 * 60);

        if (filters.dateRange === 'today') return diffHours <= 24;
        if (filters.dateRange === '7days') return diffHours <= 24 * 7;
        if (filters.dateRange === '30days') return diffHours <= 24 * 30;
        if (filters.dateRange === 'this_month') {
          const d = new Date(l.created_at);
          const cur = new Date();
          return d.getMonth() === cur.getMonth() && d.getFullYear() === cur.getFullYear();
        }
        return true;
      });
    }

    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  /**
   * Fetches leads from Supabase PostgreSQL (or mock fallback if unconfigured in test)
   */
  async getLeads(filters?: LeadFilters, client?: SupabaseClient): Promise<Lead[]> {
    if (isTestEnvironment() || !isSupabaseConfigured()) {
      return this.filterLeads(mockLeadsStore, filters);
    }

    if (typeof window !== 'undefined' && !client) {
      try {
        const headers = await getAuthHeaders();
        let url = '/api/admin/leads';
        if (filters?.showArchived) {
          url += '?archived=true';
        }
        const res = await fetch(url, { method: 'GET', headers });
        if (res.ok) {
          const json = await res.json();
          if (json.data && Array.isArray(json.data)) {
            const leads = json.data.map((row: Record<string, unknown>) => mapDbRowToLead(row));
            return this.filterLeads(leads, filters);
          }
        }
      } catch (err) {
        console.warn('API leads fetch fallback to direct client:', err);
      }
    }

    const sb = getServiceClient(client);
    let query = sb
      .from('leads')
      .select('*, profiles:assigned_salesperson_id(id, full_name, email)')
      .order('created_at', { ascending: false });

    if (filters?.showArchived) {
      query = query.eq('is_archived', true);
    }

    let { data, error } = await query;
    if (error) {
      // Graceful fallback if join syntax differs
      const fallbackRes = await sb
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (fallbackRes.error) {
        throw new Error(`Database error fetching leads: ${fallbackRes.error.message}`);
      }
      data = fallbackRes.data;
    }

    const leads = (data || []).map((row) => mapDbRowToLead(row as Record<string, unknown>));
    return this.filterLeads(leads, filters);
  },

  /**
   * Fetches a lead by ID
   */
  async getLeadById(id: string, client?: SupabaseClient): Promise<Lead | null> {
    if (isTestEnvironment() || !isSupabaseConfigured()) {
      return mockLeadsStore.find((l) => l.id === id) || null;
    }

    if (typeof window !== 'undefined' && !client) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/admin/leads?id=${encodeURIComponent(id)}`, { method: 'GET', headers });
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            return mapDbRowToLead(json.data as Record<string, unknown>);
          }
        }
      } catch (err) {
        console.warn('API getLeadById fallback to direct client:', err);
      }
    }

    const sb = getServiceClient(client);
    let { data, error } = await sb
      .from('leads')
      .select('*, profiles:assigned_salesperson_id(id, full_name, email)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      const fallback = await sb.from('leads').select('*').eq('id', id).maybeSingle();
      if (fallback.error) {
        throw new Error(`Database error finding lead ${id}: ${fallback.error.message}`);
      }
      data = fallback.data;
    }

    if (!data) return null;
    return mapDbRowToLead(data as Record<string, unknown>);
  },

  /**
   * Checks for duplicate lead by normalized phone number
   */
  async checkDuplicatePhone(rawPhone: string, excludeLeadId?: string, client?: SupabaseClient): Promise<Lead | null> {
    const normalized = normalizePhoneNumber(rawPhone);
    if (!normalized) return null;

    if (isTestEnvironment() || !isSupabaseConfigured()) {
      return mockLeadsStore.find((l) => l.phone === normalized && l.id !== excludeLeadId) || null;
    }

    const sb = getServiceClient(client);
    let query = sb.from('leads').select('*').eq('phone', normalized);
    if (excludeLeadId) {
      query = query.neq('id', excludeLeadId);
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      throw new Error(`Database error checking duplicate phone: ${error.message}`);
    }

    if (!data) return null;
    return mapDbRowToLead(data as Record<string, unknown>);
  },

  /**
   * Creates a new lead in Supabase PostgreSQL
   */
  async createLead(data: CreateLeadInput, client?: SupabaseClient): Promise<{ lead: Lead; duplicateFound: boolean }> {
    const normalizedPhone = normalizePhoneNumber(data.phone);
    const existing = await this.checkDuplicatePhone(normalizedPhone, undefined, client);

    if (existing) {
      return { lead: existing, duplicateFound: true };
    }

    if (isTestEnvironment() || !isSupabaseConfigured()) {
      const newLead: Lead = {
        id: `lead-${Date.now()}`,
        name: data.name,
        phone: normalizedPhone,
        email: data.email || null,
        lead_source: data.lead_source || 'WhatsApp',
        interested_destination: data.interested_destination || null,
        travel_dates: data.travel_dates || null,
        number_of_travelers: data.number_of_travelers || null,
        estimated_budget: data.estimated_budget || null,
        lead_status: 'NEW',
        qualification_status: 'UNQUALIFIED',
        qualified_at: null,
        qualified_by: null,
        assigned_salesperson_id: data.assigned_salesperson_id || 'user-sales-01',
        assigned_salesperson: {
          id: 'user-sales-01',
          full_name: 'Priya Sharma',
          email: 'priya@tripinnholidays.com',
        },
        last_contact_date: new Date().toISOString(),
        follow_up_date: data.follow_up_date || null,
        follow_up_notes: data.follow_up_notes || null,
        follow_up_completed: false,
        internal_notes: data.internal_notes || null,
        ctwa_clid: data.ctwa_clid || null,
        meta_campaign_id: data.meta_campaign_id || null,
        meta_ad_id: data.meta_ad_id || null,
        meta_conversion_sent: false,
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockLeadsStore = [newLead, ...mockLeadsStore];
      await this.addActivity(newLead.id, {
        activity_type: 'lead_created',
        title: 'New Lead Created',
        description: `Lead created via ${newLead.lead_source}.`,
      }, client);
      return { lead: newLead, duplicateFound: false };
    }

    if (typeof window !== 'undefined' && !client) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/admin/leads', {
          method: 'POST',
          headers,
          body: JSON.stringify({ action: 'create_lead', ...data }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.lead) {
            return {
              lead: mapDbRowToLead(json.lead as Record<string, unknown>),
              duplicateFound: Boolean(json.duplicateFound),
            };
          }
        }
      } catch (err) {
        console.warn('API createLead fallback to direct client:', err);
      }
    }

    const sb = getServiceClient(client);
    const now = new Date().toISOString();

    const insertPayload: Record<string, unknown> = {
      name: data.name,
      phone: normalizedPhone,
      email: data.email || null,
      lead_source: data.lead_source || 'WhatsApp',
      interested_destination: data.interested_destination || null,
      travel_dates: data.travel_dates || null,
      number_of_travelers: data.number_of_travelers || null,
      estimated_budget: data.estimated_budget || null,
      lead_status: 'NEW',
      qualification_status: 'UNQUALIFIED',
      last_contact_date: now,
      follow_up_date: data.follow_up_date || null,
      follow_up_notes: data.follow_up_notes || null,
      follow_up_completed: false,
      internal_notes: data.internal_notes || null,
      ctwa_clid: data.ctwa_clid || null,
      meta_campaign_id: data.meta_campaign_id || null,
      meta_ad_id: data.meta_ad_id || null,
      meta_conversion_sent: false,
      is_archived: false,
    };

    if (data.assigned_salesperson_id && data.assigned_salesperson_id.length > 20) {
      insertPayload.assigned_salesperson_id = data.assigned_salesperson_id;
    }

    const { data: createdRow, error } = await sb
      .from('leads')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create lead in database: ${error.message} (${error.code || ''})`);
    }

    const newLead = mapDbRowToLead(createdRow as Record<string, unknown>);

    // Record activity audit trail
    await this.addActivity(newLead.id, {
      activity_type: 'lead_created',
      title: 'New Lead Created',
      description: `Lead registered via ${newLead.lead_source}.`,
      metadata: { source: newLead.lead_source, ctwa_clid: newLead.ctwa_clid },
    }, client);

    if (newLead.follow_up_date) {
      await this.addActivity(newLead.id, {
        activity_type: 'follow_up_scheduled',
        title: 'Follow-up Scheduled',
        description: `Follow-up set for ${new Date(newLead.follow_up_date).toLocaleString()}: ${newLead.follow_up_notes || 'No notes'}`,
      }, client);
    }

    return { lead: newLead, duplicateFound: false };
  },

  /**
   * Updates lead details in Supabase
   */
  async updateLead(id: string, updates: UpdateLeadInput, client?: SupabaseClient): Promise<Lead | null> {
    if (isTestEnvironment() || !isSupabaseConfigured()) {
      const index = mockLeadsStore.findIndex((l) => l.id === id);
      if (index === -1) return null;
      const current = mockLeadsStore[index];
      const updated: Lead = {
        ...current,
        ...updates,
        phone: updates.phone ? normalizePhoneNumber(updates.phone) : current.phone,
        updated_at: new Date().toISOString(),
      };
      mockLeadsStore[index] = updated;
      return updated;
    }

    if (typeof window !== 'undefined' && !client) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/admin/leads', {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ action: 'update', id, updates }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            return mapDbRowToLead(json.data as Record<string, unknown>);
          }
        }
      } catch (err) {
        console.warn('API updateLead fallback to direct client:', err);
      }
    }

    const sb = getServiceClient(client);
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) updatePayload.name = updates.name;
    if (updates.phone !== undefined) updatePayload.phone = normalizePhoneNumber(updates.phone);
    if (updates.email !== undefined) updatePayload.email = updates.email || null;
    if (updates.lead_source !== undefined) updatePayload.lead_source = updates.lead_source;
    if (updates.interested_destination !== undefined) updatePayload.interested_destination = updates.interested_destination || null;
    if (updates.travel_dates !== undefined) updatePayload.travel_dates = updates.travel_dates || null;
    if (updates.number_of_travelers !== undefined) updatePayload.number_of_travelers = updates.number_of_travelers || null;
    if (updates.estimated_budget !== undefined) updatePayload.estimated_budget = updates.estimated_budget || null;
    if (updates.follow_up_date !== undefined) updatePayload.follow_up_date = updates.follow_up_date || null;
    if (updates.follow_up_notes !== undefined) updatePayload.follow_up_notes = updates.follow_up_notes || null;
    if (updates.internal_notes !== undefined) updatePayload.internal_notes = updates.internal_notes || null;
    if (updates.ctwa_clid !== undefined) updatePayload.ctwa_clid = updates.ctwa_clid || null;
    if (updates.meta_campaign_id !== undefined) updatePayload.meta_campaign_id = updates.meta_campaign_id || null;
    if (updates.meta_ad_id !== undefined) updatePayload.meta_ad_id = updates.meta_ad_id || null;
    if (updates.meta_conversion_sent !== undefined) updatePayload.meta_conversion_sent = updates.meta_conversion_sent;
    if (updates.meta_conversion_sent_at !== undefined) updatePayload.meta_conversion_sent_at = updates.meta_conversion_sent_at;

    const { data, error } = await sb
      .from('leads')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update lead ${id}: ${error.message}`);
    }

    if (!data) return null;
    return mapDbRowToLead(data as Record<string, unknown>);
  },

  /**
   * Updates pipeline stage of a lead
   */
  async updateLeadStatus(id: string, newStatus: LeadPipelineStage, client?: SupabaseClient): Promise<Lead | null> {
    const current = await this.getLeadById(id, client);
    if (!current) return null;

    const prevStatus = current.lead_status;

    if (isTestEnvironment() || !isSupabaseConfigured()) {
      const updated: Lead = {
        ...current,
        lead_status: newStatus,
        updated_at: new Date().toISOString(),
      };
      const idx = mockLeadsStore.findIndex((l) => l.id === id);
      if (idx !== -1) mockLeadsStore[idx] = updated;
      await this.addActivity(id, {
        activity_type: 'status_change',
        title: `Pipeline Stage Changed: ${prevStatus} → ${newStatus}`,
        description: `Lead progressed from ${prevStatus} to ${newStatus}.`,
      }, client);
      return updated;
    }

    if (typeof window !== 'undefined' && !client) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/admin/leads', {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ action: 'update_status', id, newStatus }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            return mapDbRowToLead(json.data as Record<string, unknown>);
          }
        }
      } catch (err) {
        console.warn('API updateLeadStatus fallback to direct client:', err);
      }
    }

    const sb = getServiceClient(client);
    const { data, error } = await sb
      .from('leads')
      .update({
        lead_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update lead status: ${error.message}`);
    }

    if (!data) return null;
    const updated = mapDbRowToLead(data as Record<string, unknown>);

    await this.addActivity(id, {
      activity_type: 'status_change',
      title: `Pipeline Stage Changed: ${prevStatus} → ${newStatus}`,
      description: `Lead progressed from ${prevStatus} to ${newStatus}.`,
    }, client);

    return updated;
  },

  /**
   * Explicit Qualification workflow
   */
  async qualifyLead(
    id: string, 
    criteria: QualifyLeadCriteria, 
    salespersonName = 'Priya Sharma',
    client?: SupabaseClient
  ): Promise<{
    success: boolean;
    lead: Lead | null;
    metaCapiTriggered: boolean;
    message: string;
  }> {
    const current = await this.getLeadById(id, client);
    if (!current) {
      return { success: false, lead: null, metaCapiTriggered: false, message: 'Lead not found' };
    }

    if (!criteria.verifiedBudget || !criteria.verifiedTravelDates || !criteria.verifiedTravelers) {
      return {
        success: false,
        lead: null,
        metaCapiTriggered: false,
        message: 'All three qualification criteria (Budget, Dates, Travelers) must be verified.',
      };
    }

    const now = new Date().toISOString();
    let metaTriggered = false;

    if (current.ctwa_clid && !current.meta_conversion_sent) {
      metaTriggered = true;
    }

    if (isTestEnvironment() || !isSupabaseConfigured()) {
      const updated: Lead = {
        ...current,
        lead_status: 'QUALIFIED',
        qualification_status: 'QUALIFIED',
        qualified_at: now,
        meta_conversion_sent: metaTriggered ? true : current.meta_conversion_sent,
        meta_conversion_sent_at: metaTriggered ? now : current.meta_conversion_sent_at,
        updated_at: now,
      };
      const idx = mockLeadsStore.findIndex((l) => l.id === id);
      if (idx !== -1) mockLeadsStore[idx] = updated;

      await this.addActivity(id, {
        activity_type: 'qualification',
        title: 'Lead Explicitly Qualified',
        description: `Qualified by ${salespersonName}. Criteria verified: Budget, Travelers, Travel Dates. Notes: ${criteria.qualificationNotes}`,
      }, client);

      return {
        success: true,
        lead: updated,
        metaCapiTriggered: metaTriggered,
        message: metaTriggered
          ? 'Lead marked QUALIFIED! Meta Messaging Conversion event queued.'
          : 'Lead marked QUALIFIED successfully.',
      };
    }

    if (typeof window !== 'undefined' && !client) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/admin/leads', {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ action: 'qualify', id, criteria, salespersonName }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            return {
              success: true,
              lead: mapDbRowToLead(json.data as Record<string, unknown>),
              metaCapiTriggered: Boolean(json.metaCapiTriggered),
              message: json.message || 'Lead marked QUALIFIED successfully.',
            };
          }
        }
      } catch (err) {
        console.warn('API qualifyLead fallback to direct client:', err);
      }
    }

    const sb = getServiceClient(client);
    const updateFields: Record<string, unknown> = {
      lead_status: 'QUALIFIED',
      qualification_status: 'QUALIFIED',
      qualified_at: now,
      updated_at: now,
    };

    if (metaTriggered) {
      updateFields.meta_conversion_sent = true;
      updateFields.meta_conversion_sent_at = now;
    }

    const { data, error } = await sb
      .from('leads')
      .update(updateFields)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to qualify lead: ${error.message}`);
    }

    if (!data) {
      return { success: false, lead: null, metaCapiTriggered: false, message: 'Lead update failed' };
    }

    const updated = mapDbRowToLead(data as Record<string, unknown>);

    await this.addActivity(id, {
      activity_type: 'qualification',
      title: 'Lead Explicitly Qualified',
      description: `Qualified by ${salespersonName}. Criteria verified: Budget, Travelers, Travel Dates. Notes: ${criteria.qualificationNotes}`,
    }, client);

    if (metaTriggered) {
      await this.addActivity(id, {
        activity_type: 'meta_conversion',
        title: 'Meta Messaging Conversion Event Dispatched',
        description: `Dispatched "Lead" event to Meta Conversions API with ctwa_clid (${current.ctwa_clid}).`,
        metadata: { ctwa_clid: current.ctwa_clid, event_name: 'Lead' },
      }, client);
    }

    return {
      success: true,
      lead: updated,
      metaCapiTriggered: metaTriggered,
      message: metaTriggered
        ? 'Lead marked QUALIFIED! Meta Messaging Conversion event successfully queued.'
        : 'Lead marked QUALIFIED successfully.',
    };
  },

  /**
   * Schedules a follow-up
   */
  async scheduleFollowUp(id: string, followUpDate?: string | null, notes?: string, client?: SupabaseClient): Promise<Lead | null> {
    // Sanitize followUpDate: ensure empty string is converted to null so Postgres timestamp never errors
    const cleanFollowUpDate = (typeof followUpDate === 'string' && followUpDate.trim() !== '') 
      ? followUpDate.trim() 
      : null;

    if (isTestEnvironment() || !isSupabaseConfigured()) {
      const idx = mockLeadsStore.findIndex((l) => l.id === id);
      if (idx === -1) return null;
      const updated: Lead = {
        ...mockLeadsStore[idx],
        follow_up_date: cleanFollowUpDate,
        follow_up_notes: notes || null,
        follow_up_completed: false,
        updated_at: new Date().toISOString(),
      };
      mockLeadsStore[idx] = updated;
      await this.addActivity(id, {
        activity_type: 'follow_up_scheduled',
        title: cleanFollowUpDate ? 'Follow-up Scheduled' : 'Follow-up Notes Updated',
        description: cleanFollowUpDate 
          ? `Follow-up set for ${new Date(cleanFollowUpDate).toLocaleString()}: ${notes || 'No notes'}`
          : `Follow-up notes updated: ${notes || 'No notes'}`,
      }, client);
      return updated;
    }

    if (typeof window !== 'undefined' && !client) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/admin/leads', {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ action: 'schedule_follow_up', id, followUpDate: cleanFollowUpDate, notes }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            return mapDbRowToLead(json.data as Record<string, unknown>);
          }
        }
      } catch (err) {
        console.warn('API scheduleFollowUp fallback to direct client:', err);
      }
    }

    const sb = getServiceClient(client);
    const { data, error } = await sb
      .from('leads')
      .update({
        follow_up_date: cleanFollowUpDate,
        follow_up_notes: notes || null,
        follow_up_completed: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to schedule follow-up: ${error.message}`);
    }

    if (!data) return null;
    const updated = mapDbRowToLead(data as Record<string, unknown>);

    await this.addActivity(id, {
      activity_type: 'follow_up_scheduled',
      title: cleanFollowUpDate ? 'Follow-up Scheduled' : 'Follow-up Notes Updated',
      description: cleanFollowUpDate 
        ? `Follow-up set for ${new Date(cleanFollowUpDate).toLocaleString()}: ${notes || 'No notes'}`
        : `Follow-up notes updated: ${notes || 'No notes'}`,
    }, client);

    return updated;
  },

  /**
   * Completes a follow-up
   */
  async completeFollowUp(id: string, client?: SupabaseClient): Promise<Lead | null> {
    if (isTestEnvironment() || !isSupabaseConfigured()) {
      const idx = mockLeadsStore.findIndex((l) => l.id === id);
      if (idx === -1) return null;
      const updated: Lead = {
        ...mockLeadsStore[idx],
        follow_up_completed: true,
        updated_at: new Date().toISOString(),
      };
      mockLeadsStore[idx] = updated;
      await this.addActivity(id, {
        activity_type: 'follow_up_completed',
        title: 'Follow-up Marked Completed',
        description: 'Salesperson completed scheduled customer contact.',
      }, client);
      return updated;
    }

    if (typeof window !== 'undefined' && !client) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/admin/leads', {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ action: 'complete_follow_up', id }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            return mapDbRowToLead(json.data as Record<string, unknown>);
          }
        }
      } catch (err) {
        console.warn('API completeFollowUp fallback to direct client:', err);
      }
    }

    const sb = getServiceClient(client);
    const { data, error } = await sb
      .from('leads')
      .update({
        follow_up_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to complete follow-up: ${error.message}`);
    }

    if (!data) return null;
    const updated = mapDbRowToLead(data as Record<string, unknown>);

    await this.addActivity(id, {
      activity_type: 'follow_up_completed',
      title: 'Follow-up Marked Completed',
      description: 'Salesperson completed scheduled customer contact.',
    }, client);

    return updated;
  },

  /**
   * Archives or unarchives a lead
   */
  async archiveLead(id: string, archive = true, client?: SupabaseClient): Promise<Lead | null> {
    if (isTestEnvironment() || !isSupabaseConfigured()) {
      const idx = mockLeadsStore.findIndex((l) => l.id === id);
      if (idx === -1) return null;
      const updated: Lead = {
        ...mockLeadsStore[idx],
        is_archived: archive,
        updated_at: new Date().toISOString(),
      };
      mockLeadsStore[idx] = updated;
      return updated;
    }

    if (typeof window !== 'undefined' && !client) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/admin/leads', {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ action: 'archive', id, archive }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            return mapDbRowToLead(json.data as Record<string, unknown>);
          }
        }
      } catch (err) {
        console.warn('API archiveLead fallback to direct client:', err);
      }
    }

    const sb = getServiceClient(client);
    const { data, error } = await sb
      .from('leads')
      .update({
        is_archived: archive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to archive lead: ${error.message}`);
    }

    if (!data) return null;
    return mapDbRowToLead(data as Record<string, unknown>);
  },

  /**
   * Computes dashboard metrics
   */
  calculateMetrics(leads: Lead[], filters?: LeadFilters): DashboardMetrics {
    const list = this.filterLeads(leads, filters);
    const totalLeads = list.length;
    const newLeads = list.filter((l) => l.lead_status === 'NEW').length;
    const qualifiedLeads = list.filter((l) => l.qualification_status === 'QUALIFIED').length;
    const followUpsDue = list.filter((l) => l.follow_up_date && !l.follow_up_completed).length;
    const bookingsConfirmed = list.filter((l) => l.lead_status === 'BOOKED').length;
    const completedBookings = list.filter((l) => l.lead_status === 'COMPLETED').length;
    const converted = bookingsConfirmed + completedBookings;
    const conversionRate = totalLeads > 0 ? Math.round((converted / totalLeads) * 1000) / 10 : 0;

    return {
      totalLeads,
      newLeads,
      qualifiedLeads,
      followUpsDue,
      bookingsConfirmed,
      completedBookings,
      conversionRate,
    };
  },

  async getDashboardMetrics(filters?: LeadFilters, client?: SupabaseClient): Promise<DashboardMetrics> {
    const leads = await this.getLeads(filters, client);
    return this.calculateMetrics(leads, filters);
  },

  /**
   * Fetches lead activities from Supabase
   */
  async getLeadActivities(leadId: string, client?: SupabaseClient): Promise<LeadActivity[]> {
    if (isTestEnvironment() || !isSupabaseConfigured()) {
      const list = mockActivitiesStore[leadId] || [];
      return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    if (typeof window !== 'undefined' && !client) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/admin/leads?activities_for=${encodeURIComponent(leadId)}`, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.data && Array.isArray(json.data)) {
            return json.data.map((row: Record<string, unknown>) => mapDbRowToActivity(row));
          }
        }
      } catch (err) {
        console.warn('API getLeadActivities fallback to direct client:', err);
      }
    }

    const sb = getServiceClient(client);
    const { data, error } = await sb
      .from('lead_activities')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (error) {
      // If table doesn't exist yet, return empty list rather than crashing UI
      if (error.code === 'PGRST205' || error.message.includes('schema cache')) {
        return [];
      }
      throw new Error(`Database error fetching activities: ${error.message}`);
    }

    return (data || []).map((row) => mapDbRowToActivity(row as Record<string, unknown>));
  },

  /**
   * Records a new activity in Supabase
   */
  async addActivity(
    leadId: string, 
    activity: Omit<LeadActivity, 'id' | 'lead_id' | 'created_at'>,
    client?: SupabaseClient
  ): Promise<LeadActivity> {
    const newAct: LeadActivity = {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      lead_id: leadId,
      ...activity,
      created_at: new Date().toISOString(),
    };

    if (isTestEnvironment() || !isSupabaseConfigured()) {
      const current = mockActivitiesStore[leadId] || [];
      mockActivitiesStore[leadId] = [newAct, ...current];
      return newAct;
    }

    if (typeof window !== 'undefined' && !client) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/admin/leads', {
          method: 'POST',
          headers,
          body: JSON.stringify({ action: 'add_activity', leadId, activity }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            return mapDbRowToActivity(json.data as Record<string, unknown>);
          }
        }
      } catch (err) {
        console.warn('API addActivity fallback to direct client:', err);
      }
    }

    const sb = getServiceClient(client);
    const { data, error } = await sb
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        activity_type: activity.activity_type,
        title: activity.title,
        description: activity.description || null,
        metadata: activity.metadata || {},
      })
      .select()
      .maybeSingle();

    if (error) {
      // If activities table is not yet created in user DB, do not crash main lead flow
      console.warn(`Could not save lead activity to database: ${error.message}`);
      return newAct;
    }

    return data ? mapDbRowToActivity(data as Record<string, unknown>) : newAct;
  },

  /**
   * Fetches WhatsApp messages for a lead
   */
  async getLeadMessages(leadId: string, client?: SupabaseClient): Promise<WhatsAppMessage[]> {
    if (isTestEnvironment() || !isSupabaseConfigured()) {
      return mockMessagesStore[leadId] || [];
    }

    if (typeof window !== 'undefined' && !client) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/admin/leads?messages_for=${encodeURIComponent(leadId)}`, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.data && Array.isArray(json.data)) {
            return json.data.map((row: Record<string, unknown>) => mapDbRowToMessage(row));
          }
        }
      } catch (err) {
        console.warn('API getLeadMessages fallback to direct client:', err);
      }
    }

    const sb = getServiceClient(client);
    const { data, error } = await sb
      .from('whatsapp_messages')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true });

    if (error) {
      if (error.code === 'PGRST205' || error.message.includes('schema cache')) {
        return [];
      }
      throw new Error(`Database error fetching messages: ${error.message}`);
    }

    return (data || []).map((row) => mapDbRowToMessage(row as Record<string, unknown>));
  },

  /**
   * Persists an incoming or outbound WhatsApp message
   */
  async recordWhatsAppMessage(
    msg: {
      leadId?: string | null;
      wamid: string;
      direction: 'inbound' | 'outbound';
      fromPhone: string;
      toPhone: string;
      messageBody: string;
      messageType?: string;
      status?: MessageStatus;
      rawPayload?: Record<string, unknown>;
    },
    client?: SupabaseClient
  ): Promise<WhatsAppMessage> {
    if (isTestEnvironment() || !isSupabaseConfigured()) {
      const recorded: WhatsAppMessage = {
        id: `msg-${Date.now()}`,
        lead_id: msg.leadId || null,
        wamid: msg.wamid,
        direction: msg.direction,
        from_phone: msg.fromPhone,
        to_phone: msg.toPhone,
        message_body: msg.messageBody,
        message_type: (msg.messageType as WhatsAppMessage['message_type']) || 'text',
        status: msg.status || (msg.direction === 'inbound' ? 'received' : 'sent'),
        raw_payload: msg.rawPayload || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (msg.leadId) {
        const cur = mockMessagesStore[msg.leadId] || [];
        mockMessagesStore[msg.leadId] = [...cur, recorded];
      }
      return recorded;
    }

    const sb = getServiceClient(client);
    const payload: Record<string, unknown> = {
      lead_id: msg.leadId || null,
      wamid: msg.wamid,
      direction: msg.direction,
      from_phone: msg.fromPhone,
      to_phone: msg.toPhone,
      message_body: msg.messageBody,
      message_type: msg.messageType || 'text',
      status: msg.status || (msg.direction === 'inbound' ? 'received' : 'sent'),
      raw_payload: msg.rawPayload || null,
    };

    const { data, error } = await sb
      .from('whatsapp_messages')
      .upsert(payload, { onConflict: 'wamid' })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save WhatsApp message to database: ${error.message}`);
    }

    return mapDbRowToMessage(data as Record<string, unknown>);
  },

  /**
   * Updates message delivery/read/failure status in Supabase
   */
  async updateWhatsAppMessageStatus(
    wamid: string,
    status: MessageStatus,
    errorDetails?: Record<string, unknown>,
    client?: SupabaseClient
  ): Promise<WhatsAppMessage | null> {
    if (isTestEnvironment() || !isSupabaseConfigured()) {
      for (const leadId of Object.keys(mockMessagesStore)) {
        const msg = mockMessagesStore[leadId].find((m) => m.wamid === wamid);
        if (msg) {
          msg.status = status;
          msg.updated_at = new Date().toISOString();
          return msg;
        }
      }
      return null;
    }

    const sb = getServiceClient(client);
    const updatePayload: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (errorDetails) {
      updatePayload.error_details = errorDetails;
    }

    const { data, error } = await sb
      .from('whatsapp_messages')
      .update(updatePayload)
      .eq('wamid', wamid)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update message status for ${wamid}: ${error.message}`);
    }

    if (!data) return null;
    return mapDbRowToMessage(data as Record<string, unknown>);
  },

  /**
   * Outbound message dispatcher helper
   */
  async sendWhatsAppMessage(leadId: string, messageBody: string, client?: SupabaseClient): Promise<WhatsAppMessage> {
    if (typeof window !== 'undefined' && !client) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/admin/leads', {
          method: 'POST',
          headers,
          body: JSON.stringify({ action: 'send_whatsapp_message', leadId, messageBody }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            return mapDbRowToMessage(json.data as Record<string, unknown>);
          }
        }
      } catch (err) {
        console.warn('API sendWhatsAppMessage fallback to direct client:', err);
      }
    }

    const lead = await this.getLeadById(leadId, client);
    const toPhone = lead ? lead.phone : 'unknown';
    const wamid = `wamid.outbound.${Date.now()}.${Math.random().toString(36).substring(2, 8)}`;

    const saved = await this.recordWhatsAppMessage({
      leadId,
      wamid,
      direction: 'outbound',
      fromPhone: process.env.WHATSAPP_PHONE_NUMBER_ID || 'business',
      toPhone,
      messageBody,
      messageType: 'text',
      status: 'sent',
    }, client);

    await this.addActivity(leadId, {
      activity_type: 'whatsapp_outbound',
      title: 'WhatsApp Message Sent',
      description: messageBody.length > 80 ? `${messageBody.substring(0, 80)}...` : messageBody,
      metadata: { wamid },
    }, client);

    return saved;
  },

  /**
   * Logs a telecaller call outcome
   */
  async logCallOutcome(
    leadId: string,
    outcome: 'CONNECTED_INTERESTED' | 'CALLBACK_REQUESTED' | 'RINGING_NO_ANSWER' | 'BUSY_DISCONNECTED' | 'NOT_INTERESTED',
    notes: string,
    nextFollowUpDate?: string,
    telecallerName = 'Priya Sharma',
    client?: SupabaseClient
  ): Promise<Lead | null> {
    const current = await this.getLeadById(leadId, client);
    if (!current) return null;

    const now = new Date().toISOString();
    let newStatus = current.lead_status;
    let newQual = current.qualification_status;
    let newFollowUpDate = current.follow_up_date;
    let newFollowUpNotes = current.follow_up_notes;
    let newFollowUpCompleted = current.follow_up_completed;

    const outcomeLabels: Record<string, string> = {
      CONNECTED_INTERESTED: 'Connected & Interested in Tour',
      CALLBACK_REQUESTED: 'Callback Requested by Client',
      RINGING_NO_ANSWER: 'Ringing / No Answer',
      BUSY_DISCONNECTED: 'Line Busy or Disconnected',
      NOT_INTERESTED: 'Not Interested / Budget Mismatch',
    };

    if (outcome === 'CONNECTED_INTERESTED') {
      if (current.lead_status === 'NEW') newStatus = 'CONTACTED';
    } else if (outcome === 'CALLBACK_REQUESTED') {
      newStatus = 'FOLLOW_UP';
      if (nextFollowUpDate && typeof nextFollowUpDate === 'string' && nextFollowUpDate.trim() !== '') {
        newFollowUpDate = nextFollowUpDate.trim();
        newFollowUpCompleted = false;
        newFollowUpNotes = notes;
      }
    } else if (outcome === 'NOT_INTERESTED') {
      newStatus = 'LOST';
      newQual = 'DISQUALIFIED';
      newFollowUpCompleted = true;
    }

    // Ensure follow_up_date is null if empty string
    newFollowUpDate = (typeof newFollowUpDate === 'string' && newFollowUpDate.trim() !== '') ? newFollowUpDate.trim() : null;

    if (isTestEnvironment() || !isSupabaseConfigured()) {
      const updated: Lead = {
        ...current,
        lead_status: newStatus,
        qualification_status: newQual,
        last_contact_date: now,
        follow_up_date: newFollowUpDate,
        follow_up_notes: newFollowUpNotes,
        follow_up_completed: newFollowUpCompleted,
        updated_at: now,
      };
      const idx = mockLeadsStore.findIndex((l) => l.id === leadId);
      if (idx !== -1) mockLeadsStore[idx] = updated;

      await this.addActivity(leadId, {
        activity_type: 'note_added',
        title: `Phone Call Logged: ${outcomeLabels[outcome]}`,
        description: `Call by ${telecallerName}. Outcome: ${outcomeLabels[outcome]}. Remarks: ${notes || 'No remarks'}`,
        metadata: { outcome, telecaller: telecallerName },
      }, client);
      return updated;
    }

    if (typeof window !== 'undefined' && !client) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/admin/leads', {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            action: 'call_outcome',
            leadId,
            outcome,
            notes,
            nextFollowUpDate,
            telecallerName,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            return mapDbRowToLead(json.data as Record<string, unknown>);
          }
        }
      } catch (err) {
        console.warn('API logCallOutcome fallback to direct client:', err);
      }
    }

    const sb = getServiceClient(client);
    const { data, error } = await sb
      .from('leads')
      .update({
        lead_status: newStatus,
        qualification_status: newQual,
        last_contact_date: now,
        follow_up_date: newFollowUpDate,
        follow_up_notes: newFollowUpNotes || null,
        follow_up_completed: newFollowUpCompleted,
        updated_at: now,
      })
      .eq('id', leadId)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to log call outcome in database: ${error.message}`);
    }

    if (!data) return null;
    const updated = mapDbRowToLead(data as Record<string, unknown>);

    await this.addActivity(leadId, {
      activity_type: 'note_added',
      title: `Phone Call Logged: ${outcomeLabels[outcome]}`,
      description: `Call by ${telecallerName}. Outcome: ${outcomeLabels[outcome]}. Remarks: ${notes || 'No remarks added'}`,
      metadata: { outcome, telecaller: telecallerName },
    }, client);

    return updated;
  },

  /**
   * Reassigns lead to a telecaller
   */
  async reassignLead(leadId: string, staffId: string, staffName: string, staffEmail: string, client?: SupabaseClient): Promise<Lead | null> {
    const isUnassigned = !staffId || staffId === 'unassigned';

    if (isTestEnvironment() || !isSupabaseConfigured()) {
      const idx = mockLeadsStore.findIndex((l) => l.id === leadId);
      if (idx === -1) return null;
      const updated: Lead = {
        ...mockLeadsStore[idx],
        assigned_salesperson_id: isUnassigned ? null : staffId,
        assigned_salesperson: isUnassigned ? undefined : { id: staffId, full_name: staffName, email: staffEmail },
        updated_at: new Date().toISOString(),
      };
      mockLeadsStore[idx] = updated;
      await this.addActivity(leadId, {
        activity_type: 'note_added',
        title: 'Lead Reassigned',
        description: isUnassigned ? 'Lead marked as unassigned.' : `Lead assigned to staff member ${staffName}.`,
      }, client);
      return updated;
    }

    if (typeof window !== 'undefined' && !client) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/admin/leads', {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            action: 'reassign',
            leadId,
            staffId,
            staffName,
            staffEmail,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            return mapDbRowToLead(json.data as Record<string, unknown>);
          }
        }
      } catch (err) {
        console.warn('API reassignLead fallback to direct client:', err);
      }
    }

    const sb = getServiceClient(client);
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      assigned_salesperson_id: isUnassigned ? null : staffId,
    };

    const { data, error } = await sb
      .from('leads')
      .update(updatePayload)
      .eq('id', leadId)
      .select('*, profiles:assigned_salesperson_id(id, full_name, email)')
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to reassign lead: ${error.message}`);
    }

    if (!data) return null;
    const updated = mapDbRowToLead(data as Record<string, unknown>);
    if (!isUnassigned) {
      updated.assigned_salesperson = { id: staffId, full_name: staffName, email: staffEmail };
      updated.assigned_salesperson_id = staffId;
    } else {
      updated.assigned_salesperson = undefined;
      updated.assigned_salesperson_id = null;
    }

    await this.addActivity(leadId, {
      activity_type: 'note_added',
      title: 'Lead Reassigned',
      description: isUnassigned ? 'Lead marked as unassigned.' : `Lead assigned to staff member ${staffName}.`,
    }, client);

    return updated;
  },

  /**
   * Exports leads to CSV (pure synchronous helper)
   */
  exportToCsv(leads: Lead[]): string {
    const headers = [
      'Lead ID',
      'Customer Name',
      'Phone',
      'Email',
      'Source',
      'Destination',
      'Travel Dates',
      'Travelers',
      'Estimated Budget (INR)',
      'Lead Status',
      'Qualification Status',
      'Assigned Salesperson',
      'Follow-up Date',
      'Follow-up Completed',
      'CTWA Clid',
      'Created Date',
    ];

    const rows = leads.map((l) => [
      l.id,
      `"${l.name.replace(/"/g, '""')}"`,
      l.phone,
      l.email || '',
      l.lead_source,
      `"${(l.interested_destination || '').replace(/"/g, '""')}"`,
      `"${(l.travel_dates || '').replace(/"/g, '""')}"`,
      l.number_of_travelers || '',
      l.estimated_budget || '',
      l.lead_status,
      l.qualification_status,
      `"${l.assigned_salesperson?.full_name || ''}"`,
      l.follow_up_date || '',
      l.follow_up_completed ? 'Yes' : 'No',
      l.ctwa_clid || '',
      l.created_at,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  },

  /**
   * Permanently deletes a lead and associated activities/messages
   */
  async deleteLead(id: string, client?: SupabaseClient): Promise<boolean> {
    if (!isSupabaseConfigured() || process.env.NODE_ENV === 'test') {
      const idx = mockLeadsStore.findIndex((l) => l.id === id);
      if (idx !== -1) {
        mockLeadsStore.splice(idx, 1);
        delete mockActivitiesStore[id];
        delete mockMessagesStore[id];
        return true;
      }
      return false;
    }

    if (typeof window !== 'undefined' && !client) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/admin/leads?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers,
        });
        if (res.ok) {
          const idx = mockLeadsStore.findIndex((l) => l.id === id);
          if (idx !== -1) {
            mockLeadsStore.splice(idx, 1);
            delete mockActivitiesStore[id];
            delete mockMessagesStore[id];
          }
          return true;
        }
      } catch (err) {
        console.warn('API deleteLead fallback to direct client:', err);
      }
    }

    const sb = getServiceClient(client);

    // Clean up dependent child records safely before deleting parent lead
    try {
      await sb.from('lead_activities').delete().eq('lead_id', id);
      await sb.from('whatsapp_messages').delete().eq('lead_id', id);
    } catch (cleanErr) {
      console.warn('Child records cleanup note:', cleanErr);
    }

    const { error } = await sb.from('leads').delete().eq('id', id);
    if (error) {
      throw new Error(`Failed to delete lead from database: ${error.message}`);
    }

    // Keep mock cache in sync
    const idx = mockLeadsStore.findIndex((l) => l.id === id);
    if (idx !== -1) {
      mockLeadsStore.splice(idx, 1);
      delete mockActivitiesStore[id];
      delete mockMessagesStore[id];
    }

    return true;
  },
};

