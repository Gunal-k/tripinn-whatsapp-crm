import { NextRequest, NextResponse } from 'next/server';
import { whatsappService } from '../../../../lib/services/whatsapp';
import { leadService } from '../../../../lib/services/leads';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadId, toPhone, messageText } = body;

    if (!messageText || (!leadId && !toPhone)) {
      return NextResponse.json(
        { error: 'Missing required parameters: messageText and either leadId or toPhone' },
        { status: 400 }
      );
    }

    let targetPhone = toPhone;
    if (leadId) {
      const lead = leadService.getLeadById(leadId);
      if (!lead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      }
      targetPhone = lead.phone;
    }

    // Dispatch via WhatsApp Cloud API
    const result = await whatsappService.sendTextMessage(targetPhone, messageText);

    if (!result.success) {
      // In local development or before Meta access token is configured, log safely
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          note: 'Ensure WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID are configured in .env.local',
        },
        { status: 422 }
      );
    }

    // Save outbound message to lead service if leadId provided
    if (leadId) {
      leadService.sendWhatsAppMessage(leadId, messageText);
    }

    return NextResponse.json({
      success: true,
      wamid: result.wamid,
      recipient: targetPhone,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to dispatch WhatsApp message';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
