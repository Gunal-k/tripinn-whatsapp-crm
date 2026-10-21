Object.assign(process.env, { NODE_ENV: 'test' });

import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { proxy } from '../proxy';

test('Authentication & Route Protection Tests', async (t) => {
  await t.test('passes static assets through without interception or redirect', async () => {
    const staticReq = new NextRequest('http://localhost:3000/_next/static/chunks/main.js');
    const res = await proxy(staticReq);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('location'), null);
  });

  await t.test('preserves public access to WhatsApp webhook for Meta HMAC verification', async () => {
    const webhookReq = new NextRequest('http://localhost:3000/api/webhook/whatsapp');
    const res = await proxy(webhookReq);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('location'), null);
  });

  await t.test('allows public access to /login and /auth/ routes', async () => {
    const loginReq = new NextRequest('http://localhost:3000/login');
    const resLogin = await proxy(loginReq);
    assert.equal(resLogin.status, 200);

    const resetReq = new NextRequest('http://localhost:3000/auth/reset-password');
    const resReset = await proxy(resetReq);
    assert.equal(resReset.status, 200);
  });

  await t.test('redirects unauthenticated users from protected dashboard to /login', async () => {
    // When Supabase is configured in production, unauthenticated requests redirect to /login
    const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const origKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    try {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mocktest.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key-valid';

      const dashboardReq = new NextRequest('http://localhost:3000/');
      const res = await proxy(dashboardReq);
      assert.equal(res.status, 307);
      assert.match(res.headers.get('location') || '', /\/login/);
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origKey;
    }
  });

  await t.test('returns 401 for unauthenticated API requests to protected endpoints', async () => {
    const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const origKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    try {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mocktest.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key-valid';

      const apiReq = new NextRequest('http://localhost:3000/api/whatsapp/send', {
        method: 'POST',
      });
      const res = await proxy(apiReq);
      assert.equal(res.status, 401);
      const json = await res.json();
      assert.match(json.error, /Staff authentication required/i);
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origKey;
    }
  });

  await t.test('preserves redirect URL with next query param for deep linking', async () => {
    const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const origKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    try {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mocktest.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key-valid';

      const settingsReq = new NextRequest('http://localhost:3000/settings');
      const res = await proxy(settingsReq);
      assert.equal(res.status, 307);
      const location = res.headers.get('location') || '';
      assert.match(location, /\/login\?next=%2Fsettings/);
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origKey;
    }
  });
});
