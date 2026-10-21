import { NextRequest, NextResponse } from 'next/server';
import { whatsappService } from '../../../../lib/services/whatsapp';
import { leadService, isTestEnvironment, isSupabaseConfigured } from '../../../../lib/services/leads';
import { createAdminClient } from '../../../../lib/supabase/admin';
import { getAuthenticatedStaff } from '../../../../lib/supabase/auth';

export async function POST(request: NextRequest) {
  try {
    // Enforce active staff authentication on the server
    if (!isTestEnvironment() && isSupabaseConfigured()) {
      const { profile, error: authError } = await getAuthenticatedStaff();
      if (authError || !profile) {
        return NextResponse.json(
          { error: authError || 'Unauthorized: Active staff session required' },
          { status: 401 }
        );
      }
    }

    const body = await request.json();
    const { leadId, toPhone, messageText } = body;

    if (!messageText || (!leadId && !toPhone)) {
      return NextResponse.json(
        { error: 'Missing required parameters: messageText and either leadId or toPhone' },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    let targetPhone = toPhone;
    if (leadId) {
      const lead = await leadService.getLeadById(leadId, adminSupabase);
      if (!lead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      }
      targetPhone = lead.phone;
    }

    // Dispatch via WhatsApp Cloud API
    const result = await whatsappService.sendTextMessage(targetPhone, messageText);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          note: 'Ensure WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID are configured in .env.local',
        },
        { status: 422 }
      );
    }

    // Save outbound message to Supabase
    if (leadId) {
      await leadService.sendWhatsAppMessage(leadId, messageText, adminSupabase);
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
