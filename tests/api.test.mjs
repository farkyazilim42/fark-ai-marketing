import { test } from 'node:test';
import assert from 'node:assert/strict';
const base = process.env.TEST_BASE_URL;
test('unauthenticated integrations and AI are fail-closed', { skip: !base }, async () => {
  for (const path of ['/api/integrations', '/api/report', '/api/automation', '/api/notifications', '/api/ads']) {
    const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(response.status, 401);
    assert.ok((await response.json()).error);
    const forged = await fetch(`${base}${path}`, { method: 'POST', headers: { Authorization: 'Bearer invalid-token', 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(forged.status, 401);
  }
});
test('public connection status returns booleans only', { skip: !base }, async () => {
  const response = await fetch(`${base}/api/integrations`);
  assert.equal(response.status, 200);
  const status = await response.json();
  assert.deepEqual(Object.keys(status).sort(), ['ads', 'ga4', 'gsc', 'openai', 'supabase']);
  assert.ok(Object.values(status).every(x => typeof x === 'boolean'));
});

test('cron requires a configured secret and public automation exposes no history or secrets', { skip: !base }, async () => {
  for (const headers of [{}, { Authorization: 'Bearer undefined' }, { Authorization: 'Bearer invalid-token' }]) {
    const response = await fetch(`${base}/api/cron/weekly-report`, { headers });
    assert.equal(response.status, 401);
  }
  const response = await fetch(`${base}/api/automation`);
  assert.equal(response.status, 200);
  const status = await response.json();
  assert.deepEqual(status.runs, []);
  assert.equal(typeof status.ready, 'boolean');
  assert.ok(!JSON.stringify(status).includes('services/'));
});

test('Ads plan state and geography fail closed without authenticated owner', { skip: !base }, async () => {
  const state = await fetch(`${base}/api/ads`);
  assert.equal(state.status, 200);
  const body = await state.json();
  assert.deepEqual(body.plans, []);
  assert.deepEqual(body.runs, []);
  assert.equal(body.config.customerId, '');
  assert.equal((await fetch(`${base}/api/ads/locations?q=Konya`)).status, 401);
  assert.equal((await fetch(`${base}/api/cron/ads-optimize`)).status, 401);
  assert.equal((await fetch(`${base}/api/cron/ads-optimize`, { headers: { Authorization: 'Bearer undefined' } })).status, 401);
});
