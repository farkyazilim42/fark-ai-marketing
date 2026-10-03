import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adsDefaultPlan, validateAdsPlan, adsPlanCanonicalJson, minorToMicros, microsToMinor, decideAdsBudget, accountLocalDate } from '../lib/ads-model.ts';

const now = new Date('2026-10-03T09:00:00Z');
const plan = () => ({ ...adsDefaultPlan(), startDate: '2026-10-01', endDate: '2026-10-31', dailyBudgetMinor: 20000, maxDailyBudgetMinor: 30000, optimizeEnabled: true });
const performance = () => ({ currentDailyBudgetMinor: 20000, todaySpendMinor: 10000, monthSpendMinor: 100000, sevenDayCostMinor: 100000, sevenDayConversions: 10, daysRemainingInMonth: 29, reportingCurrency: 'TRY', accountDate: '2026-10-03', accountTimeZone: 'Europe/Istanbul', collectedAt: now.toISOString() });

test('Ads canonical validation uses integer money, normalizes input and excludes unsigned extra fields', () => {
  const a = plan(); a.name = '  Konya ERP  '; a.extra = 'ignored';
  const checked = validateAdsPlan(a);
  assert.equal(checked.ok, true);
  assert.equal(checked.plan.name, 'Konya ERP');
  assert.equal(checked.plan.extra, undefined);
  const reversed = Object.fromEntries(Object.entries(a).reverse());
  assert.equal(adsPlanCanonicalJson(a), adsPlanCanonicalJson(reversed));
  for (const amount of [0, -1, 1.1, '20000', NaN, Infinity, Number.MAX_SAFE_INTEGER]) assert.equal(validateAdsPlan({ ...plan(), dailyBudgetMinor: amount }).ok, false);
});
test('Ads validates unique RSA limits, safe public HTTPS URL and exact/phrase keyword syntax', () => {
  for (const landingUrl of ['http://example.com', 'https://localhost/', 'https://127.0.0.1', 'https://[::1]', 'https://user:pass@example.com', 'https://example.com:444/', 'https://example.com/#test']) assert.equal(validateAdsPlan({ ...plan(), landingUrl }).ok, false, landingUrl);
  for (const patch of [{ headlines: ['A', 'B'] }, { headlines: ['A', 'a', 'C'] }, { descriptions: ['x'.repeat(91), 'valid'] }, { keywords: [{ text: '[mikro]', matchType: 'EXACT' }] }, { keywords: [{ text: 'mikro', matchType: 'BROAD' }] }, { negativeKeywords: ['mikro yazılım'] }]) assert.equal(validateAdsPlan({ ...plan(), ...patch }).ok, false);
  assert.equal(validateAdsPlan({ ...plan(), headlines: ['ş'.repeat(30), 'İşletmeniz İçin ERP', 'Fark Yazılım'] }).ok, true);
});
test('Ads rejects inconsistent geographic, budget, date and currency plans', () => {
  const patches = [{ locations: [] }, { locations: [{ id: '2792', name: 'Türkiye' }, { id: '123', name: 'Konya' }] }, { dailyBudgetMinor: 40000 }, { monthlyLimitMinor: 500000 }, { maxCpcMinor: 20000 }, { currency: 'USD' }, { startDate: '2026-02-30' }, { endDate: '2026-09-01' }, { endDate: '2028-10-01' }, { maxChangePercent: 31 }, { minConversions: 0 }, { optimizeEnabled: 'true' }];
  for (const patch of patches) assert.equal(validateAdsPlan({ ...plan(), ...patch }).ok, false, JSON.stringify(patch));
});
test('Ads validates every ad group and signs distinct product landing pages and keyword sets', () => {
  const p = plan();
  const group = { name: 'Mikro Jump', product: 'Mikro Jump', landingUrl: p.landingUrl, headlines: p.headlines, descriptions: p.descriptions, keywords: p.keywords, negativeKeywords: [] };
  const valid = { ...p, adGroups: [group, { ...group, name: 'WMS', product: 'WMS', keywords: [{ text: 'depo yönetimi', matchType: 'PHRASE' }] }] };
  assert.equal(validateAdsPlan(valid).ok, true);
  assert.notEqual(adsPlanCanonicalJson(valid), adsPlanCanonicalJson({ ...valid, adGroups: [{ ...group, landingUrl: 'https://www.farkyazilim.com/jump' }] }));
  assert.equal(validateAdsPlan({ ...p, adGroups: [group, group] }).ok, false);
  assert.equal(validateAdsPlan({ ...p, adGroups: [{ ...group, headlines: ['bad'] }] }).ok, false);
  assert.equal(validateAdsPlan({ ...p, adGroups: [{ ...group, keywords: [{ text: 'crack', matchType: 'EXACT' }] }] }).ok, false);
});
test('Money conversion preserves exact micros and conservatively rounds reported spend up', () => {
  assert.equal(minorToMicros(12345678901), '123456789010000');
  assert.equal(microsToMinor('123456789010001'), 12345678902);
  assert.equal(microsToMinor('0'), 0);
  assert.equal(microsToMinor('1'), 1);
  for (const value of [-1, 1.5, NaN, 100000000001]) assert.throws(() => minorToMicros(value));
  for (const value of [123, 'NaN', '-1', '1.1', '999999999999999999999']) assert.throws(() => microsToMinor(value));
});
test('Budget optimization obeys CPA evidence and percentage and signed upper bounds', () => {
  const raised = decideAdsBudget(plan(), performance(), now);
  assert.equal(raised.action, 'UPDATE_BUDGET'); assert.equal(raised.nextDailyBudgetMinor, 22000); assert.equal(raised.safety, false);
  const lowered = decideAdsBudget(plan(), { ...performance(), sevenDayCostMinor: 600000 }, now);
  assert.equal(lowered.nextDailyBudgetMinor, 18000);
  assert.equal(decideAdsBudget(plan(), { ...performance(), sevenDayCostMinor: 500000 }, now).action, 'KEEP');
  assert.equal(decideAdsBudget(plan(), { ...performance(), sevenDayConversions: 9.99 }, now).action, 'KEEP');
  assert.equal(decideAdsBudget({ ...plan(), optimizeEnabled: false }, performance(), now).action, 'KEEP');
});
test('Budget reserves highest signed daily exposure even after same-day reduction', () => {
  const p = { ...plan(), maxDailyBudgetMinor: 50000 };
  const d = decideAdsBudget(p, { ...performance(), currentDailyBudgetMinor: 10000, monthSpendMinor: 930000, todaySpendMinor: 10000 }, now);
  assert.equal(d.action, 'PAUSE'); assert.equal(d.safety, true);
  const down = decideAdsBudget(p, { ...performance(), currentDailyBudgetMinor: 40000 }, now);
  assert.equal(down.action, 'UPDATE_BUDGET'); assert.equal(down.safety, true); assert.ok(down.nextDailyBudgetMinor <= Math.floor(p.monthlyLimitMinor / 30.4));
  assert.equal(decideAdsBudget(p, { ...performance(), currentDailyBudgetMinor: 50001 }, now).action, 'PAUSE', 'An unauthorized high daily budget may retain its same-day exposure after lowering');
});
test('Budget safety overrides disabled optimization and refuses stale, missing or contradictory metrics', () => {
  const p = { ...plan(), optimizeEnabled: false };
  for (const patch of [{ monthSpendMinor: p.monthlyLimitMinor }, { todaySpendMinor: 60000 }, { monthSpendMinor: 999 }, { collectedAt: '2026-10-03T08:00:00Z' }, { collectedAt: '2026-10-03T10:00:00Z' }, { sevenDayCostMinor: undefined }, { sevenDayConversions: NaN }, { reportingCurrency: 'USD' }, { accountTimeZone: '' }, { accountDate: '2026-10-02' }, { daysRemainingInMonth: 0 }]) assert.equal(decideAdsBudget(p, { ...performance(), ...patch }, now).action, 'PAUSE', JSON.stringify(patch));
  assert.equal(decideAdsBudget({ ...p, endDate: '2026-10-02' }, performance(), now).action, 'PAUSE');
});
test('Account calendar respects Turkish midnight and DST transitions', () => {
  assert.equal(accountLocalDate(new Date('2026-10-02T21:00:00Z'), 'Europe/Istanbul'), '2026-10-03');
  assert.equal(accountLocalDate(new Date('2026-11-01T06:30:00Z'), 'America/New_York'), '2026-11-01');
});
test('Future scheduled campaigns remain enabled without premature optimization, unsafe budgets or historic spend', () => {
  const scheduled = { ...plan(), startDate: '2026-10-10', endDate: '2026-11-08' };
  const empty = { ...performance(), todaySpendMinor: 0, monthSpendMinor: 0, sevenDayCostMinor: 0, sevenDayConversions: 0 };
  assert.equal(decideAdsBudget(scheduled, empty, now).action, 'KEEP');
  assert.match(decideAdsBudget(scheduled, empty, now).reason, /2026-10-10/);
  for (const patch of [{ currentDailyBudgetMinor: 40000 }, { currentDailyBudgetMinor: 9000 }, { monthSpendMinor: 1 }, { todaySpendMinor: 1 }, { collectedAt: '2026-10-02T09:00:00Z' }]) assert.equal(decideAdsBudget(scheduled, { ...empty, ...patch }, now).action, 'PAUSE');
  assert.equal(decideAdsBudget({ ...plan(), endDate: '2026-10-02' }, empty, now).action, 'PAUSE');
});
