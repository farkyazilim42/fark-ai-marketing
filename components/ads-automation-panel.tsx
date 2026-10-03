"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, CheckCircle2, ChevronDown, ClipboardCheck, Download, FilePlus2, Globe2, MapPin, Megaphone, Pause, Play, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Square, Trash2, Wallet, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { adsDefaultPlan, validateAdsPlan, type AdsPlan, type AdsAdGroup } from "@/lib/ads-model";
import { products } from "@/lib/model";

type Issue = { field: string; message: string };
type RecordStatus = "draft" | "validated" | "creating" | "paused" | "activating" | "active" | "pausing" | "removing" | "removed" | "unknown" | "failed";
type PlanRecord = { id: string; plan: AdsPlan; plan_hash: string; status: RecordStatus; customer_id: string; validated_at?: string | null; approved_at?: string | null; activated_at?: string | null; last_error?: string | null; created_at: string; updated_at: string; resources?: Record<string, unknown> | null; validation?: { account?: { timeZone?: string } } };
type AdsRun = { id: string; action?: string; status: string; created_at: string; error?: string | null; message?: string; plan_id?: string; [key: string]: unknown };
type AccountState = { config: { ready: boolean; mutationsEnabled: boolean; automationEnabled: boolean; missing: string[]; customerId?: string; ownerConfigured: boolean; monitorIntervalMinutes?: number; monitorReady?: boolean; lastMonitorAt?: string | null }; plans: PlanRecord[]; runs: AdsRun[]; accountLock: Record<string, unknown> | null; databaseError?: string };
type Result = { message?: string; error?: string; issues?: Issue[]; plan?: PlanRecord; result?: unknown };
type Approval = { kind: "approve" | "activate" | "remove"; record: PlanRecord } | { kind: "kill" };
type Draft = { plan: AdsPlan; scope: "national" | "regional" };
type Step = "target" | "copy" | "budget";

const money = (minor: number) => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format((Number.isFinite(minor) ? minor : 0) / 100);
const dateTime = (value?: string | null) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "short", timeStyle: "short" }) : "—";
const dateLabel = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split("-").reverse().join(".") : value;
const statusLabels: Record<RecordStatus, string> = { draft: "Taslak", validated: "Google doğrulandı", creating: "Oluşturuluyor", paused: "Duraklatıldı", activating: "Yayın açılıyor", active: "Yayında", pausing: "Durduruluyor", removing: "Kaldırılıyor", removed: "Kaldırıldı", unknown: "Hesabı kontrol edin", failed: "İşlem başarısız" };
const actionLabels: Record<string, string> = { plan: "Plan kaydı", validate: "Google doğrulaması", approve: "Kampanya oluşturma / onay", activate: "Yayına alma", pause: "Duraklatma", kill: "Acil durdurma", remove: "Kampanya kaldırma", optimize: "Bütçe kontrolü", recover: "Google ile mutabakat", intent: "İşlem başlatıldı", completed: "Tamamlandı", succeeded: "Başarılı", success: "Başarılı", failed: "Başarısız", running: "Çalışıyor", skipped: "Atlandı", unknown: "Kontrol gerekli" };
const defaultProducts = ["Mikro Jump", "Mikro Fly", "Zeus WMS", "Eryaz B4B"];
const productUrls: Record<string, string> = { "Mikro Jump": "https://www.farkyazilim.com/urunlerimiz/mikro-jump", "Mikro Fly": "https://www.farkyazilim.com/urunlerimiz/mikro-fly", "Eryaz B4B": "https://www.farkyazilim.com/cozumlerimiz/eryaz-b2b-b4b", "Zeus WMS": "https://www.farkyazilim.com/konya-depo-programi" };
function newGroup(product: string, scope: "national" | "regional"): AdsAdGroup {
  const template = adsDefaultPlan(product, scope);
  return { name: product, product, landingUrl: product === "Zeus WMS" && scope === "national" ? "https://www.farkyazilim.com/depo-programi" : productUrls[product] || template.landingUrl, headlines: template.headlines, descriptions: template.descriptions, keywords: template.keywords, negativeKeywords: template.negativeKeywords };
}
const initDraft = (): Draft => {
  const base = adsDefaultPlan("Mikro Jump", "regional");
  const adGroups = defaultProducts.map(product => newGroup(product, "regional"));
  return { scope: "regional", plan: { ...base, ...adGroups[0], name: "Fark | Konya | Mikro + WMS/B2B", product: defaultProducts.join(" / "), adGroups, locations: [], dailyBudgetMinor: 50_000, minDailyBudgetMinor: 20_000, maxDailyBudgetMinor: 60_000, monthlyLimitMinor: 2_000_000, maxCpcMinor: 3_000, targetCpaMinor: 30_000, maxChangePercent: 10, minConversions: 5, optimizeEnabled: false } };
};
const liveStatuses: RecordStatus[] = ["creating", "paused", "activating", "active", "pausing", "removing", "unknown"];
const pendingStatuses: RecordStatus[] = ["creating", "activating", "pausing", "removing", "unknown"];
function recordLabel(record: PlanRecord): string {
  if (record.status === "active") {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: record.validation?.account?.timeZone || "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
      const value = (key: string) => parts.find(part => part.type === key)?.value;
      if (record.plan.startDate > `${value("year")}-${value("month")}-${value("day")}`) return "Zamanlandı";
    } catch { /* Persisted status remains usable if historical timezone data is absent. */ }
  }
  return statusLabels[record.status] || record.status;
}
const readyKeys: Record<string, string> = { GOOGLE_CLIENT_ID: "Google OAuth istemcisi", GOOGLE_CLIENT_SECRET: "Google OAuth gizli anahtarı", GOOGLE_REFRESH_TOKEN: "Google Ads hesap yetkisi", GOOGLE_ADS_CUSTOMER_ID: "Google Ads müşteri numarası", GOOGLE_ADS_DEVELOPER_TOKEN: "Google Ads geliştirici erişimi", GOOGLE_ADS_API_VERSION: "Google Ads API sürümü", ADS_AUTOMATION_USER_ID: "Otomasyonun yetkili kullanıcısı", ADS_AUTOMATION_ENABLED: "Otomasyon zamanlayıcısı", ADS_MUTATIONS_ENABLED: "Google Ads değişiklik izni", SUPABASE_SERVICE_ROLE_KEY: "Sunucu veri erişimi", CRON_SECRET: "Zamanlayıcı erişimi", NEXT_PUBLIC_SUPABASE_URL: "Veri hizmeti bağlantısı", NEXT_PUBLIC_SUPABASE_ANON_KEY: "Uygulama oturum erişimi", ADMIN_EMAILS: "Yetkili kullanıcı e-postası" };
const objectValue = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
function auditDescription(run: AdsRun): string {
  const result = objectValue(run.result);
  const decision = objectValue(result.decision);
  const reason = typeof result.reason === "string" ? result.reason : typeof decision.reason === "string" ? decision.reason : "";
  const amount = typeof result.nextDailyBudgetMinor === "number" ? result.nextDailyBudgetMinor : undefined;
  if (reason) return `${reason}${amount !== undefined ? ` · Günlük ortalama: ${money(amount)}` : ""}`;
  const policy = objectValue(result.policy);
  if (typeof policy.canServe === "boolean") return policy.canServe ? "Google reklam incelemesi tamamlandı; gösterime uygun." : "Google reklam incelemesi veya yayın uygunluğu bekleniyor.";
  if (result.status === "PAUSED") return "Kampanya duraklatıldı.";
  if (result.status === "REMOVED") return "Kampanya kalıcı olarak kaldırıldı.";
  return run.status === "completed" ? "İşlem kaydı doğrulandı." : "—";
}
function issueLabel(field: string, plan: AdsPlan): string {
  const fields: Record<string, string> = { name: "Kampanya adı", product: "Ürün", landingUrl: "Açılış sayfası", headlines: "Başlıklar", descriptions: "Açıklamalar", keywords: "Anahtar kelimeler", negativeKeywords: "Negatif kelimeler", locations: "Hedef bölge", dailyBudgetMinor: "Başlangıç bütçesi", minDailyBudgetMinor: "Minimum günlük bütçe", maxDailyBudgetMinor: "Maksimum günlük bütçe", monthlyLimitMinor: "Aylık hedef", maxCpcMinor: "Tıklama teklifi", targetCpaMinor: "Dönüşüm maliyeti hedefi", maxChangePercent: "Değişiklik oranı", minConversions: "Minimum dönüşüm", startDate: "Başlangıç tarihi", endDate: "Bitiş tarihi", adGroups: "Ürün grupları" };
  const match = /^adGroups\.(\d+)\.(.+)$/.exec(field);
  return match ? `${plan.adGroups?.[Number(match[1])]?.product || "Ürün grubu"} · ${fields[match[2]] || match[2]}` : fields[field] || field;
}

