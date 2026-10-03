import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seoOpportunities, campaignsCsv } from '../lib/seo.ts';
test('SEO opportunities use real query thresholds and rank by impressions', () => {
  assert.deepEqual(seoOpportunities(null), []);
  const result = seoOpportunities({ queries: [
    { query: 'jump', clicks: 2, impressions: 100, position: 8 },
    { query: 'fly', clicks: 0, impressions: 200, position: 12 },
    { query: 'low', clicks: 1, impressions: 19, position: 5 },
    { query: 'first', clicks: 10, impressions: 300, position: 1 },
    { query: 'distant', clicks: 0, impressions: 500, position: 21 }
  ] });
  assert.deepEqual(result.map(r => r.query), ['fly', 'jump']);
  assert.equal(result[1].ctr, 2);
});
test('CSV preserves Turkish text and quotes while neutralizing spreadsheet formulas', () => {
  const csv = campaignsCsv([{product:'Mikro Fly',city:'İstanbul',title:' =HYPERLINK("bad")',description:'Destek; eğitim',dailyBudget:500,status:'Taslak'}]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('İstanbul'));
  assert.ok(csv.includes('"\' =HYPERLINK(""bad"")"'));
  assert.ok(csv.includes('"Destek; eğitim"'));
});
