import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET as getLeadsApi, POST as postLeadsApi, PATCH as patchLeadsApi, DELETE as deleteLeadsApi } from '../app/api/admin/leads/route';
import { leadService } from '../lib/services/leads';

test('Lead API Route & Staff Integration Tests', async (t) => {
  leadService.resetMockStore();

  await t.test('GET /api/admin/leads returns list of leads in mock/test environment', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/leads');
    const res = await getLeadsApi(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.data.length > 0);
  });

  await t.test('POST /api/admin/leads creates a lead in mock/test mode', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/leads', {
      method: 'POST',
      body: JSON.stringify({
        action: 'create_lead',
        name: 'Aarav Patel',
        phone: '+91 98765 99881',
        email: 'aarav@example.com',
        interested_destination: 'Switzerland',
        travel_dates: '2026-12-10',
        number_of_travelers: 2,
        estimated_budget: 250000,
        lead_source: 'WhatsApp',
      }),
    });

    const res = await postLeadsApi(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.lead.name, 'Aarav Patel');
    assert.equal(json.lead.phone, '919876599881');
  });

  await t.test('PATCH /api/admin/leads updates status and follow-up in mock mode', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/leads', {
      method: 'PATCH',
      body: JSON.stringify({
        action: 'update_status',
        id: 'lead-001',
        newStatus: 'CONTACTED',
      }),
    });

    const res = await patchLeadsApi(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
  });

  await t.test('DELETE /api/admin/leads rejects missing ID', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/leads', {
      method: 'DELETE',
    });

    const res = await deleteLeadsApi(req);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.ok(json.error);
  });

  await t.test('DELETE /api/admin/leads deletes an existing lead in test mode', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/leads?id=lead-003', {
      method: 'DELETE',
    });

    const res = await deleteLeadsApi(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
  });
});
