import crypto from 'crypto';
import { normalizePhoneNumber } from '../utils/phone';

export interface WhatsAppIncomingMessage {
  wamid: string;
  fromPhone: string;
  senderName: string;
  body: string;
  timestamp: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'location' | 'button_reply' | 'unknown';
  // Meta CTWA referral attribution
  ctwaClid?: string;
  metaCampaignId?: string;
  metaAdId?: string;
  sourceType?: string;
}

export interface WhatsAppStatusUpdate {
  wamid: string;
  recipientPhone: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  errors?: Record<string, unknown>[];
}

interface MetaContact {
  wa_id: string;
  profile?: { name?: string };
}

interface MetaMessage {
  from: string;
  id: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string };
  image?: { caption?: string };
  document?: { filename?: string };
  location?: { latitude?: number; longitude?: number };
  referral?: {
    source_type?: string;
    source_id?: string;
    ctwa_clid?: string;
    headline?: string;
  };
}

interface MetaStatus {
  id: string;
  recipient_id: string;
  status: string;
  timestamp?: string;
  errors?: Record<string, unknown>[];
}

interface MetaChangeValue {
  contacts?: MetaContact[];
  messages?: MetaMessage[];
  statuses?: MetaStatus[];
}

interface MetaChange {
  field?: string;
  value?: MetaChangeValue;
}

interface MetaEntry {
  changes?: MetaChange[];
}

interface MetaWebhookPayload {
  entry?: MetaEntry[];
}

export const whatsappService = {
  /**
   * Validates Meta's X-Hub-Signature-256 header using timing-safe comparison.
   */
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null, appSecret?: string): boolean {
    const secret = appSecret || process.env.WHATSAPP_APP_SECRET;
    if (!secret || !signatureHeader) {
      return false;
    }

    const parts = signatureHeader.split('=');
    if (parts.length !== 2 || parts[0] !== 'sha256') {
      return false;
    }

    const signature = parts[1];
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch {
      return false;
    }
  },

  /**
   * Verifies the GET subscription verification challenge from Meta.
   */
  verifySubscriptionChallenge(
    mode: string | null,
    token: string | null,
    challenge: string | null,
    configuredVerifyToken?: string
  ): { valid: boolean; challenge: string | null } {
    const verifyToken = configuredVerifyToken || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    if (mode === 'subscribe' && token && verifyToken && token === verifyToken) {
      return { valid: true, challenge };
    }
    return { valid: false, challenge: null };
  },

  /**
   * Parses official Meta WhatsApp Business Cloud API incoming webhook payload.
   */
  parseWebhookPayload(rawPayload: unknown): {
    messages: WhatsAppIncomingMessage[];
    statuses: WhatsAppStatusUpdate[];
  } {
    const payload = rawPayload as MetaWebhookPayload;
    const parsedMessages: WhatsAppIncomingMessage[] = [];
    const parsedStatuses: WhatsAppStatusUpdate[] = [];

    if (!payload?.entry || !Array.isArray(payload.entry)) {
      return { messages: parsedMessages, statuses: parsedStatuses };
    }

    for (const entry of payload.entry) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;
        const value = change.value;
        if (!value) continue;

        // 1. Process Messages
        if (Array.isArray(value.messages)) {
          const contactMap: Record<string, string> = {};
          if (Array.isArray(value.contacts)) {
            value.contacts.forEach((c: MetaContact) => {
              contactMap[c.wa_id] = c.profile?.name || 'Customer';
            });
          }

          for (const msg of value.messages) {
            const fromRaw = msg.from;
            const fromNormalized = normalizePhoneNumber(fromRaw);
            const wamid = msg.id;
            const timestamp = msg.timestamp
              ? new Date(parseInt(msg.timestamp) * 1000).toISOString()
              : new Date().toISOString();

            let body = '';
            let type: WhatsAppIncomingMessage['type'] = 'unknown';

            if (msg.type === 'text') {
              type = 'text';
              body = msg.text?.body || '';
            } else if (msg.type === 'button') {
              type = 'button_reply';
              body = msg.button?.text || '';
            } else if (msg.type === 'image') {
              type = 'image';
              body = msg.image?.caption || '[Image received]';
            } else if (msg.type === 'document') {
              type = 'document';
              body = msg.document?.filename || '[Document received]';
            } else if (msg.type === 'audio') {
              type = 'audio';
              body = '[Voice note received]';
            } else if (msg.type === 'location') {
              type = 'location';
              body = `Location: ${msg.location?.latitude}, ${msg.location?.longitude}`;
            }

            // Extract CTWA referral metadata if user came from Click-to-WhatsApp ad
            let ctwaClid: string | undefined;
            let metaCampaignId: string | undefined;
            let metaAdId: string | undefined;
            let sourceType: string | undefined;

            if (msg.referral) {
              ctwaClid = msg.referral.ctwa_clid;
              sourceType = msg.referral.source_type;
              metaCampaignId = msg.referral.source_id;
              metaAdId = msg.referral.headline;
            }

            parsedMessages.push({
              wamid,
              fromPhone: fromNormalized,
              senderName: contactMap[fromRaw] || 'WhatsApp Traveler',
              body,
              timestamp,
              type,
              ctwaClid,
              metaCampaignId,
              metaAdId,
              sourceType,
            });
          }
        }

        // 2. Process Delivery Status Callbacks (sent, delivered, read, failed)
        if (Array.isArray(value.statuses)) {
          for (const st of value.statuses) {
            parsedStatuses.push({
              wamid: st.id,
              recipientPhone: normalizePhoneNumber(st.recipient_id),
              status: st.status as WhatsAppStatusUpdate['status'],
              timestamp: st.timestamp
                ? new Date(parseInt(st.timestamp) * 1000).toISOString()
                : new Date().toISOString(),
              errors: st.errors,
            });
          }
        }
      }
    }

    return { messages: parsedMessages, statuses: parsedStatuses };
  },

  /**
   * Sends an outbound text message via WhatsApp Business Platform Cloud API.
   */
  async sendTextMessage(
    toPhone: string,
    messageBody: string,
    options?: {
      accessToken?: string;
      phoneNumberId?: string;
      apiVersion?: string;
    }
  ): Promise<{ success: boolean; wamid?: string; error?: string }> {
    const accessToken = options?.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = options?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = options?.apiVersion || process.env.WHATSAPP_API_VERSION || 'v21.0';

    if (!accessToken || !phoneNumberId) {
      return {
        success: false,
        error: 'WhatsApp Cloud API credentials (WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID) missing in environment.',
      };
    }

    const normalizedRecipient = normalizePhoneNumber(toPhone);
    const endpoint = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: normalizedRecipient,
          type: 'text',
          text: {
            preview_url: false,
            body: messageBody,
          },
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: responseData?.error?.message || `WhatsApp Cloud API error (HTTP ${response.status})`,
        };
      }

      const wamid = responseData?.messages?.[0]?.id;
      return {
        success: true,
        wamid,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network failure contacting WhatsApp Cloud API';
      return { success: false, error: msg };
    }
  },
};
