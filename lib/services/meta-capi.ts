import { Lead } from '../types/crm';
import { normalizePhoneNumber } from '../utils/phone';

export interface MetaCapiEventPayload {
  event_name: 'Lead' | 'Purchase';
  event_time: number;
  event_id: string; // Idempotency key (e.g. lead-001_Lead)
  action_source: 'business_messaging';
  messaging_channel: 'whatsapp';
  user_data: {
    ctwa_clid?: string;
    phone?: string[];
  };
  custom_data?: {
    destination?: string;
    value?: number;
    currency?: string;
    qualification_notes?: string;
  };
}

export const metaCapiService = {
  /**
   * Constructs the official Meta Conversions API payload for Click-to-WhatsApp (CTWA) ads.
   */
  buildMessagingConversionPayload(
    lead: Lead,
    eventName: 'Lead' | 'Purchase' = 'Lead',
    customNotes?: string
  ): MetaCapiEventPayload {
    const normPhone = normalizePhoneNumber(lead.phone);
    const eventTime = Math.floor(Date.now() / 1000);
    const eventId = `${lead.id}_${eventName}`;

    return {
      event_name: eventName,
      event_time: eventTime,
      event_id: eventId,
      action_source: 'business_messaging',
      messaging_channel: 'whatsapp',
      user_data: {
        ctwa_clid: lead.ctwa_clid || undefined,
        phone: normPhone ? [normPhone] : undefined,
      },
      custom_data: {
        destination: lead.interested_destination || undefined,
        value: lead.estimated_budget || undefined,
        currency: 'INR',
        qualification_notes: customNotes || lead.internal_notes || undefined,
      },
    };
  },

  /**
   * Sends the messaging conversion event to Meta Conversions API endpoint.
   */
  async sendMessagingConversionEvent(
    lead: Lead,
    options?: {
      datasetId?: string;
      accessToken?: string;
      testEventCode?: string;
      apiVersion?: string;
    }
  ): Promise<{
    success: boolean;
    responseCode?: number;
    eventsReceived?: number;
    fbtraceId?: string;
    error?: string;
  }> {
    const datasetId = options?.datasetId || process.env.META_DATASET_ID;
    const token = options?.accessToken || process.env.META_CONVERSIONS_API_TOKEN;
    const testCode = options?.testEventCode || process.env.META_TEST_EVENT_CODE;
    const apiVersion = options?.apiVersion || process.env.WHATSAPP_API_VERSION || 'v21.0';

    if (!datasetId || !token) {
      return {
        success: false,
        error: 'Meta Conversions API credentials (META_DATASET_ID or META_CONVERSIONS_API_TOKEN) missing in environment.',
      };
    }

    const payload = this.buildMessagingConversionPayload(lead, 'Lead');
    const endpoint = `https://graph.facebook.com/${apiVersion}/${datasetId}/events?access_token=${token}`;

    const body: Record<string, unknown> = {
      data: [payload],
    };

    if (testCode) {
      body.test_event_code = testCode;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const responseData = await response.json();

      if (!response.ok) {
        return {
          success: false,
          responseCode: response.status,
          error: responseData?.error?.message || `Meta CAPI error (HTTP ${response.status})`,
          fbtraceId: responseData?.error?.fbtrace_id,
        };
      }

      return {
        success: true,
        responseCode: response.status,
        eventsReceived: responseData?.events_received || 1,
        fbtraceId: responseData?.fbtrace_id,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error dispatching Meta CAPI event';
      return {
        success: false,
        error: msg,
      };
    }
  },
};
