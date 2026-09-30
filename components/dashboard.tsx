"use client";
import { useEffect, useRef, useState } from "react";
import { BarChart3, Search, Megaphone, CheckSquare, FileText, Plug, ArrowUpRight, ArrowRight, RefreshCw, Plus, Download, Check, X, Sparkles, ShieldCheck, Menu, LogOut, Circle, ChevronRight, Globe, Target, Layers, AlertCircle } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { campaignTemplate, initialWorkspace, products, validWorkspace, type Workspace, type Campaign, type Task } from "@/lib/model";

type View = "overview" | "seo" | "ads" | "tasks" | "reports" | "settings";
type Connections = { supabase: boolean; gsc: boolean; ga4: boolean; ads: boolean; openai: boolean };
const navigation = [
  { id: "overview", label: "Genel bakış", icon: BarChart3 }, { id: "seo", label: "SEO analizi", icon: Search },
  { id: "ads", label: "Google Ads", icon: Megaphone }, { id: "tasks", label: "Görevler", icon: CheckSquare },
  { id: "reports", label: "AI raporları", icon: FileText }, { id: "settings", label: "Bağlantılar", icon: Plug }
] as const;
const storageKey = "fark-marketing-workspace-v1";
const format = (n: number | null | undefined) => n == null ? "—" : new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(n);
const date = (s: string) => new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(s));
function exportFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

