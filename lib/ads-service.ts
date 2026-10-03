import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";
import { adsPlanCanonicalJson, validateAdsPlan, decideAdsBudget } from "./ads-model";
import type { AdsPlan, AdsPerformance } from "./ads-model";
import * as googleApi from "./ads-google";
import { googleToken } from "./server";

export type AdsStatus = "draft" | "validated" | "creating" | "paused" | "activating" | "active" | "pausing" | "unknown" | "failed" | "removed";
export type AdsResources = { campaignResourceName: string; budgetResourceName: string; adGroupResourceName?: string; adResourceName?: string; googleName: string };
export type AdsPlanRecord = { id: string; user_id: string; customer_id: string; plan: AdsPlan; plan_hash: string; status: AdsStatus; operation_id: string; resources: AdsResources | null; validation?: unknown; validated_at: string | null; approved_at: string | null; activated_at: string | null; last_optimized_local_day: string | null; last_error: string | null; created_at: string; updated_at: string };
export type AdsRun = { id: string; plan_id: string; action: string; status: string; intent: unknown; result: unknown; error: string | null; created_at: string; finished_at: string | null };
export type AdsLock = { customer_id: string; user_id: string; run_id: string; plan_id: string; created_at: string };
export class AdsServiceError extends Error { status: number; issues?: unknown; constructor(message: string, status = 400, issues?: unknown) { super(message); this.status = status; this.issues = issues; } }
const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "ADS_AUTOMATION_USER_ID", "ADMIN_EMAILS", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN", "GOOGLE_ADS_CUSTOMER_ID", "GOOGLE_ADS_API_VERSION"];
export function adsAutomationStatus() {
  const missing = required.filter(key => !process.env[key]);
  const customerId = (process.env.GOOGLE_ADS_CUSTOMER_ID || "").replace(/-/g, "");
  if (customerId && !/^\d{10}$/.test(customerId)) missing.push("GOOGLE_ADS_CUSTOMER_ID (10 rakam)");
  return { ready: missing.length === 0, mutationsEnabled: process.env.ADS_MUTATIONS_ENABLED === "true", automationEnabled: process.env.ADS_AUTOMATION_ENABLED === "true", missing, customerId, ownerConfigured: !!process.env.ADS_AUTOMATION_USER_ID, monitorIntervalMinutes: Number(process.env.ADS_MONITOR_INTERVAL_MINUTES || 0), schedule: "Hesap saat diliminde günde en çok bir bütçe ayarı; 1–15 dakikada bir koruyucu kontrol" };
}
export function hashAdsPlan(plan: AdsPlan) { return createHash("sha256").update(adsPlanCanonicalJson(plan)).digest("hex"); }
export function assertPlanHash(record: AdsPlanRecord, hash: unknown) {
  if (typeof hash !== "string" || hash !== record.plan_hash || hashAdsPlan(record.plan) !== record.plan_hash) throw new AdsServiceError("Plan özeti değişmiş veya onay özeti uyuşmuyor. Planı yeniden açın.", 409);
}
export function requireFreshApproval(record: AdsPlanRecord, now: Date, activation = false) {
  const value = activation ? record.approved_at : record.validated_at;
  const age = value ? now.getTime() - Date.parse(value) : Infinity;
  if (!Number.isFinite(age) || age < 0 || age > 24 * 3600_000) throw new AdsServiceError("Onayın 24 saatlik süresi doldu. Planı yeniden doğrulayıp onaylayın.", 409);
}
function message(error: unknown) { return error instanceof Error ? error.message : "Ads işlemi tamamlanamadı."; }
function assertResources(record: AdsPlanRecord): AdsResources { if (!record.resources?.campaignResourceName || !record.resources.budgetResourceName) throw new AdsServiceError("Kampanya kaynak kaydı eksik; uzlaştırma gerekiyor.", 409); return record.resources; }
function assertOwner(userId: string) { if (!process.env.ADS_AUTOMATION_USER_ID || userId !== process.env.ADS_AUTOMATION_USER_ID) throw new AdsServiceError("Ads otomasyonu için tanımlı hesap sahibiyle giriş yapın.", 403); }

