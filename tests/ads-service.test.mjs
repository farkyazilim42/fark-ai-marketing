import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { adsDefaultPlan } from '../lib/ads-model.ts';
// Test the actual orchestration with fake I/O; never import credentials or call Google.
const source = (await readFile(new URL('../lib/ads-service.ts', import.meta.url), 'utf8'))
  .replace(/import "server-only";\n/, '')
  .replace(/import \{ createClient \} from "@supabase\/supabase-js";\n/, '')
  .replace(/import \* as googleApi from "\.\/ads-google";\n/, '')
  .replace(/import \{ googleToken \} from "\.\/server";\n/, '')
  .replace(/from "\.\/ads-model"/g, `from ${JSON.stringify(new URL('../lib/ads-model.ts', import.meta.url).href)}`);
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { createAdsService, hashAdsPlan } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const time = new Date('2026-10-03T08:00:00Z');
const pid = '11111111-1111-4111-8111-111111111111';
const resources = { campaignResourceName: 'customers/1234567890/campaigns/1', budgetResourceName: 'customers/1234567890/campaignBudgets/2', googleName: 'FARK-AI-test' };
function fixture(options = {}) {
  const plan = { ...adsDefaultPlan(), startDate: '2026-10-01', endDate: '2026-10-30', ...options.plan };
  let record = { id: pid, user_id: 'owner', customer_id: '1234567890', plan, plan_hash: hashAdsPlan(plan), status: 'validated', operation_id: '22222222-2222-4222-8222-222222222222', resources: null, validated_at: time.toISOString(), approved_at: time.toISOString(), activated_at: null, last_optimized_local_day: null, created_at: time.toISOString(), updated_at: time.toISOString(), ...options.record };
  let lock = null;
  const events = [];
  const google = {
    account: async () => ({ customerId: '1234567890', currencyCode: 'TRY', timeZone: 'Europe/Istanbul', manager: false }),
    validate: async () => { events.push('validateOnly'); return { account: await google.account(), locations: [], warnings: [] }; },
    create: async () => { events.push('create'); if (options.createError) { const error = new Error('network timeout'); if (options.definiteError) error.definitelyNotApplied = true; throw error; } return resources; },
    snapshot: async () => ({ ...resources, status: options.actualStatus || 'ENABLED', currentDailyBudgetMinor: options.currentBudget || 30000, currencyCode: 'TRY', timeZone: 'Europe/Istanbul' }),
    find: async () => options.found || null,
    policy: async () => ({ approved: true, canServe: true, ads: [] }),
    verify: async () => {},
    performance: async () => ({ currentDailyBudgetMinor: options.currentBudget || 30000, todaySpendMinor: 0, monthSpendMinor: 0, sevenDayCostMinor: 100000, sevenDayConversions: 20, daysRemainingInMonth: 29, reportingCurrency: 'TRY', accountDate: '2026-10-03', accountTimeZone: 'Europe/Istanbul', collectedAt: time.toISOString() }),
    budget: async (_r, amount) => { events.push(`budget:${amount}`); },
    status: async (_r, status) => { events.push(status); }
  };
  const store = {
    get: async () => structuredClone(record),
    list: async () => ({ plans: [structuredClone(record)], runs: [], accountLock: lock }),
    insert: async next => { record = structuredClone(next); events.push('insert'); },
    claim: async (_rec, runId, action, expected, next) => {
      if (lock) throw new Error('LOCKED');
      if (!expected.includes(record.status)) throw new Error('STATUS_CHANGED');
      if (options.claimError) throw new Error('audit unavailable');
      if (options.freshDailyMarker) record.last_optimized_local_day = '2026-10-03';
      const previous = structuredClone(record);
      lock = { customer_id: record.customer_id, user_id: 'owner', run_id: runId, plan_id: record.id, created_at: time.toISOString() };
      record.status = next; events.push('intent'); return previous;
    },
    finish: async (_run, status, result, error, patch, release) => {
      if (options.finishError && status === 'completed') throw new Error('database unavailable');
      events.push(`finish:${status}`); Object.assign(record, patch); if (release) lock = null;
    }
  };
  const service = createAdsService({ store, google, userId: 'owner', customerId: '1234567890', mutationsEnabled: options.writes !== false, automationEnabled: true, monitorReady: options.monitorReady !== false, now: () => time, uuid: () => '33333333-3333-4333-8333-333333333333' });
  return { service, store, google, events, record: () => record, lock: () => lock };
}
test('Ads approval writes audit first and creates PAUSED with immutable hash', async () => {
  const f = fixture(); await f.service.action('approve', pid, f.record().plan_hash);
  assert.deepEqual(f.events, ['intent', 'validateOnly', 'create', 'finish:completed']);
  assert.equal(f.record().status, 'paused'); assert.ok(!f.events.includes('ENABLED')); assert.equal(f.lock(), null);
});
test('hash change, missing write gate and stale validation cannot mutate Ads', async () => {
  for (const [options, hash] of [[{}, 'wrong'], [{ writes: false }], [{ record: { validated_at: '2026-10-01T08:00:00Z' } }]]) {
    const f = fixture(options); await assert.rejects(f.service.action('approve', pid, hash || f.record().plan_hash)); assert.equal(f.events.includes('create'), false);
  }
});
test('audit persistence failure fails before Google writes', async () => {
  const f = fixture({ claimError: true }); await assert.rejects(f.service.action('approve', pid, f.record().plan_hash)); assert.deepEqual(f.events, []);
});
test('ambiguous Google write leaves permanent mutex and cannot be retried', async () => {
  const f = fixture({ createError: true }); await assert.rejects(f.service.action('approve', pid, f.record().plan_hash), /belirsiz/);
  assert.equal(f.record().status, 'unknown'); assert.ok(f.lock());
  await assert.rejects(f.service.action('approve', pid, f.record().plan_hash)); assert.equal(f.events.filter(x => x === 'create').length, 1);
});
test('successful remote write followed by persistence failure stays unknown', async () => {
  const f = fixture({ finishError: true }); await assert.rejects(f.service.action('approve', pid, f.record().plan_hash));
  assert.equal(f.record().status, 'unknown'); assert.ok(f.lock());
});
test('validateOnly is available with Google writes disabled and never creates', async () => {
  const f = fixture({ writes: false, record: { status: 'draft' } }); await f.service.action('validate', pid, f.record().plan_hash);
  assert.deepEqual(f.events, ['intent', 'validateOnly', 'finish:completed']); assert.equal(f.record().status, 'validated');
});
test('activation requires exact explicit confirmation and a recent automation heartbeat', async () => {
  const f = fixture({ plan: { optimizeEnabled: true }, record: { status: 'paused', resources }, monitorReady: false });
  await assert.rejects(f.service.action('activate', pid, f.record().plan_hash, 'REKLAMLARI YAYINA AL'), /zamanlayıcı/);
  const g = fixture({ record: { status: 'paused', resources } }); await assert.rejects(g.service.action('activate', pid, g.record().plan_hash, 'yes'), /onayı/);
  assert.ok(!f.events.includes('ENABLED')); assert.ok(!g.events.includes('ENABLED'));
});
test('optimizer preserves manual Google pause and never enables campaigns', async () => {
  const f = fixture({ plan: { optimizeEnabled: true }, record: { status: 'active', resources }, actualStatus: 'PAUSED' });
  await f.service.action('optimize', pid, f.record().plan_hash); assert.equal(f.record().status, 'paused'); assert.ok(!f.events.includes('ENABLED')); assert.ok(!f.events.some(x => x.startsWith('budget:')));
});
test('fresh daily marker under lock prevents concurrent duplicate budget changes', async () => {
  const f = fixture({ plan: { optimizeEnabled: true }, record: { status: 'active', resources }, freshDailyMarker: true });
  await f.service.action('optimize', pid, f.record().plan_hash); assert.ok(!f.events.some(x => x.startsWith('budget:')));
});
test('emergency pause works while plan performance automation is disabled', async () => {
  const f = fixture({ record: { status: 'active', resources }, plan: { optimizeEnabled: false } });
  await f.service.action('pause', pid, f.record().plan_hash); assert.ok(f.events.includes('PAUSED')); assert.equal(f.record().status, 'paused');
});
test('account currency mismatch fails closed before campaign creation', async () => {
  const f = fixture(); f.google.account = async () => ({ customerId: '1234567890', currencyCode: 'USD', timeZone: 'Europe/Istanbul', manager: false });
  await assert.rejects(f.service.action('approve', pid, f.record().plan_hash), /uyuşmuyor/); assert.ok(!f.events.includes('create')); assert.equal(f.lock(), null);
});
test('unauthenticated Ads and cron requests are rejected', { skip: !process.env.TEST_BASE_URL }, async () => {
  for (const path of ['/api/ads', '/api/ads/locations?q=Konya', '/api/cron/ads-optimize']) {
    const response = await fetch(`${process.env.TEST_BASE_URL}${path}`, path === '/api/ads' ? { method: 'POST', body: '{}' } : undefined);
    assert.equal(response.status, 401);
  }
});

