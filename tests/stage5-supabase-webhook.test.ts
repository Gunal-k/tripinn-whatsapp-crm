Object.assign(process.env, { NODE_ENV: 'test' });

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { whatsappService } from '../lib/services/whatsapp';
import { 
  mapDbRowToLead, 
  mapDbRowToMessage, 
  mapDbRowToActivity 
} from '../lib/services/leads';

test('Supabase Database Mapping & Resilience Tests', async (t) => {
  await t.test('maps database row with legacy source & status columns', () => {
    const legacyRow = {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      name: 'Pooja Hegde',
      phone: '919876543210',
      email: 'pooja@example.com',
      source: 'WhatsApp',
      status: 'QUALIFIED',
      destination: 'Switzerland 8D/7N',
      notes: 'Honeymoon couple',
      created_at: '2026-10-21T10:00:00Z',
    };

    const lead = mapDbRowToLead(legacyRow);
    assert.equal(lead.id, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
    assert.equal(lead.name, 'Pooja Hegde');
    assert.equal(lead.lead_source, 'WhatsApp');
    assert.equal(lead.lead_status, 'QUALIFIED');
    assert.equal(lead.interested_destination, 'Switzerland 8D/7N');
    assert.equal(lead.internal_notes, 'Honeymoon couple');
  });

  await t.test('maps database row with modern lead_source & lead_status columns', () => {
    const modernRow = {
      id: 'b1ffcd88-8b0a-3ef7-aa5c-5aa8ac270b22',
      name: 'Vikram Seth',
      phone: '919811223344',
      lead_source: 'Instagram',
      lead_status: 'FOLLOW_UP',
      qualification_status: 'QUALIFIED',
      interested_destination: 'Bali Romance & Luxury',
      number_of_travelers: 2,
      estimated_budget: 200000,
      follow_up_date: '2026-11-01T14:00:00Z',
      ctwa_clid: 'ctwa_bali_ad_9988',
      meta_conversion_sent: true,
      created_at: '2026-10-21T10:00:00Z',
    };

    const lead = mapDbRowToLead(modernRow);
    assert.equal(lead.lead_source, 'Instagram');
    assert.equal(lead.lead_status, 'FOLLOW_UP');
    assert.equal(lead.qualification_status, 'QUALIFIED');
    assert.equal(lead.estimated_budget, 200000);
    assert.equal(lead.ctwa_clid, 'ctwa_bali_ad_9988');
    assert.equal(lead.meta_conversion_sent, true);
  });

  await t.test('maps whatsapp_messages row with both wa_message_id and wamid', () => {
    const legacyMsgRow = {
      id: 'c2eedd77-7a09-2ef6-994b-4997ab160c33',
      lead_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      wa_message_id: 'wamid.HBgLMTIzNDU2Nw==',
      direction: 'inbound',
      body: 'Hi, I need packages for Bali next month',
      message_type: 'text',
      status: 'received',
      created_at: '2026-10-21T10:05:00Z',
    };

    const msg = mapDbRowToMessage(legacyMsgRow);
    assert.equal(msg.wamid, 'wamid.HBgLMTIzNDU2Nw==');
    assert.equal(msg.message_body, 'Hi, I need packages for Bali next month');
    assert.equal(msg.direction, 'inbound');
    assert.equal(msg.status, 'received');
  });

  await t.test('maps lead_activities row with performer and metadata', () => {
    const actRow = {
      id: 'd3ffcc66-6908-1ef5-883a-3886aa050d44',
      lead_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      activity_type: 'qualification',
      title: 'Lead Explicitly Qualified',
      description: 'Verified budget and travel dates for Bali.',
      profiles: { full_name: 'Priya Sharma' },
      metadata: { ctwa_clid: 'ctwa_bali_ad_9988' },
      created_at: '2026-10-21T10:10:00Z',
    };

    const act = mapDbRowToActivity(actRow);
    assert.equal(act.activity_type, 'qualification');
    assert.equal(act.performer?.full_name, 'Priya Sharma');
    assert.equal((act.metadata as { ctwa_clid?: string })?.ctwa_clid, 'ctwa_bali_ad_9988');
  });
});

test('WhatsApp Webhook Security & Idempotency Tests', async (t) => {
  const testSecret = 'f8c982fc8d1d01c687c5a1fff7fbd93b';
  const rawBody = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '4616136468628131',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '15556455088', phone_number_id: '1350342924833300' },
              contacts: [{ profile: { name: 'Kavita Krishnan' }, wa_id: '919899001122' }],
              messages: [
                {
                  from: '919899001122',
                  id: 'wamid.HBgLTestIdempotentMessage123==',
                  timestamp: '1729512000',
                  text: { body: 'Looking for a family trip to Dubai in December' },
                  type: 'text',
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  });

  await t.test('computes and validates exact timing-safe HMAC-SHA256 signature', () => {
    const validHex = crypto.createHmac('sha256', testSecret).update(rawBody, 'utf8').digest('hex');
    const validHeader = `sha256=${validHex}`;

    const isValid = whatsappService.verifyWebhookSignature(rawBody, validHeader, testSecret);
    assert.equal(isValid, true);

    const tamperedHeader = `sha256=${validHex.substring(0, validHex.length - 2)}00`;
    const isTamperedValid = whatsappService.verifyWebhookSignature(rawBody, tamperedHeader, testSecret);
    assert.equal(isTamperedValid, false);
  });

  await t.test('rejects signature when app secret is missing or header is malformed', () => {
    assert.equal(whatsappService.verifyWebhookSignature(rawBody, null, testSecret), false);
    assert.equal(whatsappService.verifyWebhookSignature(rawBody, 'invalid-format', testSecret), false);
    assert.equal(whatsappService.verifyWebhookSignature(rawBody, 'sha256=abcdef', ''), false);
  });

  await t.test('extracts incoming message ID and payload for deduplication', () => {
    const payload = JSON.parse(rawBody);
    const { messages } = whatsappService.parseWebhookPayload(payload);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].wamid, 'wamid.HBgLTestIdempotentMessage123==');
    assert.equal(messages[0].fromPhone, '919899001122');
    assert.equal(messages[0].senderName, 'Kavita Krishnan');
    assert.equal(messages[0].body, 'Looking for a family trip to Dubai in December');
  });

  await t.test('parses status callbacks for message status update (delivered/read/failed)', () => {
    const statusPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '4616136468628131',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                statuses: [
                  {
                    id: 'wamid.HBgLTestStatus123==',
                    status: 'delivered',
                    timestamp: '1729512100',
                    recipient_id: '919899001122',
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    const { statuses } = whatsappService.parseWebhookPayload(statusPayload);
    assert.equal(statuses.length, 1);
    assert.equal(statuses[0].wamid, 'wamid.HBgLTestStatus123==');
    assert.equal(statuses[0].status, 'delivered');
    assert.equal(statuses[0].recipientPhone, '919899001122');
  });
});

test('Supabase Admin Client Security & Environment Validation', async (t) => {
  const { createAdminClient } = await import('../lib/supabase/admin');

  await t.test('throws clear error when SUPABASE_SERVICE_ROLE_KEY is missing (no fallback to anon key)', () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const originalAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    try {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-public-key-should-not-be-used';
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      assert.throws(
        () => createAdminClient(),
        /Missing Supabase admin configuration: SUPABASE_SERVICE_ROLE_KEY is required/
      );
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalRole;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnon;
    }
  });

  await t.test('throws clear error when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'valid-service-role-key-12345';

      assert.throws(
        () => createAdminClient(),
        /Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_URL/
      );
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalRole;
    }
  });

  await t.test('successfully initializes admin client when valid SUPABASE_SERVICE_ROLE_KEY is set', () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'valid-service-role-secret-key-12345';

      const client = createAdminClient();
      assert.ok(client);
      assert.equal(typeof client.from, 'function');
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalRole;
    }
  });
});

