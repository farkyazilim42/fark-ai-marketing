/** Money is always integer TRY kuruş. Google Ads average budgets are not hard spend caps. */
export type AdsKeyword = { text: string; matchType: "EXACT" | "PHRASE" };
export type AdsLocation = { id: string; name: string };
export type AdsAdGroup = { name: string; product: string; landingUrl: string; headlines: string[]; descriptions: string[]; keywords: AdsKeyword[]; negativeKeywords: string[] };
export type AdsPlanInput = {
  name: string; product: string; landingUrl: string;
  headlines: string[]; descriptions: string[]; keywords: AdsKeyword[]; negativeKeywords: string[];
  locations: AdsLocation[]; currency: "TRY";
  dailyBudgetMinor: number; minDailyBudgetMinor: number; maxDailyBudgetMinor: number;
  monthlyLimitMinor: number; maxCpcMinor: number; targetCpaMinor: number;
  maxChangePercent: number; minConversions: number; optimizeEnabled: boolean;
  startDate: string; endDate: string;
  adGroups?: AdsAdGroup[];
};
export type AdsPlan = AdsPlanInput;
export type AdsValidationIssue = { field: string; message: string };
export type AdsValidationResult = { ok: true; plan: AdsPlan } | { ok: false; issues: AdsValidationIssue[] };
export const ADS_BUDGET_WARNING = "Google günlük ortalama bütçenin 2 katına kadar harcayabilir. Aylık 30,4 katsayısı ve bütçe değişiklikleri geçerlidir. Raporlama gecikmesi nedeniyle uygulama limiti kesin harcama tavanı değildir.";
const MAX_MONEY_MINOR = 100_000_000_000; // 1bn TRY; multiplication remains safely below Number.MAX_SAFE_INTEGER.
const control = /[\u0000-\u001f\u007f]/;
const count = (value: string) => [...value].length;
const normalized = (value: string) => value.trim().normalize("NFC");
export function validAdsDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validateAdsPlan(input: unknown): AdsValidationResult {
  const issues: AdsValidationIssue[] = [];
  const issue = (field: string, message: string) => { issues.push({ field, message }); };
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, issues: [{ field: "plan", message: "Kampanya parametreleri gerekli." }] };
  const raw = input as Record<string, unknown>;
  const str = (field: string, max: number) => {
    const value = typeof raw[field] === "string" ? normalized(raw[field]) : "";
    if (!value || count(value) > max || control.test(value)) issue(field, `1–${max} karakter uzunluğunda metin girin.`);
    return value;
  };
  const name = str("name", 100); const product = str("product", 80); const landingUrl = str("landingUrl", 2048);
  try {
    const url = new URL(landingUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash || !url.hostname.includes(".") || /^(?:localhost|.*\.localhost|.*\.local|.*\.internal|\[.*\]|\d+(?:\.\d+){3})$/i.test(url.hostname)) throw new Error();
  } catch { issue("landingUrl", "Herkese açık, HTTPS kullanan geçerli açılış sayfası adresi girin."); }
  const texts = (field: string, min: number, max: number, length: number) => {
    if (!Array.isArray(raw[field])) { issue(field, "Metin listesi gerekli."); return []; }
    const values = (raw[field] as unknown[]).map(value => typeof value === "string" ? normalized(value) : "");
    if (values.length < min || values.length > max) issue(field, `${min}–${max} adet metin girin.`);
    if (values.some(value => !value || count(value) > length || control.test(value))) issue(field, `Her metin 1–${length} karakter olmalı.`);
    if (new Set(values.map(value => value.toLocaleLowerCase("tr"))).size !== values.length) issue(field, "Tekrarlanan metinleri kaldırın.");
    return values;
  };
  const headlines = texts("headlines", 3, 15, 30);
  const descriptions = texts("descriptions", 2, 4, 90);
  const negativeKeywords = texts("negativeKeywords", 0, 200, 80);
  const keywords: AdsKeyword[] = [];
  if (!Array.isArray(raw.keywords) || raw.keywords.length < 1 || raw.keywords.length > 200) issue("keywords", "1–200 adet anahtar kelime girin.");
  else for (const value of raw.keywords) {
    const entry = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const text = typeof entry.text === "string" ? normalized(entry.text) : "";
    if (!text || count(text) > 80 || text.split(/\s+/u).length > 10 || control.test(text) || /[\[\]"]/u.test(text) || !["EXACT", "PHRASE"].includes(String(entry.matchType))) issue("keywords", "Anahtar kelime en fazla 80 karakter/10 sözcük olmalı; eşleme TAM veya SIRALI seçilmeli. Köşeli parantez ve tırnak eklemeyin.");
    else keywords.push({ text, matchType: entry.matchType as AdsKeyword["matchType"] });
  }
  if (new Set(keywords.map(k => `${k.matchType}:${k.text.toLocaleLowerCase("tr")}`)).size !== keywords.length) issue("keywords", "Tekrarlanan anahtar kelimeleri kaldırın.");
  if (negativeKeywords.some(text => text.split(/\s+/u).length > 10 || /[\[\]"]/u.test(text))) issue("negativeKeywords", "Negatif kelimeler en fazla 10 sözcük olmalı; eşleme işareti eklemeyin.");
  if (keywords.some(k => negativeKeywords.some(n => k.text.toLocaleLowerCase("tr") === n.toLocaleLowerCase("tr")))) issue("negativeKeywords", "Hedeflenen anahtar kelime aynı zamanda negatif olamaz.");
  const locations: AdsLocation[] = [];
  if (!Array.isArray(raw.locations) || raw.locations.length < 1 || raw.locations.length > 100) issue("locations", "Türkiye geneli veya en az bir doğrulanmış bölge seçin.");
  else for (const value of raw.locations) {
    const entry = value && typeof value === "object" ? value as Record<string, unknown> : {};
    if (typeof entry.id !== "string" || !/^[1-9]\d{0,11}$/.test(entry.id) || typeof entry.name !== "string" || !normalized(entry.name) || count(entry.name) > 200 || control.test(entry.name)) issue("locations", "Geçerli Google bölge kimliği ve adı gerekli.");
    else locations.push({ id: entry.id, name: normalized(entry.name) });
  }
  if (new Set(locations.map(l => l.id)).size !== locations.length) issue("locations", "Tekrarlanan bölgeleri kaldırın.");
  if (locations.some(l => l.id === "2792") && locations.length > 1) issue("locations", "Türkiye geneli seçildiğinde ayrıca şehir seçmeyin.");
  const moneyFields = ["dailyBudgetMinor", "minDailyBudgetMinor", "maxDailyBudgetMinor", "monthlyLimitMinor", "maxCpcMinor", "targetCpaMinor"] as const;
  const money = {} as Pick<AdsPlan, typeof moneyFields[number]>;
  for (const field of moneyFields) {
    const value = raw[field];
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > MAX_MONEY_MINOR) issue(field, "Pozitif, tam kuruş tutarı girin.");
    money[field] = typeof value === "number" ? value : 0;
  }
  if (money.minDailyBudgetMinor > money.dailyBudgetMinor || money.dailyBudgetMinor > money.maxDailyBudgetMinor) issue("dailyBudgetMinor", "Günlük bütçe, alt ve üst bütçe sınırları arasında olmalı.");
  if (money.dailyBudgetMinor * 304 > money.monthlyLimitMinor * 10) issue("monthlyLimitMinor", "Aylık limit en az günlük ortalama bütçenin 30,4 katı olmalı.");
  if (money.maxCpcMinor > money.minDailyBudgetMinor) issue("maxCpcMinor", "TBM üst sınırı minimum günlük bütçeyi aşamaz.");
  if (raw.currency !== "TRY") issue("currency", "Bu çalışma alanı yalnızca TRY hesaplarını destekler.");
  if (!Number.isSafeInteger(raw.maxChangePercent) || Number(raw.maxChangePercent) < 1 || Number(raw.maxChangePercent) > 30) issue("maxChangePercent", "Günlük değişim sınırı %1–30 arasında olmalı.");
  if (!Number.isSafeInteger(raw.minConversions) || Number(raw.minConversions) < 1 || Number(raw.minConversions) > 1000) issue("minConversions", "Minimum dönüşüm sayısı 1–1000 arasında olmalı.");
  if (typeof raw.optimizeEnabled !== "boolean") issue("optimizeEnabled", "Otomatik optimizasyon tercihi gerekli.");
  if (!validAdsDate(raw.startDate)) issue("startDate", "Geçerli başlangıç tarihi gerekli.");
  if (!validAdsDate(raw.endDate)) issue("endDate", "Geçerli bitiş tarihi gerekli.");
  if (validAdsDate(raw.startDate) && validAdsDate(raw.endDate)) {
    if (raw.endDate < raw.startDate) issue("endDate", "Bitiş tarihi başlangıçtan önce olamaz.");
    if (new Date(raw.endDate).getTime() - new Date(raw.startDate).getTime() > 366 * 86400000) issue("endDate", "Bir onay en fazla 366 gün geçerli olabilir.");
  }
  let adGroups: AdsAdGroup[] | undefined;
  if (raw.adGroups !== undefined) {
    if (!Array.isArray(raw.adGroups) || raw.adGroups.length < 1 || raw.adGroups.length > 6) issue("adGroups", "1–6 ürün reklam grubu tanımlayın.");
    else {
      adGroups = [];
      for (const [index, value] of raw.adGroups.entries()) {
        const group = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
        const checked = validateAdsPlan({ ...raw, name: group.name, product: group.product, landingUrl: group.landingUrl, headlines: group.headlines, descriptions: group.descriptions, keywords: group.keywords, negativeKeywords: group.negativeKeywords, adGroups: undefined });
        if (!checked.ok) for (const item of checked.issues) issue(`adGroups.${index}.${item.field}`, item.message);
        else {
          const p = checked.plan;
          if (p.keywords.some(k => negativeKeywords.some(n => n.toLocaleLowerCase("tr") === k.text.toLocaleLowerCase("tr")))) issue(`adGroups.${index}.keywords`, "Grup anahtar kelimesi kampanya negatifleriyle çakışıyor.");
          adGroups.push({ name: p.name, product: p.product, landingUrl: p.landingUrl, headlines: p.headlines, descriptions: p.descriptions, keywords: p.keywords, negativeKeywords: p.negativeKeywords });
        }
      }
      if (new Set(adGroups.map(group => group.name.toLocaleLowerCase("tr"))).size !== adGroups.length) issue("adGroups", "Reklam grubu adları farklı olmalı.");
    }
  }
  if (issues.length) return { ok: false, issues };
  return { ok: true, plan: { name, product, landingUrl, headlines, descriptions, keywords, negativeKeywords, locations, currency: "TRY", ...money,
    maxChangePercent: raw.maxChangePercent as number, minConversions: raw.minConversions as number, optimizeEnabled: raw.optimizeEnabled as boolean, startDate: raw.startDate as string, endDate: raw.endDate as string, ...(adGroups ? { adGroups } : {}) } };
}
/** Canonical key ordering comes from validation; never sign a browser-supplied serialization. */
export function adsPlanCanonicalJson(input: AdsPlan): string {
  const result = validateAdsPlan(input);
  if (!result.ok) throw new Error(result.issues.map(issue => `${issue.field}: ${issue.message}`).join(" "));
  return JSON.stringify(result.plan);
}
export function minorToMicros(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_MONEY_MINOR) throw new Error("Geçersiz kuruş tutarı.");
  return (BigInt(value) * BigInt(10000)).toString();
}
/** Round cost upwards: fractional kuruş must never make spend look smaller. */
export function microsToMinor(value: unknown): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new Error("Google Ads tutarı geçersiz.");
  const result = (BigInt(value) + BigInt(9999)) / BigInt(10000);
  if (result > BigInt(MAX_MONEY_MINOR)) throw new Error("Google Ads tutarı desteklenen sınırı aşıyor.");
  return Number(result);
}
export type AdsPerformance = {
  currentDailyBudgetMinor: number; todaySpendMinor: number; monthSpendMinor: number;
  sevenDayCostMinor: number; sevenDayConversions: number; daysRemainingInMonth: number;
  reportingCurrency: string; accountDate: string; accountTimeZone: string; collectedAt: string;
};
export type AdsBudgetDecision = { action: "KEEP" | "UPDATE_BUDGET" | "PAUSE"; nextDailyBudgetMinor: number; reason: string; warnings: string[]; safety?: boolean };
export function decideAdsBudget(plan: AdsPlan, performance: AdsPerformance, now: Date = new Date()): AdsBudgetDecision {
  const current = performance.currentDailyBudgetMinor;
  const result = (action: AdsBudgetDecision["action"], reason: string, nextDailyBudgetMinor = current, safety = action === "PAUSE"): AdsBudgetDecision => ({ action, nextDailyBudgetMinor, reason, warnings: [ADS_BUDGET_WARNING], safety });
  if (!validateAdsPlan(plan).ok) return result("PAUSE", "Onaylanan kampanya parametreleri geçersiz.", 0);
  const age = now.getTime() - new Date(performance.collectedAt).getTime();
  const amounts = [current, performance.todaySpendMinor, performance.monthSpendMinor, performance.sevenDayCostMinor];
  if (amounts.some(v => !Number.isSafeInteger(v) || v < 0 || v > MAX_MONEY_MINOR) || current < 1 || !Number.isFinite(performance.sevenDayConversions) || performance.sevenDayConversions < 0 || !Number.isSafeInteger(performance.daysRemainingInMonth) || performance.daysRemainingInMonth < 1 || performance.daysRemainingInMonth > 31 || !validAdsDate(performance.accountDate) || !Number.isFinite(age) || age < -60000 || age > 5 * 60000 || performance.reportingCurrency !== plan.currency) return result("PAUSE", "Güncel ve güvenilir hesap/harcama verisi doğrulanamadı.", 0);
  let localDate: string;
  try { localDate = accountLocalDate(now, performance.accountTimeZone); } catch { return result("PAUSE", "Google Ads hesap saat dilimi doğrulanamadı.", 0); }
  if (localDate !== performance.accountDate) return result("PAUSE", "Hesabın yerel günü değişti; harcama yeniden okunmalı.", 0);
  if (performance.accountDate > plan.endDate) return result("PAUSE", "Onaylanan kampanya bitiş tarihi geçti.");
  if (performance.accountDate < plan.startDate) {
    if (current < plan.minDailyBudgetMinor || current > Math.min(plan.maxDailyBudgetMinor, Math.floor(plan.monthlyLimitMinor * 10 / 304)) || performance.todaySpendMinor !== 0 || performance.monthSpendMinor !== 0) return result("PAUSE", "Gelecek tarihli kampanyanın bütçesi veya harcama kaydı onaylı plana uygun değil.");
    return result("KEEP", `Kampanya zamanlandı; Google Ads ${plan.startDate} tarihinde hesabın saat dilimine göre yayına başlayacak.`);
  }
  if (performance.todaySpendMinor > performance.monthSpendMinor) return result("PAUSE", "Günlük ve aylık rapor tutarları tutarsız.");
  if (current > plan.maxDailyBudgetMinor) return result("PAUSE", "Google Ads günlük bütçesi onaylanan üst sınırı aşıyor. Aynı gün yüksek bütçeye bağlı harcama riski nedeniyle tekrar inceleme gerekli.");
  const remaining = plan.monthlyLimitMinor - performance.monthSpendMinor;
  // Budget reductions do not erase Google's highest-budget-today liability. Reserve today's full remaining 2× exposure.
  const reserve = Math.max(0, 2 * Math.max(current, plan.maxDailyBudgetMinor) - performance.todaySpendMinor);
  if (remaining <= reserve) return result("PAUSE", "Aylık limite yaklaşıldı; bugünün olası ek harcaması için güvenli pay kalmadı.");
  if (performance.todaySpendMinor >= 2 * plan.maxDailyBudgetMinor) return result("PAUSE", "Günlük üst bütçenin iki katına ulaşıldı.");
  const monthlyCeiling = Math.floor(plan.monthlyLimitMinor * 10 / 304);
  const pacingCeiling = Math.floor((remaining - reserve) / Math.max(1, performance.daysRemainingInMonth - 1));
  const safeCeiling = Math.min(plan.maxDailyBudgetMinor, monthlyCeiling, pacingCeiling, Math.floor(remaining / 2));
  if (safeCeiling < plan.minDailyBudgetMinor) return result("PAUSE", "Kalan aylık limit minimum günlük bütçeye yeterli değil.");
  // Risk reductions take precedence over the normal percentage change limit.
  if (current > safeCeiling) return result("UPDATE_BUDGET", "Aylık harcama hızını ve bütçe sınırlarını korumak için bütçe azaltıldı.", safeCeiling, true);
  if (current < plan.minDailyBudgetMinor) return result("PAUSE", "Google Ads bütçesi onaylanan alt sınırın altında; tekrar onay gerekli.");
  if (!plan.optimizeEnabled) return result("KEEP", "Performans optimizasyonu kapalı; harcama sınırları izleniyor.");
  if (performance.sevenDayConversions < plan.minConversions || performance.sevenDayCostMinor <= 0) return result("KEEP", "Bütçe optimizasyonu için son 7 tamamlanmış günde yeterli dönüşüm verisi yok.");
  const cpa = performance.sevenDayCostMinor / performance.sevenDayConversions;
  const factor = plan.maxChangePercent / 100;
  const proposed = cpa <= plan.targetCpaMinor * 0.9 ? Math.floor(current * (1 + factor)) : cpa >= plan.targetCpaMinor * 1.1 ? Math.floor(current * (1 - factor)) : current;
  const next = Math.max(plan.minDailyBudgetMinor, Math.min(safeCeiling, proposed));
  if (next === current) return result("KEEP", "Bütçe hedef EBM ve onaylı sınırlar içinde.");
  return result("UPDATE_BUDGET", next > current ? "Dönüşüm maliyeti hedefin altında; bütçe onaylanan oranda artırıldı." : "Dönüşüm maliyeti hedefin üzerinde; bütçe onaylanan oranda azaltıldı.", next);
}
export function accountLocalDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (name: string) => parts.find(part => part.type === name)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function adsDefaultPlan(product = "Mikro Yazılım", scope: "national" | "regional" = "national"): AdsPlan {
  const today = accountLocalDate(new Date(), "Europe/Istanbul");
  const end = new Date(`${today}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 29);
  const templates: Record<string, { path: string; headlines: string[]; descriptions: string[]; terms: string[] }> = {
    "Mikro Jump": { path: "/urunlerimiz/mikro-jump", headlines: ["Mikro Jump Çözümleri", "Muhasebe ve Stok Yönetimi", "Fark Yazılım'dan Teklif Alın"], descriptions: ["Mikro Jump ile muhasebe, stok ve ticari süreçlerinizi tek sistemde yönetin.", "İşletmenize uygun lisans, eğitim ve destek seçenekleri için Fark Yazılım'a ulaşın."], terms: ["mikro jump", "mikro jump bayi", "mikro jump fiyat"] },
    "Mikro Fly": { path: "/urunlerimiz/mikro-fly", headlines: ["Mikro Fly ERP Çözümleri", "Üretim ve Maliyet Yönetimi", "Fark Yazılım ile Tanışın"], descriptions: ["Mikro Fly ile üretim, stok, muhasebe ve maliyet süreçlerinizi birlikte yönetin.", "Firmanıza uygun ERP yapısını görüşmek için Fark Yazılım'dan bilgi ve teklif alın."], terms: ["mikro fly", "mikro fly bayi", "mikro üretim programı"] },
    "Zeus WMS": { path: scope === "regional" ? "/konya-depo-programi" : "/depo-programi", headlines: ["Zeus WMS Depo Yönetimi", "Depo Operasyonlarınızı Yönetin", "Fark Yazılım'dan Bilgi Alın"], descriptions: ["Mal kabul, yerleştirme ve sevkiyat süreçlerini Zeus WMS ile dijital ortamda yönetin.", "Depo iş akışlarınız ve ERP entegrasyonu için Fark Yazılım ile görüşün."], terms: ["zeus wms", "depo yönetim yazılımı", "depo otomasyon sistemi"] },
    "Eryaz B4B": { path: "/cozumlerimiz/eryaz-b2b-b4b", headlines: ["Eryaz B4B Bayi Portalı", "B2B Satış Süreçlerini Yönetin", "Fark Yazılım'dan Teklif Alın"], descriptions: ["Bayi siparişleri, ürün kataloğu ve cari hesap süreçlerini Eryaz B4B ile yönetin.", "Firmanıza uygun B2B yapısı ve ERP entegrasyonu için Fark Yazılım'a ulaşın."], terms: ["eryaz b4b", "b2b bayi portalı", "b2b yazılımı"] }
  };
  const template = templates[product];
  return { name: `${product} | ${scope === "national" ? "Türkiye" : "Bölgesel"}`, product, landingUrl: `https://www.farkyazilim.com${template?.path || "/"}`,
    headlines: template?.headlines ?? ["Mikro Yazılım Çözümleri", "Fark Yazılım ile Tanışın", "Satış, Eğitim ve Destek"],
    descriptions: template?.descriptions ?? ["İşletmenize uygun Mikro Yazılım çözümlerini Fark Yazılım ile değerlendirin.", "ERP, e-dönüşüm ve üretim süreçleri için bilgi ve teklif alın."],
    keywords: (template?.terms ?? ["mikro yazılım", "mikro yazılım bayi"]).map((text, index) => ({ text, matchType: index === 0 ? "PHRASE" : "EXACT" })), negativeKeywords: ["iş ilanı", "staj", "ücretsiz", "crack"],
    locations: scope === "national" ? [{ id: "2792", name: "Türkiye" }] : [], currency: "TRY", dailyBudgetMinor: 30000, minDailyBudgetMinor: 10000, maxDailyBudgetMinor: 50000, monthlyLimitMinor: 1000000,
    maxCpcMinor: 3000, targetCpaMinor: 50000, maxChangePercent: 10, minConversions: 10, optimizeEnabled: false, startDate: today, endDate: end.toISOString().slice(0, 10) };
}
