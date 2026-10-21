import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { whatsappService } from '../lib/services/whatsapp';
import { metaCapiService } from '../lib/services/meta-capi';
import { leadService } from '../lib/services/leads';

test('WhatsApp Webhook verification tests', async (t) => {
  const testSecret = 'tripinn_meta_test_secret_key_12345';
  const testVerifyToken = 'tripinn_secure_verify_token_xyz';

  await t.test('accepts valid subscription challenge', () => {
    const res = whatsappService.verifySubscriptionChallenge(
      'subscribe',
      testVerifyToken,
      'challenge_code_987654',
      testVerifyToken
    );
    assert.equal(res.valid, true);
    assert.equal(res.challenge, 'challenge_code_987654');
  });

  await t.test('rejects incorrect verify token', () => {
    const res = whatsappService.verifySubscriptionChallenge(
      'subscribe',
      'wrong_token',
      'challenge_code_987654',
      testVerifyToken
    );
    assert.equal(res.valid, false);
    assert.equal(res.challenge, null);
  });

  await t.test('validates timing-safe HMAC-SHA256 signature', () => {
    const rawPayload = JSON.stringify({ object: 'whatsapp_business_account' });
    const validSignature = crypto
      .createHmac('sha256', testSecret)
      .update(rawPayload, 'utf8')
      .digest('hex');

    const isValid = whatsappService.verifyWebhookSignature(
      rawPayload,
      `sha256=${validSignature}`,
      testSecret
    );
    assert.equal(isValid, true);
  });

  await t.test('rejects tampered or invalid signature', () => {
    const rawPayload = JSON.stringify({ object: 'whatsapp_business_account' });
    const isValid = whatsappService.verifyWebhookSignature(
      rawPayload,
      'sha256=invalid_tampered_signature_hex_value',
      testSecret
    );
    assert.equal(isValid, false);
  });
});

test('WhatsApp Webhook payload parsing & CTWA attribution tests', async (t) => {
  await t.test('extracts incoming text message and ctwa_clid referral', () => {
    const mockMetaWebhook = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '123456789',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '919800000000', phone_number_id: 'ph_123' },
                contacts: [{ profile: { name: 'Kunal Kapoor' }, wa_id: '919833445566' }],
                messages: [
                  {
                    from: '919833445566',
                    id: 'wamid.HBgMOTExOTgzMzQ0NTU2NgUCMR4XFDAxMjM0',
                    timestamp: '1729500000',
                    type: 'text',
                    text: { body: 'Interested in Switzerland 8D package!' },
                    referral: {
                      source_type: 'ad',
                      source_id: 'camp_autumn_deals',
                      ctwa_clid: 'ctwa_swiss_ad_click_999',
                      headline: 'Swiss Alps Luxury Getaway',
                    },
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    const parsed = whatsappService.parseWebhookPayload(mockMetaWebhook);
    assert.equal(parsed.messages.length, 1);
    const msg = parsed.messages[0];
    assert.equal(msg.senderName, 'Kunal Kapoor');
    assert.equal(msg.fromPhone, '919833445566');
    assert.equal(msg.body, 'Interested in Switzerland 8D package!');
    assert.equal(msg.ctwaClid, 'ctwa_swiss_ad_click_999');
    assert.equal(msg.metaCampaignId, 'camp_autumn_deals');
  });

  await t.test('extracts delivery status updates', () => {
    const mockStatusWebhook = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '123456789',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                statuses: [
                  {
                    id: 'wamid.test_outbound_123',
                    status: 'delivered',
                    timestamp: '1729500100',
                    recipient_id: '919820123456',
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    const parsed = whatsappService.parseWebhookPayload(mockStatusWebhook);
    assert.equal(parsed.statuses.length, 1);
    assert.equal(parsed.statuses[0].status, 'delivered');
    assert.equal(parsed.statuses[0].recipientPhone, '919820123456');
  });
});

test('Meta Conversions API (CAPI) messaging workflow tests', async (t) => {
  await t.test('builds correct official messaging conversion payload for CTWA leads', () => {
    const { lead } = leadService.createLead({
      name: 'Aditi Deshmukh',
      phone: '+91 9777700011',
      lead_source: 'WhatsApp',
      ctwa_clid: 'ctwa_ad_test_12345',
      estimated_budget: 200000,
      interested_destination: 'Bali 7D/6N',
    });

    const payload = metaCapiService.buildMessagingConversionPayload(lead, 'Lead');
    assert.equal(payload.event_name, 'Lead');
    assert.equal(payload.action_source, 'business_messaging');
    assert.equal(payload.messaging_channel, 'whatsapp');
    assert.equal(payload.user_data.ctwa_clid, 'ctwa_ad_test_12345');
    assert.equal(payload.user_data.phone?.[0], '919777700011');
    assert.equal(payload.custom_data?.destination, 'Bali 7D/6N');
    assert.equal(payload.custom_data?.value, 200000);
    assert.equal(payload.custom_data?.currency, 'INR');
    assert.equal(payload.event_id, `${lead.id}_Lead`);
  });
});
