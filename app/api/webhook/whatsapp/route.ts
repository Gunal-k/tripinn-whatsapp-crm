import { NextRequest, NextResponse } from 'next/server';
import { whatsappService } from '../../../../lib/services/whatsapp';
import { leadService } from '../../../../lib/services/leads';

/**
 * Meta WhatsApp Business Webhook Route
 * GET: Webhook verification challenge
 * POST: Incoming message & status updates with HMAC-SHA256 verification
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
    // Return the challenge as plain text HTTP 200
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

    // 1. Verify Webhook Signature using Meta App Secret
    if (process.env.WHATSAPP_APP_SECRET) {
      const isValid = whatsappService.verifyWebhookSignature(rawBody, signatureHeader);
      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid webhook signature' },
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

    // 3. Process Incoming Messages
    for (const msg of messages) {
      // Find or create lead
      let lead = leadService.checkDuplicatePhone(msg.fromPhone);

      if (!lead) {
        // Create new lead from eligible first-time customer
        const { lead: createdLead } = leadService.createLead({
          name: msg.senderName,
          phone: msg.fromPhone,
          lead_source: 'WhatsApp',
          ctwa_clid: msg.ctwaClid || null,
          meta_campaign_id: msg.metaCampaignId || null,
          meta_ad_id: msg.metaAdId || null,
          internal_notes: `First message: "${msg.body}"`,
        });
        lead = createdLead;
      } else {
        // Associate incoming message with existing lead
        leadService.addActivity(lead.id, {
          activity_type: 'whatsapp_inbound',
          title: 'WhatsApp Message Received',
          description: msg.body,
          metadata: { wamid: msg.wamid },
        });

        // If lead was from CTWA ad and ctwa_clid wasn't captured yet, update it
        if (msg.ctwaClid && !lead.ctwa_clid) {
          leadService.updateLead(lead.id, {
            ctwa_clid: msg.ctwaClid,
            meta_campaign_id: msg.metaCampaignId || null,
            meta_ad_id: msg.metaAdId || null,
          });
        }
      }
    }

    // 4. Process Status Updates (sent, delivered, read, failed)
    for (const st of statuses) {
      // Record status transition in lead activities
      const existing = leadService.checkDuplicatePhone(st.recipientPhone);
      if (existing) {
        leadService.addActivity(existing.id, {
          activity_type: 'note_added',
          title: `WhatsApp Message ${st.status.toUpperCase()}`,
          description: `Message ${st.wamid.slice(0, 18)}... marked as ${st.status}`,
          metadata: { wamid: st.wamid, status: st.status },
        });
      }
    }

    // Meta requires immediate HTTP 200 OK
    return NextResponse.json({ success: true, processed: { messages: messages.length, statuses: statuses.length } }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown webhook error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
