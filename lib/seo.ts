import type { Metrics, Task, Campaign } from "./model";

export function seoOpportunities(metrics: Metrics | null) {
  return (metrics?.queries || []).filter(q => q.impressions >= 20 && q.position >= 4 && q.position <= 20)
    .map(q => ({ ...q, ctr: q.impressions ? q.clicks / q.impressions * 100 : 0 }))
    .sort((a, b) => b.impressions - a.impressions).slice(0, 10);
}
export function opportunityTask(query: string): Task {
  return { id: crypto.randomUUID(), title: `“${query}” sorgusu için ilgili sayfanın başlık, açıklama ve içeriğini iyileştir`, category: "SEO", priority: "Yüksek", done: false };
}
const csvCell = (value: string | number) => {
  // Spreadsheet formula injection protection, including leading whitespace.
  const text = String(value);
  return `"${(/^[\s]*[=+@-]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`;
};
export function campaignsCsv(campaigns: Campaign[]): string {
  const rows: (string | number)[][] = [["Ürün", "Bölge", "Başlık", "Açıklama", "Günlük bütçe (TL)", "Durum"], ...campaigns.map(c => [c.product, c.city, c.title, c.description, c.dailyBudget, c.status])];
  return "\uFEFF" + rows.map(r => r.map(csvCell).join(";")).join("\r\n");
}