export default function Dashboard() {
  const [view, setView] = useState<View>("overview");
  const [workspace, setWorkspace] = useState<Workspace>(initialWorkspace);
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [connections, setConnections] = useState<Connections>({ supabase: false, gsc: false, ga4: false, ads: false, openai: false });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<"task" | "campaign" | "login" | null>(null);
  const [cloudReady, setCloudReady] = useState(false);
  const [filter, setFilter] = useState("Tümü");
  const [query, setQuery] = useState("");
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [approval, setApproval] = useState<string | null>(null);
  const activeUser = useRef<string | null>(null);
  const saveQueue = useRef(Promise.resolve());

  useEffect(() => {
    try { const saved = localStorage.getItem(storageKey); if (saved) { const parsed = JSON.parse(saved); if (validWorkspace(parsed)) setWorkspace(parsed); } } catch { setNotice("Yerel veriler okunamadı. JSON yedeğiniz varsa geri yükleyebilirsiniz."); }
    setReady(true);
    fetch("/api/integrations").then(r => r.json()).then(setConnections).catch(() => setNotice("Bağlantı durumu alınamadı."));
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { activeUser.current = data.session?.user.id || null; setSession(data.session); });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      activeUser.current = next?.user.id || null;
      if (!next) {
        try { const local = JSON.parse(localStorage.getItem(storageKey) || "null"); setWorkspace(validWorkspace(local) ? local : structuredClone(initialWorkspace)); }
        catch { setWorkspace(structuredClone(initialWorkspace)); }
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setCloudReady(false);
    if (!session || !supabase) return;
    // Deliberately never upload local drafts into a different account automatically.
    supabase.from("workspaces").select("data").eq("user_id", session.user.id).maybeSingle().then(({ data, error }) => {
      if (cancelled) return;
      if (error) { setNotice("Bulut verileri yüklenemedi. Supabase tablo ve erişim ayarlarını kontrol edin."); return; }
      if (data && !validWorkspace(data.data)) { setNotice("Bulut verilerinin biçimi geçersiz. Üzerine yazmadan önce veri yedeğini kontrol edin."); return; }
      setWorkspace(data ? data.data : structuredClone(initialWorkspace));
      setCloudReady(true);
    });
    return () => { cancelled = true; };
  }, [session?.user.id]); // Token refresh does not reload or overwrite current drafts.

  useEffect(() => {
    if (!modal && !approval) return;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const previous = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select, textarea') || []);
    focusables()[0]?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") { setModal(null); setApproval(null); }
      if (event.key !== "Tab") return;
      const nodes = focusables(); const first = nodes[0]; const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); previous?.focus(); };
  }, [modal, approval]);

  async function save(next: Workspace) {
    if (activeUser.current !== (session?.user.id || null)) return;
    if (session && !cloudReady) { setNotice("Bulut verileri yüklenmeden değişiklik yapılamaz. Bağlantıları kontrol edin."); return; }
    setWorkspace(next);
    if (session && supabase) {
      const userId = session.user.id;
      saveQueue.current = saveQueue.current.catch(() => {}).then(async () => {
        if (activeUser.current !== userId || !supabase) return;
        const { error } = await supabase.from("workspaces").upsert({ user_id: userId, data: next, updated_at: new Date().toISOString() });
        if (activeUser.current !== userId) return;
        if (error) { setNotice("Buluta kaydedilemedi. Ekrandaki değişikliklerinizi JSON olarak dışa aktarın."); return; }
        setNotice("Buluta kaydedildi.");
      });
      await saveQueue.current;
    } else {
      try { localStorage.setItem(storageKey, JSON.stringify(next)); setNotice("Bu tarayıcıya kaydedildi."); } catch { setNotice("Tarayıcıya kaydedilemedi. Verilerinizi dışa aktarın."); }
    }
  }

  async function api(path: string, body?: unknown) {
    const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || "İşlem tamamlanamadı."); return result;
  }
  async function sync() {
    if (session && !cloudReady) { setNotice("Önce bulut verilerinin yüklenmesini bekleyin."); return; }
    setBusy(true);
    try { const metrics = await api("/api/integrations"); await save({ ...workspace, metrics }); if (metrics.errors.length) setNotice(metrics.errors.join(" ")); }
    catch (error) { setNotice((error as Error).message); } finally { setBusy(false); }
  }
  async function generateReport() {
    if (session && !cloudReady) { setNotice("Önce bulut verilerinin yüklenmesini bekleyin."); return; }
    setBusy(true);
    try {
      const { text } = await api("/api/report", { metrics: workspace.metrics });
      const report = { id: crypto.randomUUID(), created: new Date().toISOString(), text, source: "AI" as const };
      await save({ ...workspace, reports: [report, ...workspace.reports] }); setSelectedReport(report.id);
    } catch (error) { setNotice((error as Error).message); } finally { setBusy(false); }
  }
  async function logout() {
    if (supabase) await supabase.auth.signOut(); setSession(null); setCloudReady(false);
    try { const saved = JSON.parse(localStorage.getItem(storageKey) || "null"); setWorkspace(validWorkspace(saved) ? saved : structuredClone(initialWorkspace)); } catch { setWorkspace(structuredClone(initialWorkspace)); }
  }
  function go(next: View) { setView(next); setMenu(false); setQuery(""); setFilter("Tümü"); }
  const finished = workspace.tasks.filter(t => t.done).length;
  const connected = Object.values(connections).filter(Boolean).length;
  const metrics = workspace.metrics;
  const report = workspace.reports.find(r => r.id === selectedReport) || workspace.reports[0];
  const taskList = workspace.tasks.filter(t => (filter === "Tümü" || (filter === "Tamamlanan" ? t.done : !t.done)) && t.title.toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr")));

  return <div className="shell">
    <aside className={`sidebar ${menu ? "open" : ""}`}>
      <button className="brand" onClick={() => go("overview")}><span className="brand-symbol">f<span>.</span></span><span>FARK<span className="brand-sub">AI MARKETING</span></span></button>
      <div className="workspace-label"><span className="workspace-avatar">F</span><span>Fark Yazılım<small>Pazarlama çalışma alanı</small></span><ChevronRight size={15}/></div>
      <div className="nav-label">ÇALIŞMA ALANI</div>
      <nav aria-label="Ana gezinme">{navigation.map(n => <button key={n.id} className={`nav-item ${view === n.id ? "active" : ""}`} onClick={() => go(n.id)}><n.icon size={19}/><span>{n.label}</span>{n.id === "tasks" && <span className="nav-count">{workspace.tasks.length - finished}</span>}</button>)}</nav>
      <div className="sidebar-card"><span className="icon-box"><Sparkles size={18}/></span><h3>Veriden aksiyona.</h3><p>SEO ve reklam çalışmalarını tek bir yerden yönetin.</p><button onClick={() => go("settings")}>Bağlantıları tamamla <ArrowRight size={15}/></button></div>
      <div className="sidebar-bottom"><div className="avatar">FK</div><div><strong>{session ? session.user.email?.split("@")[0] : "Fark çalışma alanı"}</strong><small>{session ? "Hesabınızla bağlı" : "Yerel çalışma modu"}</small></div><button className="icon-button" aria-label={session ? "Çıkış yap" : "Giriş yap"} onClick={() => session ? logout() : setModal("login")}>{session ? <LogOut size={17}/> : <ArrowUpRight size={17}/>}</button></div>
    </aside>
    <div className="main">
      <header className="topbar"><button className="icon-button mobile-toggle" aria-label="Menüyü aç" onClick={() => setMenu(!menu)}><Menu size={20}/></button><span className="breadcrumb">Çalışma alanı <ChevronRight size={13}/> <strong>{navigation.find(n => n.id === view)?.label}</strong></span><div className="top-actions"><span className="mode-dot"/><span>{session ? (cloudReady ? "Bulut çalışma alanı" : "Bulut yükleniyor") : "Yerel çalışma alanı"}</span><span className="small-avatar">F</span></div></header>
      <main className="content">
        <div className="page-heading"><div><div className="eyebrow">FARK YAZILIM · PAZARLAMA MERKEZİ</div><h1>{view === "overview" ? "Pazarlamanın tamamı, tek bakışta." : navigation.find(n => n.id === view)?.label}</h1><p>{({ overview: "Öncelikleri belirleyin, çalışmaları takip edin, veriye dayalı ilerleyin.", seo: "Arama görünürlüğünü gerçek Search Console verileriyle değerlendirin.", ads: "Ürün ve bölge odaklı kampanya taslakları hazırlayın.", tasks: "Fikirleri aksiyona dönüştürün. Öncelikleri ve tamamlanan işleri takip edin.", reports: "Hesap verilerinizden haftalık analiz ve uygulanabilir öneriler oluşturun.", settings: "Veri kaynakları ve hesabınızın bağlantı durumunu kontrol edin." })[view]}</p></div><button className="button secondary" onClick={() => exportFile("fark-marketing-yedek.json", JSON.stringify(workspace, null, 2), "application/json")} disabled={!ready}><Download size={16}/> Dışa aktar</button></div>
        {!session && <div className="local-banner"><Layers size={16}/><span>Yerel çalışma modu: görev ve taslaklar bu tarayıcıda saklanır. Gerçek veri analizi için hesabınızı bağlayın.</span><button onClick={() => setModal("login")}>Giriş yap <ArrowRight size={14}/></button></div>}
        {notice && <div className="notice" role="status"><AlertCircle size={17}/><span>{notice}</span><button className="icon-button" aria-label="Bildirimi kapat" onClick={() => setNotice("")}><X size={16}/></button></div>}

        {view === "overview" && <>
          <div className="hero-panel"><div><span className="pill teal"><span className="mode-dot"/> İlk sürüm · Çalışma alanınız hazır</span><h2>Doğru veriler.<br/>Daha net kararlar.</h2><p>Mikro Jump, Fly ve e-Dönüşüm için SEO ve reklam çalışmalarınızı bir araya getirin.</p><button className="button primary" onClick={() => go("settings")}>Veri kaynaklarını bağla <ArrowUpRight size={17}/></button></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="art-center"><BarChart3 size={40}/></div><div className="art-chip chip-a"><Search size={16}/> SEO</div><div className="art-chip chip-b"><Megaphone size={16}/> ADS</div><div className="art-chip chip-c"><Sparkles size={16}/> AI</div><span className="art-caption">FARK / GROWTH SYSTEM</span></div></div>
          <div className="section-heading"><h2>Performans özeti</h2><span>{metrics ? `${metrics.start} — ${metrics.end}` : "Hesap bağlantısı bekleniyor"}</span></div>
          <div className="stats-grid">{[{ label: "Organik tıklama", value: format(metrics?.clicks), icon: Search, source: "Search Console" }, { label: "Arama gösterimi", value: format(metrics?.impressions), icon: Globe, source: "Search Console" }, { label: "Web sitesi oturumu", value: format(metrics?.sessions), icon: BarChart3, source: "Google Analytics 4" }, { label: "Reklam harcaması", value: metrics?.spend == null ? "—" : `${format(metrics.spend)} ${metrics.currency || ""}`, icon: Megaphone, source: "Google Ads" }].map(s => <div key={s.label} className="stat-card"><div className="stat-label">{s.label}<s.icon size={16}/></div><strong>{s.value}</strong><span>{s.source} <span className="mini-dot"/>{metrics ? "Son senkronizasyon" : "Veri bekleniyor"}</span></div>)}</div>
          <div className="two-column"><section className="panel"><div className="panel-heading"><div><h2>Sıradaki adımlar</h2><p>Bugün odağınıza alabileceğiniz işler</p></div><button className="text-button" onClick={() => go("tasks")}>Tüm görevler <ArrowUpRight size={15}/></button></div><div className="task-preview">{workspace.tasks.filter(t => !t.done).slice(0, 4).map(t => <TaskRow key={t.id} task={t} onToggle={() => save({ ...workspace, tasks: workspace.tasks.map(x => x.id === t.id ? { ...x, done: !x.done } : x) })}/>)}{finished === workspace.tasks.length && <Empty icon={CheckSquare} title="Görevler tamamlandı" text="Yeni hedefiniz için bir görev ekleyin."/>}</div></section><section className="panel readiness"><div className="panel-heading"><div><h2>Kurulum durumu</h2><p>Gerçek verilerle çalışmaya hazırlanıyoruz</p></div><span className="pill">{connected}/5</span></div><div className="progress-track"><span style={{ width: `${connected / 5 * 100}%` }}/></div>{[{ id: "supabase", label: "Kullanıcı ve veri yönetimi" }, { id: "gsc", label: "Search Console" }, { id: "ga4", label: "Google Analytics 4" }, { id: "ads", label: "Google Ads" }, { id: "openai", label: "OpenAI rapor servisi" }].map(c => <div className="checklist" key={c.id}>{connections[c.id as keyof Connections] ? <Check size={16} className="teal-text"/> : <Circle size={15}/>}<span>{c.label}</span><small>{connections[c.id as keyof Connections] ? "Yapılandırıldı" : "Bekliyor"}</small></div>)}<button className="button secondary full" onClick={() => go("settings")}>Bağlantıları yönet <ArrowRight size={16}/></button></section></div>
          <section className="focus-strip"><span className="icon-box"><Target size={20}/></span><div><h3>Odak: Konya’dan Türkiye’ye</h3><p>Mikro Yazılım satış, eğitim ve destek hizmetlerinde görünürlüğünüzü artırın.</p></div><div className="product-tags">{products.slice(0, 3).map(p => <span className="pill" key={p}>{p}</span>)}</div></section>
        </>}

        {view === "seo" && <section className="panel"><div className="panel-heading"><div><h2>Arama sorguları</h2><p>{metrics ? `Son senkronizasyon: ${date(metrics.syncedAt)}` : "Son 28 günlük sorgular ve ortalama konum"}</p></div><button className="button primary" onClick={sync} disabled={busy}><RefreshCw size={16} className={busy ? "spin" : ""}/>{busy ? "Senkronize ediliyor" : "Verileri senkronize et"}</button></div>{metrics?.queries.length ? <div className="table-wrap"><table><thead><tr><th>Arama sorgusu</th><th>Tıklama</th><th>Gösterim</th><th>Ort. konum</th></tr></thead><tbody>{metrics.queries.map(q => <tr key={q.query}><td>{q.query}</td><td>{format(q.clicks)}</td><td>{format(q.impressions)}</td><td>{format(q.position)}</td></tr>)}</tbody></table></div> : <Empty icon={Search} title="Arama verileri henüz yok" text="Search Console bağlantısı yapılandırıldıktan sonra gerçek arama sorgularını burada görüntüleyebilirsiniz."/>}{metrics?.errors.map(e => <p className="error-text" key={e}>{e}</p>)}<div className="panel-footer">GSC, GA4 ve Ads aynı tarih aralığında okunur. Son 3 gün, Search Console veri gecikmesi için dışarıda bırakılır.</div></section>}

        {view === "ads" && <><div className="approval-banner"><ShieldCheck size={22}/><div><strong>Kontrol sizde.</strong><p>Taslak onayı yalnızca bu panelde kaydedilir. Bu sürüm Google Ads hesabında reklam yayınlamaz veya bütçe değiştirmez.</p></div></div><div className="section-heading"><h2>Kampanya taslakları <span className="count-label">{workspace.campaigns.length}</span></h2><button className="button primary" onClick={() => setModal("campaign")}><Plus size={16}/> Taslak oluştur</button></div>{workspace.campaigns.length ? <div className="campaign-grid">{workspace.campaigns.map(c => <section className="panel campaign-card" key={c.id}><div className="campaign-top"><span className="icon-box"><Megaphone size={19}/></span><span className={`pill ${c.status === "Onaylandı" ? "teal" : ""}`}>{c.status}</span></div><h3>{c.product}</h3><p className="campaign-location"><Globe size={14}/>{c.city} · Arama ağı</p><div className="ad-preview"><small>REKLAM TASLAĞI · farkyazilim.com</small><strong>{c.title}</strong><p>{c.description}</p></div><div className="budget"><span>Önerilen günlük bütçe</span><strong>{format(c.dailyBudget)} TL</strong></div><div className="card-actions"><button className="button secondary" onClick={() => exportFile(`${c.product.replaceAll(" ", "-")}-taslak.json`, JSON.stringify(c, null, 2), "application/json")}><Download size={15}/> İndir</button>{c.status === "Taslak" && <button className="button primary" onClick={() => save({ ...workspace, campaigns: workspace.campaigns.map(x => x.id === c.id ? { ...x, status: "İnceleme" } : x) })}>İncelemeye al</button>}{c.status === "İnceleme" && <button className="button primary" onClick={() => setApproval(c.id)}>Taslağı onayla</button>}{c.status === "Onaylandı" && <button className="text-button" onClick={() => save({ ...workspace, campaigns: workspace.campaigns.map(x => x.id === c.id ? { ...x, status: "Taslak" } : x) })}>Taslağa döndür</button>}</div></section>)}</div> : <section className="panel"><Empty icon={Megaphone} title="İlk kampanya taslağınızı hazırlayın" text="Ürününüzü, hedef bölgenizi ve önerilen bütçenizi seçin. Reklam metnini düzenleyip incelemeye alabilirsiniz."/></section>}</>}

        {view === "tasks" && <section className="panel"><div className="panel-heading"><div><h2>Görev listesi</h2><p>{finished} / {workspace.tasks.length} görev tamamlandı</p></div><button className="button primary" onClick={() => setModal("task")}><Plus size={16}/> Görev ekle</button></div><div className="toolbar"><div className="tabs">{["Tümü", "Açık", "Tamamlanan"].map(f => <button key={f} className={filter === f ? "selected" : ""} onClick={() => setFilter(f)}>{f}</button>)}</div><label className="search-field"><Search size={16}/><input aria-label="Görevlerde ara" placeholder="Görevlerde ara..." value={query} onChange={e => setQuery(e.target.value)}/></label></div><div className="task-list">{taskList.map(t => <TaskRow key={t.id} task={t} onToggle={() => save({ ...workspace, tasks: workspace.tasks.map(x => x.id === t.id ? { ...x, done: !x.done } : x) })}/>)}{!taskList.length && <Empty icon={CheckSquare} title="Bu görünümde görev yok" text="Aramayı temizleyin veya yeni bir görev ekleyin."/>}</div></section>}

        {view === "reports" && <><div className="section-heading"><h2>Haftalık raporlar</h2><button className="button primary" onClick={generateReport} disabled={busy || !metrics}><Sparkles size={16}/>{busy ? "Rapor hazırlanıyor" : "AI raporu oluştur"}</button></div><p className="helper-text">Rapor oluşturmak için önce SEO analizinden gerçek hesap verilerini senkronize edin. İşlem, verileri OpenAI’a analiz için gönderir.</p>{workspace.reports.length ? <div className="report-layout"><div className="panel report-list">{workspace.reports.map(r => <button key={r.id} className={report?.id === r.id ? "selected" : ""} onClick={() => setSelectedReport(r.id)}><FileText size={19}/><span><strong>Performans raporu</strong><small>{date(r.created)}</small></span><ChevronRight size={14}/></button>)}</div><section className="panel report-detail"><div className="panel-heading"><div><h2>Performans ve aksiyon raporu</h2><p>{report && date(report.created)}</p></div><button className="icon-button" aria-label="Raporu indir" onClick={() => report && exportFile("fark-haftalik-rapor.txt", report.text, "text/plain")}><Download size={18}/></button></div><div className="report-body">{report?.text}</div></section></div> : <section className="panel"><Empty icon={Sparkles} title="İlk analiziniz burada başlayacak" text="Veri bağlantıları hazır olduğunda AI; SEO fırsatlarını, reklam sonuçlarını ve öncelikli görevleri raporlayacak."/></section>}</>}

        {view === "settings" && <><div className="connections-grid">{[{ id: "supabase", name: "Supabase", desc: "Hesabınız, görevleriniz ve taslaklarınız", letter: "S", keys: "NEXT_PUBLIC_SUPABASE_URL · NEXT_PUBLIC_SUPABASE_ANON_KEY" }, { id: "gsc", name: "Search Console", desc: "Organik sorgular, tıklamalar ve gösterimler", letter: "G", keys: "GOOGLE_CLIENT_ID · GOOGLE_CLIENT_SECRET · GOOGLE_REFRESH_TOKEN · GSC_SITE_URL" }, { id: "ga4", name: "Google Analytics 4", desc: "Web sitesi oturum verileri", letter: "A", keys: "Google OAuth ayarları · GA4_PROPERTY_ID" }, { id: "ads", name: "Google Ads", desc: "Reklam harcaması · yalnızca okuma", letter: "A", keys: "Google OAuth ayarları · GOOGLE_ADS_CUSTOMER_ID · GOOGLE_ADS_DEVELOPER_TOKEN · GOOGLE_ADS_API_VERSION" }, { id: "openai", name: "OpenAI", desc: "Veriye dayalı AI performans raporları", letter: "O", keys: "OPENAI_API_KEY · OPENAI_MODEL" }].map(c => <section className="panel connection-card" key={c.id}><div className="connection-head"><span className={`provider-logo provider-${c.id}`}>{c.letter}</span><span className={`pill ${connections[c.id as keyof Connections] ? "teal" : ""}`}>{connections[c.id as keyof Connections] ? "Yapılandırıldı" : "Kurulum bekliyor"}</span></div><h3>{c.name}</h3><p>{c.desc}</p><div className="key-hint">{c.keys}</div></section>)}</div><section className="panel setup-panel"><div><h2>Hesap ve veri yönetimi</h2><p>Bağlantı durumu ortam değişkenlerinin varlığını gösterir. Hesap izinleri, senkronizasyon sırasında doğrulanır. API anahtarlarını Vercel ortam değişkenlerine ekleyin.</p><p>Google ve AI servislerini kullanacak e-posta adreslerini <code>ADMIN_EMAILS</code> içinde tanımlayın. Supabase tablo kurulumunu <code>supabase/schema.sql</code> ile tamamlayın.</p></div><div className="setup-actions"><button className="button primary" onClick={() => session ? logout() : setModal("login")}>{session ? "Hesaptan çıkış yap" : "Hesabına giriş yap"}<ArrowRight size={16}/></button><label className="button secondary">JSON yedeği yükle<input type="file" accept="application/json,.json" hidden onChange={async e => { const file = e.target.files?.[0]; if (!file) return; try { if (file.size > 2_000_000) throw new Error("too large"); const parsed = JSON.parse(await file.text()); if (!validWorkspace(parsed)) throw new Error("invalid"); await save(parsed); } catch { setNotice("Dosya geçerli bir Fark Marketing yedeği değil veya 2 MB sınırını aşıyor."); } e.target.value = ""; }}/></label></div></section><div className="approval-banner"><ShieldCheck size={22}/><div><strong>Planlı raporlar ve Slack bildirimleri</strong><p>Bu sürümde zamanlayıcı ve otomatik bildirimler etkin değil. Önce veri bağlantıları doğrulanmalı; rapor üretimi ve bildirim sıklığı sonraki kurulum adımında yapılandırılmalı.</p></div></div></>}
        <footer className="footer"><span>FARK AI MARKETING <span>v0.1</span></span><span>Fark Yazılım · SEO & Google Ads çalışma alanı</span></footer>
      </main>
    </div>
    {modal && <div className="modal-backdrop" onClick={() => setModal(null)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={e => e.stopPropagation()}><button className="close-modal icon-button" aria-label="Pencereyi kapat" onClick={() => setModal(null)}><X size={20}/></button>{modal === "task" && <TaskForm onSave={t => { save({ ...workspace, tasks: [...workspace.tasks, t] }); setModal(null); }}/ >}{modal === "campaign" && <CampaignForm onSave={c => { save({ ...workspace, campaigns: [c, ...workspace.campaigns] }); setModal(null); }}/ >}{modal === "login" && <LoginForm onSuccess={() => setModal(null)}/>}</section></div>}
    {approval && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="approval-title"><ShieldCheck className="teal-text" size={30}/><h2 id="approval-title">Taslağı onaylıyor musunuz?</h2><p>Bu onay kampanya taslağını panelde “Onaylandı” olarak işaretler. Google Ads hesabına aktarım veya harcama yapılmaz.</p><div className="card-actions"><button className="button secondary" onClick={() => setApproval(null)}>Vazgeç</button><button className="button primary" onClick={() => { save({ ...workspace, campaigns: workspace.campaigns.map(c => c.id === approval ? { ...c, status: "Onaylandı" } : c) }); setApproval(null); }}>Taslağı onayla</button></div></section></div>}
  </div>;
}
function TaskRow({ task, onToggle }: { task: Task; onToggle: () => void }) {
  return <div className={`task-row ${task.done ? "done" : ""}`}><button className="task-check" aria-label={`${task.title}: ${task.done ? "yeniden aç" : "tamamla"}`} aria-pressed={task.done} onClick={onToggle}>{task.done && <Check size={14}/>}</button><div><strong>{task.title}</strong><span>{task.category}</span></div><span className={`priority ${task.priority === "Yüksek" ? "high" : ""}`}><span/>{task.priority}</span></div>;
}
function Empty({ icon: Icon, title, text }: { icon: typeof Search; title: string; text: string }) {
  return <div className="empty"><span className="empty-icon"><Icon size={28}/></span><h3>{title}</h3><p>{text}</p></div>;
}
function TaskForm({ onSave }: { onSave: (task: Task) => void }) {
  return <form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); onSave({ id: crypto.randomUUID(), title: String(f.get("title")).trim(), category: f.get("category") as Task["category"], priority: f.get("priority") as Task["priority"], done: false }); }}><div className="eyebrow">AKSİYON PLANI</div><h2 id="modal-title">Yeni görev</h2><p>Çalışmanıza net bir sonraki adım ekleyin.</p><label>Görev başlığı<input name="title" placeholder="Örn. Mikro Fly sayfasını optimize et" required minLength={3} maxLength={180} autoFocus/></label><div className="form-grid"><label>Kategori<select name="category"><option>SEO</option><option>Google Ads</option><option>Sistem</option></select></label><label>Öncelik<select name="priority"><option>Normal</option><option>Yüksek</option></select></label></div><button className="button primary full" type="submit"><Plus size={16}/> Görevi ekle</button></form>;
}
function CampaignForm({ onSave }: { onSave: (campaign: Campaign) => void }) {
  const [product, setProduct] = useState(products[0]); const [city, setCity] = useState("Konya");
  const [title, setTitle] = useState(campaignTemplate(products[0], "Konya").title);
  const [description, setDescription] = useState(campaignTemplate(products[0], "Konya").description);
  function update(p: string, c: string) { setProduct(p); setCity(c); const t = campaignTemplate(p, c); setTitle(t.title); setDescription(t.description); }
  return <form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); onSave({ id: crypto.randomUUID(), product, city, title: title.trim(), description: description.trim(), dailyBudget: Number(f.get("budget")), status: "Taslak" }); }}><div className="eyebrow">GOOGLE ADS</div><h2 id="modal-title">Kampanya taslağı</h2><p>Önerilen metinleri düzenleyin. Taslak oluşturmak reklam yayınlamaz.</p><div className="form-grid"><label>Ürün<select value={product} onChange={e => update(e.target.value, city)}>{products.map(p => <option key={p}>{p}</option>)}</select></label><label>Hedef bölge<select value={city} onChange={e => update(product, e.target.value)}>{["Konya", "Türkiye geneli", "Ankara", "İstanbul", "İzmir"].map(c => <option key={c}>{c}</option>)}</select></label></div><label>Reklam başlığı <small>{title.length}/30</small><input required minLength={3} value={title} maxLength={30} onChange={e => setTitle(e.target.value)}/></label><label>Açıklama <small>{description.length}/90</small><textarea required minLength={10} value={description} maxLength={90} onChange={e => setDescription(e.target.value)}/></label><label>Önerilen günlük bütçe (TL)<input name="budget" type="number" min={1} max={100000} step="0.01" defaultValue={500} required/></label><button className="button primary full" type="submit">Taslağı kaydet <ArrowRight size={16}/></button></form>;
}
function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  return <form onSubmit={async e => { e.preventDefault(); if (!supabase) return; setBusy(true); const f = new FormData(e.currentTarget); const { error } = await supabase.auth.signInWithPassword({ email: String(f.get("email")), password: String(f.get("password")) }); setBusy(false); if (error) setError("Giriş yapılamadı. E-posta ve parolanızı kontrol edin."); else onSuccess(); }}><div className="eyebrow">FARK ÇALIŞMA ALANI</div><h2 id="modal-title">Hesabınıza giriş yapın</h2><p>{supabase ? "Supabase üzerinden davet edilen ekip hesabınızı kullanın. Yerel taslaklarınız hesaba otomatik aktarılmaz." : "Supabase bağlantısı henüz yapılandırılmadı. Bağlantılar ekranındaki kurulum adımlarını tamamlayın."}</p>{supabase && <><label>E-posta<input name="email" type="email" autoComplete="username" required autoFocus/></label><label>Parola<input name="password" type="password" autoComplete="current-password" required/></label>{error && <p className="error-text" role="alert">{error}</p>}<button className="button primary full" disabled={busy}>{busy ? "Giriş yapılıyor" : "Giriş yap"}<ArrowRight size={16}/></button></>}</form>;
}