export type AdsStore = {
  get(id: string): Promise<AdsPlanRecord>;
  list(): Promise<{ plans: AdsPlanRecord[]; runs: AdsRun[]; accountLock: AdsLock | null }>;
  insert(record: AdsPlanRecord): Promise<void>;
  claim(record: AdsPlanRecord, runId: string, action: string, expected: AdsStatus[], next: AdsStatus, intent: unknown): Promise<AdsPlanRecord>;
  finish(runId: string, status: "completed" | "failed" | "unknown", result: unknown, error: string | null, patch: Partial<AdsPlanRecord>, release: boolean): Promise<void>;
};
type Account = { customerId: string; currencyCode: string; timeZone: string; manager: boolean; testAccount?: boolean };
type Snapshot = AdsResources & { status: string; currentDailyBudgetMinor: number; currencyCode: string; timeZone: string };
export type AdsGoogle = {
  validate(plan: AdsPlan, operationId: string): Promise<{ account: Account; locations: unknown; warnings: string[] }>;
  create(plan: AdsPlan, operationId: string): Promise<AdsResources>;
  account(): Promise<Account>;
  snapshot(resources: AdsResources): Promise<Snapshot>;
  find(operationId: string): Promise<Snapshot | null>;
  policy(resources: AdsResources): Promise<{ approved: boolean; canServe: boolean; ads: unknown[] }>;
  verify(plan: AdsPlan, operationId: string, resources: AdsResources): Promise<void>;
  performance(resources: AdsResources): Promise<AdsPerformance>;
  budget(resources: AdsResources, amount: number): Promise<unknown>;
  status(resources: AdsResources, status: "ENABLED" | "PAUSED" | "REMOVED"): Promise<unknown>;
};
export function createAdsService(deps: { store: AdsStore; google: AdsGoogle; userId: string; customerId: string; mutationsEnabled: boolean; automationEnabled: boolean; monitorReady?: boolean; now?: () => Date; uuid?: () => string }) {
  const now = deps.now || (() => new Date());
  const uuid = deps.uuid || randomUUID;
  function accountMatches(account: Account, plan: AdsPlan) {
    if (account.customerId !== deps.customerId || account.currencyCode !== plan.currency || account.manager) throw new AdsServiceError("Google Ads hesap kimliği, para birimi veya hesap türü planla uyuşmuyor.", 409);
    try { new Intl.DateTimeFormat("en", { timeZone: account.timeZone }).format(now()); } catch { throw new AdsServiceError("Google Ads hesap saat dilimi doğrulanamadı.", 409); }
  }
  function localDate(timeZone: string) { return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now()); }
  function datesMatch(plan: AdsPlan, timeZone: string) { const day = localDate(timeZone); if (plan.endDate < day) throw new AdsServiceError("Kampanya bitiş tarihi geçmiş. Yeni bir plan oluşturun.", 409); }
  function writesAllowed() { if (!deps.mutationsEnabled) throw new AdsServiceError("Google Ads yazma işlemleri kapalı (ADS_MUTATIONS_ENABLED).", 409); }
  async function load(id: unknown, hash: unknown) { if (typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id)) throw new AdsServiceError("Geçerli plan kimliği gerekli."); const record = await deps.store.get(id); if (record.user_id !== deps.userId || record.customer_id !== deps.customerId) throw new AdsServiceError("Plan bu hesaba ait değil.", 403); assertPlanHash(record, hash); return record; }
  async function withLock(record: AdsPlanRecord, action: string, expected: AdsStatus[], next: AdsStatus, work: (markWrite: () => void) => Promise<{ result: unknown; patch: Partial<AdsPlanRecord>; message: string }>) {
    const runId = uuid();
    const previous = await deps.store.claim(record, runId, action, expected, next, { planHash: record.plan_hash, operationId: record.operation_id, requestedAt: now().toISOString(), priorStatus: record.status, approvedLimits: { min: record.plan.minDailyBudgetMinor, max: record.plan.maxDailyBudgetMinor, monthly: record.plan.monthlyLimitMinor } });
    Object.assign(record, previous); // Use current daily marker after the atomic claim, not a stale pre-lock read.
    let wrote = false;
    try {
      const output = await work(() => { wrote = true; });
      await deps.store.finish(runId, "completed", output.result, null, output.patch, true);
      return { message: output.message, result: output.result, plan: { ...record, ...output.patch, last_error: null, updated_at: now().toISOString() } };
    } catch (error) {
      const text = message(error);
      // Only a typed, parsed Google rejection proves that no mutation was applied.
      const definitelyRejected = error instanceof Error && "definitelyNotApplied" in error && error.definitelyNotApplied === true;
      if (definitelyRejected) wrote = false;
      try { await deps.store.finish(runId, wrote ? "unknown" : "failed", null, text, { status: wrote ? "unknown" : previous.status }, !wrote); }
      catch { throw new AdsServiceError("İşlem sonucu kaydedilemedi. Hesap kilitli bırakıldı; tekrar göndermeden uzlaştırın.", 503); }
      throw new AdsServiceError(wrote ? `${text} Sonuç belirsiz; otomatik tekrar yapılmadı. Hesap kilitli, uzlaştırma gerekli.` : text, wrote ? 409 : error instanceof AdsServiceError ? error.status : 503);
    }
  }
  async function freshValidation(record: AdsPlanRecord) {
    if (record.resources) {
      const account = await deps.google.account(); accountMatches(account, record.plan); datesMatch(record.plan, account.timeZone);
      await deps.google.verify(record.plan, record.operation_id, record.resources);
      return { account, locations: record.plan.locations, warnings: ["Mevcut kampanya Google hesabındaki ayarlarla karşılaştırılarak doğrulandı; yeni kampanya oluşturulmadı."] };
    }
    const validation = await deps.google.validate(record.plan, record.operation_id); accountMatches(validation.account, record.plan); datesMatch(record.plan, validation.account.timeZone); return validation;
  }
  async function snapshot(record: AdsPlanRecord) { const account = await deps.google.account(); accountMatches(account, record.plan); const value = await deps.google.snapshot(assertResources(record)); if (value.currencyCode !== record.plan.currency || value.timeZone !== account.timeZone) throw new AdsServiceError("Kampanya hesap bilgileri uyuşmuyor.", 409); return value; }
  return {
    async plan(input: unknown) {
      const checked = validateAdsPlan(input);
      if (!checked.ok) throw new AdsServiceError("Plan parametrelerini düzeltin.", 400, checked.issues);
      const stamp = now().toISOString();
      const record: AdsPlanRecord = { id: uuid(), user_id: deps.userId, customer_id: deps.customerId, plan: checked.plan, plan_hash: hashAdsPlan(checked.plan), status: "draft", operation_id: uuid(), resources: null, validated_at: null, approved_at: null, activated_at: null, last_optimized_local_day: null, last_error: null, created_at: stamp, updated_at: stamp };
      await deps.store.insert(record);
      return { message: "Değiştirilemez plan kaydedildi. Google doğrulaması ve onay bekleniyor.", plan: record };
    },
    async action(action: string, id: unknown, hash: unknown, confirmation?: unknown): Promise<{ message: string; result?: unknown; plan?: AdsPlanRecord }> {
      const record = await load(id, hash);
      if (action === "recover") {
        const { accountLock, runs } = await deps.store.list();
        if (!accountLock) {
          if (!record.resources) throw new AdsServiceError("Bu planda uzlaştırılacak Google kampanyası yok.", 409);
          return withLock(record, "recover", ["paused", "active", "removed"], record.status, async () => {
            const found = await snapshot(record);
            if (!["ENABLED", "PAUSED", "REMOVED"].includes(found.status)) throw new AdsServiceError("Google kampanya durumu kesinleştirilemedi.", 409);
            const policy = found.status === "REMOVED" ? null : await deps.google.policy(found).catch(() => null);
            return { result: { found, policy, recovered: true }, patch: { resources: found, status: found.status === "ENABLED" ? "active" : found.status === "REMOVED" ? "removed" : "paused" }, message: "Google üzerindeki kampanya durumu eşitlendi." };
          });
        }
        if (accountLock.plan_id !== record.id) throw new AdsServiceError("Hesap kilidi farklı bir plana ait.", 409);
        if (now().getTime() - Date.parse(accountLock.created_at) < 10 * 60_000) throw new AdsServiceError("Devam eden isteğe müdahale etmemek için uzlaştırma 10 dakika sonra kullanılabilir.", 409);
        const abandoned = runs.find(run => run.id === accountLock.run_id);
        if (abandoned?.action === "validate" || abandoned?.action === "recover") {
          // These operations are strictly read-only at Google; an abandoned lock can be safely settled.
          await deps.store.finish(accountLock.run_id, "failed", { recovered: true, readOnly: true }, "Yarım kalan salt okunur kontrol uzlaştırıldı.", { status: record.status }, true);
          return { message: "Yarım kalan salt okunur kontrolün kilidi kaldırıldı. Yeniden doğrulayabilirsiniz.", plan: await deps.store.get(record.id) };
        }
        const account = await deps.google.account(); accountMatches(account, record.plan);
        const found = record.resources ? await snapshot(record) : await deps.google.find(record.operation_id);
        if (!found || !["ENABLED", "PAUSED", "REMOVED"].includes(found.status)) throw new AdsServiceError("Google sonucu kesinleştirilemedi. Kilit korundu; Ads hesabını ve işlem günlüğünü kontrol edin.", 409);
        const policy = found.status === "REMOVED" ? null : await deps.google.policy(found).catch(() => null);
        await deps.store.finish(accountLock.run_id, "completed", { recovered: true, found, policy, reconciledAt: now().toISOString() }, null, { resources: found, last_optimized_local_day: localDate(found.timeZone), status: found.status === "ENABLED" ? "active" : found.status === "REMOVED" ? "removed" : "paused" }, true);
        return { message: "Google hesabı salt okunur sorguyla uzlaştırıldı; kampanya durumu kaydedildi.", result: { found, policy }, plan: await deps.store.get(record.id) };
      }
      if (action === "validate") return withLock(record, action, ["draft", "validated", "paused", "failed"], record.status, async () => {
        const validation = await freshValidation(record);
        return { result: validation, patch: { validation, validated_at: now().toISOString(), status: record.resources ? "paused" : "validated" }, message: "Google Ads validateOnly doğrulaması başarılı. Harcama veya kampanya oluşturulmadı." };
      });
      if (action === "approve") {
        writesAllowed(); requireFreshApproval(record, now());
        return withLock(record, action, ["validated", "paused"], record.resources ? "paused" : "creating", async markWrite => {
          const validation = await freshValidation(record);
          let resources = record.resources;
          if (!resources) { markWrite(); resources = await deps.google.create(record.plan, record.operation_id); }
          else if ((await snapshot(record)).status !== "PAUSED") throw new AdsServiceError("Onay yenilemek için kampanya duraklatılmış olmalı.", 409);
          return { result: { resources, validation }, patch: { status: "paused", resources, validation, validated_at: now().toISOString(), approved_at: now().toISOString() }, message: "Onaylanan kampanya Google Ads hesabında DURAKLATILMIŞ durumda. Yayına almak için ayrı harcama onayı gerekli." };
        });
      }
      if (action === "activate") {
        writesAllowed(); requireFreshApproval(record, now(), true);
        if (!deps.automationEnabled || !deps.monitorReady) throw new AdsServiceError("Otomatik bütçeli yayına geçmek için 1–15 dakikalık çalışan zamanlayıcı ve güncel kontrol kaydı gerekli.", 409);
        if (confirmation !== "REKLAMLARI YAYINA AL") throw new AdsServiceError("Yayına almak için açık harcama onayı gerekli.");
        return withLock(record, action, ["paused"], "activating", async markWrite => {
          const actual = await snapshot(record); datesMatch(record.plan, actual.timeZone);
          await deps.google.verify(record.plan, record.operation_id, assertResources(record));
          if (actual.status !== "PAUSED") throw new AdsServiceError("Google kampanya durumu değişmiş; önce durumu uzlaştırın.", 409);
          if (actual.currentDailyBudgetMinor < record.plan.minDailyBudgetMinor || actual.currentDailyBudgetMinor > record.plan.maxDailyBudgetMinor) throw new AdsServiceError("Ads bütçesi onaylanan sınırların dışında; yayın engellendi.", 409);
          const policy = await deps.google.policy(assertResources(record));
          if (!policy.canServe) throw new AdsServiceError("Tüm reklamların Google politika incelemesi ve onayı tamamlanmalı.", 409);
          const performance = await deps.google.performance(assertResources(record));
          const decision = decideAdsBudget(record.plan, performance, now());
          if (decision.action === "PAUSE") throw new AdsServiceError(`Yayın için bütçe kontrolü başarısız: ${decision.reason}`, 409);
          if (decision.action === "UPDATE_BUDGET" && decision.nextDailyBudgetMinor < actual.currentDailyBudgetMinor) throw new AdsServiceError("Aylık kalan bütçe için mevcut günlük bütçe yüksek. Planı yeni limitlerle yeniden hazırlayın.", 409);
          markWrite(); await deps.google.status(assertResources(record), "ENABLED");
          return { result: { policy, decision }, patch: { status: "active", activated_at: now().toISOString() }, message: "Harcama onayı kaydedildi; Google kampanyası etkinleştirildi. Gösterim, Google reklam incelemesine bağlıdır." };
        });
      }
      if (action === "remove") {
        writesAllowed();
        if (confirmation !== "KAMPANYAYI KALDIR") throw new AdsServiceError("Kalıcı kaldırma için açık onay gerekli.");
        return withLock(record, action, ["paused"], "pausing", async markWrite => {
          const actual = await snapshot(record);
          if (actual.status !== "PAUSED") throw new AdsServiceError("Yalnızca Google üzerinde duraklatılmış kampanya kaldırılabilir.", 409);
          markWrite(); await deps.google.status(assertResources(record), "REMOVED");
          return { result: { status: "REMOVED" }, patch: { status: "removed" }, message: "Kampanya Google Ads hesabından kalıcı olarak kaldırıldı. Yeni planı onaylayabilirsiniz." };
        });
      }
      if (action === "pause") {
        writesAllowed();
        return withLock(record, action, ["active", "paused"], "pausing", async markWrite => {
          const resources = assertResources(record);
          markWrite(); await deps.google.status(resources, "PAUSED");
          return { result: { status: "PAUSED" }, patch: { status: "paused" }, message: "Yönetilen kampanya duraklatıldı." };
        });
      }
      if (action === "optimize") {
        writesAllowed();
        if (!deps.automationEnabled) throw new AdsServiceError("Bütçe izleme otomasyonu kapalı.", 409);
        return withLock(record, action, ["active"], "active", async markWrite => {
          let actual: Snapshot;
          try {
            actual = await snapshot(record);
            if (actual.status === "ENABLED") await deps.google.verify(record.plan, record.operation_id, assertResources(record));
          } catch (error) {
            // A managed campaign with unreadable or changed approved settings must not continue silently.
            const reason = message(error);
            markWrite(); await deps.google.status(assertResources(record), "PAUSED");
            return { result: { action: "PAUSE", reason: `Onaylanan kampanya ayarları doğrulanamadı: ${reason}` }, patch: { status: "paused" }, message: "Kampanya ayarları doğrulanamadığı için güvenlik amacıyla duraklatıldı." };
          }
          if (actual.status !== "ENABLED") return { result: { action: "KEEP", reason: "Google üzerinde duraklatılmış kampanya yeniden açılmadı." }, patch: { status: actual.status === "REMOVED" ? "removed" : "paused" }, message: "Google üzerindeki manuel duraklatma korundu." };
          let performance: AdsPerformance;
          try { performance = await deps.google.performance(assertResources(record)); }
          catch (error) {
            markWrite(); await deps.google.status(assertResources(record), "PAUSED");
            return { result: { action: "PAUSE", reason: `Güncel harcama okunamadı: ${message(error)}` }, patch: { status: "paused" }, message: "Güncel harcama doğrulanamadığı için kampanya duraklatıldı." };
          }
          const decision = decideAdsBudget(record.plan, performance, now());
          const localDay = localDate(actual.timeZone);
          if (performance.accountDate !== localDay || performance.accountTimeZone !== actual.timeZone) { decision.action = "PAUSE"; decision.reason = "Performans verisi hesabın gün ve saat dilimiyle uyuşmuyor."; }
          if (decision.action === "PAUSE") {
            markWrite(); await deps.google.status(assertResources(record), "PAUSED");
            return { result: decision, patch: { status: "paused", last_optimized_local_day: localDay }, message: `Bütçe koruması kampanyayı duraklattı: ${decision.reason}` };
          }
          if (record.last_optimized_local_day === localDay && "safety" in decision && decision.safety === true && decision.action === "UPDATE_BUDGET" && decision.nextDailyBudgetMinor < actual.currentDailyBudgetMinor) {
            markWrite(); await deps.google.status(assertResources(record), "PAUSED");
            return { result: { ...decision, action: "PAUSE", reason: "Günlük bütçe değişikliğinden sonra güvenlik sınırı ihlal edildi; kampanya duraklatıldı." }, patch: { status: "paused" }, message: "Onaylanan bütçe koruması için kampanya duraklatıldı." };
          }
          if (record.last_optimized_local_day === localDay) return { result: { ...decision, action: "KEEP", reason: "Bu hesap gününün bütçe ayarı zaten yapıldı." }, patch: {}, message: "Günlük bütçe değişikliği limiti korundu." };
          if (decision.action === "UPDATE_BUDGET") { markWrite(); await deps.google.budget(assertResources(record), decision.nextDailyBudgetMinor); }
          return { result: decision, patch: { last_optimized_local_day: localDay }, message: decision.reason };
        });
      }
      throw new AdsServiceError("Desteklenmeyen Ads işlemi.");
    }
  };
}

