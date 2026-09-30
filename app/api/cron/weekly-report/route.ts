import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/automation-policy";
import { runWeeklyReport } from "@/lib/automation";
export const maxDuration = 120;
export async function GET(request: Request) {
  if (!cronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) return NextResponse.json({ error: "Yetkisiz zamanlayıcı isteği." }, { status: 401 });
  try { return NextResponse.json(await runWeeklyReport()); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 503 }); }
}
