import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/automation-policy";
import { AdsServiceError, runAdsOptimization } from "@/lib/ads-service";
export const maxDuration = 120;
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!cronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) return NextResponse.json({ error: "Yetkisiz zamanlayıcı isteği." }, { status: 401 });
  try { return NextResponse.json(await runAdsOptimization(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Ads zamanlayıcı hatası." }, { status: error instanceof AdsServiceError ? error.status : 503 }); }
}
