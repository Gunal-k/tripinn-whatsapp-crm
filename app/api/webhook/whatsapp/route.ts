import { NextRequest, NextResponse } from 'next/server';
import { whatsappService } from '../../../../lib/services/whatsapp';
import { leadService } from '../../../../lib/services/leads';
import { createAdminClient } from '../../../../lib/supabase/admin';

/**
 * Meta WhatsApp Business Webhook Route
 * GET: Webhook verification subscription challenge
 * POST: Incoming message & delivery status updates with HMAC-SHA256 verification and Supabase persistence
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const { valid, challenge: verifiedChallenge } = whatsappService.verifySubscriptionChallenge(
    mode,
    token,
    challenge
  );

  if (valid && verifiedChallenge) {
    return new NextResponse(verifiedChallenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({ error: 'Webhook verification challenge failed' }, { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get('x-hub-signature-256');
    const isProduction = process.env.NODE_ENV === 'production';
    const appSecret = process.env.WHATSAPP_APP_SECRET;

    // 1. Verify Webhook Signature using Meta App Secret
    if (isProduction) {
      if (!appSecret) {
        console.error('FATAL: WHATSAPP_APP_SECRET is not configured in production environment.');
        return NextResponse.json(
          { error: 'Server misconfiguration: WHATSAPP_APP_SECRET required in production.' },
          { status: 500 }
        );
      }
      if (!signatureHeader) {
        return NextResponse.json(
          { error: 'Missing x-hub-signature-256 header in production request.' },
          { status: 401 }
        );
      }
      const isValid = whatsappService.verifyWebhookSignature(rawBody, signatureHeader, appSecret);
      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid webhook signature.' },
          { status: 401 }
        );
      }
    } else if (signatureHeader && appSecret) {
      const isValid = whatsappService.verifyWebhookSignature(rawBody, signatureHeader, appSecret);
      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid webhook signature.' },
          { status: 401 }
        );
      }
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    // 2. Parse Messages and Status Callbacks
    const { messages, statuses } = whatsappService.parseWebhookPayload(payload);

    // Initialize server-side Supabase client (service role for webhook ingestion)
    const adminSupabase = createAdminClient();

    let processedMessagesCount = 0;
    let processedStatusesCount = 0;
    let duplicateIgnoredCount = 0;

    // 3. Process Incoming Messages Idempotently
    for (const msg of messages) {
      // Deduplication check via webhook_events table
      const { data: existingEvent, error: checkError } = await adminSupabase
        .from('webhook_events')
        .select('id, status')
        .eq('event_id', msg.wamid)
        .maybeSingle();

      if (checkError) {
        throw new Error(`Database error checking webhook idempotency: ${checkError.message}`);
      }

      if (existingEvent) {
        duplicateIgnoredCount++;
        continue;
      }

      // Find or create lead by normalized phone
      let lead = await leadService.checkDuplicatePhone(msg.fromPhone, undefined, adminSupabase);

      if (!lead) {
        // Create new travel lead
        const createResult = await leadService.createLead({
          name: msg.senderName || 'WhatsApp Enquiry',
          phone: msg.fromPhone,
          lead_source: 'WhatsApp',
          ctwa_clid: msg.ctwaClid || null,
          meta_campaign_id: msg.metaCampaignId || null,
          meta_ad_id: msg.metaAdId || null,
          internal_notes: `Initial WhatsApp message: "${msg.body}"`,
        }, adminSupabase);

        lead = createResult.lead;
      } else {
        // Lead already exists - update last contact date and attribution if newly received
        await leadService.addActivity(lead.id, {
          activity_type: 'whatsapp_inbound',
          title: 'WhatsApp Message Received',
          description: msg.body,
          metadata: { wamid: msg.wamid, ctwa_clid: msg.ctwaClid },
        }, adminSupabase);

        if (msg.ctwaClid && !lead.ctwa_clid) {
          await leadService.updateLead(lead.id, {
            ctwa_clid: msg.ctwaClid,
            meta_campaign_id: msg.metaCampaignId || null,
            meta_ad_id: msg.metaAdId || null,
          }, adminSupabase);
        }
      }

      // Persist inbound message to whatsapp_messages table
      await leadService.recordWhatsAppMessage({
        leadId: lead.id,
        wamid: msg.wamid,
        direction: 'inbound',
        fromPhone: msg.fromPhone,
        toPhone: process.env.WHATSAPP_PHONE_NUMBER_ID || 'business',
        messageBody: msg.body,
        messageType: msg.type,
        status: 'received',
        rawPayload: payload,
      }, adminSupabase);

      // Record in webhook_events audit log for idempotency
      const { error: logError } = await adminSupabase
        .from('webhook_events')
        .upsert(
          {
            event_id: msg.wamid,
            source: 'whatsapp',
            event_type: 'incoming_message',
            payload: msg,
            status: 'processed',
            processed_at: new Date().toISOString(),
          },
          { onConflict: 'event_id' }
        );

      if (logError) {
        throw new Error(`Database error logging webhook event for message ${msg.wamid}: ${logError.message}`);
      }

      processedMessagesCount++;
    }

    // 4. Process Status Updates (sent, delivered, read, failed)
    for (const st of statuses) {
      const statusEventId = `${st.wamid}:${st.status}`;

      // Deduplication check
      const { data: existingEvent, error: checkError } = await adminSupabase
        .from('webhook_events')
        .select('id')
        .eq('event_id', statusEventId)
        .maybeSingle();

      if (checkError) {
        throw new Error(`Database error checking status idempotency: ${checkError.message}`);
      }

      if (existingEvent) {
        duplicateIgnoredCount++;
        continue;
      }

      // Persist status change in whatsapp_messages
      const updatedMsg = await leadService.updateWhatsAppMessageStatus(
        st.wamid,
        st.status,
        st.errors ? { errors: st.errors } : undefined,
        adminSupabase
      );

      // If message is linked to a lead, record activity
      const recipientLead = await leadService.checkDuplicatePhone(st.recipientPhone, undefined, adminSupabase);
      const targetLeadId = updatedMsg?.lead_id || recipientLead?.id;

      if (targetLeadId) {
        if (st.status === 'failed') {
          await leadService.addActivity(targetLeadId, {
            activity_type: 'note_added',
            title: 'WhatsApp Message Delivery Failed',
            description: `Delivery failed for message ${st.wamid.substring(0, 15)}... Error: ${JSON.stringify(st.errors || 'Unknown error')}`,
            metadata: { wamid: st.wamid, errors: st.errors },
          }, adminSupabase);
        } else if (st.status === 'read') {
          await leadService.addActivity(targetLeadId, {
            activity_type: 'note_added',
            title: 'WhatsApp Message Read by Customer',
            description: `Customer read outbound message (${st.wamid.substring(0, 15)}...).`,
            metadata: { wamid: st.wamid, status: 'read' },
          }, adminSupabase);
        }
      }

      // Record event in webhook_events
      const { error: logError } = await adminSupabase
        .from('webhook_events')
        .upsert(
          {
            event_id: statusEventId,
            source: 'whatsapp',
            event_type: `message_status_${st.status}`,
            payload: st,
            status: 'processed',
            processed_at: new Date().toISOString(),
          },
          { onConflict: 'event_id' }
        );

      if (logError) {
        throw new Error(`Database error logging webhook status event ${statusEventId}: ${logError.message}`);
      }

      processedStatusesCount++;
    }

    // Success response to Meta
    return NextResponse.json({
      success: true,
      processed: {
        messages: processedMessagesCount,
        statuses: processedStatusesCount,
        duplicatesIgnored: duplicateIgnoredCount,
      },
    }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database or webhook processing error';
    console.error('WhatsApp webhook processing failure:', message);
    // Never report success on failure — return 500 so Meta safely retries delivery
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