test('definitive atomic Google rejection releases lock for safe correction', async () => {
  const f = fixture({ createError: true, definiteError: true }); await assert.rejects(f.service.action('approve', pid, f.record().plan_hash));
  assert.equal(f.record().status, 'validated'); assert.equal(f.lock(), null); assert.ok(f.events.includes('finish:failed'));
});
test('normal pending policy review does not create an ambiguous write lock', async () => {
  const f = fixture({ record: { status: 'paused', resources }, actualStatus: 'PAUSED' });
  f.google.policy = async () => ({ approved: false, canServe: false, ads: [] });
  await assert.rejects(f.service.action('activate', pid, f.record().plan_hash, 'REKLAMLARI YAYINA AL'), /politika/);
  assert.equal(f.lock(), null); assert.equal(f.record().status, 'paused'); assert.ok(!f.events.includes('ENABLED'));
});
test('changed live configuration is paused even with performance optimization off', async () => {
  const f = fixture({ record: { status: 'active', resources }, plan: { optimizeEnabled: false } });
  f.google.verify = async () => { throw new Error('geo changed'); };
  await f.service.action('optimize', pid, f.record().plan_hash); assert.ok(f.events.includes('PAUSED')); assert.equal(f.record().status, 'paused');
});
test('unreadable live spend pauses managed campaign conservatively', async () => {
  const f = fixture({ record: { status: 'active', resources } });
  f.google.performance = async () => { throw new Error('report timeout'); };
  await f.service.action('optimize', pid, f.record().plan_hash); assert.ok(f.events.includes('PAUSED'));
});
test('safety reduction after daily adjustment pauses instead of silently ignoring risk', async () => {
  const f = fixture({ record: { status: 'active', resources }, freshDailyMarker: true, currentBudget: 60000 });
  await f.service.action('optimize', pid, f.record().plan_hash); assert.ok(f.events.includes('PAUSED')); assert.ok(!f.events.some(x => x.startsWith('budget:')));
});
test('removal requires explicit confirmation and previously paused Google status', async () => {
  const f = fixture({ record: { status: 'paused', resources }, actualStatus: 'PAUSED' });
  await assert.rejects(f.service.action('remove', pid, f.record().plan_hash, 'yes'));
  await f.service.action('remove', pid, f.record().plan_hash, 'KAMPANYAYI KALDIR'); assert.equal(f.record().status, 'removed'); assert.ok(f.events.includes('REMOVED'));
});
test('Google manual removal can be read-only reconciled to permit a replacement', async () => {
  const f = fixture({ record: { status: 'paused', resources }, actualStatus: 'REMOVED' });
  await f.service.action('recover', pid, f.record().plan_hash); assert.equal(f.record().status, 'removed'); assert.deepEqual(f.events, ['intent', 'finish:completed']);
});
