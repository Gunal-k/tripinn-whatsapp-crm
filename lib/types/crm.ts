// ==============================================================================
// TRIPINN HOLIDAYS CRM - CORE TYPE DEFINITIONS
// ==============================================================================

export type UserRole = 'admin' | 'salesperson';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string | null;
  avatar_url?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type LeadSource = 
  | 'WhatsApp' 
  | 'Instagram' 
  | 'Facebook' 
  | 'website' 
  | 'referral' 
  | 'manual';

export type LeadPipelineStage = 
  | 'NEW' 
  | 'CONTACTED' 
  | 'QUALIFIED' 
  | 'FOLLOW_UP' 
  | 'PAYMENT_PENDING' 
  | 'BOOKED' 
  | 'COMPLETED' 
  | 'LOST';

export type QualificationStatus = 
  | 'UNQUALIFIED' 
  | 'PENDING' 
  | 'QUALIFIED' 
  | 'DISQUALIFIED';

export interface Lead {
  id: string;
  name: string;
  phone: string; // E.164 without leading + (e.g. 919876543210)
  email?: string | null;
  lead_source: LeadSource;
  interested_destination?: string | null;
  travel_dates?: string | null;
  number_of_travelers?: number | null;
  estimated_budget?: number | null;
  lead_status: LeadPipelineStage;
  qualification_status: QualificationStatus;
  qualified_at?: string | null;
  qualified_by?: string | null;
  assigned_salesperson_id?: string | null;
  assigned_salesperson?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  last_contact_date?: string | null;
  follow_up_date?: string | null;
  follow_up_notes?: string | null;
  follow_up_completed: boolean;
  internal_notes?: string | null;
  
  // Meta CTWA Attribution
  ctwa_clid?: string | null;
  meta_campaign_id?: string | null;
  meta_ad_id?: string | null;
  meta_source_id?: string | null;
  meta_conversion_sent: boolean;
  meta_conversion_sent_at?: string | null;
  meta_conversion_response?: Record<string, unknown> | null;
  
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  activity_type: 
    | 'status_change' 
    | 'qualification' 
    | 'note_added' 
    | 'whatsapp_inbound' 
    | 'whatsapp_outbound' 
    | 'follow_up_scheduled' 
    | 'follow_up_completed' 
    | 'meta_conversion'
    | 'lead_created';
  title: string;
  description?: string | null;
  performed_by?: string | null;
  performer?: {
    full_name: string;
  } | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export type MessageDirection = 'inbound' | 'outbound';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'received';

export interface WhatsAppMessage {
  id: string;
  lead_id?: string | null;
  wamid: string;
  direction: MessageDirection;
  from_phone: string;
  to_phone: string;
  message_body: string;
  message_type: 'text' | 'image' | 'document' | 'audio' | 'location' | 'template' | 'button_reply';
  status: MessageStatus;
  error_details?: Record<string, unknown> | null;
  raw_payload?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardMetrics {
  totalLeads: number;
  newLeads: number;
  qualifiedLeads: number;
  followUpsDue: number;
  bookingsConfirmed: number;
  completedBookings: number;
  conversionRate: number; // percentage
}

export interface LeadFilters {
  search?: string;
  status?: LeadPipelineStage | 'ALL';
  source?: LeadSource | 'ALL';
  qualification?: QualificationStatus | 'ALL';
  dateRange?: 'all' | 'today' | '7days' | '30days' | 'this_month';
  assignedTo?: string | 'ALL';
  showArchived?: boolean;
}
