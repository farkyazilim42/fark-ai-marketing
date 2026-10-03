import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { adsDefaultPlan, accountLocalDate } from '../lib/ads-model.ts';

// Keep server-only enforcement in production; load the unchanged adapter logic without Next's marker in Node.
const source = (await readFile(new URL('../lib/ads-google.ts', import.meta.url), 'utf8')).replace('import "server-only";', '').replace('from "./ads-model";', `from ${JSON.stringify(new URL('../lib/ads-model.ts', import.meta.url).href)};`);
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const api = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const config = { customerId: '123-456-7890', accessToken: 'test-only-token', apiVersion: 'v25' };
const op = '11111111-2222-3333-4444-555555555555';
const resources = { campaignResourceName: 'customers/1234567890/campaigns/123', budgetResourceName: 'customers/1234567890/campaignBudgets/456', adGroupResourceName: 'customers/1234567890/adGroups/789', adResourceName: 'customers/1234567890/adGroupAds/789~999' };
const account = { id: '1234567890', currencyCode: 'TRY', timeZone: 'Europe/Istanbul', status: 'ENABLED', descriptiveName: 'Test', manager: false };
const p = () => adsDefaultPlan();
function fixture(plan = p()) {
  return { campaign: { resourceName: resources.campaignResourceName, name: api.googleAdsCampaignName(plan, op), status: 'PAUSED', advertisingChannelType: 'SEARCH', biddingStrategyType: 'MANUAL_CPC', campaignBudget: resources.budgetResourceName, startDateTime: `${plan.startDate} 00:00:00`, endDateTime: `${plan.endDate} 23:59:59`, networkSettings: { targetGoogleSearch: true }, geoTargetTypeSetting: { positiveGeoTargetType: 'PRESENCE', negativeGeoTargetType: 'PRESENCE' } }, campaignBudget: { amountMicros: String(plan.dailyBudgetMinor * 10000), referenceCount: '1', explicitlyShared: false } };
}
function responses(body) {
  return { mutateOperationResponses: body.mutateOperations.map(operation => {
    const type = Object.keys(operation)[0];
    return { [type.replace(/Operation$/, 'Result')]: { resourceName: type === 'campaignOperation' ? resources.campaignResourceName : type === 'campaignBudgetOperation' ? resources.budgetResourceName : type === 'adGroupOperation' ? resources.adGroupResourceName : type === 'adGroupAdOperation' ? resources.adResourceName : 'test-criterion-resource' } };
  }) };
}
function stub(t, customize = () => undefined, plan = p()) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const body = JSON.parse(init.body); const call = { url, init, body }; calls.push(call);
    let data = customize(call);
    if (data instanceof Error) throw data;
    if (data instanceof Response) return data;
    if (data === undefined) {
      if (body.query?.startsWith('SELECT customer.')) data = { results: [{ customer: account }] };
      else if (body.query?.includes('FROM geo_target_constant')) data = { results: [{ geoTargetConstant: { id: '2792', name: 'Turkey', canonicalName: 'Turkey', countryCode: 'TR', status: 'ENABLED', targetType: 'Country' } }] };
      else if (body.query?.includes('campaign.name LIKE')) data = { results: [] };
      else if (body.query?.startsWith('SELECT campaign.resource_name, campaign.name, campaign.status')) data = { results: [fixture(plan)] };
      else if (body.query?.startsWith('SELECT ad_group.resource_name, ad_group_ad.resource_name')) data = { results: [{ adGroup: { resourceName: resources.adGroupResourceName }, adGroupAd: { resourceName: resources.adResourceName } }] };
      else if (url.endsWith('googleAds:mutate')) data = body.validateOnly ? {} : responses(body);
      else if (body.query?.includes('policy_summary')) data = { results: [{ adGroupAd: { resourceName: resources.adResourceName, status: 'ENABLED', policySummary: { approvalStatus: 'APPROVED', reviewStatus: 'REVIEWED' } } }] };
      else throw new Error(`Unexpected mocked Google request: ${body.query || url}`);
    }
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  return calls;
}
test('Google builder creates Search hierarchy paused with presence-only geography and exact bounded CPC', () => {
  const plan = p(); const operations = api.buildGoogleAdsMutations(config, plan, op);
  const campaign = operations.find(o => o.campaignOperation).campaignOperation.create;
  assert.equal(campaign.status, 'PAUSED'); assert.equal(campaign.advertisingChannelType, 'SEARCH'); assert.deepEqual(campaign.manualCpc, {});
  assert.deepEqual(campaign.geoTargetTypeSetting, { positiveGeoTargetType: 'PRESENCE', negativeGeoTargetType: 'PRESENCE' });
  assert.equal(campaign.networkSettings.targetContentNetwork, false); assert.equal(campaign.networkSettings.targetSearchNetwork, false);
  assert.equal(campaign.containsEuPoliticalAdvertising, 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING');
  assert.equal(operations.find(o => o.adGroupOperation).adGroupOperation.create.cpcBidMicros, '30000000');
  assert.equal(operations.find(o => o.campaignBudgetOperation).campaignBudgetOperation.create.explicitlyShared, false);
  assert.equal(operations.some(o => o.campaignCriterionOperation?.create.language), false, 'Manual Search language criteria were removed in September 2026');
  assert.equal(operations.find(o => o.campaignCriterionOperation?.create.location).campaignCriterionOperation.create.location.geoTargetConstant, 'geoTargetConstants/2792');
  assert.throws(() => api.buildGoogleAdsMutations(config, plan, "unsafe' operation"));
});
test('Google builder creates each product group under one campaign budget and unique temporary IDs', () => {
  const plan = p(); const group = { name: 'Jump', product: 'Jump', landingUrl: plan.landingUrl, headlines: plan.headlines, descriptions: plan.descriptions, keywords: plan.keywords, negativeKeywords: ['ikinci el'] };
  const ops = api.buildGoogleAdsMutations(config, { ...plan, adGroups: [group, { ...group, name: 'WMS', product: 'WMS' }] }, op);
  assert.equal(ops.filter(o => o.campaignBudgetOperation).length, 1);
  assert.equal(ops.filter(o => o.adGroupOperation).length, 2); assert.equal(ops.filter(o => o.adGroupAdOperation).length, 2);
  assert.equal(new Set(ops.filter(o => o.adGroupOperation).map(o => o.adGroupOperation.create.resourceName)).size, 2);
  assert.equal(ops.filter(o => o.adGroupCriterionOperation?.create.negative === true).length, 2);
});
test('Google validateOnly checks real account and geography and never mutates serving state', async t => {
  const calls = stub(t); const result = await api.validateGoogleAdsPlan(config, p(), op);
  assert.equal(result.account.currencyCode, 'TRY'); assert.equal(result.locations[0].countryCode, 'TR');
  const mutations = calls.filter(c => c.url.endsWith('googleAds:mutate'));
  assert.equal(mutations.length, 1); assert.equal(mutations[0].body.validateOnly, true); assert.equal(mutations[0].body.partialFailure, false);
  assert.equal(calls[0].init.headers['developer-token'], undefined);
});
test('Google rejects foreign or obsolete geo targets and manager/non-TRY accounts before creation', async t => {
  for (const patch of [{ currencyCode: 'USD' }, { manager: true }, { status: 'CANCELED' }, { timeZone: 'invalid' }]) {
    const calls = stub(t, c => c.body.query?.startsWith('SELECT customer.') ? { results: [{ customer: { ...account, ...patch } }] } : undefined);
    await assert.rejects(api.createGoogleAdsCampaign(config, p(), op)); assert.equal(calls.some(c => c.url.endsWith('googleAds:mutate')), false); t.mock.restoreAll();
  }
  const calls = stub(t, c => c.body.query?.includes('FROM geo_target_constant') ? { results: [{ geoTargetConstant: { id: '2792', name: 'wrong', countryCode: 'US', status: 'ENABLED', targetType: 'Country' } }] } : undefined);
  await assert.rejects(api.createGoogleAdsCampaign(config, p(), op)); assert.equal(calls.some(c => c.url.endsWith('googleAds:mutate')), false);
});
test('Google creation is exactly one atomic mutate with paused campaign and persisted resource results', async t => {
  const calls = stub(t); const result = await api.createGoogleAdsCampaign(config, p(), op);
  assert.equal(result.campaignResourceName, resources.campaignResourceName); assert.deepEqual(result.adResourceNames, [resources.adResourceName]);
  const mutations = calls.filter(c => c.url.endsWith('googleAds:mutate'));
  assert.equal(mutations.length, 1); assert.equal(mutations[0].body.validateOnly, false); assert.equal(mutations[0].body.partialFailure, false);
});
test('Google ambiguous write failures never retry; parsed atomic rejection is explicitly safe to unlock', async t => {
  for (const [response, ambiguous] of [[new Error('transport dropped'), true], [new Response(JSON.stringify({ error: { message: 'busy' } }), { status: 503 }), true], [new Response('not json', { status: 400 }), true], [new Response(JSON.stringify({ error: { message: 'invalid' } }), { status: 400 }), false], [new Response(JSON.stringify({ error: { message: 'quota' } }), { status: 429 }), true]]) {
    const calls = stub(t, c => c.url.endsWith('googleAds:mutate') ? response : undefined);
    await assert.rejects(api.createGoogleAdsCampaign(config, p(), op), error => error.ambiguous === ambiguous && error.definitelyNotApplied === !ambiguous);
    assert.equal(calls.filter(c => c.url.endsWith('googleAds:mutate')).length, 1); t.mock.restoreAll();
  }
});
test('Google malformed success remains ambiguous and never falsely unlocks after creation', async t => {
  for (const malformed of [{}, { mutateOperationResponses: [{ campaignResult: { resourceName: 'wrong' } }] }]) {
    const calls = stub(t, c => c.url.endsWith('googleAds:mutate') ? malformed : undefined);
    await assert.rejects(api.createGoogleAdsCampaign(config, p(), op), error => error.ambiguous && !error.definitelyNotApplied); assert.equal(calls.filter(c => c.url.endsWith('googleAds:mutate')).length, 1); t.mock.restoreAll();
  }
  stub(t, c => c.url.endsWith('googleAds:mutate') ? { ...responses(c.body), mutateOperationResponses: responses(c.body).mutateOperationResponses.map(r => r.campaignResult ? { campaignResult: { resourceName: 'customers/0000000000/campaigns/123' } } : r) } : undefined);
  await assert.rejects(api.createGoogleAdsCampaign(config, p(), op), error => error.ambiguous && !error.definitelyNotApplied);
});
test('Google emergency pause is possible on drift and does not need account/policy snapshot reads', async t => {
  const calls = stub(t); await api.setGoogleAdsCampaignStatus(config, resources.campaignResourceName, 'PAUSED');
  assert.equal(calls.length, 1); assert.equal(calls[0].body.mutateOperations[0].campaignOperation.update.status, 'PAUSED');
  await assert.rejects(api.setGoogleAdsCampaignStatus(config, 'customers/9999999999/campaigns/123', 'PAUSED')); assert.equal(calls.length, 1);
});
test('Google removal only accepts paused status and uses remove operation', async t => {
  const calls = stub(t, c => c.body.query?.startsWith('SELECT campaign.status') ? { results: [{ campaign: { status: 'PAUSED' } }] } : undefined);
  await api.setGoogleAdsCampaignStatus(config, resources.campaignResourceName, 'REMOVED');
  assert.deepEqual(calls.at(-1).body.mutateOperations, [{ campaignOperation: { remove: resources.campaignResourceName } }]);
});
test('Google activation rejects any unreviewed, limited, or disapproved product ad', async t => {
  for (const [approvalStatus, reviewStatus] of [['DISAPPROVED', 'REVIEWED'], ['APPROVED_LIMITED', 'REVIEWED'], ['APPROVED', 'REVIEW_IN_PROGRESS']]) {
    const calls = stub(t, c => c.body.query?.includes('policy_summary') ? { results: [{ adGroupAd: { status: 'ENABLED', policySummary: { approvalStatus: 'APPROVED', reviewStatus: 'REVIEWED' } } }, { adGroupAd: { status: 'ENABLED', policySummary: { approvalStatus, reviewStatus } } }] } : undefined);
    await assert.rejects(api.setGoogleAdsCampaignStatus(config, resources.campaignResourceName, 'ENABLED'));
    assert.equal(calls.some(c => c.url.endsWith('googleAds:mutate')), false); t.mock.restoreAll();
  }
});
test('Google shared/reassigned budgets are refused before an automatic budget update', async t => {
  const calls = stub(t, c => c.body.query?.startsWith('SELECT campaign.resource_name, campaign.name, campaign.status') ? { results: [{ ...fixture(), campaignBudget: { amountMicros: '300000000', referenceCount: '2', explicitlyShared: true } }] } : undefined);
  await assert.rejects(api.updateGoogleAdsBudget(config, { ...resources, dailyBudgetMinor: 30000 })); assert.equal(calls.some(c => c.url.endsWith('googleAds:mutate')), false);
});
test('Google recovery refuses duplicate identity and refuses to silently create again', async t => {
  const calls = stub(t, c => c.body.query?.includes('campaign.name LIKE') ? { results: [{ campaign: fixture().campaign }, { campaign: fixture().campaign }] } : undefined);
  await assert.rejects(api.findGoogleAdsCampaign(config, op), /birden çok/);
  await assert.rejects(api.createGoogleAdsCampaign(config, p(), op)); assert.equal(calls.some(c => c.url.endsWith('googleAds:mutate')), false);
});
test('Google performance uses account local dates and excludes current day from CPA window', async t => {
  const today = accountLocalDate(new Date(), account.timeZone);
  const yesterday = new Date(`${today}T00:00:00Z`); yesterday.setUTCDate(yesterday.getUTCDate() - 1); const prior = yesterday.toISOString().slice(0, 10);
  const calls = stub(t, c => c.body.query?.startsWith('SELECT segments.date') ? { results: [{ segments: { date: today }, metrics: { costMicros: '100001', conversions: 100 } }, { segments: { date: prior }, metrics: { costMicros: '200001', conversions: 2.5 } }] } : undefined);
  const result = await api.readGoogleAdsPerformance(config, resources.campaignResourceName);
  assert.equal(result.todaySpendMinor, 11); assert.equal(result.sevenDayCostMinor, 21); assert.equal(result.sevenDayConversions, 2.5); assert.equal(result.accountDate, today);
  assert.equal(result.monthSpendMinor, today.endsWith('-01') ? 11 : 31);
  assert.ok(calls.some(c => c.body.query?.includes(`AND '${today}'`)));
});
test('Google empty report legitimately returns zero only after campaign existence was verified', async t => {
  stub(t, c => c.body.query?.startsWith('SELECT segments.date') ? { results: [] } : undefined);
  const result = await api.readGoogleAdsPerformance(config, resources.campaignResourceName); assert.equal(result.monthSpendMinor, 0);
  t.mock.restoreAll(); stub(t, c => c.body.query?.startsWith('SELECT campaign.resource_name, campaign.name, campaign.status') ? { results: [] } : undefined);
  await assert.rejects(api.readGoogleAdsPerformance(config, resources.campaignResourceName));
});
function integrityFixture(plan, call) {
  const query = call.body.query || '';
  if (query.startsWith('SELECT campaign.network_settings')) return { results: [{ campaign: fixture(plan).campaign }] };
  if (query.includes('FROM campaign_criterion')) return { results: [...plan.locations.map(location => ({ campaignCriterion: { type: 'LOCATION', location: { geoTargetConstant: `geoTargetConstants/${location.id}` } } })), ...plan.negativeKeywords.map(text => ({ campaignCriterion: { type: 'KEYWORD', negative: true, keyword: { text, matchType: 'PHRASE' } } }))] };
  if (query.includes('FROM ad_group WHERE')) return { results: [{ adGroup: { resourceName: resources.adGroupResourceName, name: plan.product, status: 'ENABLED', type: 'SEARCH_STANDARD', cpcBidMicros: String(plan.maxCpcMinor * 10000) } }] };
  if (query.startsWith('SELECT ad_group.resource_name, ad_group_ad.status')) return { results: [{ adGroup: { resourceName: resources.adGroupResourceName }, adGroupAd: { status: 'ENABLED', ad: { type: 'RESPONSIVE_SEARCH_AD', finalUrls: [plan.landingUrl], responsiveSearchAd: { headlines: plan.headlines.map(text => ({ text })), descriptions: plan.descriptions.map(text => ({ text })) } } } }] };
  if (query.includes('FROM ad_group_criterion')) return { results: plan.keywords.map(keyword => ({ adGroup: { resourceName: resources.adGroupResourceName }, adGroupCriterion: { type: 'KEYWORD', status: 'ENABLED', keyword } })) };
  if (query.includes('FROM ad_group_bid_modifier') || query.includes('FROM campaign_bid_modifier')) return { results: [] };
}
test('Google integrity assertion accepts matching live structure and refuses targeting, copy, URL, bid, and AI Max drift', async t => {
  const plan = p();
  const snapshot = { ...resources, googleName: api.googleAdsCampaignName(plan, op), startDate: plan.startDate, endDate: plan.endDate, status: 'PAUSED' };
  stub(t, c => integrityFixture(plan, c));
  await api.assertGoogleAdsCampaignMatchesPlan(config, snapshot, plan, op);
  t.mock.restoreAll();
  const changes = [
    ['FROM campaign_criterion', data => { data.results[0].campaignCriterion.location.geoTargetConstant = 'geoTargetConstants/2840'; }],
    ['FROM campaign_criterion', data => { data.results.pop(); }],
    ['FROM campaign_criterion', data => { data.results[0].campaignCriterion.bidModifier = 1.5; }],
    ['FROM ad_group_bid_modifier', data => { data.results.push({ adGroupBidModifier: { bidModifier: 2 } }); }],
    ['FROM campaign_bid_modifier', data => { data.results.push({ campaignBidModifier: { bidModifier: 1.25 } }); }],
    ['SELECT campaign.network_settings', data => { data.results[0].campaign.networkSettings.targetContentNetwork = true; }],
    ['SELECT campaign.network_settings', data => { data.results[0].campaign.aiMaxSetting = { enableAiMax: true }; }],
    ['FROM ad_group WHERE', data => { data.results[0].adGroup.cpcBidMicros = '999999999'; }],
    ['FROM ad_group WHERE', data => { data.results[0].adGroup.trackingUrlTemplate = 'https://other.test/'; }],
    ['SELECT ad_group.resource_name, ad_group_ad.status', data => { data.results[0].adGroupAd.ad.responsiveSearchAd.headlines[0].text = 'Bambaşka teklif'; }],
    ['SELECT ad_group.resource_name, ad_group_ad.status', data => { data.results[0].adGroupAd.ad.finalMobileUrls = ['https://other.test/']; }],
    ['FROM ad_group_criterion', data => { data.results[0].adGroupCriterion.cpcBidMicros = '100000000'; }],
    ['FROM ad_group_criterion', data => { data.results[0].adGroupCriterion.finalUrls = ['https://other.test/']; }],
    ['FROM ad_group_criterion', data => { data.results[0].adGroupCriterion.keyword.matchType = 'BROAD'; }]
  ];
  for (const [part, alter] of changes) {
    stub(t, c => { const data = integrityFixture(plan, c); if (data && c.body.query.includes(part)) { const changed = structuredClone(data); alter(changed); return changed; } return data; });
    await assert.rejects(api.assertGoogleAdsCampaignMatchesPlan(config, snapshot, plan, op), /onaylanan plandan farklı/, part);
    t.mock.restoreAll();
  }
});
test('Google recovery includes removed owned campaigns and tolerates removed budget reference count zero', async t => {
  const removed = fixture(); removed.campaign.status = 'REMOVED'; removed.campaignBudget.referenceCount = '0';
  stub(t, c => c.body.query?.includes('campaign.name LIKE') ? { results: [{ campaign: removed.campaign }] } : c.body.query?.startsWith('SELECT campaign.resource_name, campaign.name, campaign.status') ? { results: [removed] } : undefined);
  const result = await api.findGoogleAdsCampaign(config, op); assert.equal(result.status, 'REMOVED');
});
test('Google read failures before a write are definitely not applied even for server errors', async t => {
  const calls = stub(t, c => c.body.query?.startsWith('SELECT customer.') ? new Response(JSON.stringify({ error: { message: 'unavailable' } }), { status: 503 }) : undefined);
  await assert.rejects(api.createGoogleAdsCampaign(config, p(), op), error => error.definitelyNotApplied && !error.ambiguous);
  assert.equal(calls.some(c => c.url.endsWith('googleAds:mutate')), false);
});
