import { NextResponse } from "next/server";
import { authorized } from "@/lib/server";
import { automationStatus, runWeeklyReport } from "@/lib/automation";
export const maxDuration = 120;
export async function GET(request: Request) {
  const status = automationStatus();
  const auth = await authorized(request);
  if (!auth) return NextResponse.json({ ...status, runs: [] }, { headers: { "Cache-Control": "no-store" } });
  const { data, error } = await auth.client.from("automation_runs").select("period,status,error,created_at,finished_at").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(10);
  return NextResponse.json({ ...status, runs: data || [], historyError: error ? "Otomasyon geçmişi okunamadı. Veritabanı kurulumunu kontrol edin." : null }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  const auth = await authorized(request);
  if (!auth) return NextResponse.json({ error: "Otomasyon için yetkili kullanıcıyla giriş yapın." }, { status: 401 });
  try { return NextResponse.json(await runWeeklyReport(auth.user.id)); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 503 }); }
}
