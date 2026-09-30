"use client";
import { useEffect, useState } from "react";
import { CalendarClock, RefreshCw, Play, MessageSquare, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
type State = { enabled: boolean; ready: boolean; missing: string[]; slack: boolean; channel: string; scheduledSlack: boolean; schedule: string; historyError?: string; runs: { period: string; status: string; error: string | null }[] };
export default function AutomationPanel({ userId, onUpdate }: { userId?: string; onUpdate: () => void }) {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function load() {
    const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
    const response = await fetch("/api/automation", { headers: data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {} });
    if (!response.ok) throw new Error("Otomasyon durumu alınamadı.");
    setState(await response.json());
  }
  useEffect(() => { load().catch(e => setMessage(e.message)); }, [userId]);
  async function run() {
    const text = `Bu haftanın raporu Google verileriyle oluşturulacak ve OpenAI API kullanımı oluşacak.${state?.scheduledSlack ? ` Rapor #${state.channel} kanalına da gönderilecek.` : " Slack gönderimi kapalı."} Devam edilsin mi?`;
    if (!window.confirm(text)) return;
    setBusy(true);
    try {
      const { data } = await supabase!.auth.getSession();
      const response = await fetch("/api/automation", { method: "POST", headers: { Authorization: `Bearer ${data.session?.access_token || ""}` } });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      setMessage(body.message); await load(); onUpdate();
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }
  return <section className="panel automation-panel"><div className="panel-heading"><div><h2><CalendarClock size={18}/> Haftalık rapor otomasyonu</h2><p>{state?.schedule || "Durum yükleniyor…"}</p></div><span className={`pill ${state?.ready ? "teal" : ""}`}>{state?.ready ? "Çalışmaya hazır" : "Kurulum bekliyor"}</span></div><div className="automation-body"><div className="automation-summary"><p><MessageSquare size={16}/>{state?.slack ? `Slack bağlantısı yapılandırıldı · #${state.channel}` : "Slack rapor bağlantısı bekleniyor"}</p><p>{state?.scheduledSlack ? "Planlı Slack gönderimi açık" : "Planlı Slack gönderimi kapalı"}</p></div>{state?.missing.length ? <div className="missing-list"><strong>Eksik ayarlar</strong><ul>{state.missing.map(k => <li key={k}>{k}</li>)}</ul></div> : <p>{state?.enabled ? "Gerekli ayarlar mevcut; gerçek hesap erişimi çalıştırma sırasında doğrulanır." : "Ayarlar hazırsa AUTOMATION_ENABLED=true ile zamanlayıcıyı etkinleştirin."}</p>}{state?.historyError && <p className="error-text">{state.historyError}</p>}{message && <div className="notice" role="status"><AlertCircle size={16}/>{message}</div>}{!!state?.runs.length && <div className="table-wrap"><table><thead><tr><th>Hafta</th><th>Durum</th><th>Açıklama</th></tr></thead><tbody>{state.runs.map(r => <tr key={r.period}><td>{r.period}</td><td>{{ completed: "Tamamlandı", failed: "Başarısız", running: "Çalışıyor", sending_slack: "Slack gönderimi" }[r.status] || r.status}</td><td>{r.error || "—"}</td></tr>)}</tbody></table></div>}<div className="card-actions"><button className="button secondary" onClick={() => load().catch(e => setMessage(e.message))} disabled={busy}><RefreshCw size={15}/> Durumu yenile</button><button className="button primary" onClick={run} disabled={busy || !state?.ready || !userId}><Play size={15}/>{busy ? "Rapor hazırlanıyor" : "Bu haftayı şimdi çalıştır"}</button></div><p className="helper-text">Aynı hafta için tekrar çağrı yeni rapor veya yinelenen mesaj üretmez. Başarısız/belirsiz teslimatlar otomatik tekrar gönderilmez; geçmiş ve Slack kanalı kontrol edilmelidir.</p></div></section>;
}
