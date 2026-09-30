import { NextResponse } from "next/server";
import { authorized } from "@/lib/server";
import { sendSlack } from "@/lib/automation";
import { validSlackWebhook } from "@/lib/automation-policy";
import { validWorkspace } from "@/lib/model";
export async function POST(request: Request) {
  const auth = await authorized(request);
  if (!auth) return NextResponse.json({ error: "Bildirim için yetkili kullanıcıyla giriş yapın." }, { status: 401 });
  if (!validSlackWebhook(process.env.SLACK_REPORT_WEBHOOK_URL)) return NextResponse.json({ error: "Slack rapor bağlantısı yapılandırılmamış." }, { status: 503 });
  let id: unknown;
  try { id = (await request.json()).reportId; } catch { return NextResponse.json({ error: "Geçersiz rapor isteği." }, { status: 400 }); }
  if (typeof id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(id)) return NextResponse.json({ error: "Geçersiz rapor kimliği." }, { status: 400 });
  const { data: workspace } = await auth.client.from("workspaces").select("data").eq("user_id", auth.user.id).maybeSingle();
  let text = workspace && validWorkspace(workspace.data) ? workspace.data.reports.find(r => r.id === id)?.text : undefined;
  if (!text) {
    const { data } = await auth.client.from("scheduled_reports").select("text").eq("user_id", auth.user.id).eq("id", id).maybeSingle();
    text = data?.text;
  }
  if (!text) return NextResponse.json({ error: "Kaydedilmiş rapor bulunamadı." }, { status: 404 });
  const { data: allowed, error: quotaError } = await auth.client.rpc("claim_notification_quota");
  if (quotaError) return NextResponse.json({ error: "Bildirim kullanım sınırı doğrulanamadı. Veritabanı kurulumunu tamamlayın." }, { status: 503 });
  if (!allowed) return NextResponse.json({ error: "Saatlik 10 bildirim sınırına ulaşıldı." }, { status: 429 });
  const { error: lockError } = await auth.client.from("notification_deliveries").insert({ user_id: auth.user.id, report_id: id, status: "sending" });
  if (lockError) return NextResponse.json({ error: lockError.code === "23505" ? "Bu raporun gönderimi daha önce denendi. Yinelenen mesajları önlemek için Slack kanalını kontrol edin." : "Gönderim kaydı oluşturulamadı." }, { status: 409 });
  try {
    await sendSlack(text);
    const { error } = await auth.client.from("notification_deliveries").update({ status: "sent" }).eq("user_id", auth.user.id).eq("report_id", id);
    if (error) return NextResponse.json({ error: "Slack teslimatı doğrulandı fakat kayıt güncellenemedi. Yeniden göndermeden kanalı kontrol edin." }, { status: 502 });
    return NextResponse.json({ message: "Slack rapor teslimatı doğrulandı." });
  } catch {
    await auth.client.from("notification_deliveries").update({ status: "unknown" }).eq("user_id", auth.user.id).eq("report_id", id);
    return NextResponse.json({ error: "Slack teslimatı doğrulanamadı. Yeniden göndermeden önce kanalı kontrol edin." }, { status: 502 });
  }
}
