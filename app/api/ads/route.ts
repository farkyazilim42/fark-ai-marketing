import { NextResponse } from "next/server";
import { authorized } from "@/lib/server";
import { AdsServiceError, adsAutomationStatus, getAdsState, runAdsAction } from "@/lib/ads-service";
export const maxDuration = 120;
export const dynamic = "force-dynamic";
function errorResponse(error: unknown) { return NextResponse.json({ error: error instanceof Error ? error.message : "Ads işlemi tamamlanamadı.", ...(error instanceof AdsServiceError && error.issues ? { issues: error.issues } : {}) }, { status: error instanceof AdsServiceError ? error.status : 503 }); }
export async function GET(request: Request) {
  const auth = await authorized(request);
  if (!auth) return NextResponse.json({ config: { ...adsAutomationStatus(), customerId: "" }, plans: [], runs: [], accountLock: null }, { headers: { "Cache-Control": "no-store" } });
  try { return NextResponse.json(await getAdsState(auth.user.id), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  const auth = await authorized(request);
  if (!auth) return NextResponse.json({ error: "Ads otomasyonu için yetkili kullanıcıyla giriş yapın." }, { status: 401 });
  try {
    const raw = await request.text();
    if (raw.length > 50000) throw new AdsServiceError("Ads planı çok büyük.", 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { throw new AdsServiceError("Geçerli JSON isteği gerekli."); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new AdsServiceError("Geçerli işlem gövdesi gerekli.");
    return NextResponse.json(await runAdsAction(auth.user.id, body as Record<string, unknown>), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
