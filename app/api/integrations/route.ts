import { NextResponse } from "next/server";
import { authorized, integrationStatus } from "@/lib/server";
import { collectMetrics } from "@/lib/google";
export const maxDuration = 60;
export async function GET() {
  return NextResponse.json(integrationStatus(), { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  if (!await authorized(request)) return NextResponse.json({ error: "Gerçek hesap verileri için yetkili kullanıcıyla giriş yapın." }, { status: 401 });
  try { return NextResponse.json(await collectMetrics()); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 502 }); }
}
