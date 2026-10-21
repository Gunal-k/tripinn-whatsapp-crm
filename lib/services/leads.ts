import { 
  Lead, 
  LeadActivity, 
  WhatsAppMessage, 
  DashboardMetrics, 
  LeadFilters, 
  LeadPipelineStage 
} from '../types/crm';
import { INITIAL_MOCK_LEADS, INITIAL_MOCK_ACTIVITIES, INITIAL_MOCK_MESSAGES } from '../data/mock-leads';
import { normalizePhoneNumber } from '../utils/phone';
import { CreateLeadInput, UpdateLeadInput, QualifyLeadCriteria } from '../validations/lead';

const STORAGE_KEY_LEADS = 'tripinn_leads_cache_v1';
const STORAGE_KEY_ACTIVITIES = 'tripinn_activities_cache_v1';
const STORAGE_KEY_MESSAGES = 'tripinn_messages_cache_v1';

// In-memory fallback stores
let inMemoryLeads: Lead[] = [...INITIAL_MOCK_LEADS];
let inMemoryActivities: Record<string, LeadActivity[]> = { ...INITIAL_MOCK_ACTIVITIES };
let inMemoryMessages: Record<string, WhatsAppMessage[]> = { ...INITIAL_MOCK_MESSAGES };

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function loadLocalLeads(): Lead[] {
  if (!isBrowser()) return inMemoryLeads;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LEADS);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return inMemoryLeads;
}

function saveLocalLeads(leads: Lead[]): void {
  inMemoryLeads = leads;
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY_LEADS, JSON.stringify(leads));
  } catch {
    // ignore quota errors
  }
}

function loadLocalActivities(): Record<string, LeadActivity[]> {
  if (!isBrowser()) return inMemoryActivities;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVITIES);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return inMemoryActivities;
}

function saveLocalActivities(acts: Record<string, LeadActivity[]>): void {
  inMemoryActivities = acts;
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY_ACTIVITIES, JSON.stringify(acts));
  } catch {
    // ignore
  }
}

function loadLocalMessages(): Record<string, WhatsAppMessage[]> {
  if (!isBrowser()) return inMemoryMessages;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MESSAGES);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return inMemoryMessages;
}

function saveLocalMessages(msgs: Record<string, WhatsAppMessage[]>): void {
  inMemoryMessages = msgs;
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(msgs));
  } catch {
    // ignore
  }
}

