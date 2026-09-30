import { NextResponse } from "next/server";
import { generateAnalysis } from "@/lib/report";
import { authorized } from "@/lib/server";
import { initialWorkspace, validWorkspace } from "@/lib/model";
export const maxDuration = 60;
export async function POST(request: Request) {
  const auth = await authorized(request);
  if (!auth) return NextResponse.json({ error: "AI raporu için yetkili kullanıcıyla giriş yapın." }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OpenAI API bağlantısı yapılandırılmamış." }, { status: 503 });
  const raw = await request.text();
  if (raw.length > 50000) return NextResponse.json({ error: "Rapor verisi çok büyük." }, { status: 413 });
  let input;
  try { input = JSON.parse(raw); } catch { return NextResponse.json({ error: "Geçersiz rapor verisi." }, { status: 400 }); }
  if (!input || typeof input !== "object" || !validWorkspace({ ...initialWorkspace, metrics: input.metrics }) || !input.metrics || [input.metrics.clicks, input.metrics.sessions, input.metrics.spend].every(x => x === null)) return NextResponse.json({ error: "Önce hesap verilerini başarıyla senkronize edin." }, { status: 400 });
  const { data: allowed, error: quotaError } = await auth.client.rpc("claim_report_quota");
  if (quotaError) return NextResponse.json({ error: "Rapor kullanım sınırı doğrulanamadı. Supabase tablo kurulumunu tamamlayın." }, { status: 503 });
  if (!allowed) return NextResponse.json({ error: "Saatlik 5 rapor sınırına ulaşıldı. Bir sonraki saat tekrar deneyin." }, { status: 429 });
  try { return NextResponse.json({ text: await generateAnalysis(input.metrics) }); }
  catch { return NextResponse.json({ error: "AI servisine ulaşılamadı. Tekrar deneyin." }, { status: 502 }); }
}
