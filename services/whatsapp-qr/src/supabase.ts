import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load both local .env and root CRM .env.local
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/^["']|["']$/g, '');
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/^["']|["']$/g, '');

let supabaseAdmin: SupabaseClient | null = null;

if (supabaseUrl && serviceRoleKey && !supabaseUrl.includes('placeholder')) {
  try {
    supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    console.log('[SupabaseService] Admin client initialized for experimental synchronization.');
  } catch (err) {
    console.warn('[SupabaseService] Failed to initialize Supabase client:', err);
  }
} else {
  console.log('[SupabaseService] Supabase not fully configured; running in standalone memory mode.');
}

export interface StoredMessageRecord {
  sessionId: string;
  providerMessageId: string;
  direction: 'inbound' | 'outbound';
  fromPhone: string;
  toPhone: string;
  messageBody: string;
  messageType?: string;
  chatType?: 'direct' | 'group';
  senderPhone?: string;
  senderName?: string;
  groupJid?: string;
  groupName?: string;
  status?: string;
  leadId?: string | null;
  matchedLeadName?: string | null;
  rawPayload?: Record<string, unknown>;
  createdAt?: string;
}

export const supabaseService = {
  isConfigured(): boolean {
    return Boolean(supabaseAdmin);
  },

  /**
   * Upserts the active session status into public.experimental_whatsapp_sessions.
   * Tolerates missing table (PGRST205) gracefully.
   */
  async syncSession(sessionId: string, data: {
    phoneNumber?: string | null;
    status: string;
    pairedAt?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (!supabaseAdmin) return;

    try {
      const now = new Date().toISOString();
      const payload: Record<string, unknown> = {
        session_id: sessionId,
        status: data.status,
        updated_at: now,
        last_active_at: now,
      };

      if (data.phoneNumber) payload.phone_number = data.phoneNumber;
      if (data.pairedAt) payload.paired_at = data.pairedAt;
      if (data.metadata) payload.metadata = data.metadata;

      const { error } = await supabaseAdmin
        .from('experimental_whatsapp_sessions')
        .upsert(payload, { onConflict: 'session_id' });

      if (error) {
        if (error.code !== 'PGRST205') {
          console.warn('[SupabaseService] Session upsert notice:', error.message);
        }
      }
    } catch {
      // Graceful fallback if database schema is pending
    }
  },

  /**
   * Looks up a lead by normalized phone number without modifying the lead.
   */
  async findLeadByPhone(rawPhone: string): Promise<{ id: string; name: string } | null> {
    if (!supabaseAdmin || !rawPhone) return null;

    try {
      const digits = rawPhone.replace(/\D/g, '');
      const possibleFormats = [digits, `+${digits}`, digits.slice(-10)];

      const { data, error } = await supabaseAdmin
        .from('leads')
        .select('id, name, phone')
        .or(possibleFormats.map((p) => `phone.eq.${p}`).join(','))
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return { id: data.id, name: data.name };
      }
    } catch {
      // Ignore lookup failure
    }
    return null;
  },

  /**
   * Persists an experimental message into public.experimental_whatsapp_messages.
   * Associates with matching lead by phone if one exists.
   * Strictly idempotent via provider_message_id.
   */
  async persistMessage(msg: StoredMessageRecord): Promise<void> {
    if (!supabaseAdmin) return;

    try {
      // Match lead by fromPhone (or senderPhone for group inbound) or toPhone (for outbound)
      let leadId = msg.leadId || null;
      if (!leadId) {
        const targetPhone = msg.direction === 'inbound'
          ? (msg.chatType === 'group' ? msg.senderPhone : msg.fromPhone)
          : msg.toPhone;
        if (targetPhone && !targetPhone.includes('@')) {
          const matchedLead = await this.findLeadByPhone(targetPhone);
          if (matchedLead) {
            leadId = matchedLead.id;
            msg.leadId = leadId;
            msg.matchedLeadName = matchedLead.name;
          }
        }
      }

      const row = {
        session_id: msg.sessionId,
        provider_message_id: msg.providerMessageId,
        direction: msg.direction,
        from_phone: msg.fromPhone,
        to_phone: msg.toPhone,
        message_body: msg.messageBody,
        message_type: msg.messageType || 'text',
        status: msg.status || (msg.direction === 'inbound' ? 'received' : 'sent'),
        lead_id: leadId,
        raw_payload: {
          ...(msg.rawPayload || {}),
          senderName: msg.senderName,
          groupName: msg.groupName,
          chatType: msg.chatType,
          senderPhone: msg.senderPhone,
          matchedLeadName: msg.matchedLeadName,
        },
        created_at: msg.createdAt || new Date().toISOString(),
      };

      const { error } = await supabaseAdmin
        .from('experimental_whatsapp_messages')
        .insert(row);

      if (error) {
        // Code 23505 = duplicate provider_message_id (idempotent, ignore)
        // Code PGRST205 = table not yet migrated
        if (error.code !== '23505' && error.code !== 'PGRST205') {
          console.warn('[SupabaseService] Message insert notice:', error.message);
        }
      }
    } catch {
      // Graceful fallback
    }
  },

  /**
   * Retrieves recent messages for a session.
   */
  async getRecentMessages(sessionId: string, limit = 50): Promise<StoredMessageRecord[]> {
    if (!supabaseAdmin) return [];

    try {
      const { data, error } = await supabaseAdmin
        .from('experimental_whatsapp_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && data) {
        return data.map((d: any) => ({
          sessionId: d.session_id,
          providerMessageId: d.provider_message_id,
          direction: d.direction,
          fromPhone: d.from_phone,
          toPhone: d.to_phone,
          messageBody: d.message_body,
          messageType: d.message_type,
          chatType: d.raw_payload?.chatType || (d.from_phone?.length > 15 ? 'group' : 'direct'),
          senderPhone: d.raw_payload?.senderPhone || d.from_phone,
          senderName: d.raw_payload?.senderName,
          groupName: d.raw_payload?.groupName,
          matchedLeadName: d.raw_payload?.matchedLeadName,
          status: d.status,
          leadId: d.lead_id,
          createdAt: d.created_at,
        }));
      }
    } catch {
      // Table may not exist yet
    }
    return [];
  },
};

