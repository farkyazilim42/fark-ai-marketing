export type Task = { id: string; title: string; category: "SEO" | "Google Ads" | "Sistem"; priority: "Yüksek" | "Normal"; done: boolean };
export type Campaign = { id: string; product: string; city: string; title: string; description: string; dailyBudget: number; status: "Taslak" | "İnceleme" | "Onaylandı" };
export type Report = { id: string; created: string; text: string; source: "AI" | "Manuel" };
export type Metrics = { syncedAt: string; start: string; end: string; clicks: number | null; impressions: number | null; sessions: number | null; spend: number | null; currency: string | null; queries: { query: string; clicks: number; impressions: number; position: number }[]; errors: string[] };
export type Workspace = { tasks: Task[]; campaigns: Campaign[]; reports: Report[]; metrics: Metrics | null };
export const initialWorkspace: Workspace = {
  tasks: [
    { id: "setup-1", title: "Search Console ve GA4 erişimini bağla", category: "Sistem", priority: "Yüksek", done: false },
    { id: "setup-2", title: "Konya Mikro Yazılım sayfasının başlık ve açıklamasını incele", category: "SEO", priority: "Yüksek", done: false },
    { id: "setup-3", title: "Mikro Jump ve Fly için kampanya taslağı hazırla", category: "Google Ads", priority: "Normal", done: false },
    { id: "setup-4", title: "ERP, MRP ve e-Dönüşüm anahtar kelime listesini oluştur", category: "SEO", priority: "Normal", done: false }
  ], campaigns: [], reports: [], metrics: null
};
export const products = ["Mikro Jump", "Mikro Fly", "e-Dönüşüm", "ERP", "MRP"];
export function campaignTemplate(product: string, city: string) {
  return {
    title: `${product} | Fark Yazılım`.slice(0, 30),
    description: `${city} için ${product} satış, eğitim ve destek. Fark Yazılım ile işletmenize uygun çözümü keşfedin.`.slice(0, 90)
  };
}
export function validWorkspace(value: unknown): value is Workspace {
  if (!value || typeof value !== "object") return false;
  const w = value as Workspace;
  const string = (v: unknown) => typeof v === "string";
  return Array.isArray(w.tasks) && Array.isArray(w.campaigns) && Array.isArray(w.reports) &&
    w.tasks.every(t => t && string(t.id) && string(t.title) && typeof t.done === "boolean" && ["SEO", "Google Ads", "Sistem"].includes(t.category) && ["Yüksek", "Normal"].includes(t.priority)) &&
    w.campaigns.every(c => c && string(c.id) && string(c.title) && string(c.product) && string(c.city) && string(c.description) && Number.isFinite(c.dailyBudget) && c.dailyBudget > 0 && ["Taslak", "İnceleme", "Onaylandı"].includes(c.status)) &&
    w.reports.every(r => r && string(r.id) && string(r.text) && string(r.created) && Number.isFinite(Date.parse(r.created)) && ["AI", "Manuel"].includes(r.source)) &&
    (w.metrics === null || (!!w.metrics && typeof w.metrics === "object" && string(w.metrics.syncedAt) && Number.isFinite(Date.parse(w.metrics.syncedAt)) && string(w.metrics.start) && string(w.metrics.end) &&
      [w.metrics.clicks, w.metrics.impressions, w.metrics.sessions, w.metrics.spend].every(x => x === null || (typeof x === "number" && Number.isFinite(x) && x >= 0)) &&
      (w.metrics.currency === null || string(w.metrics.currency)) && Array.isArray(w.metrics.errors) && w.metrics.errors.every(string) &&
      Array.isArray(w.metrics.queries) && w.metrics.queries.every(q => q && string(q.query) && [q.clicks, q.impressions, q.position].every(x => typeof x === "number" && Number.isFinite(x) && x >= 0))));
}
