"use client";
import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { supabase } from "@/lib/supabase";
export default function ShareReport({ reportId, userId, onNotice }: { reportId: string; userId?: string; onNotice: (message: string) => void }) {
  const [config, setConfig] = useState<{ slack: boolean; channel: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/automation").then(r => r.json()).then(c => { if (!cancelled) setConfig(c); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  async function send() {
    if (!window.confirm(`Bu rapor, pazarlama verileriyle birlikte #${config?.channel || "ai-reports"} Slack kanalına gönderilsin mi?`)) return;
    setBusy(true);
    try {
      const { data } = await supabase!.auth.getSession();
      if (!data.session || data.session.user.id !== userId) throw new Error("Hesap oturumu değişti; yeniden giriş yapın.");
      const response = await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ reportId }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Gönderim tamamlanamadı.");
      onNotice(body.message);
    } catch (error) { onNotice((error as Error).message); } finally { setBusy(false); }
  }
  return <div className="panel-footer"><button className="button secondary" onClick={send} disabled={busy || !userId || !config?.slack}><MessageSquare size={16}/>{busy ? "Gönderiliyor" : "Slack’e gönder"}</button><p className="helper-text">{!userId ? "Slack gönderimi için hesabınıza giriş yapın." : !config?.slack ? "Slack rapor webhook bağlantısı bekleniyor." : `Hedef: #${config.channel}. Gönderimden önce onayınız alınır.`}</p></div>;
}
