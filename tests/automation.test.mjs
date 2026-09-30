import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validSlackWebhook, weeklyKey, cronAuthorized, slackPayload } from '../lib/automation-policy.ts';
test('webhook permits only Slack service endpoints without credentials or extra destinations', () => {
  assert.equal(validSlackWebhook('https://hooks.slack.com/services/T123/B123/abc123'), true);
  for (const value of [undefined, '', 'http://hooks.slack.com/services/T/B/C', 'https://hooks.slack.com.evil.test/services/T/B/C', 'https://user:pass@hooks.slack.com/services/T/B/C', 'https://hooks.slack.com/services/T/B/C?redirect=1', 'https://localhost/services/T/B/C']) assert.equal(validSlackWebhook(value), false);
});
test('weekly lock follows Monday boundaries in Turkey across UTC and year changes', () => {
  assert.equal(weeklyKey(new Date('2026-09-27T20:59:00Z')), '2026-09-21');
  assert.equal(weeklyKey(new Date('2026-09-27T21:00:00Z')), '2026-09-28');
  assert.equal(weeklyKey(new Date('2027-01-01T09:00:00Z')), '2026-12-28');
});
test('cron fails closed for missing, short and incorrect secrets', () => {
  const secret = 'a'.repeat(32);
  assert.equal(cronAuthorized(`Bearer ${secret}`, secret), true);
  for (const [header, value] of [[null, secret], ['Bearer undefined', undefined], ['Bearer short', 'short'], ['Bearer wrong', secret]]) assert.equal(cronAuthorized(header, value), false);
});
test('Slack payload prevents injected mentions and link unfurls', () => {
  const payload = slackPayload('<!channel> <@U123> & <https://example.com>');
  assert.ok(!payload.text.includes('<'));
  assert.ok(payload.text.includes('&amp;'));
  assert.equal(payload.mrkdwn, false);
  assert.equal(payload.unfurl_links, false);
  assert.ok(slackPayload('a'.repeat(50000)).text.length < 12000);
});
