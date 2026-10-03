import "server-only";
import { googlePost, googleToken, integrationStatus } from "./server";
import type { Metrics } from "./model";
export async function collectMetrics(): Promise<Metrics> {
  const status = integrationStatus();
  if (!status.gsc && !status.ga4 && !status.ads) throw new Error("Google bağlantısı yapılandırılmamış.");
  try {
    const token = await googleToken();
    const today = new Date();
    const end = new Date(today.getTime() - 3 * 86400000).toISOString().slice(0, 10);
    const start = new Date(today.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    const metrics: Metrics = { syncedAt: new Date().toISOString(), start, end, clicks: null, impressions: null, sessions: null, spend: null, currency: null, queries: [], errors: [] };
    await Promise.all([
      (async () => {
        if (!status.gsc) return;
        try {
          const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(process.env.GSC_SITE_URL!)}/searchAnalytics/query`;
          const [totals, queries] = await Promise.all([
            googlePost(endpoint, token, { startDate: start, endDate: end }),
            googlePost(endpoint, token, { startDate: start, endDate: end, dimensions: ["query"], rowLimit: 20 })
          ]);
          metrics.clicks = totals.rows?.[0]?.clicks ?? 0;
          metrics.impressions = totals.rows?.[0]?.impressions ?? 0;
          metrics.queries = (queries.rows || []).map((r: { keys: string[]; clicks: number; impressions: number; position: number }) => ({ query: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: r.position }));
        } catch { metrics.errors.push("Search Console verileri alınamadı. Mülk adresi ve izinleri kontrol edin."); }
      })(),
      (async () => {
        if (!status.ga4) return;
        try {
          const data = await googlePost(`https://analyticsdata.googleapis.com/v1beta/properties/${process.env.GA4_PROPERTY_ID}:runReport`, token, { dateRanges: [{ startDate: start, endDate: end }], metrics: [{ name: "sessions" }] });
          metrics.sessions = Number(data.rows?.[0]?.metricValues?.[0]?.value || 0);
        } catch { metrics.errors.push("GA4 verileri alınamadı. Mülk numarası ve izinleri kontrol edin."); }
      })(),
      (async () => {
        if (!status.ads) return;
        try {
          const customer = process.env.GOOGLE_ADS_CUSTOMER_ID!.replace(/-/g, "");
          const version = process.env.GOOGLE_ADS_API_VERSION!;
          const extra: Record<string, string> = {};
          if (process.env.GOOGLE_ADS_DEVELOPER_TOKEN) extra["developer-token"] = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
          if (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) extra["login-customer-id"] = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g, "");
          const data = await googlePost(`https://googleads.googleapis.com/${version}/customers/${customer}/googleAds:searchStream`, token, { query: `SELECT customer.currency_code, metrics.cost_micros FROM customer WHERE segments.date BETWEEN '${start}' AND '${end}'` }, extra);
          const rows = (Array.isArray(data) ? data : []).flatMap(b => b.results || []);
          metrics.spend = rows.reduce((total, r) => total + Number(r.metrics?.costMicros || 0) / 1e6, 0);
          metrics.currency = rows[0]?.customer?.currencyCode || null;
        } catch { metrics.errors.push("Google Ads verileri alınamadı. API sürümü, developer tokenı ve hesap izinlerini kontrol edin."); }
      })()
    ]);
    return metrics;
  } catch { throw new Error("Google erişimi sağlanamadı. Bağlantı ayarlarını kontrol edin."); }
}
