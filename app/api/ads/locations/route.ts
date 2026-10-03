import { NextResponse } from "next/server";
import { authorized } from "@/lib/server";
import { AdsServiceError, googleAdsConfig } from "@/lib/ads-service";
import { lookupAdsLocations, searchGoogleAdsLocations } from "@/lib/ads-google";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const auth = await authorized(request);
  if (!auth) return NextResponse.json({ error: "Bölge aramak için giriş yapın." }, { status: 401 });
  if (!process.env.ADS_AUTOMATION_USER_ID || auth.user.id !== process.env.ADS_AUTOMATION_USER_ID) return NextResponse.json({ error: "Ads hesap sahibi yetkisi gerekli." }, { status: 403 });
  try {
    const query = new URL(request.url).searchParams;
    const q = query.get("q")?.trim();
    const ids = query.get("ids")?.split(",").map(x => x.trim()).filter(Boolean);
    if (!q && !ids?.length) throw new AdsServiceError("İl adı veya Google bölge kimliği gerekli.");
    if (q && (q.length < 2 || q.length > 80)) throw new AdsServiceError("Bölge adı 2–80 karakter olmalı.");
    if (ids && (ids.length > 20 || ids.some(id => !/^\d+$/.test(id)))) throw new AdsServiceError("Geçerli bölge kimlikleri gerekli.");
    const config = await googleAdsConfig();
    const locations = q ? await searchGoogleAdsLocations(config, q) : await lookupAdsLocations(config, ids!);
    return NextResponse.json({ locations }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Bölge araması başarısız." }, { status: error instanceof AdsServiceError ? error.status : 503 }); }
}
