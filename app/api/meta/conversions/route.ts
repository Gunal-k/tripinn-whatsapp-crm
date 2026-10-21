import { NextRequest, NextResponse } from 'next/server';
import { metaCapiService } from '../../../../lib/services/meta-capi';
import { leadService } from '../../../../lib/services/leads';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadId, eventName = 'Lead' } = body;

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
    }

    const lead = leadService.getLeadById(leadId);
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Qualification enforcement rule:
    // Only send conversion event when lead is explicitly qualified!
    if (lead.qualification_status !== 'QUALIFIED') {
      return NextResponse.json(
        {
          error: 'Forbidden: Conversions API event can only be dispatched for explicitly QUALIFIED leads.',
        },
        { status: 403 }
      );
    }

    // Idempotency rule: Do not send duplicate events if already confirmed
    if (lead.meta_conversion_sent) {
      return NextResponse.json({
        success: true,
        alreadySent: true,
        message: 'Conversion event already recorded for this lead (Idempotent bypass).',
        sentAt: lead.meta_conversion_sent_at,
      });
    }

    // Dispatch to Meta
    const result = await metaCapiService.sendMessagingConversionEvent(lead);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          note: 'Ensure META_DATASET_ID and META_CONVERSIONS_API_TOKEN are configured in .env.local',
        },
        { status: 422 }
      );
    }

    // Update lead record
    const updated = leadService.updateLead(lead.id, {
      meta_conversion_sent: true,
      meta_conversion_sent_at: new Date().toISOString(),
    });

    leadService.addActivity(lead.id, {
      activity_type: 'meta_conversion',
      title: 'Meta Messaging Conversion Event Confirmed',
      description: `Dispatched "${eventName}" event to Meta CAPI. Response: HTTP ${result.responseCode}, trace ID: ${result.fbtraceId || 'N/A'}`,
      metadata: { fbtraceId: result.fbtraceId, responseCode: result.responseCode },
    });

    return NextResponse.json({
      success: true,
      eventsReceived: result.eventsReceived,
      fbtraceId: result.fbtraceId,
      lead: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error sending Meta CAPI event';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
