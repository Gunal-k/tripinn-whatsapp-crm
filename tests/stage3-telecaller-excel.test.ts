import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { leadService } from '../lib/services/leads';
import { formatPhoneDisplay } from '../lib/utils/phone';

test('Telecaller Excel Calling Sheet and Call Logging tests', async (t) => {
  await t.test('builds telecaller calling workbook with correct calling columns', () => {
    const leads = leadService.getLeads();
    assert.ok(leads.length > 0);

    // Simulate export rows transformation
    const rows = leads.map((lead, idx) => ({
      'S.No': idx + 1,
      'Customer Name': lead.name,
      'Phone Number': formatPhoneDisplay(lead.phone),
      'Direct Dial': `+${lead.phone}`,
      'WhatsApp Quick Link': `https://wa.me/${lead.phone}`,
      'Destination': lead.interested_destination || 'General Enquiry',
      'Assigned Telecaller': lead.assigned_salesperson?.full_name || 'Unassigned',
      'Call Outcome': '',
      'Telecaller Remarks': '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Telecaller Calling Sheet');

    // Verify worksheet has valid range and columns
    const sheet = workbook.Sheets['Telecaller Calling Sheet'];
    assert.ok(sheet !== undefined);
    assert.ok(sheet['A1'] !== undefined); // S.No
    assert.ok(sheet['B1'] !== undefined); // Customer Name
    assert.ok(sheet['C1'] !== undefined); // Phone Number
    assert.ok(sheet['D1'] !== undefined); // Direct Dial
    assert.ok(sheet['E1'] !== undefined); // WhatsApp Quick Link
  });

  await t.test('filters calling list by telecaller name', () => {
    const allLeads = leadService.getLeads();
    const priyaLeads = allLeads.filter((l) => l.assigned_salesperson?.full_name === 'Priya Sharma');
    assert.ok(priyaLeads.length > 0);
    assert.ok(priyaLeads.every((l) => l.assigned_salesperson?.full_name === 'Priya Sharma'));
  });

  await t.test('logs call outcome: CONNECTED_INTERESTED', () => {
    const { lead } = leadService.createLead({
      name: 'Call Test Customer 1',
      phone: '+91 9888800011',
      lead_source: 'WhatsApp',
      interested_destination: 'Bali 7D/6N',
    });

    assert.equal(lead.lead_status, 'NEW');

    const updated = leadService.logCallOutcome(
      lead.id,
      'CONNECTED_INTERESTED',
      'Customer answered immediately, excited about Bali villa with private pool.',
      undefined,
      'Priya Sharma'
    );

    assert.ok(updated !== null);
    assert.equal(updated?.lead_status, 'CONTACTED');
    assert.ok(updated?.last_contact_date !== null);

    const activities = leadService.getLeadActivities(lead.id);
    const callAct = activities.find((a) => a.title.includes('Phone Call Logged'));
    assert.ok(callAct !== undefined);
    assert.ok(callAct?.description?.includes('Connected & Interested'));
  });

  await t.test('logs call outcome: CALLBACK_REQUESTED with rescheduled follow-up date', () => {
    const { lead } = leadService.createLead({
      name: 'Call Test Customer 2',
      phone: '+91 9888800022',
      lead_source: 'Instagram',
      interested_destination: 'Dubai 5D/4N',
    });

    const callbackTime = '2026-11-05T15:00:00Z';
    const updated = leadService.logCallOutcome(
      lead.id,
      'CALLBACK_REQUESTED',
      'Client in meeting, asked to call back after 3 PM.',
      callbackTime,
      'Priya Sharma'
    );

    assert.ok(updated !== null);
    assert.equal(updated?.lead_status, 'FOLLOW_UP');
    assert.equal(updated?.follow_up_date, callbackTime);
    assert.equal(updated?.follow_up_completed, false);
    assert.equal(updated?.follow_up_notes, 'Client in meeting, asked to call back after 3 PM.');
  });

  await t.test('logs call outcome: NOT_INTERESTED and marks lead lost', () => {
    const { lead } = leadService.createLead({
      name: 'Call Test Customer 3',
      phone: '+91 9888800033',
      lead_source: 'Facebook',
      interested_destination: 'Maldives',
    });

    const updated = leadService.logCallOutcome(
      lead.id,
      'NOT_INTERESTED',
      'Customer selected a domestic tour instead.',
      undefined,
      'Priya Sharma'
    );

    assert.ok(updated !== null);
    assert.equal(updated?.lead_status, 'LOST');
    assert.equal(updated?.qualification_status, 'DISQUALIFIED');
  });

  await t.test('reassigns lead to another telecaller', () => {
    const { lead } = leadService.createLead({
      name: 'Reassign Customer',
      phone: '+91 9888800044',
      lead_source: 'website',
    });

    const reassigned = leadService.reassignLead(
      lead.id,
      'user-sales-02',
      'Rahul Varma',
      'rahul@tripinnholidays.com'
    );

    assert.ok(reassigned !== null);
    assert.equal(reassigned?.assigned_salesperson_id, 'user-sales-02');
    assert.equal(reassigned?.assigned_salesperson?.full_name, 'Rahul Varma');
  });
});
