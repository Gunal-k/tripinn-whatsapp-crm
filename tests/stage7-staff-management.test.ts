Object.assign(process.env, { NODE_ENV: 'test' });

import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { createStaffSchema } from '../lib/validations/staff';
import { staffService, resetMockStaffStore } from '../lib/services/staff';
import { GET as getStaff, POST as postStaff, PATCH as patchStaff, DELETE as deleteStaff } from '../app/api/admin/staff/route';

test('Staff Management & Direct Provisioning Tests', async (t) => {
  t.beforeEach(() => {
    resetMockStaffStore();
  });

  await t.test('Validation: Validates staff creation input correctly', () => {
    // Valid telecaller
    const validSales = createStaffSchema.safeParse({
      full_name: 'Pooja Hegde',
      email: 'pooja@tripinnholidays.com',
      password: 'password123',
      role: 'sales',
      phone: '+91 98222 33445',
    });
    assert.equal(validSales.success, true);

    // Valid admin
    const validAdmin = createStaffSchema.safeParse({
      full_name: 'Vikram Seth',
      email: 'vikram@tripinnholidays.com',
      password: 'adminSecurePassword!',
      role: 'admin',
    });
    assert.equal(validAdmin.success, true);

    // Invalid email
    const invalidEmail = createStaffSchema.safeParse({
      full_name: 'Vikram',
      email: 'not-an-email',
      password: 'password123',
      role: 'sales',
    });
    assert.equal(invalidEmail.success, false);

    // Password too short (< 6 chars)
    const shortPassword = createStaffSchema.safeParse({
      full_name: 'Vikram',
      email: 'vikram@tripinnholidays.com',
      password: '123',
      role: 'sales',
    });
    assert.equal(shortPassword.success, false);
  });

  await t.test('Service Layer: Fetches staff members list', async () => {
    const staff = await staffService.getStaffMembers();
    assert.ok(Array.isArray(staff));
    assert.ok(staff.length >= 2);
    const admin = staff.find((s) => s.role === 'admin');
    const telecaller = staff.find((s) => s.role === 'sales');
    assert.ok(admin);
    assert.ok(telecaller);
  });

  await t.test('Service Layer: Provisions a new staff member and prevents duplicates', async () => {
    const newStaff = await staffService.createStaffMember({
      full_name: 'Kavita Krishnan',
      email: 'kavita@tripinnholidays.com',
      password: 'secretPassword123',
      role: 'sales',
      phone: '+91 99887 76655',
    });

    assert.equal(newStaff.full_name, 'Kavita Krishnan');
    assert.equal(newStaff.email, 'kavita@tripinnholidays.com');
    assert.equal(newStaff.role, 'sales');
    assert.equal(newStaff.is_active, true);

    // Duplicate email registration should throw
    await assert.rejects(
      async () => {
        await staffService.createStaffMember({
          full_name: 'Duplicate Staff',
          email: 'kavita@tripinnholidays.com',
          password: 'anotherPassword',
          role: 'sales',
        });
      },
      /already registered/
    );
  });

  await t.test('Service Layer: Toggles staff active/deactivated status', async () => {
    const list = await staffService.getStaffMembers();
    const target = list[0];
    const initialStatus = target.is_active;

    const updated = await staffService.toggleStaffStatus(target.id, !initialStatus);
    assert.equal(updated.is_active, !initialStatus);

    // Toggle back
    const restored = await staffService.toggleStaffStatus(target.id, initialStatus);
    assert.equal(restored.is_active, initialStatus);
  });

  await t.test('API Route: GET /api/admin/staff returns list of staff', async () => {
    const res = await getStaff();
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
  });

  await t.test('API Route: POST /api/admin/staff creates staff and returns 200/201', async () => {
    const uniqueEmail = `neha.${Date.now()}@tripinnholidays.com`;
    const req = new NextRequest('http://localhost:3000/api/admin/staff', {
      method: 'POST',
      body: JSON.stringify({
        full_name: 'Neha Singhania',
        email: uniqueEmail,
        password: 'securePassword789',
        role: 'sales',
        phone: '+91 99112 23344',
      }),
    });

    const res = await postStaff(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.email, uniqueEmail);
    assert.equal(json.data.full_name, 'Neha Singhania');
  });

  await t.test('API Route: POST /api/admin/staff rejects invalid inputs', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/staff', {
      method: 'POST',
      body: JSON.stringify({
        full_name: '',
        email: 'invalid-email',
        password: '123',
      }),
    });

    const res = await postStaff(req);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.ok(json.error);
  });

  await t.test('API Route: PATCH /api/admin/staff toggles status', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/staff', {
      method: 'PATCH',
      body: JSON.stringify({
        id: 'user-sales-01',
        is_active: false,
      }),
    });

    const res = await patchStaff(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.is_active, false);
  });

  await t.test('Service Layer: Deletes a staff member', async () => {
    const initialList = await staffService.getStaffMembers();
    const countBefore = initialList.length;
    const target = initialList[initialList.length - 1];

    await staffService.deleteStaffMember(target.id);

    const updatedList = await staffService.getStaffMembers();
    assert.equal(updatedList.length, countBefore - 1);
    assert.ok(!updatedList.some((s) => s.id === target.id));
  });

  await t.test('API Route: DELETE /api/admin/staff removes staff member', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/staff?id=user-sales-02', {
      method: 'DELETE',
    });

    const res = await deleteStaff(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
  });

  await t.test('API Route: DELETE /api/admin/staff rejects missing id', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/staff', {
      method: 'DELETE',
    });

    const res = await deleteStaff(req);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.ok(json.error);
  });
});

