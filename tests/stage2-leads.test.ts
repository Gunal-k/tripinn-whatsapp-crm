Object.assign(process.env, { NODE_ENV: 'test' });

import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhoneNumber, isValidInternationalPhone, formatPhoneDisplay } from '../lib/utils/phone';
import { leadService } from '../lib/services/leads';
import { createLeadSchema } from '../lib/validations/lead';

test('Phone normalization and validation tests', async (t) => {
  await t.test('normalizes Indian phone numbers correctly', () => {
    assert.equal(normalizePhoneNumber('+91 98201 23456'), '919820123456');
    assert.equal(normalizePhoneNumber('+91-98201-23456'), '919820123456');
    assert.equal(normalizePhoneNumber('00919820123456'), '919820123456');
  });

  await t.test('validates valid international numbers', () => {
    assert.equal(isValidInternationalPhone('+91 9820123456'), true);
    assert.equal(isValidInternationalPhone('+1 415 555 2671'), true);
    assert.equal(isValidInternationalPhone('123'), false); // too short
  });

  await t.test('formats display string with readable country code spacing', () => {
    assert.equal(formatPhoneDisplay('919820123456'), '+91 98201 23456');
  });
});

test('Lead schema validation tests', async (t) => {
  await t.test('accepts valid travel lead input', () => {
    const valid = {
      name: 'Simran Gill',
      phone: '+91 9811223344',
      lead_source: 'WhatsApp',
      interested_destination: 'Bali 7D/6N Honeymoon',
      estimated_budget: 180000,
      number_of_travelers: 2,
    };
    const parsed = createLeadSchema.safeParse(valid);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.phone, '919811223344');
    }
  });

  await t.test('rejects short customer names and invalid phone numbers', () => {
    const invalid = {
      name: 'A',
      phone: '123',
    };
    const parsed = createLeadSchema.safeParse(invalid);
    assert.equal(parsed.success, false);
  });
});

test('Lead service management & duplicate detection tests', async (t) => {
  await t.test('creates new lead and verifies attributes', async () => {
    const { lead, duplicateFound } = await leadService.createLead({
      name: 'Test Customer A',
      phone: '+91 9999000011',
      lead_source: 'WhatsApp',
      interested_destination: 'Dubai Desert Experience',
      estimated_budget: 250000,
      number_of_travelers: 4,
    });

    assert.equal(duplicateFound, false);
    assert.equal(lead.lead_status, 'NEW');
    assert.equal(lead.qualification_status, 'UNQUALIFIED');
    assert.equal(lead.phone, '919999000011');
  });

  await t.test('detects duplicate phone number', async () => {
    const dupCheck = await leadService.checkDuplicatePhone('+91 9999 000011');
    assert.ok(dupCheck !== null);
    assert.equal(dupCheck?.name, 'Test Customer A');
  });

  await t.test('explicitly qualifies lead when criteria is met', async () => {
    const { lead } = await leadService.createLead({
      name: 'Aditi Rao',
      phone: '+91 9999000022',
      lead_source: 'Facebook',
      ctwa_clid: 'ctwa_test_ad_click_123',
    });

    // Attempt qualification without verified budget should fail
    const failedAttempt = await leadService.qualifyLead(lead.id, {
      verifiedTravelDates: true,
      verifiedBudget: false,
      verifiedTravelers: true,
      qualificationNotes: 'Incomplete',
    });
    assert.equal(failedAttempt.success, false);

    // Full qualification with verified criteria
    const qualifiedResult = await leadService.qualifyLead(lead.id, {
      verifiedTravelDates: true,
      verifiedBudget: true,
      verifiedTravelers: true,
      qualificationNotes: 'Budget and travelers confirmed for Maldives private villa.',
    });

    assert.equal(qualifiedResult.success, true);
    assert.equal(qualifiedResult.lead?.qualification_status, 'QUALIFIED');
    assert.equal(qualifiedResult.lead?.lead_status, 'QUALIFIED');
    assert.equal(qualifiedResult.metaCapiTriggered, true); // Triggers Meta CAPI because ctwa_clid exists
  });

  await t.test('schedules and completes follow-ups', async () => {
    const { lead } = await leadService.createLead({
      name: 'Tarun Verma',
      phone: '+91 9999000033',
      lead_source: 'manual',
    });

    const scheduled = await leadService.scheduleFollowUp(lead.id, '2026-11-01T10:00:00Z', 'Discuss flight tickets');
    assert.equal(scheduled?.follow_up_completed, false);
    assert.equal(scheduled?.follow_up_notes, 'Discuss flight tickets');

    const completed = await leadService.completeFollowUp(lead.id);
    assert.equal(completed?.follow_up_completed, true);
  });

  await t.test('exports leads to valid CSV format', async () => {
    const sampleLeads = await leadService.getLeads();
    const csv = leadService.exportToCsv(sampleLeads);
    assert.ok(csv.includes('Lead ID,Customer Name,Phone'));
    assert.ok(csv.includes('919820123456'));
  });
});
