import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campaignTemplate, initialWorkspace, validWorkspace, products } from '../lib/model.ts';
test('initial state contains no fabricated marketing metrics', () => {
  assert.equal(initialWorkspace.metrics, null);
  assert.equal(initialWorkspace.reports.length, 0);
  assert.equal(validWorkspace(initialWorkspace), true);
});
test('generated ad copy respects Google text lengths for all supported products', () => {
  for (const p of products) {
    const draft = campaignTemplate(p, 'Türkiye geneli');
    assert.ok(draft.title.length <= 30);
    assert.ok(draft.description.length <= 90);
  }
});
test('backup validator rejects broken and unrecognized task/campaign records', () => {
  for (const bad of [null, {}, { ...initialWorkspace, tasks: [null] }, { ...initialWorkspace, metrics: {} }, { ...initialWorkspace, campaigns: [{ id: '1', title: 'Test', dailyBudget: -500 }] }, { ...initialWorkspace, tasks: [{ ...initialWorkspace.tasks[0], category: 'Unknown' }] }]) assert.equal(validWorkspace(bad), false);
});
test('backup validator accepts a valid campaign and rejects unsupported status', () => {
  const campaign = { id: 'c1', product: 'Mikro Jump', city: 'Konya', ...campaignTemplate('Mikro Jump', 'Konya'), dailyBudget: 500, status: 'Taslak' };
  assert.equal(validWorkspace({ ...initialWorkspace, campaigns: [campaign] }), true);
  assert.equal(validWorkspace({ ...initialWorkspace, campaigns: [{ ...campaign, status: 'Published' }] }), false);
});