function PolicyStatus({ planId, runs }: { planId: string; runs: AdsRun[] }) {
  const run = runs.find(item => item.plan_id === planId && typeof objectValue(objectValue(item.result).policy).canServe === "boolean");
  if (!run) return <p className="ads-small">Google politika sonucu henüz alınmadı. “Google durumunu kontrol et” ile inceleme durumunu yenileyin.</p>;
  const policy = objectValue(objectValue(run.result).policy);
  const ads = Array.isArray(policy.ads) ? policy.ads.map(objectValue) : [];
  const labels: Record<string, string> = { APPROVED: "Onaylandı", APPROVED_LIMITED: "Sınırlı onay", DISAPPROVED: "Reddedildi", UNDER_REVIEW: "İnceleniyor", REVIEWED: "İnceleme tamamlandı", ELIGIBLE_MAY_SERVE: "İnceleme sürüyor", UNKNOWN: "Bilinmiyor" };
  return <div className={`ads-policy ${policy.canServe ? "ready" : ""}`}><strong>{policy.canServe ? "Google politika incelemesi tamamlandı" : "Google incelemesi / yayın uygunluğu bekleniyor"}</strong><p>Son kontrol: {dateTime(run.created_at)}. Yayına alma sırasında yeniden doğrulanır.</p>{ads.length > 0 && <ul>{ads.map((ad, index) => <li key={index}>Reklam {index + 1}: {labels[String(ad.approvalStatus)] || String(ad.approvalStatus)} · {labels[String(ad.reviewStatus)] || String(ad.reviewStatus)}{Array.isArray(ad.topics) && ad.topics.length ? ` · ${ad.topics.filter(value => typeof value === "string").join(", ")}` : ""}</li>)}</ul>}</div>;
}

function isStoredDraft(value: unknown): value is Draft {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Draft;
  // Incomplete drafts are retained, but never trusted as executable plans.
  const p = candidate.plan;
  return ["national", "regional"].includes(candidate.scope) && !!p && typeof p.name === "string" && typeof p.product === "string" && typeof p.landingUrl === "string" && typeof p.startDate === "string" && typeof p.endDate === "string" && typeof p.optimizeEnabled === "boolean" && p.currency === "TRY" &&
    [p.headlines, p.descriptions, p.negativeKeywords].every(v => Array.isArray(v) && v.every(s => typeof s === "string")) && Array.isArray(p.keywords) && p.keywords.every(k => k && typeof k.text === "string" && ["EXACT", "PHRASE"].includes(k.matchType)) && Array.isArray(p.locations) && p.locations.every(l => l && typeof l.id === "string" && typeof l.name === "string") &&
    [p.dailyBudgetMinor, p.minDailyBudgetMinor, p.maxDailyBudgetMinor, p.monthlyLimitMinor, p.maxCpcMinor, p.targetCpaMinor, p.maxChangePercent, p.minConversions].every(n => typeof n === "number" && Number.isFinite(n)) &&
    (p.adGroups === undefined || (Array.isArray(p.adGroups) && p.adGroups.length > 0 && p.adGroups.length <= 6 && p.adGroups.every(g => g && typeof g.name === "string" && typeof g.product === "string" && typeof g.landingUrl === "string" && [g.headlines, g.descriptions, g.negativeKeywords].every(a => Array.isArray(a) && a.every(s => typeof s === "string")) && Array.isArray(g.keywords) && g.keywords.every(k => k && typeof k.text === "string" && ["EXACT", "PHRASE"].includes(k.matchType)))));
}

function GroupAssets({ group }: { group: AdsAdGroup }) {
  return <div className="ads-review-assets ads-group-review"><h4>{group.name}</h4><p className="ads-break"><strong>Açılış sayfası</strong>{group.landingUrl}</p><strong>Başlıklar</strong><ul>{group.headlines.map((h, i) => <li key={i}>{h}</li>)}</ul><strong>Açıklamalar</strong><ul>{group.descriptions.map((d, i) => <li key={i}>{d}</li>)}</ul><strong>Anahtar kelimeler</strong><p>{group.keywords.map(k => k.matchType === "EXACT" ? `[${k.text}]` : `“${k.text}”`).join(" · ")}</p><strong>Grup negatifleri</strong><p>{group.negativeKeywords.join(" · ") || "Yok"}</p></div>;
}

function CampaignSummary({ plan, full = false }: { plan: AdsPlan; full?: boolean }) {
  return <div className="ads-summary">
    <dl><div><dt>Ürün</dt><dd>{plan.product}</dd></div><div><dt>Hedef bölge</dt><dd>{plan.locations.map(l => l.name).join(", ") || "Bölge seçilmedi"}</dd></div><div><dt>Yayın aralığı</dt><dd>{dateLabel(plan.startDate)} – {dateLabel(plan.endDate)}</dd></div><div><dt>Başlangıç / gün ortalaması</dt><dd>{money(plan.dailyBudgetMinor)}</dd></div><div><dt>Otomatik bütçe aralığı / gün</dt><dd>{money(plan.minDailyBudgetMinor)} – {money(plan.maxDailyBudgetMinor)}</dd></div><div><dt>Planın aylık harcama hedefi</dt><dd>{money(plan.monthlyLimitMinor)}</dd></div><div><dt>Manuel tıklama teklifi</dt><dd>{money(plan.maxCpcMinor)}</dd></div><div><dt>Optimizasyon CPA hedefi</dt><dd>{money(plan.targetCpaMinor)}</dd></div><div><dt>Günlük en fazla değişiklik</dt><dd>%{plan.maxChangePercent}</dd></div><div><dt>Karar için en az dönüşüm</dt><dd>{plan.minConversions}</dd></div><div><dt>Otomatik bütçe yönetimi</dt><dd>{plan.optimizeEnabled ? "Açık" : "Kapalı"}</dd></div></dl>
    {full && <>{(plan.adGroups || [{ ...plan }]).map((group, index) => <GroupAssets key={index} group={group}/>)}<p className="ads-small">Kampanya genelindeki negatifler: {plan.negativeKeywords.join(" · ") || "Yok"}. Tüm gruplar ortak kampanya bütçesini kullanır.</p></>}
  </div>;
}