export const leadService = {
  getLeads(filters?: LeadFilters): Lead[] {
    let list = loadLocalLeads();

    if (!filters) return list;

    // Filter by archived
    if (!filters.showArchived) {
      list = list.filter((l) => !l.is_archived);
    } else {
      list = list.filter((l) => l.is_archived);
    }

    // Filter by status
    if (filters.status && filters.status !== 'ALL') {
      list = list.filter((l) => l.lead_status === filters.status);
    }

    // Filter by lead source
    if (filters.source && filters.source !== 'ALL') {
      list = list.filter((l) => l.lead_source === filters.source);
    }

    // Filter by qualification
    if (filters.qualification && filters.qualification !== 'ALL') {
      list = list.filter((l) => l.qualification_status === filters.qualification);
    }

    // Filter by search query (Name, Phone, Destination, Email)
    if (filters.search && filters.search.trim() !== '') {
      const q = filters.search.toLowerCase().trim();
      list = list.filter((l) => {
        return (
          l.name.toLowerCase().includes(q) ||
          l.phone.includes(q) ||
          (l.email && l.email.toLowerCase().includes(q)) ||
          (l.interested_destination && l.interested_destination.toLowerCase().includes(q))
        );
      });
    }

    // Filter by date range
    if (filters.dateRange && filters.dateRange !== 'all') {
      const now = new Date().getTime();
      list = list.filter((l) => {
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

    // Order by created_at DESC
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  getLeadById(id: string): Lead | null {
    const list = loadLocalLeads();
    return list.find((l) => l.id === id) || null;
  },

  checkDuplicatePhone(rawPhone: string, excludeLeadId?: string): Lead | null {
    const normalized = normalizePhoneNumber(rawPhone);
    if (!normalized) return null;
    const list = loadLocalLeads();
    return list.find((l) => l.phone === normalized && l.id !== excludeLeadId) || null;
  },

  createLead(data: CreateLeadInput): { lead: Lead; duplicateFound: boolean } {
    const normalizedPhone = normalizePhoneNumber(data.phone);
    const existing = this.checkDuplicatePhone(normalizedPhone);

    if (existing) {
      return { lead: existing, duplicateFound: true };
    }

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

    const currentLeads = loadLocalLeads();
    saveLocalLeads([newLead, ...currentLeads]);

    // Record activity
    this.addActivity(newLead.id, {
      activity_type: 'lead_created',
      title: 'New Lead Created',
      description: `Lead created via ${newLead.lead_source}. Assigned to Priya Sharma.`,
    });

    if (newLead.follow_up_date) {
      this.addActivity(newLead.id, {
        activity_type: 'follow_up_scheduled',
        title: 'Follow-up Scheduled',
        description: `Follow-up set for ${new Date(newLead.follow_up_date).toLocaleString()}: ${newLead.follow_up_notes || 'No notes'}`,
      });
    }

    return { lead: newLead, duplicateFound: false };
  },

  updateLead(id: string, updates: UpdateLeadInput): Lead | null {
    const list = loadLocalLeads();
    const index = list.findIndex((l) => l.id === id);
    if (index === -1) return null;

    const current = list[index];
    const updated: Lead = {
      ...current,
      ...updates,
      phone: updates.phone ? normalizePhoneNumber(updates.phone) : current.phone,
      updated_at: new Date().toISOString(),
    };

    list[index] = updated;
    saveLocalLeads(list);

    this.addActivity(id, {
      activity_type: 'note_added',
      title: 'Lead Details Updated',
      description: 'Customer contact or trip specifications modified.',
    });

    return updated;
  },

  updateLeadStatus(id: string, newStatus: LeadPipelineStage): Lead | null {
    const list = loadLocalLeads();
    const index = list.findIndex((l) => l.id === id);
    if (index === -1) return null;

    const current = list[index];
    const prevStatus = current.lead_status;

    // Business rule: To transition to QUALIFIED, use qualifyLead() with explicit criteria verification
    const updated: Lead = {
      ...current,
      lead_status: newStatus,
      updated_at: new Date().toISOString(),
    };

    list[index] = updated;
    saveLocalLeads(list);

    this.addActivity(id, {
      activity_type: 'status_change',
      title: `Pipeline Stage Changed: ${prevStatus} → ${newStatus}`,
      description: `Lead progressed from ${prevStatus} to ${newStatus}.`,
    });

    return updated;
  },

  qualifyLead(id: string, criteria: QualifyLeadCriteria, salespersonName = 'Priya Sharma'): {
    success: boolean;
    lead: Lead | null;
    metaCapiTriggered: boolean;
    message: string;
  } {
    const list = loadLocalLeads();
    const index = list.findIndex((l) => l.id === id);
    if (index === -1) {
      return { success: false, lead: null, metaCapiTriggered: false, message: 'Lead not found' };
    }

    const current = list[index];

    // Explicit qualification verification
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

    // Check if Meta CAPI should be signaled
    // Required: ctwa_clid present and meta_conversion_sent is false (idempotent)
    if (current.ctwa_clid && !current.meta_conversion_sent) {
      metaTriggered = true;
    }

    const updated: Lead = {
      ...current,
      lead_status: 'QUALIFIED',
      qualification_status: 'QUALIFIED',
      qualified_at: now,
      qualified_by: 'user-sales-01',
      meta_conversion_sent: metaTriggered ? true : current.meta_conversion_sent,
      meta_conversion_sent_at: metaTriggered ? now : current.meta_conversion_sent_at,
      updated_at: now,
    };

    list[index] = updated;
    saveLocalLeads(list);

    // Record qualification activity
    this.addActivity(id, {
      activity_type: 'qualification',
      title: 'Lead Explicitly Qualified',
      description: `Qualified by ${salespersonName}. Criteria verified: Budget, Travelers, Travel Dates. Notes: ${criteria.qualificationNotes}`,
    });

    if (metaTriggered) {
      this.addActivity(id, {
        activity_type: 'meta_conversion',
        title: 'Meta Messaging Conversion Event Dispatched',
        description: `Dispatched "Lead" event to Meta Conversions API with ctwa_clid (${current.ctwa_clid}).`,
        metadata: { ctwa_clid: current.ctwa_clid, event_name: 'Lead' },
      });
    }

    return {
      success: true,
      lead: updated,
      metaCapiTriggered: metaTriggered,
      message: metaTriggered
        ? 'Lead marked QUALIFIED! Meta Messaging Conversion event successfully triggered.'
        : 'Lead marked QUALIFIED successfully.',
    };
  },

  scheduleFollowUp(id: string, followUpDate: string, notes?: string): Lead | null {
    const list = loadLocalLeads();
    const index = list.findIndex((l) => l.id === id);
    if (index === -1) return null;

    const updated: Lead = {
      ...list[index],
      follow_up_date: followUpDate,
      follow_up_notes: notes || null,
      follow_up_completed: false,
      updated_at: new Date().toISOString(),
    };

    list[index] = updated;
    saveLocalLeads(list);

    this.addActivity(id, {
      activity_type: 'follow_up_scheduled',
      title: 'Follow-up Scheduled',
      description: `Follow-up set for ${new Date(followUpDate).toLocaleString()}: ${notes || 'No notes provided'}`,
    });

    return updated;
  },

  completeFollowUp(id: string): Lead | null {
    const list = loadLocalLeads();
    const index = list.findIndex((l) => l.id === id);
    if (index === -1) return null;

    const updated: Lead = {
      ...list[index],
      follow_up_completed: true,
      updated_at: new Date().toISOString(),
    };

    list[index] = updated;
    saveLocalLeads(list);

    this.addActivity(id, {
      activity_type: 'follow_up_completed',
      title: 'Follow-up Marked Completed',
      description: 'Salesperson completed scheduled customer contact.',
    });

    return updated;
  },

  archiveLead(id: string, archive = true): Lead | null {
    const list = loadLocalLeads();
    const index = list.findIndex((l) => l.id === id);
    if (index === -1) return null;

    const updated: Lead = {
      ...list[index],
      is_archived: archive,
      updated_at: new Date().toISOString(),
    };

    list[index] = updated;
    saveLocalLeads(list);

    this.addActivity(id, {
      activity_type: 'status_change',
      title: archive ? 'Lead Archived' : 'Lead Unarchived',
      description: archive ? 'Lead moved to archive.' : 'Lead restored from archive.',
    });

    return updated;
  },

  getDashboardMetrics(filters?: LeadFilters): DashboardMetrics {
    const leads = this.getLeads(filters);
    const totalLeads = leads.length;
    const newLeads = leads.filter((l) => l.lead_status === 'NEW').length;
    const qualifiedLeads = leads.filter((l) => l.qualification_status === 'QUALIFIED').length;
    
    // Follow-ups due: incomplete follow-up with a set date
    const followUpsDue = leads.filter(
      (l) => l.follow_up_date && !l.follow_up_completed
    ).length;

    const bookingsConfirmed = leads.filter((l) => l.lead_status === 'BOOKED').length;
    const completedBookings = leads.filter((l) => l.lead_status === 'COMPLETED').length;

    // Conversion rate: Booked + Completed divided by Total Leads
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

  getLeadActivities(leadId: string): LeadActivity[] {
    const allActivities = loadLocalActivities();
    const list = allActivities[leadId] || [];
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  addActivity(leadId: string, activity: Omit<LeadActivity, 'id' | 'lead_id' | 'created_at'>): void {
    const allActivities = loadLocalActivities();
    const current = allActivities[leadId] || [];
    const newAct: LeadActivity = {
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      lead_id: leadId,
      ...activity,
      created_at: new Date().toISOString(),
    };

    allActivities[leadId] = [newAct, ...current];
    saveLocalActivities(allActivities);
  },

  getLeadMessages(leadId: string): WhatsAppMessage[] {
    const allMessages = loadLocalMessages();
    return allMessages[leadId] || [];
  },

  sendWhatsAppMessage(leadId: string, messageBody: string): WhatsAppMessage {
    const lead = this.getLeadById(leadId);
    const toPhone = lead ? lead.phone : 'unknown';

    const newMsg: WhatsAppMessage = {
      id: `msg-${Date.now()}`,
      lead_id: leadId,
      wamid: `wamid.outbound.${Date.now()}.${Math.random().toString(36).substr(2, 6)}`,
      direction: 'outbound',
      from_phone: '919800000000',
      to_phone: toPhone,
      message_body: messageBody,
      message_type: 'text',
      status: 'sent', // Initially sent, will transition to delivered/read
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const allMessages = loadLocalMessages();
    const current = allMessages[leadId] || [];
    allMessages[leadId] = [...current, newMsg];
    saveLocalMessages(allMessages);

    // Record activity
    this.addActivity(leadId, {
      activity_type: 'whatsapp_outbound',
      title: 'WhatsApp Message Sent',
      description: messageBody.length > 80 ? `${messageBody.substring(0, 80)}...` : messageBody,
    });

    return newMsg;
  },

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

  logCallOutcome(
    leadId: string,
    outcome: 'CONNECTED_INTERESTED' | 'CALLBACK_REQUESTED' | 'RINGING_NO_ANSWER' | 'BUSY_DISCONNECTED' | 'NOT_INTERESTED',
    notes: string,
    nextFollowUpDate?: string,
    telecallerName = 'Priya Sharma'
  ): Lead | null {
    const list = loadLocalLeads();
    const index = list.findIndex((l) => l.id === leadId);
    if (index === -1) return null;

    const current = list[index];
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
      if (nextFollowUpDate) {
        newFollowUpDate = nextFollowUpDate;
        newFollowUpCompleted = false;
        newFollowUpNotes = notes;
      }
    } else if (outcome === 'NOT_INTERESTED') {
      newStatus = 'LOST';
      newQual = 'DISQUALIFIED';
      newFollowUpCompleted = true;
    }

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

    list[index] = updated;
    saveLocalLeads(list);

    this.addActivity(leadId, {
      activity_type: 'note_added',
      title: `Phone Call Logged: ${outcomeLabels[outcome]}`,
      description: `Call by ${telecallerName}. Outcome: ${outcomeLabels[outcome]}. Remarks: ${notes || 'No remarks added'}`,
      metadata: { outcome, telecaller: telecallerName },
    });

    return updated;
  },

  reassignLead(leadId: string, staffId: string, staffName: string, staffEmail: string): Lead | null {
    const list = loadLocalLeads();
    const index = list.findIndex((l) => l.id === leadId);
    if (index === -1) return null;

    const updated: Lead = {
      ...list[index],
      assigned_salesperson_id: staffId,
      assigned_salesperson: {
        id: staffId,
        full_name: staffName,
        email: staffEmail,
      },
      updated_at: new Date().toISOString(),
    };

    list[index] = updated;
    saveLocalLeads(list);

    this.addActivity(leadId, {
      activity_type: 'note_added',
      title: 'Lead Reassigned',
      description: `Lead assigned to telecaller ${staffName}.`,
    });

    return updated;
  },
};
