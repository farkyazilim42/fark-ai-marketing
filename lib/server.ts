import "server-only";
import { createClient } from "@supabase/supabase-js";
export async function authorized(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const bearer = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!url || !key || !bearer) return null;
  const client = createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${bearer}` } } });
  const { data, error } = await client.auth.getUser(bearer);
  if (error || !data.user?.email) return null;
  const allow = (process.env.ADMIN_EMAILS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  return allow.includes(data.user.email.toLowerCase()) ? { client, user: data.user } : null;
}
export function integrationStatus() {
  const google = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);
  return {
    supabase: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    gsc: google && !!process.env.GSC_SITE_URL,
    ga4: google && !!process.env.GA4_PROPERTY_ID,
    ads: google && !!(process.env.GOOGLE_ADS_CUSTOMER_ID && process.env.GOOGLE_ADS_API_VERSION),
    openai: !!process.env.OPENAI_API_KEY
  };
}
export async function googleToken() {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, refresh_token: process.env.GOOGLE_REFRESH_TOKEN!, grant_type: "refresh_token" }),
    signal: AbortSignal.timeout(15000), cache: "no-store"
  });
  if (!response.ok) throw new Error("Google yetkilendirmesi başarısız. Hesap bağlantısını kontrol edin.");
  const data = await response.json();
  if (!data.access_token) throw new Error("Google erişim tokenı alınamadı.");
  return data.access_token as string;
}
export async function googlePost(url: string, token: string, body: unknown, extra: Record<string, string> = {}) {
  const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...extra }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000), cache: "no-store" });
  if (!response.ok) throw new Error(`Veri servisi isteği başarısız (${response.status}). Yetki ve hesap numarasını kontrol edin.`);
  return response.json();
}