function BudgetCaveat() {
  return <p className="ads-budget-caveat">Google Ads bütçesi günlük ortalamadır. Bir gün içinde bunun 2 katına kadar harcama oluşabilir; sabit günlük bütçede aylık ücretlendirme sınırı genellikle 30,4 katıdır. Buradaki aylık hedef, veriler gecikmeli geldiği için kesin bir harcama garantisi değildir. Sistem bütçeyi sınırlar ve eşikte duraklatır; bütçe değişiklikleri Google’ın aylık hesaplamasını etkileyebilir.</p>;
}

function MoneyInput({ label, value, onChange, hint }: { label: string; value: number; onChange: (minor: number) => void; hint?: string }) {
  return <label className="ads-field">{label}<div className="ads-money-input"><input type="number" min="0.01" step="0.01" inputMode="decimal" value={value ? value / 100 : ""} onChange={event => onChange(Math.round(Number(event.target.value) * 100))}/><span>TL</span></div>{hint && <small>{hint}</small>}</label>;
}

function AssetInputs({ title, items, min, max, chars, onChange }: { title: string; items: string[]; min: number; max: number; chars: number; onChange: (items: string[]) => void }) {
  return <div className="ads-assets"><div className="ads-subheading"><h4>{title}</h4><span>{items.length}/{max} · en az {min}</span></div>{items.map((item, index) => <div className="ads-asset-row" key={index}><label className="ads-field"><span className="ads-visually-hidden">{title === "Başlıklar" ? "Başlık" : "Açıklama"} {index + 1}</span>{chars > 30 ? <textarea rows={2} maxLength={chars} value={item} onChange={event => onChange(items.map((v, i) => i === index ? event.target.value : v))}/> : <input maxLength={chars} value={item} onChange={event => onChange(items.map((v, i) => i === index ? event.target.value : v))}/>}<small className="ads-character-count">{Array.from(item).length}/{chars}</small></label><button type="button" className="icon-button" disabled={items.length <= min} aria-label={`${title === "Başlıklar" ? "Başlık" : "Açıklama"} ${index + 1} sil`} onClick={() => onChange(items.filter((_, i) => i !== index))}><X size={15}/></button></div>)}<button type="button" className="text-button" disabled={items.length >= max} onClick={() => onChange([...items, ""])}>+ {title === "Başlıklar" ? "Başlık" : "Açıklama"} ekle</button></div>;
}

function ApprovalDialog({ approval, customerId, busy, onClose, onConfirm }: { approval: Approval; customerId?: string; busy: boolean; onClose: () => void; onConfirm: (confirmation: string) => void }) {
  const id = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const [checked, setChecked] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const renew = approval.kind === "approve" && approval.record.status === "paused";
  const text = approval.kind === "activate" ? "REKLAMLARI YAYINA AL" : approval.kind === "kill" ? "TÜM YÖNETİLEN REKLAMLARI DURDUR" : approval.kind === "remove" ? "KAMPANYAYI KALDIR" : "";
  const title = approval.kind === "approve" ? renew ? "Sabit planın onayını yenile" : "Kampanyayı duraklatılmış oluştur" : approval.kind === "activate" ? "Harcama ve yayın onayı" : approval.kind === "remove" ? "Kampanyayı kalıcı olarak kaldır" : "Yönetilen reklamları durdur";
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => previous?.focus();
  }, []);
  return <div className="ads-dialog-backdrop"><div ref={dialog} className="ads-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} tabIndex={-1} onKeyDown={event => {
    if (event.key === "Escape" && !busy) onClose();
    if (event.key !== "Tab") return;
    const nodes = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]') || []);
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>
    <div className="ads-dialog-heading"><span className="icon-box"><ShieldCheck size={21}/></span><button className="icon-button" disabled={busy} aria-label="Onay penceresini kapat" onClick={onClose}><X size={19}/></button></div>
    <h2 id={`${id}-title`}>{title}</h2><p>Google Ads hesabı: <strong>{customerId || "Yapılandırılan hesap"}</strong></p>
    {approval.kind === "kill" ? <p className="ads-dialog-intro">Bu sistemin yönettiği kampanyalar duraklatılacak. Hesabın diğer kampanyaları bu işleme dahil değildir. Sonuç Google Ads üzerinden doğrulanacak.</p> : <><p className="ads-dialog-intro">{approval.kind === "remove" ? "Bu duraklatılmış kampanya Google Ads hesabında KALDIRILDI olarak işaretlenecek. Aynı kampanya yeniden yayına alınamaz. İşlem yeni plan oluşturmak için hesap kapasitesini açar; harcama ve işlem geçmişini silmez." : approval.kind === "approve" ? renew ? "Mevcut kampanyanın sabit planını yeniden onaylayacaksınız. Yeni kampanya oluşturulmaz; yayın duraklatılmış kalır. Yayına alma için ayrıca onayınız gerekecek." : "Aşağıdaki sabit plan Google Ads hesabında duraklatılmış olarak oluşturulacak. Yayına alma için ayrıca onayınız gerekecek." : "Aşağıdaki sabit planı yayına aldığınızda Google Ads hesabınızdan harcama başlayabilir. Otomatik değişiklikler yalnızca bu plandaki sınırlar içinde yapılacak."}</p><h3>{approval.record.plan.name}</h3><CampaignSummary plan={approval.record.plan} full/>{approval.kind !== "remove" && <><BudgetCaveat/><p className="ads-small">Yalnızca Google Arama Ağı · Türkçe reklam metni · seçilen bölgede bulunan veya düzenli bulunan kişiler. Google’ın reklam ve marka politikalarına ilişkin son incelemesi yayın sürecinde devam eder.</p></>}</>}
    <label className="ads-check"><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} disabled={busy}/><span>{approval.kind === "remove" ? "Bu kampanyanın Google Ads hesabından kalıcı olarak kaldırılmasını onaylıyorum." : approval.kind === "kill" ? "Yönetilen kampanyaların durdurulmasını onaylıyorum." : approval.kind === "activate" ? "Reklam metinlerini, tarihleri ve yukarıdaki harcama sınırlarını inceledim; yayına almayı onaylıyorum." : renew ? "Sabit reklam planını ve bütçe sınırlarını yeniden inceledim; onayımı yeniliyorum." : "Reklam içeriğini, hedeflemeyi ve bütçe planını inceledim; Google Ads hesabında oluşturulmasını onaylıyorum."}</span></label>
    {text && <label className="ads-field ads-confirm-input">Onaylamak için <strong>{text}</strong> yazın<input autoComplete="off" value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)} spellCheck={false}/></label>}
    <div className="card-actions"><button className="button secondary" disabled={busy} onClick={onClose}>Vazgeç</button><button className={`button ${approval.kind === "kill" || approval.kind === "remove" ? "ads-danger" : "primary"}`} disabled={busy || !checked || (!!text && confirmation !== text)} onClick={() => onConfirm(confirmation)}>{busy ? "İşlem sürüyor…" : approval.kind === "approve" ? renew ? "Onayı yenile" : "Onayla ve oluştur" : approval.kind === "activate" ? "Onayla ve yayına al" : approval.kind === "remove" ? "Onayla ve kalıcı kaldır" : "Onayla ve durdur"}</button></div>
  </div></div>;
}