function dbClient() { if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new AdsServiceError("Ads veritabanı bağlantısı yapılandırılmamış.", 503); return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }); }
export function createAdsStore(userId: string, customerId: string): AdsStore {
  const db = dbClient();
  function fail(error: { message?: string; code?: string } | null, context: string) { if (error) { const mappings: Record<string, string> = { ADS_ACCOUNT_LOCKED: "Hesapta devam eden veya sonucu belirsiz işlem var. Önce işlem günlüğünü kontrol edip uzlaştırın.", ADS_ACCOUNT_ALREADY_MANAGED: "Bu hesapta zaten yönetilen bir kampanya var. Tek kampanyalık toplam bütçe koruması nedeniyle yeni kampanya engellendi.", ADS_STATUS_CHANGED: "Plan durumu başka bir işlemle değişti. Listeyi yenileyin.", ADS_HASH_MISMATCH: "Onaylanan plan özeti uyuşmuyor." }; const known = Object.keys(mappings).find(k => error.message?.includes(k)); throw new AdsServiceError(known ? mappings[known] : context, known ? 409 : 503); } }
  return {
    async get(id) { const { data, error } = await db.from("ads_plans").select("*").eq("user_id", userId).eq("customer_id", customerId).eq("id", id).single(); fail(error, "Ads planı okunamadı."); return data as AdsPlanRecord; },
    async list() {
      const [recent, managed, runs, lock] = await Promise.all([
        db.from("ads_plans").select("*").eq("user_id", userId).eq("customer_id", customerId).order("created_at", { ascending: false }).limit(50),
        db.from("ads_plans").select("*").eq("user_id", userId).eq("customer_id", customerId).in("status", ["creating", "paused", "activating", "active", "pausing", "unknown"]),
        db.from("ads_runs").select("*").eq("user_id", userId).eq("customer_id", customerId).order("created_at", { ascending: false }).limit(50),
        db.from("ads_account_locks").select("*").eq("customer_id", customerId).eq("user_id", userId).maybeSingle()
      ]);
      fail(recent.error || managed.error || runs.error || lock.error, "Ads tabloları hazır değil veya okunamıyor. supabase/ads-automation.sql kurulumunu kontrol edin.");
      // Managed campaigns are queried separately: any number of newer drafts must never hide spending from cron/kill.
      const plans = [...new Map([...(recent.data || []), ...(managed.data || [])].map(plan => [plan.id, plan])).values()] as AdsPlanRecord[];
      return { plans, runs: runs.data as AdsRun[], accountLock: lock.data as AdsLock | null };
    },
    async insert(record) { const { error } = await db.from("ads_plans").insert(record); fail(error, "Plan kaydedilemedi; Ads üzerinde işlem yapılmadı."); },
    async claim(record, runId, action, expected, next, intent) { const { data, error } = await db.rpc("ads_claim", { p_user_id: userId, p_customer_id: customerId, p_plan_id: record.id, p_plan_hash: record.plan_hash, p_run_id: runId, p_action: action, p_expected: expected, p_next: next, p_intent: intent }); fail(error, "İşlem kilidi ve onay kaydı oluşturulamadı. Google Ads üzerinde işlem yapılmadı."); return data as AdsPlanRecord; },
    async finish(runId, status, result, error, patch, release) { const { error: dbError } = await db.rpc("ads_finish", { p_customer_id: customerId, p_run_id: runId, p_status: status, p_result: result, p_error: error, p_patch: patch, p_release: release }); fail(dbError, "İşlem sonucu kalıcı olarak kaydedilemedi."); }
  };
}
export async function googleAdsConfig() {
  const status = adsAutomationStatus();
  if (!status.ready) throw new AdsServiceError(`Ads bağlantı ayarları eksik: ${status.missing.join(", ")}`, 503);
  return { customerId: status.customerId, loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/-/g, ""), developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "", accessToken: await googleToken(), apiVersion: process.env.GOOGLE_ADS_API_VERSION };
}
async function ownerVerified(userId: string) {
  assertOwner(userId);
  const { data, error } = await dbClient().auth.admin.getUserById(userId);
  const emails = (process.env.ADMIN_EMAILS || "").split(",").map(x => x.trim().toLowerCase());
  if (error || !data.user?.email || !emails.includes(data.user.email.toLowerCase())) throw new AdsServiceError("Ads hesap sahibi yönetici izin listesinde değil.", 403);
}
export async function adsMonitorStatus(userId: string, customerId: string) {
  const interval = Number(process.env.ADS_MONITOR_INTERVAL_MINUTES || 0);
  const { data, error } = await dbClient().from("ads_monitor_health").select("last_monitor_at,previous_monitor_at").eq("customer_id", customerId).eq("user_id", userId).maybeSingle();
  const lastMonitorAt = !error && data?.last_monitor_at ? data.last_monitor_at as string : null;
  const age = lastMonitorAt ? Date.now() - Date.parse(lastMonitorAt) : Infinity;
  const prior = data?.previous_monitor_at ? Date.parse(data.previous_monitor_at) : NaN;
  const cadence = lastMonitorAt ? Date.parse(lastMonitorAt) - prior : Infinity;
  return { lastMonitorAt, monitorReady: Number.isInteger(interval) && interval >= 1 && interval <= 15 && cadence >= 30_000 && cadence <= (interval + 5) * 60_000 && age >= 0 && age <= (2 * interval + 5) * 60_000 };
}
export async function getAdsState(userId: string) { assertOwner(userId); const config = adsAutomationStatus(); try { return { config: { ...config, ...await adsMonitorStatus(userId, config.customerId) }, ...await createAdsStore(userId, config.customerId).list() }; } catch (error) { return { config, plans: [], runs: [], accountLock: null, databaseError: message(error) }; } }
export async function runAdsAction(userId: string, body: Record<string, unknown>) {
  await ownerVerified(userId);
  const status = adsAutomationStatus();
  if (!/^\d{10}$/.test(status.customerId)) throw new AdsServiceError("Google Ads müşteri numarası yapılandırılmamış.", 503);
  const store = createAdsStore(userId, status.customerId);
  // A saved proposal doesn't need Google credentials; all remote calls are lazy.
  let config: Awaited<ReturnType<typeof googleAdsConfig>> | undefined;
  const cfg = async () => config ||= await googleAdsConfig();
  const google: AdsGoogle = {
    validate: async (plan, id) => googleApi.validateGoogleAdsPlan(await cfg(), plan, id),
    create: async (plan, id) => googleApi.createGoogleAdsCampaign(await cfg(), plan, id),
    account: async () => googleApi.getAdsAccount(await cfg()),
    snapshot: async resources => googleApi.readGoogleAdsCampaign(await cfg(), resources.campaignResourceName),
    find: async id => googleApi.findGoogleAdsCampaign(await cfg(), id),
    policy: async resources => googleApi.readGoogleAdsPolicy(await cfg(), resources.campaignResourceName),
    verify: async (plan, id, resources) => { const config = await cfg(); const actual = await googleApi.readGoogleAdsCampaign(config, resources.campaignResourceName); if (actual.budgetResourceName !== resources.budgetResourceName) throw new AdsServiceError("Kampanyaya bağlı bütçe Google üzerinde değiştirilmiş.", 409); await googleApi.assertGoogleAdsCampaignMatchesPlan(config, actual, plan, id); },
    performance: async resources => googleApi.readGoogleAdsPerformance(await cfg(), resources.campaignResourceName),
    budget: async (resources, amount) => googleApi.updateGoogleAdsBudget(await cfg(), { ...resources, dailyBudgetMinor: amount }),
    status: async (resources, value) => googleApi.setGoogleAdsCampaignStatus(await cfg(), resources.campaignResourceName, value)
  };
  const monitor = body.action === "activate" ? await adsMonitorStatus(userId, status.customerId) : { monitorReady: false };
  const service = createAdsService({ store, google, userId, customerId: status.customerId, mutationsEnabled: status.mutationsEnabled, automationEnabled: status.automationEnabled, monitorReady: monitor.monitorReady });
  if (body.action === "plan") return service.plan(body.plan);
  if (body.action === "kill") {
    if (body.confirmation !== "TÜM YÖNETİLEN REKLAMLARI DURDUR") throw new AdsServiceError("Acil durdurma onayı gerekli.");
    const { plans, accountLock } = await store.list();
    if (accountLock) throw new AdsServiceError("Hesap kilitli. Acil durumda Google Ads panelinden kampanyayı duraklatın, ardından uzlaştırın.", 409);
    const targets = plans.filter(p => p.resources && ["active", "paused"].includes(p.status));
    const results = [];
    for (const plan of targets) results.push(await service.action("pause", plan.id, plan.plan_hash));
    return { message: `${results.length} yönetilen kampanya duraklatıldı.`, result: results };
  }
  return service.action(String(body.action || ""), body.planId, body.planHash, body.confirmation);
}
/** A stale uncertain write must not silently disable spend protection forever.
 * Reconciliation is read-only at Google; the only subsequent write is a separately
 * audited PAUSE. Never retry the original create, enable, remove, or budget update.
 */
