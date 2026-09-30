import "server-only";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { validSlackWebhook, weeklyKey, slackPayload } from "./automation-policy";
import { collectMetrics } from "./google";
import { generateAnalysis } from "./report";
import { integrationStatus } from "./server";

export function automationStatus() {
  const status = integrationStatus();
  const missing: string[] = [];
  for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "AUTOMATION_USER_ID", "ADMIN_EMAILS", "OPENAI_API_KEY"]) if (!process.env[name]) missing.push(name);
  if (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < 32) missing.push("CRON_SECRET (en az 32 karakter)");
  if (!status.gsc && !status.ga4 && !status.ads) missing.push("En az bir Google veri kaynağı");
  const enabled = process.env.AUTOMATION_ENABLED === "true";
  const slack = validSlackWebhook(process.env.SLACK_REPORT_WEBHOOK_URL);
  if (process.env.AUTOMATION_SLACK_ENABLED === "true" && !slack) missing.push("SLACK_REPORT_WEBHOOK_URL");
  return { enabled, ready: enabled && !missing.length, missing, slack, channel: process.env.SLACK_REPORT_CHANNEL_NAME || "ai-reports", scheduledSlack: process.env.AUTOMATION_SLACK_ENABLED === "true", schedule: "Pazartesi 09:00 (Türkiye saati; Hobby planda ilgili saat içinde)" };
}
export async function sendSlack(text: string) {
  const url = process.env.SLACK_REPORT_WEBHOOK_URL;
  if (!validSlackWebhook(url)) throw new Error("Slack rapor webhook bağlantısı yapılandırılmamış.");
  const response = await fetch(url!, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(slackPayload(text)), signal: AbortSignal.timeout(15000), redirect: "error" });
  if (!response.ok || (await response.text()).trim() !== "ok") throw new Error("Slack teslimatı doğrulanamadı. Kanal ve webhook izinlerini kontrol edin.");
}
export async function runWeeklyReport(requestedUserId?: string) {
  const config = automationStatus();
  if (!config.ready) throw new Error("Haftalık otomasyon kapalı veya gerekli ayarlar eksik.");
  const userId = process.env.AUTOMATION_USER_ID!;
  if (requestedUserId && requestedUserId !== userId) throw new Error("Bu otomasyon farklı bir kullanıcı için yapılandırılmış.");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: user, error: userError } = await db.auth.admin.getUserById(userId);
  const allow = (process.env.ADMIN_EMAILS || "").split(",").map(x => x.trim().toLowerCase());
  if (userError || !user.user?.email || !allow.includes(user.user.email.toLowerCase())) throw new Error("Otomasyon kullanıcısı izin listesinde değil.");
  const period = weeklyKey();
  const id = randomUUID();
  const { error: lockError } = await db.from("automation_runs").insert({ id, user_id: userId, period, status: "running" });
  if (lockError?.code === "23505") return { duplicate: true, message: "Bu haftanın çalışması zaten kaydedildi. Tekrar üretim ve gönderim yapılmadı." };
  if (lockError) throw new Error("Otomasyon tabloları hazır değil. Veritabanı kurulumunu tamamlayın.");
  try {
    const metrics = await collectMetrics();
    if ([metrics.clicks, metrics.sessions, metrics.spend].every(x => x === null)) throw new Error("Hiçbir veri kaynağı okunamadı; rapor oluşturulmadı.");
    const text = await generateAnalysis(metrics);
    const { error: saveError } = await db.from("scheduled_reports").insert({ id, user_id: userId, period, text, metrics });
    if (saveError) throw new Error("Haftalık rapor veritabanına kaydedilemedi.");
    if (config.scheduledSlack) {
      // Persist intent before sending: a timeout is uncertain and is never auto-retried.
      const { error } = await db.from("automation_runs").update({ status: "sending_slack" }).eq("id", id);
      if (error) throw new Error("Gönderim kaydı oluşturulamadı.");
      const { error: intentError } = await db.from("notification_deliveries").insert({ user_id: userId, report_id: id, status: "sending" });
      if (intentError) throw new Error("Slack teslimat kaydı oluşturulamadı.");
      try {
        await sendSlack(text);
      } catch (error) {
        await db.from("notification_deliveries").update({ status: "unknown" }).eq("user_id", userId).eq("report_id", id);
        throw error;
      }
      const { error: deliveryError } = await db.from("notification_deliveries").update({ status: "sent" }).eq("user_id", userId).eq("report_id", id);
      if (deliveryError) throw new Error("Slack teslimatı doğrulandı fakat kayıt güncellenemedi; tekrar göndermeden kontrol edin.");
    }
    const { error: finishError } = await db.from("automation_runs").update({ status: "completed", finished_at: new Date().toISOString() }).eq("id", id);
    if (finishError) throw new Error("İşlem tamamlandı fakat sonuç kaydı güncellenemedi; teslimatı kontrol edin.");
    return { duplicate: false, message: config.scheduledSlack ? "Haftalık rapor kaydedildi ve Slack teslimatı doğrulandı." : "Haftalık rapor kaydedildi. Slack gönderimi kapalı." };
  } catch (error) {
    const message = (error as Error).message;
    await db.from("automation_runs").update({ status: "failed", error: message, finished_at: new Date().toISOString() }).eq("id", id);
    throw new Error(message);
  }
}