export default function AdsAutomationPanel({ userId, onNotice }: { userId?: string; onNotice?: (message: string) => void }) {
  const [draft, setDraft] = useState<Draft>(initDraft);
  const [step, setStep] = useState<Step>("target");
  const [account, setAccount] = useState<AccountState | null>(null);
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [checkedDraft, setCheckedDraft] = useState(false);
  const [approval, setApproval] = useState<Approval | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locationQuery, setLocationQuery] = useState("");
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [keywordMatch, setKeywordMatch] = useState<"EXACT" | "PHRASE">("PHRASE");
  const [keywordText, setKeywordText] = useState("");
  const [groupIndex, setGroupIndex] = useState(0);
  const epoch = useRef(0);
  const mountedUser = useRef(userId);
  const storageOwner = useRef<string | undefined>(undefined);
  const requests = useRef(new Set<AbortController>());
  const actionPending = useRef(false);
  const requestSequence = useRef(0);
  const plan = draft.plan;
  const content: AdsAdGroup = plan.adGroups?.[groupIndex] || plan.adGroups?.[0] || plan;
  const localValidation = useMemo(() => validateAdsPlan(plan), [plan]);
  const savedRecords = account?.plans || [];
  const selected = savedRecords.find(record => record.id === selectedId) || savedRecords[0];
  const live = savedRecords.find(record => liveStatuses.includes(record.status));
  const authenticated = !!userId;
  const canUseApi = authenticated && !!account?.config.ready && !account.databaseError;
  const canMutate = canUseApi && !!account?.config.mutationsEnabled;
  const storageKey = `fark-ads-draft-v1:${userId || "local"}`;

  const notify = useCallback((text: string, error = false) => { setMessage(text); setMessageError(error); }, []);

  const api = useCallback(async <T,>(path: string, body?: unknown): Promise<T> => {
    const currentEpoch = epoch.current;
    const expectedUser = userId;
    const controller = new AbortController();
    requests.current.add(controller);
    const timeout = window.setTimeout(() => controller.abort(), 90_000);
    try {
      const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      if (epoch.current !== currentEpoch || mountedUser.current !== expectedUser) throw new Error("Hesap değişti. İşlemi yeni hesabınızda yeniden açın.");
      if (expectedUser && data.session?.user.id !== expectedUser) throw new Error("Oturum değişti veya sona erdi. Hesabınıza yeniden giriş yapın.");
      if (body && !data.session) throw new Error("Google Ads hesabını yönetmek için yetkili hesabınızla giriş yapın.");
      const response = await fetch(path, { method: body ? "POST" : "GET", headers: { ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal, cache: "no-store" });
      const result = await response.json().catch(() => ({ error: "Sunucudan geçerli yanıt alınamadı." }));
      if (epoch.current !== currentEpoch || mountedUser.current !== expectedUser) throw new Error("Hesap değişti. Önceki hesabın sonucu gösterilmedi.");
      if (!response.ok) {
        if (Array.isArray(result.issues)) setIssues(result.issues);
        throw new Error(result.error || "İşlem tamamlanamadı. Bağlantıları kontrol edip durumu yenileyin.");
      }
      return result as T;
    } catch (error) {
      if ((error as Error).name === "AbortError") throw new Error(body ? "İşlemin sonucu zamanında alınamadı. Yeniden oluşturmadan önce durumu yenileyin ve Google durumunu kontrol edin." : "Bağlantı zaman aşımına uğradı. Durumu yeniden yükleyebilirsiniz.");
      throw error;
    } finally { window.clearTimeout(timeout); requests.current.delete(controller); }
  }, [userId]);

  const load = useCallback(async () => {
    const currentEpoch = epoch.current;
    const sequence = ++requestSequence.current;
    setLoading(true);
    try { const state = await api<AccountState>("/api/ads"); if (currentEpoch === epoch.current && sequence === requestSequence.current) setAccount(state); }
    catch (error) { if (currentEpoch === epoch.current && sequence === requestSequence.current) notify((error as Error).message, true); }
    finally { if (currentEpoch === epoch.current && sequence === requestSequence.current) setLoading(false); }
  }, [api, notify]);

  useEffect(() => {
    epoch.current++;
    mountedUser.current = userId;
    for (const request of requests.current) request.abort();
    actionPending.current = false;
    setAccount(null); setApproval(null); setSelectedId(null); setBusy(""); setLocations([]); setLocationQuery("Konya"); setSearching(false); setMessage(""); setIssues([]); setCheckedDraft(false); setDraftReady(false); setGroupIndex(0);
    let next = initDraft();
    try { const value = JSON.parse(localStorage.getItem(storageKey) || "null"); if (isStoredDraft(value)) next = value; }
    catch { notify("Kaydedilmiş yerel taslak okunamadı; yeni taslak açıldı.", true); }
    setDraft(next); storageOwner.current = userId; setDraftReady(true);
    void load();
    return () => { epoch.current++; for (const request of requests.current) request.abort(); };
  }, [userId, storageKey, load, notify]);

  useEffect(() => {
    if (!draftReady || storageOwner.current !== userId) return;
    try { localStorage.setItem(storageKey, JSON.stringify(draft)); }
    catch { notify("Taslak bu cihazda kaydedilemedi. JSON indir ile bir kopyasını alabilirsiniz.", true); }
  }, [draft, draftReady, storageKey, userId, notify]);

  function update<K extends keyof AdsPlan>(field: K, value: AdsPlan[K]) {
    setDraft(current => ({ ...current, plan: { ...current.plan, [field]: value } })); setCheckedDraft(false); setIssues([]);
  }

  function updateContent<K extends keyof AdsAdGroup>(field: K, value: AdsAdGroup[K]) {
    setDraft(current => {
      const groups = current.plan.adGroups;
      if (!groups) return { ...current, plan: { ...current.plan, [field]: value } };
      const activeIndex = groups[groupIndex] ? groupIndex : 0;
      const nextGroups = groups.map((group, index) => index === activeIndex ? { ...group, [field]: value } : group);
      const syncTop = activeIndex === 0 && field !== "name" && field !== "product" && field !== "negativeKeywords" ? { [field]: value } : {};
      return { ...current, plan: { ...current.plan, ...syncTop, adGroups: nextGroups } };
    });
    setCheckedDraft(false); setIssues([]);
  }

  function toggleProduct(product: string) {
    const currentGroups = plan.adGroups || [{ ...plan }];
    const selectedGroup = currentGroups.find(group => group.product === product);
    if (selectedGroup && currentGroups.length === 1) { notify("En az bir ürün grubu seçili kalmalı.", true); return; }
    if (!selectedGroup && currentGroups.length >= 6) { notify("Bir kampanyada en fazla 6 ürün grubu olabilir.", true); return; }
    const groups = selectedGroup ? currentGroups.filter(group => group.product !== product) : [...currentGroups, newGroup(product, draft.scope)];
    const first = groups[0];
    setDraft(current => ({ ...current, plan: { ...current.plan, landingUrl: first.landingUrl, headlines: first.headlines, descriptions: first.descriptions, keywords: first.keywords, product: groups.map(group => group.product).join(" / "), adGroups: groups } }));
    setGroupIndex(0); setCheckedDraft(false); setIssues([]);
  }

  function checkDraft() {
    setCheckedDraft(true);
    if (!localValidation.ok) { setIssues(localValidation.issues); notify("İşaretlenen alanları düzenleyin. Taslak henüz kayda hazır değil.", true); return; }
    setIssues([]); notify("Taslağın biçim ve bütçe kontrolleri tamamlandı. Google Ads doğrulaması sunucuya kayıttan sonra yapılır.");
  }

  async function searchLocations() {
    if (searching || locationQuery.trim().length < 2) return;
    const currentEpoch = epoch.current;
    setSearching(true); setLocations([]);
    try {
      const result = await api<{ locations: { id: string; name: string }[] }>(`/api/ads/locations?q=${encodeURIComponent(locationQuery.trim())}`);
      if (currentEpoch !== epoch.current) return;
      setLocations(result.locations || []);
      if (!result.locations?.length) notify("Türkiye için uygun bölge bulunamadı. İl veya ilçe adıyla tekrar arayın.");
    } catch (error) { if (currentEpoch === epoch.current) notify((error as Error).message, true); }
    finally { if (currentEpoch === epoch.current) setSearching(false); }
  }

  async function runAction(action: string, record?: PlanRecord, confirmation?: string) {
    if (actionPending.current) return;
    if (action === "plan" && !localValidation.ok) { checkDraft(); return; }
    const currentEpoch = epoch.current;
    actionPending.current = true; setBusy(action); setIssues([]); setMessage("");
    try {
      const body = action === "plan" ? { action, plan } : { action, ...(record ? { planId: record.id, planHash: record.plan_hash } : {}), ...(confirmation ? { confirmation } : {}) };
      const result = await api<Result>("/api/ads", body);
      if (currentEpoch !== epoch.current) return;
      if (result.plan) setSelectedId(result.plan.id);
      setApproval(null);
      const text = result.message || "İşlem tamamlandı.";
      notify(text); onNotice?.(text);
      await load();
    } catch (error) {
      if (currentEpoch !== epoch.current) return;
      setApproval(null); notify((error as Error).message, true);
      // A failed transport may still have changed Google; refresh persisted state.
      await load();
    } finally { if (currentEpoch === epoch.current) { actionPending.current = false; setBusy(""); } }
  }

  function exportDraft() {
    const blob = new Blob([JSON.stringify({ schema: "fark-ads-draft-v1", ...draft }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "fark-google-ads-plan.json"; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function addKeywords() {
    const lines = keywordText.split(/\n/).map(text => text.trim()).filter(Boolean);
    if (!lines.length) return;
    const additions = lines.map(text => ({ text, matchType: keywordMatch }));
    updateContent("keywords", [...content.keywords, ...additions].filter((keyword, index, all) => all.findIndex(other => other.text.toLocaleLowerCase("tr") === keyword.text.toLocaleLowerCase("tr") && other.matchType === keyword.matchType) === index));
    setKeywordText("");
  }

  const visibleIssues = issues.length ? issues : checkedDraft && !localValidation.ok ? localValidation.issues : [];
  const fieldIssues = visibleIssues.length > 0;

  return <div className="ads-automation">
    <section className="ads-hero"><div><span className="ads-kicker"><Megaphone size={14}/> GOOGLE ADS OTOMASYONU</span><h2>Planı siz belirleyin.<br/>Sistem sınırlarınızda çalışsın.</h2><p>Ürün, bölge ve bütçeden kampanyaya. Önce inceleyin, Google’da doğrulayın, ardından ayrı onaylarla oluşturup yayına alın.</p></div><div className="ads-hero-badge"><ShieldCheck size={29}/><strong>İki aşamalı onay</strong><span>Oluşturma → Yayın</span></div></section>

    <div className="ads-overview"><div><span>Hesap bağlantısı</span><strong><i className={canUseApi ? "ads-dot on" : "ads-dot"}/>{loading && !account ? "Kontrol ediliyor" : !authenticated ? "Yerel taslak modu" : canUseApi ? "Hesap hazır" : "Kurulum bekliyor"}</strong><small>{account?.config.customerId ? `Hesap ${account.config.customerId}` : "Arama Ağı · TRY"}</small></div><div><span>Bütçe yönetimi</span><strong>{account?.config.automationEnabled ? "Zamanlayıcı açık" : "Zamanlayıcı kapalı"}</strong><small>Yalnızca onaylanmış sınırlar içinde</small></div><div><span>Yönetilen kampanya</span><strong>{live ? recordLabel(live) : "Henüz oluşturulmadı"}</strong><small>Hesap başına bir etkin plan</small></div><button className="button secondary" disabled={loading || !!busy} onClick={() => void load()}><RefreshCw size={15} className={loading ? "spin" : ""}/>{loading ? "Yükleniyor" : "Durumu yenile"}</button></div>

    {!authenticated && <p className="ads-small">Yerel taslağı düzenleyebilirsiniz. Hesapta işlem yapmak için Bağlantılar bölümünden giriş yapın.</p>}
    {authenticated && account?.config.automationEnabled && <div className={`ads-monitor ${account.config.monitorReady ? "ready" : ""}`}><ShieldCheck size={15}/><span>{account.config.monitorReady ? "Bütçe koruması çalışıyor" : "Bütçe koruması bağlantı bekliyor"} · Son kontrol: {dateTime(account.config.lastMonitorAt)}{account.config.monitorIntervalMinutes ? ` · ${account.config.monitorIntervalMinutes} dakika aralık` : ""}</span></div>}
    {message && <div className={`ads-message ${messageError ? "error" : ""}`} role={messageError ? "alert" : "status"}>{messageError ? <AlertCircle size={18}/> : <CheckCircle2 size={18}/>}<span>{message}</span><button className="icon-button" aria-label="Bildirimi kapat" onClick={() => setMessage("")}><X size={15}/></button></div>}
    {(!authenticated || (account && (!account.config.ready || !account.config.mutationsEnabled || account.databaseError))) && <details className="ads-setup"><summary><AlertCircle size={17}/>{!authenticated ? "Taslak hazırlamaya başlayabilirsiniz" : "Canlı işlem için tamamlanacak bağlantılar"}<ChevronDown size={16}/></summary><div>{!authenticated && <p>Bu form ve JSON çıktısı giriş yapmadan kullanılabilir. Planı sunucuya kaydetmek ve reklam hesabını yönetmek için Bağlantılar bölümünden yetkili hesabınızla giriş yapın.</p>}{account?.config.missing?.length ? <ul>{account.config.missing.map(key => <li key={key}>{readyKeys[key] || key}<code>{key}</code></li>)}</ul> : null}{account?.databaseError && <p className="error-text">{account.databaseError}</p>}{account && !account.config.mutationsEnabled && <p>Google Ads hesabında değişiklik yapma izni kapalı.</p>}<p>Google OAuth yetkisi, Google Ads API erişimi ve sunucu anahtarları Vercel’in ortam değişkenlerinde yapılandırılır. Bu form gizli anahtar istemez. Google Ads hesabının para birimi TRY olmalıdır. Tarihler ve harcama hesabında Google Ads hesabının saat dilimi kullanılır.</p></div></details>}

    <div className="ads-builder-layout"><section className="panel ads-builder"><div className="panel-heading"><div><h2><FilePlus2 size={18}/> Kampanya planlayıcı</h2><p>Taslağınız bu cihazda otomatik saklanır.</p></div><button type="button" className="text-button" onClick={exportDraft} disabled={!draftReady}><Download size={15}/> JSON indir</button></div>
      <div className="ads-steps" role="tablist" aria-label="Kampanya planı adımları">{([{ id: "target", title: "Hedefleme", icon: Globe2 }, { id: "copy", title: "Reklam içeriği", icon: Megaphone }, { id: "budget", title: "Bütçe ve kurallar", icon: SlidersHorizontal }] as const).map((item, index) => <button role="tab" aria-selected={step === item.id} aria-controls={`ads-step-${item.id}`} id={`ads-tab-${item.id}`} key={item.id} className={step === item.id ? "selected" : ""} onClick={() => setStep(item.id)}><span>{index + 1}</span>{item.title}</button>)}</div>
      <div className="ads-form-body" id={`ads-step-${step}`} role="tabpanel" aria-labelledby={`ads-tab-${step}`}>
        {step === "target" && <><div className="ads-example-note"><strong>Konya için örnek başlangıç planı</strong><p>Mikro Jump, Mikro Fly, WMS ve B2B aynı kampanyada ayrı reklam gruplarıdır. Toplam 500 TL/gün ve 20.000 TL/ay örnek bütçedir; henüz onaylanmamıştır.</p></div><label className="ads-field">Kampanya adı<input value={plan.name} maxLength={100} onChange={event => update("name", event.target.value)}/></label><fieldset className="ads-product-picker"><legend>Kampanyadaki ürün grupları</legend>{[...new Set([...defaultProducts, ...products, ...(plan.adGroups || []).map(group => group.product)])].map(product => <label key={product}><input type="checkbox" checked={(plan.adGroups || [{ ...plan }]).some(group => group.product === product)} onChange={() => toggleProduct(product)}/><span>{product}</span></label>)}</fieldset><p className="ads-small ads-product-help">Her ürünün açılış sayfası, başlıkları ve anahtar kelimeleri “Reklam içeriği” adımında ayrı düzenlenir. Bütçe tüm gruplar için ortaktır.</p>
          <fieldset className="ads-scope"><legend>Reklamın gösterileceği bölge</legend><label className={draft.scope === "national" ? "selected" : ""}><input type="radio" name="ads-scope" checked={draft.scope === "national"} onChange={() => { setDraft(current => ({ ...current, scope: "national", plan: { ...current.plan, locations: [{ id: "2792", name: "Türkiye" }] } })); setCheckedDraft(false); setIssues([]); }}/><Globe2 size={19}/><span><strong>Türkiye geneli</strong><small>Ulusal erişim</small></span></label><label className={draft.scope === "regional" ? "selected" : ""}><input type="radio" name="ads-scope" checked={draft.scope === "regional"} onChange={() => { setDraft(current => ({ ...current, scope: "regional", plan: { ...current.plan, locations: [] } })); setCheckedDraft(false); setIssues([]); }}/><MapPin size={19}/><span><strong>Bölgesel</strong><small>Seçtiğiniz il ve ilçeler</small></span></label></fieldset>
          {draft.scope === "regional" && <div className="ads-location"><label className="ads-field">İl veya ilçe ara<div className="ads-inline-input"><input value={locationQuery} placeholder="Örn. Konya, Ankara, Selçuklu" onChange={event => setLocationQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void searchLocations(); } }}/><button type="button" className="button secondary" disabled={!canUseApi || searching || locationQuery.trim().length < 2} onClick={() => void searchLocations()}><Search size={15}/>{searching ? "Aranıyor" : "Bölge ara"}</button></div><small>{canUseApi ? "Sonuçlar Google Ads konum kataloğundan doğrulanır." : "Bölge seçimi için Google Ads bağlantısı ve yetkili oturum gereklidir."}</small></label>{locations.length > 0 && <ul className="ads-location-results">{locations.map(location => <li key={location.id}><button type="button" disabled={plan.locations.some(l => l.id === location.id)} onClick={() => update("locations", [...plan.locations, location])}><span>{location.name}</span><small>{plan.locations.some(l => l.id === location.id) ? "Eklendi" : "+ Ekle"}</small></button></li>)}</ul>}<div className="ads-chips">{plan.locations.map(location => <span key={location.id}><MapPin size={12}/>{location.name}<button type="button" aria-label={`${location.name} bölgesini kaldır`} onClick={() => update("locations", plan.locations.filter(l => l.id !== location.id))}><X size={13}/></button></span>)}</div>{!plan.locations.length && <p className="ads-small">Henüz bölge seçilmedi. En az bir sonuç ekleyin.</p>}</div>}
          <div className="ads-fixed-settings"><Check size={15}/><p>Google Arama Ağı · Türkçe reklam metni · Bölgedeki fiziksel varlık hedeflemesi. Google, kullanıcı dilini reklam ve sayfa içeriğine göre değerlendirir. Görüntülü Reklam Ağı ve arama iş ortakları kapalı.</p></div><div className="ads-form-grid"><label className="ads-field">Başlangıç tarihi<input type="date" value={plan.startDate} onChange={event => update("startDate", event.target.value)}/></label><label className="ads-field">Bitiş tarihi<input type="date" value={plan.endDate} min={plan.startDate} onChange={event => update("endDate", event.target.value)}/></label></div><p className="ads-small">Tarihler Google Ads hesabının saat dilimine göre uygulanır. Örnek tarihler bugünden başlar; yayın öncesi kontrol edin.</p>
        </>}
        {step === "copy" && <><label className="ads-field">Düzenlenen reklam grubu<select value={groupIndex} onChange={event => { setGroupIndex(Number(event.target.value)); setKeywordText(""); }}>{(plan.adGroups || [{ ...plan }]).map((group, index) => <option key={index} value={index}>{group.product}</option>)}</select></label><div className="ads-template-note"><span>{content.product} için metin ve açılış sayfasını inceleyin. Bu grubun bütçesi kampanyayla ortaktır.</span><button type="button" className="button secondary" onClick={() => { const template = newGroup(content.product, draft.scope); for (const field of ["headlines", "descriptions", "keywords", "negativeKeywords"] as const) updateContent(field, template[field]); notify("Ürün şablonu uygulandı. Başlık ve açıklamaları yayından önce inceleyin."); }}>Ürün şablonunu uygula</button></div><label className="ads-field">Grubun açılış sayfası<input type="url" value={content.landingUrl} placeholder="https://www.farkyazilim.com/…" onChange={event => updateContent("landingUrl", event.target.value)}/><small>{content.product} için çalışan, ürünle ilgili HTTPS adresi.</small></label><AssetInputs title="Başlıklar" items={content.headlines} min={3} max={15} chars={30} onChange={value => updateContent("headlines", value)}/><AssetInputs title="Açıklamalar" items={content.descriptions} min={2} max={4} chars={90} onChange={value => updateContent("descriptions", value)}/>
          <div className="ads-assets"><div className="ads-subheading"><h4>Anahtar kelimeler</h4><span>{content.keywords.length} kelime</span></div><div className="ads-keyword-list">{content.keywords.map((keyword, index) => <div key={index}><input aria-label={`Anahtar kelime ${index + 1}`} value={keyword.text} maxLength={80} onChange={event => updateContent("keywords", content.keywords.map((k, i) => i === index ? { ...k, text: event.target.value } : k))}/><select aria-label={`Anahtar kelime ${index + 1} eşleme`} value={keyword.matchType} onChange={event => updateContent("keywords", content.keywords.map((k, i) => i === index ? { ...k, matchType: event.target.value as "EXACT" | "PHRASE" } : k))}><option value="PHRASE">Sıralı eşleme</option><option value="EXACT">Tam eşleme</option></select><button type="button" className="icon-button" aria-label={`Anahtar kelime ${index + 1} kaldır`} onClick={() => updateContent("keywords", content.keywords.filter((_, i) => i !== index))}><X size={14}/></button></div>)}</div><label className="ads-field">Yeni anahtar kelimeler<textarea rows={3} value={keywordText} onChange={event => setKeywordText(event.target.value)} placeholder="Her satıra bir anahtar kelime"/></label><div className="ads-keyword-add"><select aria-label="Yeni anahtar kelime eşleme" value={keywordMatch} onChange={event => setKeywordMatch(event.target.value as "EXACT" | "PHRASE")}><option value="PHRASE">Sıralı eşleme</option><option value="EXACT">Tam eşleme</option></select><button type="button" className="button secondary" onClick={addKeywords} disabled={!keywordText.trim()}>Kelimeleri ekle</button></div></div><label className="ads-field">Grubun negatif anahtar kelimeleri<textarea rows={4} value={content.negativeKeywords.join("\n")} onChange={event => updateContent("negativeKeywords", event.target.value.split("\n"))} onBlur={() => updateContent("negativeKeywords", content.negativeKeywords.map(text => text.trim()).filter(Boolean))}/><small>Her satıra bir kelime. Gruba sıralı eşlemeyle uygulanır.</small></label><details className="ads-plan-details"><summary>Kampanya genelindeki negatif kelimeler <ChevronDown size={14}/></summary><div><label className="ads-field">Tüm ürünler için negatif kelimeler<textarea rows={3} value={plan.negativeKeywords.join("\n")} onChange={event => update("negativeKeywords", event.target.value.split("\n"))} onBlur={() => update("negativeKeywords", plan.negativeKeywords.map(text => text.trim()).filter(Boolean))}/></label></div></details><p className="ads-small" style={{ marginTop: 17 }}>Biçim, tekrar ve kelime kontrolleri politika onayı değildir. Marka kullanımı, açılış sayfası ve reklam politikaları Google incelemesine tabidir.</p>
        </>}
        {step === "budget" && <><div className="ads-form-grid"><MoneyInput label="Başlangıç günlük ortalama bütçe" value={plan.dailyBudgetMinor} onChange={value => update("dailyBudgetMinor", value)}/><MoneyInput label="Aylık harcama hedefi" value={plan.monthlyLimitMinor} onChange={value => update("monthlyLimitMinor", value)}/><MoneyInput label="En düşük günlük ortalama" value={plan.minDailyBudgetMinor} onChange={value => update("minDailyBudgetMinor", value)}/><MoneyInput label="En yüksek günlük ortalama" value={plan.maxDailyBudgetMinor} onChange={value => update("maxDailyBudgetMinor", value)}/><MoneyInput label="Maksimum manuel tıklama teklifi" value={plan.maxCpcMinor} onChange={value => update("maxCpcMinor", value)}/><MoneyInput label="Optimizasyon dönüşüm maliyeti hedefi" value={plan.targetCpaMinor} onChange={value => update("targetCpaMinor", value)} hint="Google teklif stratejisi değildir; bütçe kararında kullanılır."/><label className="ads-field">Günlük en fazla bütçe değişimi (%)<input type="number" min={1} max={30} step={1} value={plan.maxChangePercent || ""} onChange={event => update("maxChangePercent", Number(event.target.value))}/></label><label className="ads-field">Karar için minimum dönüşüm<input type="number" min={1} max={1000} step={1} value={plan.minConversions || ""} onChange={event => update("minConversions", Number(event.target.value))}/></label></div><label className="ads-check ads-auto-toggle"><input type="checkbox" checked={plan.optimizeEnabled} onChange={event => update("optimizeEnabled", event.target.checked)}/><span><strong>Yayın sonrası bütçeyi otomatik yönet</strong><small>Yeterli veri oluştuğunda bütçe, onayladığınız aralık ve günlük değişim sınırı içinde ayarlanır. Koruma kontrolleri ayrıca çalışır.</small></span></label><div className="ads-budget-equation"><Wallet size={18}/><div><strong>Bu aylık hedef için günlük ortalama: en fazla {money(Math.floor(plan.monthlyLimitMinor / 30.4))}</strong><p>Başlangıç bütçesi bu tutarı aşmamalı. Otomasyon, üst sınırı ayrıca aylık hedef ve kalan bütçeye göre daraltır. Hesaptaki diğer kampanyalar bu planın bütçesine dahil değildir.</p></div></div><BudgetCaveat/></>}
      </div>
      {fieldIssues && <div className="ads-validation" role="alert"><strong>Düzenlenmesi gereken alanlar</strong><ul>{visibleIssues.map((issue, index) => <li key={`${issue.field}-${index}`}><strong>{issueLabel(issue.field, plan)}:</strong> {issue.message}</li>)}</ul></div>}
      <div className="ads-builder-footer"><span>{localValidation.ok ? <><CheckCircle2 size={15}/> Temel kontroller hazır</> : "Yayın öncesinde tüm alanlar doğrulanır"}</span><div><button className="button secondary" type="button" disabled={!!busy} onClick={checkDraft}>Taslağı kontrol et</button><button className="button primary" type="button" disabled={!!busy || !canUseApi || !localValidation.ok} onClick={() => void runAction("plan")}><ClipboardCheck size={15}/>{busy === "plan" ? "Kaydediliyor" : "Planı incelemeye kaydet"}</button></div></div>
    </section>

    <aside className="ads-preview-stack"><section className="panel ads-live-preview"><div className="panel-heading"><div><h2>Reklam önizlemesi</h2><p>{content.product} · örnek görünüm</p></div></div><div className="ads-search-preview"><div><span className="ads-brand-icon">F</span><div><strong>Fark Yazılım</strong><span>{(() => { try { return new URL(content.landingUrl).hostname; } catch { return "Açılış sayfası"; } })()}</span></div></div><small>Sponsorlu</small><h3>{content.headlines.filter(Boolean).slice(0, 3).join(" | ") || "Reklam başlıklarınız"}</h3><p>{content.descriptions.filter(Boolean).slice(0, 2).join(" ") || "Reklam açıklamalarınız burada görünür."}</p></div><p className="ads-preview-note">Google başlıkları ve açıklamaları farklı kombinasyonlarla gösterebilir.</p></section><section className="panel ads-envelope"><div className="panel-heading"><div><h2><Wallet size={17}/> Bütçe özeti</h2><p>Tüm ürünlerin ortak kampanya bütçesi</p></div></div><div className="ads-envelope-body"><span>Başlangıç günlük ortalama</span><strong>{money(plan.dailyBudgetMinor)}</strong><div><span>Aylık hedef</span><b>{money(plan.monthlyLimitMinor)}</b></div><div><span>Günlük değişiklik</span><b>En fazla %{plan.maxChangePercent}</b></div><div><span>Olası günlük harcama*</span><b>{money(plan.maxDailyBudgetMinor * 2)}</b></div><div><span>Hedefleme</span><b>{draft.scope === "national" ? "Türkiye geneli" : `${plan.locations.length} bölge`}</b></div><small>*Üst günlük ortalama bütçenin 2 katı. Bu bir kesin harcama üst sınırı taahhüdü değildir.</small></div></section><div className="ads-workflow"><h3>Yayın akışı</h3>{["Parametreleri belirleyin", "Planı Google’da doğrulayın", "Onaylayın, duraklatılmış oluşsun", "Bütçeyi onaylayın, yayına alın"].map((text, index) => <div key={text}><span>{index + 1}</span>{text}</div>)}</div></aside></div>

    <section className="panel ads-records"><div className="panel-heading"><div><h2><ShieldCheck size={18}/> Kayıtlı planlar ve yayın kontrolü</h2><p>Her kayıt sabittir. Düzenlemek için yeni bir taslak kopyası oluşturun.</p></div>{live && <button className="button ads-danger" disabled={!!busy || !canMutate} onClick={() => setApproval({ kind: "kill" })}><Square size={14}/> Acil durdur</button>}</div>
      {savedRecords.length ? <div className="ads-record-layout"><div className="ads-record-list" aria-label="Kayıtlı kampanya planları">{savedRecords.map(record => <button key={record.id} className={selected?.id === record.id ? "selected" : ""} aria-pressed={selected?.id === record.id} onClick={() => setSelectedId(record.id)}><span className={`pill ${record.status === "active" || record.status === "validated" ? "teal" : ""}`}>{recordLabel(record)}</span><strong>{record.plan.name}</strong><small>{money(record.plan.dailyBudgetMinor)} / gün · {dateTime(record.created_at)}</small></button>)}</div>{selected && <div className="ads-record-detail"><div className="ads-record-title"><div><h3>{selected.plan.name}</h3><p>Hesap {selected.customer_id} · Plan {selected.id.slice(0, 8)}</p></div><button className="text-button" disabled={!!busy} onClick={() => { setDraft({ plan: structuredClone(selected.plan), scope: selected.plan.locations.length === 1 && selected.plan.locations[0].id === "2792" ? "national" : "regional" }); setCheckedDraft(false); setIssues([]); setStep("target"); setGroupIndex(0); notify("Planın düzenlenebilir kopyası planlayıcıya alındı. Değişiklikler önceki onayı taşımaz."); document.querySelector(".ads-builder")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><FilePlus2 size={14}/> Taslağa kopyala</button></div><CampaignSummary plan={selected.plan}/><details className="ads-plan-details"><summary>Reklam metinleri ve hedeflemeyi incele <ChevronDown size={14}/></summary><div>{(selected.plan.adGroups || [{ ...selected.plan }]).map((group, index) => <GroupAssets key={index} group={group}/>)}<p className="ads-small">Kampanya genelindeki negatifler: {selected.plan.negativeKeywords.join(" · ") || "Yok"}</p></div></details><div className="ads-record-metadata"><span>Google doğrulaması: {dateTime(selected.validated_at)}</span><span>Oluşturma onayı: {dateTime(selected.approved_at)}</span><span>Yayın onayı: {dateTime(selected.activated_at)}</span></div>{selected.resources && <PolicyStatus planId={selected.id} runs={account?.runs || []}/>} {selected.last_error && <p className="ads-inline-error" role="alert">{selected.last_error}</p>}{pendingStatuses.includes(selected.status) && <p className="ads-inline-warning">İşlemin kesin sonucu doğrulanmalı. Yeni kampanya oluşturmayı denemeden önce Google durumunu kontrol edin.</p>}{live && live.id !== selected.id && <p className="ads-small">Bu hesapta başka bir yönetilen plan var. Bu taslağın oluşturulması mevcut planın durumuna göre sunucuda engellenir.</p>}<div className="ads-record-actions">
        {["draft", "validated", "failed", "paused"].includes(selected.status) && <button className="button secondary" disabled={!!busy || !canUseApi} onClick={() => void runAction("validate", selected)}><ShieldCheck size={15}/>{busy === "validate" ? "Doğrulanıyor" : "Google’da doğrula"}</button>}
        {(selected.status === "validated" || selected.status === "paused") && <button className="button primary" disabled={!!busy || !canMutate || (!!live && live.id !== selected.id)} onClick={() => setApproval({ kind: "approve", record: selected })}><Check size={15}/>{selected.status === "paused" ? "Plan onayını yenile" : "Oluşturma onayını incele"}</button>}
        {selected.status === "paused" && <button className="button primary" disabled={!!busy || !canMutate || !account?.config.automationEnabled || !account?.config.monitorReady} onClick={() => setApproval({ kind: "activate", record: selected })}><Play size={15}/> Yayın onayını incele</button>}
        {selected.status === "active" && <><button className="button secondary" disabled={!!busy || !canMutate} onClick={() => void runAction("optimize", selected)}><SlidersHorizontal size={15}/> Bütçeyi şimdi kontrol et</button><button className="button ads-danger" disabled={!!busy || !canMutate} onClick={() => void runAction("pause", selected)}><Pause size={15}/> Duraklat</button></>}
        {(liveStatuses.includes(selected.status) || account?.accountLock?.plan_id === selected.id) && <button className="button secondary" disabled={!!busy || !canUseApi} onClick={() => void runAction("recover", selected)}><RefreshCw size={15}/> Google durumunu kontrol et</button>}
        {selected.status === "paused" && <button className="button ads-danger" disabled={!!busy || !canMutate} onClick={() => setApproval({ kind: "remove", record: selected })}><Trash2 size={14}/> Kampanyayı kaldır</button>}
      </div>{selected.status === "paused" && !account?.config.monitorReady && <p className="ads-inline-warning">Yayına alma için 1–15 dakikalık koruma zamanlayıcısının çalıştığı doğrulanmalı. Son kontrol: {dateTime(account?.config.lastMonitorAt)}.</p>}<p className="ads-small">Google doğrulaması, yayın veya politika onayı garantisi vermez. Reklamların inceleme sonucu ve fiilî yayını Google Ads hesabında kontrol edilmelidir.</p></div>}</div> : <div className="ads-empty"><ClipboardCheck size={31}/><h3>İlk planınız incelemeye hazır olsun.</h3><p>Formu tamamlayıp “Planı incelemeye kaydet” seçeneğini kullanın. Hesapta kampanya oluşturmak ve yayın başlatmak ayrı onaylar gerektirir.</p></div>}
    </section>
    <section className="panel ads-audit"><div className="panel-heading"><div><h2>İşlem geçmişi</h2><p>Onaylar, bütçe kararları ve hesap işlemleri</p></div><span className="pill">{account?.runs.length || 0} kayıt</span></div>{account?.runs.length ? <div className="table-wrap"><table><thead><tr><th>Zaman</th><th>İşlem</th><th>Durum</th><th>Açıklama</th></tr></thead><tbody>{account.runs.map((run, index) => <tr key={run.id || index}><td>{dateTime(run.created_at)}</td><td>{actionLabels[run.action || ""] || run.action || "Otomasyon"}</td><td>{actionLabels[run.status] || run.status}</td><td>{run.error || run.message || auditDescription(run)}</td></tr>)}</tbody></table></div> : <p className="ads-audit-empty">Henüz hesap işlemi yok. Gerçek işlemler ve sonuçları burada kaydedilir.</p>}</section>
    {approval && <ApprovalDialog approval={approval} customerId={approval.kind === "kill" ? account?.config.customerId : approval.record.customer_id} busy={!!busy} onClose={() => setApproval(null)} onConfirm={confirmation => void runAction(approval.kind, approval.kind === "kill" ? undefined : approval.record, confirmation)}/>}
  </div>;
}