export async function runAdsMonitorCycle(
  state: { plans: AdsPlanRecord[]; accountLock: AdsLock | null },
  runAction: (body: Record<string, unknown>) => Promise<{ message: string; plan?: AdsPlanRecord; result?: unknown }>,
  now = new Date()
) {
  if (state.accountLock) {
    const age = now.getTime() - Date.parse(state.accountLock.created_at);
    if (!Number.isFinite(age) || age < 10 * 60_000) return { message: "Hesapta devam eden işlem var; güvenli uzlaştırma süresi bekleniyor.", skipped: true };
    const plan = state.plans.find(candidate => candidate.id === state.accountLock!.plan_id);
    if (!plan) return { message: "Kilitli plan okunamadı. Ads hesabından kampanyayı duraklatıp işlem günlüğünü kontrol edin.", blocked: true, manualReviewRequired: true };
    try {
      const recovered = await runAction({ action: "recover", planId: plan.id, planHash: plan.plan_hash });
      if (!recovered.plan) throw new AdsServiceError("Uzlaştırılan kampanya durumu alınamadı.", 503);
      if (recovered.plan.status === "active") {
        const paused = await runAction({ action: "pause", planId: recovered.plan.id, planHash: recovered.plan.plan_hash });
        return { message: "Belirsiz işlem Google hesabıyla uzlaştırıldı ve kampanya koruyucu olarak duraklatıldı. Yeniden yayın için açık onay gerekir.", recovered: true, paused: true, results: [recovered, paused] };
      }
      return { message: "Belirsiz işlem salt okunur sorguyla uzlaştırıldı. Yeniden yayın veya bütçe işlemi yapılmadı.", recovered: true, paused: false, results: [recovered] };
    } catch (error) {
      // Any failed read/claim stays fail-closed. In particular, never retry the original uncertain mutation.
      return { message: `Uzlaştırma veya koruyucu duraklatma tamamlanamadı: ${message(error)} Ads hesabından durumu kontrol edip gerekirse doğrudan duraklatın.`, blocked: true, manualReviewRequired: true };
    }
  }
  const results = [];
  for (const plan of state.plans.filter(candidate => candidate.status === "active")) results.push(await runAction({ action: "optimize", planId: plan.id, planHash: plan.plan_hash }));
  return { message: "Ads otomasyon kontrolü tamamlandı.", results };
}

export async function runAdsOptimization() {
  const config = adsAutomationStatus();
  if (!config.ready || !config.automationEnabled || !config.mutationsEnabled) throw new AdsServiceError("Ads zamanlayıcısı kapalı veya gerekli bağlantılar eksik.", 409);
  const userId = process.env.ADS_AUTOMATION_USER_ID!;
  await ownerVerified(userId);
  const { error: heartbeatError } = await dbClient().rpc("ads_heartbeat", { p_customer_id: config.customerId, p_user_id: userId });
  if (heartbeatError) throw new AdsServiceError("Zamanlayıcı kontrol kaydı yazılamadı; Ads işlemi yapılmadı.", 503);
  const state = await createAdsStore(userId, config.customerId).list();
  return runAdsMonitorCycle(state, body => runAdsAction(userId, body));
}
