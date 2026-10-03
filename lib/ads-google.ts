import "server-only";
import { ADS_BUDGET_WARNING, accountLocalDate, minorToMicros, microsToMinor, validateAdsPlan, type AdsPlan, type AdsPerformance, type AdsLocation } from "./ads-model";

export type GoogleAdsConfig = { customerId: string; loginCustomerId?: string; developerToken?: string; accessToken: string; apiVersion?: string };
export type GoogleAdsAccount = { customerId: string; currencyCode: string; timeZone: string; name: string; testAccount: boolean; manager: boolean; status: string };
export type GoogleAdsLocation = AdsLocation & { countryCode: string; status: string; targetType: string; canonicalName: string };
export type GoogleAdsResources = { campaignResourceName: string; budgetResourceName: string; adGroupResourceName: string; adResourceName: string; adGroupResourceNames: string[]; adResourceNames: string[]; googleName: string };
export type GoogleAdsSnapshot = GoogleAdsResources & { status: "PAUSED" | "ENABLED" | "REMOVED"; currentDailyBudgetMinor: number; currencyCode: string; timeZone: string; startDate: string; endDate: string; accountDate: string };
export type GoogleAdsPolicy = { approved: boolean; canServe: boolean; ads: { resourceName: string; approvalStatus: string; reviewStatus: string; topics: string[] }[] };
export class GoogleAdsError extends Error {
  readonly ambiguous: boolean;
  readonly status: number;
  readonly requestId: string | null;
  readonly issues: string[];
  readonly definitelyNotApplied: boolean;
  constructor(message: string, options: { ambiguous?: boolean; status?: number; requestId?: string | null; issues?: string[]; definitelyNotApplied?: boolean } = {}) {
    super(message); this.name = "GoogleAdsError"; this.ambiguous = options.ambiguous ?? false; this.status = options.status ?? 0; this.requestId = options.requestId ?? null; this.issues = options.issues ?? []; this.definitelyNotApplied = options.definitelyNotApplied ?? !this.ambiguous;
  }
}
type Json = Record<string, unknown>;
const object = (value: unknown): Json => value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const string = (value: unknown): string => typeof value === "string" ? value : "";
const API_VERSION = "v25";
const cleanCustomer = (value: string) => value.replace(/-/g, "");
function configuration(config: GoogleAdsConfig) {
  const customer = cleanCustomer(config.customerId);
  const login = config.loginCustomerId ? cleanCustomer(config.loginCustomerId) : null;
  if (!/^\d{10}$/.test(customer) || (login && !/^\d{10}$/.test(login))) throw new GoogleAdsError("Geçerli Google Ads müşteri hesabı numarası gerekli.");
  if (!config.accessToken?.trim()) throw new GoogleAdsError("Google Ads OAuth erişimi eksik.");
  const version = config.apiVersion || API_VERSION;
  if (!/^v(?:23|24|25)$/.test(version)) throw new GoogleAdsError("Bu sürüm v23, v24 ve v25 Google Ads API sürümlerini destekler; v25 önerilir.");
  const headers: Record<string, string> = { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" };
  if (login) headers["login-customer-id"] = login;
  // Developer tokens sunset 2026-09-09; OAuth Cloud project access now determines authorization.
  return { customer, version, headers };
}
function resource(config: GoogleAdsConfig, value: string, kind: string): string {
  const customer = configuration(config).customer;
  if (!new RegExp(`^customers/${customer}/${kind}/[1-9]\\d*(?:~[1-9]\\d*)?$`).test(value)) throw new GoogleAdsError("Kaynak bu Google Ads müşteri hesabına ait değil.");
  return value;
}
const quote = (value: string) => `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
function operationKey(id: string): string {
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(id)) throw new GoogleAdsError("Geçerli, benzersiz işlem kimliği gerekli.");
  return `FARK-AI-${id}`;
}
export function googleAdsCampaignName(plan: AdsPlan, operationId: string): string { const prefix = `${operationKey(operationId)} | `; return prefix + [...plan.name].slice(0, 128 - prefix.length).join(""); }
async function post(config: GoogleAdsConfig, endpoint: string, body: unknown, mutation = false): Promise<Json> {
  const c = configuration(config);
  let response: Response;
  try {
    response = await fetch(`https://googleads.googleapis.com/${c.version}/${endpoint}`, { method: "POST", headers: c.headers, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(25000) });
  } catch {
    throw new GoogleAdsError(mutation ? "Google Ads işleminin sonucu belirsiz. Tekrar oluşturmayın; hesapla eşitleyin." : "Google Ads bağlantısı kurulamadı veya zaman aşımına uğradı.", { ambiguous: mutation });
  }
  let data: Json;
  try { data = object(await response.json()); } catch {
    throw new GoogleAdsError("Google Ads yanıtı okunamadı; hesapla eşitleyin.", { status: response.status, ambiguous: mutation, requestId: response.headers.get("request-id") });
  }
  if (!response.ok || data.error || data.partialFailureError) {
    const err = object(data.error || data.partialFailureError);
    const issues = list(err.details).flatMap(detail => list(object(detail).errors)).map(value => {
      const entry = object(value); const codes = Object.values(object(entry.errorCode)).map(String).join(", ");
      return `${codes}: ${string(entry.message)}`.replace(/[\r\n]/g, " ").slice(0, 400);
    }).slice(0, 10);
    const definitelyNotApplied = !mutation || ([400, 401, 403, 404, 422].includes(response.status) && !!data.error && !data.partialFailureError);
    throw new GoogleAdsError(`Google Ads isteği reddedildi (${response.status}).${issues.length ? ` ${issues.join(" ")}` : " Hesap erişimini ve API yapılandırmasını kontrol edin."}`, { status: response.status, ambiguous: !definitelyNotApplied, definitelyNotApplied, requestId: response.headers.get("request-id"), issues });
  }
  return data;
}
async function search(config: GoogleAdsConfig, query: string): Promise<Json[]> {
  const c = configuration(config); const rows: Json[] = []; let pageToken: string | undefined;
  for (let page = 0; page < 100; page++) {
    const data = await post(config, `customers/${c.customer}/googleAds:search`, { query, ...(pageToken ? { pageToken } : {}) });
    rows.push(...list(data.results).map(object));
    pageToken = string(data.nextPageToken) || undefined;
    if (!pageToken) return rows;
  }
  throw new GoogleAdsError("Google Ads raporu desteklenen sayfa sınırını aştı.");
}
export async function getAdsAccount(config: GoogleAdsConfig): Promise<GoogleAdsAccount> {
  const rows = await search(config, "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.manager, customer.test_account, customer.status FROM customer LIMIT 1");
  if (rows.length !== 1) throw new GoogleAdsError("Google Ads hesabı bulunamadı.");
  const c = object(rows[0].customer);
  const account = { customerId: string(c.id), currencyCode: string(c.currencyCode), timeZone: string(c.timeZone), name: string(c.descriptiveName), manager: c.manager === true, testAccount: c.testAccount === true, status: string(c.status) };
  if (account.customerId !== configuration(config).customer || account.manager || account.currencyCode !== "TRY" || account.status !== "ENABLED") throw new GoogleAdsError("TRY para birimli, etkin bir reklamveren hesabı seçin; yönetici hesabında kampanya oluşturulamaz.");
  try { if (!account.timeZone) throw new Error(); accountLocalDate(new Date(), account.timeZone); } catch { throw new GoogleAdsError("Google Ads hesap saat dilimi doğrulanamadı."); }
  return account;
}
function geo(value: unknown): GoogleAdsLocation {
  const g = object(value);
  return { id: string(g.id), name: string(g.name), countryCode: string(g.countryCode), status: string(g.status), targetType: string(g.targetType), canonicalName: string(g.canonicalName) };
}
export async function lookupAdsLocations(config: GoogleAdsConfig, ids: string[]): Promise<GoogleAdsLocation[]> {
  if (ids.length < 1 || ids.length > 100 || ids.some(id => !/^[1-9]\d{0,11}$/.test(id)) || new Set(ids).size !== ids.length) throw new GoogleAdsError("Bölge kimlikleri geçersiz.");
  const rows = await search(config, `SELECT geo_target_constant.id, geo_target_constant.name, geo_target_constant.canonical_name, geo_target_constant.country_code, geo_target_constant.status, geo_target_constant.target_type FROM geo_target_constant WHERE geo_target_constant.id IN (${ids.join(",")})`);
  const locations = rows.map(row => geo(row.geoTargetConstant));
  if (locations.length !== ids.length || locations.some(location => !ids.includes(location.id) || location.countryCode !== "TR" || location.status !== "ENABLED" || !["Country", "Province", "City", "District", "Region", "County", "State"].includes(location.targetType))) throw new GoogleAdsError("Bölgeler Google Ads tarafından doğrulanamadı. Yalnızca etkin Türkiye bölgeleri kullanılabilir.");
  if (locations.some(location => location.id === "2792" && location.targetType !== "Country")) throw new GoogleAdsError("Türkiye geneli coğrafi hedef doğrulanamadı.");
  return ids.map(id => locations.find(location => location.id === id)!);
}
export async function searchGoogleAdsLocations(config: GoogleAdsConfig, query: string): Promise<GoogleAdsLocation[]> {
  if (query.trim().length < 2 || query.length > 100 || /[\u0000-\u001f]/.test(query)) throw new GoogleAdsError("Bölge araması 2–100 karakter olmalı.");
  const data = await post(config, "geoTargetConstants:suggest", { locale: "tr", countryCode: "TR", locationNames: { names: [query.trim()] } });
  const locations = list(data.geoTargetConstantSuggestions).map(value => geo(object(value).geoTargetConstant));
  return locations.filter((location, index, all) => location.countryCode === "TR" && location.status === "ENABLED" && ["Country", "Province", "City", "District", "Region", "County", "State"].includes(location.targetType) && all.findIndex(other => other.id === location.id) === index).slice(0, 30);
}
export function buildGoogleAdsMutations(config: GoogleAdsConfig, input: AdsPlan, operationId: string): Json[] {
  const validation = validateAdsPlan(input);
  if (!validation.ok) throw new GoogleAdsError(validation.issues.map(issue => `${issue.field}: ${issue.message}`).join(" "));
  const plan = validation.plan; const customer = configuration(config).customer;
  const budget = `customers/${customer}/campaignBudgets/-1`; const campaign = `customers/${customer}/campaigns/-2`;
  const name = googleAdsCampaignName(plan, operationId);
  const operations: Json[] = [
    { campaignBudgetOperation: { create: { resourceName: budget, name: `${name} bütçe`, amountMicros: minorToMicros(plan.dailyBudgetMinor), deliveryMethod: "STANDARD", explicitlyShared: false } } },
    { campaignOperation: { create: { resourceName: campaign, name, status: "PAUSED", advertisingChannelType: "SEARCH", campaignBudget: budget,
      manualCpc: {}, networkSettings: { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false, targetPartnerSearchNetwork: false },
      geoTargetTypeSetting: { positiveGeoTargetType: "PRESENCE", negativeGeoTargetType: "PRESENCE" },
      containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
      startDateTime: `${plan.startDate} 00:00:00`, endDateTime: `${plan.endDate} 23:59:59` } } },
    ...plan.locations.map(location => ({ campaignCriterionOperation: { create: { campaign, location: { geoTargetConstant: `geoTargetConstants/${location.id}` } } } })),
    // Search language criteria were sunset 2026-09-30. Google matches language from Turkish copy and landing pages.
    ...plan.negativeKeywords.map(text => ({ campaignCriterionOperation: { create: { campaign, negative: true, keyword: { text, matchType: "PHRASE" } } } }))
  ];
  const groups = plan.adGroups ?? [{ name: plan.product, product: plan.product, landingUrl: plan.landingUrl, headlines: plan.headlines, descriptions: plan.descriptions, keywords: plan.keywords, negativeKeywords: [] }];
  for (const [index, group] of groups.entries()) {
    const adGroup = `customers/${customer}/adGroups/-${index + 3}`;
    operations.push(
      { adGroupOperation: { create: { resourceName: adGroup, name: group.name, campaign, status: "ENABLED", type: "SEARCH_STANDARD", cpcBidMicros: minorToMicros(plan.maxCpcMinor) } } },
      { adGroupAdOperation: { create: { adGroup, status: "ENABLED", ad: { finalUrls: [group.landingUrl], responsiveSearchAd: { headlines: group.headlines.map(text => ({ text })), descriptions: group.descriptions.map(text => ({ text })) } } } } },
      ...group.keywords.map(keyword => ({ adGroupCriterionOperation: { create: { adGroup, status: "ENABLED", keyword: { text: keyword.text, matchType: keyword.matchType } } } })),
      ...group.negativeKeywords.map(text => ({ adGroupCriterionOperation: { create: { adGroup, negative: true, keyword: { text, matchType: "PHRASE" } } } }))
    );
  }
  return operations;
}
async function mutate(config: GoogleAdsConfig, operations: Json[], validateOnly = false): Promise<Json> {
  const data = await post(config, `customers/${configuration(config).customer}/googleAds:mutate`, { mutateOperations: operations, partialFailure: false, validateOnly, responseContentType: "RESOURCE_NAME_ONLY" }, !validateOnly);
  if (!validateOnly && list(data.mutateOperationResponses).length !== operations.length) throw new GoogleAdsError("Google Ads değişiklik yanıtı eksik. Tekrar göndermeden hesapla eşitleyin.", { ambiguous: true });
  return data;
}
async function checkPlanAccount(config: GoogleAdsConfig, plan: AdsPlan) {
  const checked = validateAdsPlan(plan);
  if (!checked.ok) throw new GoogleAdsError(checked.issues.map(issue => issue.message).join(" "));
  const account = await getAdsAccount(config);
  const today = accountLocalDate(new Date(), account.timeZone);
  if (plan.startDate < today || plan.endDate < today) throw new GoogleAdsError("Kampanya başlangıç tarihi Google Ads hesabının bugünkü tarihinden önce olamaz.");
  const locations = await lookupAdsLocations(config, plan.locations.map(location => location.id));
  return { account, locations };
}
export async function validateGoogleAdsPlan(config: GoogleAdsConfig, plan: AdsPlan, operationId = "validation-preview-0001") {
  const checked = await checkPlanAccount(config, plan);
  await mutate(config, buildGoogleAdsMutations(config, plan, operationId), true);
  return { ...checked, warnings: [ADS_BUDGET_WARNING, "API doğrulaması yayın/politika onayı değildir. Google incelemesi tamamlanınca ayrıca etkinleştirme onayı gerekir."] };
}
export async function createGoogleAdsCampaign(config: GoogleAdsConfig, plan: AdsPlan, operationId: string): Promise<GoogleAdsResources> {
  await checkPlanAccount(config, plan);
  const existing = await findGoogleAdsCampaign(config, operationId);
  if (existing) throw new GoogleAdsError("Bu işlem kimliğiyle kampanya zaten var. Tekrar oluşturmak yerine hesapla eşitleyin.");
  const data = await mutate(config, buildGoogleAdsMutations(config, plan, operationId));
  const results = list(data.mutateOperationResponses).map(object);
  const names = (kind: string) => results.map(result => string(object(result[kind]).resourceName)).filter(Boolean);
  const campaigns = names("campaignResult"); const budgets = names("campaignBudgetResult"); const groups = names("adGroupResult"); const ads = names("adGroupAdResult");
  const expected = plan.adGroups?.length ?? 1;
  if (campaigns.length !== 1 || budgets.length !== 1 || groups.length !== expected || ads.length !== expected) throw new GoogleAdsError("Kampanya oluşturma yanıtı eksik. Tekrar denemeyin; hesapla eşitleyin.", { ambiguous: true });
  try {
    for (const group of groups) resource(config, group, "adGroups");
    for (const ad of ads) resource(config, ad, "adGroupAds");
    return { campaignResourceName: resource(config, campaigns[0], "campaigns"), budgetResourceName: resource(config, budgets[0], "campaignBudgets"), adGroupResourceName: groups[0], adResourceName: ads[0], adGroupResourceNames: groups, adResourceNames: ads, googleName: googleAdsCampaignName(plan, operationId) };
  } catch { throw new GoogleAdsError("Google Ads oluşturma yanıtındaki kaynaklar doğrulanamadı; hesapla eşitleyin.", { ambiguous: true }); }
}
export async function readGoogleAdsCampaign(config: GoogleAdsConfig, campaignResourceName: string): Promise<GoogleAdsSnapshot> {
  resource(config, campaignResourceName, "campaigns");
  const account = await getAdsAccount(config);
  const rows = await search(config, `SELECT campaign.resource_name, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.bidding_strategy_type, campaign.campaign_budget, campaign.start_date_time, campaign.end_date_time, campaign_budget.amount_micros, campaign_budget.explicitly_shared, campaign_budget.reference_count FROM campaign WHERE campaign.resource_name = ${quote(campaignResourceName)}`);
  if (rows.length !== 1) throw new GoogleAdsError("Yönetilen kampanya bulunamadı.");
  const campaign = object(rows[0].campaign); const budget = object(rows[0].campaignBudget);
  if (!/^FARK-AI-[A-Za-z0-9_-]{16,100} \| /.test(string(campaign.name))) throw new GoogleAdsError("Kampanya sahipliği doğrulanamadı.");
  if (campaign.status !== "REMOVED" && (campaign.advertisingChannelType !== "SEARCH" || campaign.biddingStrategyType !== "MANUAL_CPC" || budget.explicitlyShared === true || Number(budget.referenceCount) !== 1)) throw new GoogleAdsError("Kampanya teklif stratejisi veya ayrı bütçe doğrulanamadı. Manuel inceleme gerekli.");
  if (!["ENABLED", "PAUSED", "REMOVED"].includes(string(campaign.status))) throw new GoogleAdsError("Kampanya durumu doğrulanamadı.");
  const adRows = await search(config, `SELECT ad_group.resource_name, ad_group_ad.resource_name FROM ad_group_ad WHERE campaign.resource_name = ${quote(campaignResourceName)} AND ad_group.status != 'REMOVED' AND ad_group_ad.status != 'REMOVED'`);
  const adGroupResourceNames = [...new Set(adRows.map(row => string(object(row.adGroup).resourceName)).filter(Boolean))];
  const adResourceNames = adRows.map(row => string(object(row.adGroupAd).resourceName)).filter(Boolean);
  if (campaign.status !== "REMOVED" && (!adGroupResourceNames.length || !adResourceNames.length)) throw new GoogleAdsError("Yönetilen kampanyanın reklamları bulunamadı.");
  return { campaignResourceName, budgetResourceName: resource(config, string(campaign.campaignBudget), "campaignBudgets"), googleName: string(campaign.name),
    adGroupResourceName: adGroupResourceNames[0] || "", adResourceName: adResourceNames[0] || "", adGroupResourceNames, adResourceNames,
    status: campaign.status as GoogleAdsSnapshot["status"], currentDailyBudgetMinor: microsToMinor(budget.amountMicros ?? (campaign.status === "REMOVED" ? "0" : undefined)), currencyCode: account.currencyCode, timeZone: account.timeZone,
    accountDate: accountLocalDate(new Date(), account.timeZone), startDate: string(campaign.startDateTime).slice(0, 10), endDate: string(campaign.endDateTime).slice(0, 10) };
}
export async function findGoogleAdsCampaign(config: GoogleAdsConfig, operationId: string): Promise<GoogleAdsSnapshot | null> {
  const prefix = operationKey(operationId);
  // GAQL LIKE treats '_' as a wildcard; IDs are matched exactly again before accepting a result.
  const rows = await search(config, `SELECT campaign.resource_name, campaign.name FROM campaign WHERE campaign.name LIKE ${quote(`${prefix} | %`)}`);
  const matches = rows.filter(row => string(object(row.campaign).name).startsWith(`${prefix} | `));
  if (matches.length > 1) throw new GoogleAdsError("İşlem kimliği için birden çok kampanya var. Otomasyon durduruldu; manuel inceleyin.");
  if (!matches.length) return null;
  return readGoogleAdsCampaign(config, string(object(matches[0].campaign).resourceName));
}
/** Verify live settings against the signed plan before activation and every optimizer run. */
export async function assertGoogleAdsCampaignMatchesPlan(config: GoogleAdsConfig, snapshot: GoogleAdsSnapshot, plan: AdsPlan, operationId: string): Promise<void> {
  const campaignResource = resource(config, snapshot.campaignResourceName, "campaigns");
  const fail = () => { throw new GoogleAdsError("Google Ads kampanya ayarları onaylanan plandan farklı. Kampanya duraklatılmalı ve değişiklikler incelenmeli."); };
  if (snapshot.googleName !== googleAdsCampaignName(plan, operationId) || snapshot.startDate !== plan.startDate || snapshot.endDate !== plan.endDate || snapshot.status === "REMOVED") fail();
  const [campaignRows, criteriaRows, groupRows, adRows, keywordRows, groupModifierRows, campaignModifierRows] = await Promise.all([
    search(config, `SELECT campaign.network_settings.target_google_search, campaign.network_settings.target_search_network, campaign.network_settings.target_content_network, campaign.network_settings.target_partner_search_network, campaign.geo_target_type_setting.positive_geo_target_type, campaign.geo_target_type_setting.negative_geo_target_type, campaign.ai_max_setting.enable_ai_max, campaign.tracking_url_template, campaign.final_url_suffix FROM campaign WHERE campaign.resource_name = ${quote(campaignResource)}`),
    search(config, `SELECT campaign_criterion.type, campaign_criterion.negative, campaign_criterion.bid_modifier, campaign_criterion.location.geo_target_constant, campaign_criterion.keyword.text, campaign_criterion.keyword.match_type FROM campaign_criterion WHERE campaign.resource_name = ${quote(campaignResource)} AND campaign_criterion.status != 'REMOVED'`),
    search(config, `SELECT ad_group.resource_name, ad_group.name, ad_group.status, ad_group.type, ad_group.cpc_bid_micros, ad_group.tracking_url_template, ad_group.final_url_suffix FROM ad_group WHERE campaign.resource_name = ${quote(campaignResource)} AND ad_group.status != 'REMOVED'`),
    search(config, `SELECT ad_group.resource_name, ad_group_ad.status, ad_group_ad.ad.type, ad_group_ad.ad.final_urls, ad_group_ad.ad.final_mobile_urls, ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions, ad_group_ad.ad.tracking_url_template, ad_group_ad.ad.final_url_suffix FROM ad_group_ad WHERE campaign.resource_name = ${quote(campaignResource)} AND ad_group.status != 'REMOVED' AND ad_group_ad.status != 'REMOVED'`),
    search(config, `SELECT ad_group.resource_name, ad_group_criterion.status, ad_group_criterion.type, ad_group_criterion.negative, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.cpc_bid_micros, ad_group_criterion.final_urls, ad_group_criterion.final_mobile_urls, ad_group_criterion.tracking_url_template, ad_group_criterion.final_url_suffix FROM ad_group_criterion WHERE campaign.resource_name = ${quote(campaignResource)} AND ad_group.status != 'REMOVED' AND ad_group_criterion.status != 'REMOVED'`),
    search(config, `SELECT ad_group_bid_modifier.bid_modifier FROM ad_group_bid_modifier WHERE campaign.resource_name = ${quote(campaignResource)} AND ad_group.status != 'REMOVED'`),
    search(config, `SELECT campaign_bid_modifier.bid_modifier FROM campaign_bid_modifier WHERE campaign.resource_name = ${quote(campaignResource)}`)
  ]);
  if (campaignRows.length !== 1) fail();
  const campaign = object(campaignRows[0].campaign); const network = object(campaign.networkSettings); const targeting = object(campaign.geoTargetTypeSetting);
  if (network.targetGoogleSearch !== true || network.targetSearchNetwork === true || network.targetContentNetwork === true || network.targetPartnerSearchNetwork === true || targeting.positiveGeoTargetType !== "PRESENCE" || targeting.negativeGeoTargetType !== "PRESENCE" || object(campaign.aiMaxSetting).enableAiMax === true || string(campaign.trackingUrlTemplate) || string(campaign.finalUrlSuffix)) fail();
  const equal = (a: string[], b: string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  const keywordKey = (text: string, matchType: string, negative: boolean) => `${negative ? "-" : "+"}|${matchType}|${text.toLocaleLowerCase("tr")}`;
  const geoIds: string[] = []; const campaignNegatives: string[] = [];
  if (groupModifierRows.some(row => Number(object(row.adGroupBidModifier).bidModifier) !== 1) || campaignModifierRows.some(row => Number(object(row.campaignBidModifier).bidModifier) !== 1)) fail();
  for (const row of criteriaRows) {
    const criterion = object(row.campaignCriterion);
    if (criterion.bidModifier !== undefined && Number(criterion.bidModifier) !== 1) fail();
    if (criterion.type === "LOCATION" && criterion.negative !== true) geoIds.push(string(object(criterion.location).geoTargetConstant));
    else if (criterion.type === "KEYWORD" && criterion.negative === true) { const kw = object(criterion.keyword); campaignNegatives.push(keywordKey(string(kw.text), string(kw.matchType), true)); }
    else fail();
  }
  if (!equal(geoIds, plan.locations.map(location => `geoTargetConstants/${location.id}`)) || !equal(campaignNegatives, plan.negativeKeywords.map(text => keywordKey(text, "PHRASE", true)))) fail();
  const groups = plan.adGroups ?? [{ name: plan.product, product: plan.product, landingUrl: plan.landingUrl, headlines: plan.headlines, descriptions: plan.descriptions, keywords: plan.keywords, negativeKeywords: [] }];
  if (groupRows.length !== groups.length || adRows.length !== groups.length) fail();
  const seen = new Set<string>();
  for (const row of groupRows) {
    const group = object(row.adGroup); const expected = groups.find(candidate => candidate.name === group.name); const id = string(group.resourceName);
    if (!expected || seen.has(string(group.name)) || group.status !== "ENABLED" || group.type !== "SEARCH_STANDARD" || string(group.cpcBidMicros) !== minorToMicros(plan.maxCpcMinor) || string(group.trackingUrlTemplate) || string(group.finalUrlSuffix)) fail();
    if (!expected) return; // TypeScript narrowing after the throwing local guard.
    seen.add(expected.name);
    const matchingAds = adRows.filter(ad => object(ad.adGroup).resourceName === id);
    if (matchingAds.length !== 1) fail();
    const adGroupAd = object(matchingAds[0].adGroupAd); const ad = object(adGroupAd.ad); const rsa = object(ad.responsiveSearchAd);
    const headlines = list(rsa.headlines).map(object); const descriptions = list(rsa.descriptions).map(object);
    if (adGroupAd.status !== "ENABLED" || ad.type !== "RESPONSIVE_SEARCH_AD" || !equal(list(ad.finalUrls).map(String), [expected.landingUrl]) || list(ad.finalMobileUrls).length || !equal(headlines.map(item => string(item.text)), expected.headlines) || !equal(descriptions.map(item => string(item.text)), expected.descriptions) || [...headlines, ...descriptions].some(item => item.pinnedField && item.pinnedField !== "UNSPECIFIED") || string(ad.trackingUrlTemplate) || string(ad.finalUrlSuffix)) fail();
    const actualKeys: string[] = [];
    for (const entry of keywordRows.filter(item => object(item.adGroup).resourceName === id)) {
      const criterion = object(entry.adGroupCriterion); const keyword = object(criterion.keyword);
      if (criterion.type !== "KEYWORD" || (criterion.negative !== true && criterion.status !== "ENABLED") || (criterion.cpcBidMicros && criterion.cpcBidMicros !== "0") || list(criterion.finalUrls).length || list(criterion.finalMobileUrls).length || string(criterion.trackingUrlTemplate) || string(criterion.finalUrlSuffix)) fail();
      actualKeys.push(keywordKey(string(keyword.text), string(keyword.matchType), criterion.negative === true));
    }
    if (!equal(actualKeys, [...expected.keywords.map(keyword => keywordKey(keyword.text, keyword.matchType, false)), ...expected.negativeKeywords.map(text => keywordKey(text, "PHRASE", true))])) fail();
  }
}
function shiftedDate(date: string, days: number): string { const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); }
export async function readGoogleAdsPerformance(config: GoogleAdsConfig, campaignResourceName: string): Promise<AdsPerformance> {
  const snapshot = await readGoogleAdsCampaign(config, campaignResourceName);
  const today = snapshot.accountDate; const monthStart = `${today.slice(0, 7)}-01`; const sevenStart = shiftedDate(today, -7); const yesterday = shiftedDate(today, -1);
  const earliest = monthStart < sevenStart ? monthStart : sevenStart;
  const rows = await search(config, `SELECT segments.date, metrics.cost_micros, metrics.conversions FROM campaign WHERE campaign.resource_name = ${quote(campaignResourceName)} AND segments.date BETWEEN '${earliest}' AND '${today}'`);
  let todayMicros = BigInt(0), monthMicros = BigInt(0), weekMicros = BigInt(0), conversions = 0;
  for (const row of rows) {
    const date = string(object(row.segments).date); const metric = object(row.metrics);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < earliest || date > today) throw new GoogleAdsError("Google Ads rapor tarihleri doğrulanamadı.");
    // Protobuf JSON omits fields at their legitimate zero default; never treat an absent campaign as zero spend.
    const cost = metric.costMicros === undefined ? "0" : string(metric.costMicros);
    if (!/^\d+$/.test(cost)) throw new GoogleAdsError("Google Ads maliyet raporu doğrulanamadı.");
    const amount = BigInt(cost); const conversion = Number(metric.conversions ?? 0);
    if (!Number.isFinite(conversion) || conversion < 0) throw new GoogleAdsError("Google Ads dönüşüm raporu doğrulanamadı.");
    if (date === today) todayMicros += amount;
    if (date >= monthStart) monthMicros += amount;
    if (date >= sevenStart && date <= yesterday) { weekMicros += amount; conversions += conversion; }
  }
  const date = new Date(`${today}T00:00:00Z`); const monthDays = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  return { currentDailyBudgetMinor: snapshot.currentDailyBudgetMinor, todaySpendMinor: microsToMinor(todayMicros.toString()), monthSpendMinor: microsToMinor(monthMicros.toString()), sevenDayCostMinor: microsToMinor(weekMicros.toString()), sevenDayConversions: conversions,
    daysRemainingInMonth: monthDays - date.getUTCDate() + 1, reportingCurrency: snapshot.currencyCode, accountDate: today, accountTimeZone: snapshot.timeZone, collectedAt: new Date().toISOString() };
}
export async function readGoogleAdsPolicy(config: GoogleAdsConfig, campaignResourceName: string): Promise<GoogleAdsPolicy> {
  resource(config, campaignResourceName, "campaigns");
  const rows = await search(config, `SELECT ad_group_ad.resource_name, ad_group_ad.status, ad_group_ad.policy_summary.approval_status, ad_group_ad.policy_summary.review_status, ad_group_ad.policy_summary.policy_topic_entries FROM ad_group_ad WHERE campaign.resource_name = ${quote(campaignResourceName)} AND ad_group.status != 'REMOVED' AND ad_group_ad.status != 'REMOVED'`);
  const ads = rows.map(row => { const ad = object(row.adGroupAd); const policy = object(ad.policySummary); return { resourceName: string(ad.resourceName), approvalStatus: string(policy.approvalStatus) || "UNKNOWN", reviewStatus: string(policy.reviewStatus) || "UNKNOWN", topics: list(policy.policyTopicEntries).map(entry => string(object(entry).topic)).filter(Boolean) }; });
  const approved = ads.length > 0 && ads.every(ad => ad.approvalStatus === "APPROVED" && ad.reviewStatus === "REVIEWED");
  return { approved, canServe: approved && rows.every(row => object(row.adGroupAd).status === "ENABLED"), ads };
}
export async function updateGoogleAdsBudget(config: GoogleAdsConfig, input: { campaignResourceName: string; budgetResourceName: string; dailyBudgetMinor: number }): Promise<void> {
  const snapshot = await readGoogleAdsCampaign(config, input.campaignResourceName);
  if (snapshot.status === "REMOVED" || snapshot.budgetResourceName !== resource(config, input.budgetResourceName, "campaignBudgets") || input.dailyBudgetMinor < 1) throw new GoogleAdsError("Yönetilen kampanya bütçesi doğrulanamadı.");
  await mutate(config, [{ campaignBudgetOperation: { update: { resourceName: input.budgetResourceName, amountMicros: minorToMicros(input.dailyBudgetMinor) }, updateMask: "amount_micros" } }]);
}
export async function setGoogleAdsCampaignStatus(config: GoogleAdsConfig, campaignResourceName: string, status: "ENABLED" | "PAUSED" | "REMOVED"): Promise<void> {
  if (!["ENABLED", "PAUSED", "REMOVED"].includes(status)) throw new GoogleAdsError("Kampanya durumu geçersiz.");
  resource(config, campaignResourceName, "campaigns");
  // Caller must supply its persisted owned campaign resource. Emergency pause must work even after external configuration drift.
  if (status === "PAUSED") {
    await mutate(config, [{ campaignOperation: { update: { resourceName: campaignResourceName, status }, updateMask: "status" } }]);
    return;
  }
  if (status === "REMOVED") {
    const rows = await search(config, `SELECT campaign.status FROM campaign WHERE campaign.resource_name = ${quote(campaignResourceName)}`);
    if (rows.length !== 1) throw new GoogleAdsError("Kaldırılacak kampanya bulunamadı.");
    const actual = object(rows[0].campaign).status;
    if (actual === "REMOVED") return;
    if (actual !== "PAUSED") throw new GoogleAdsError("Yalnızca duraklatılmış kampanya kaldırılabilir.");
    await mutate(config, [{ campaignOperation: { remove: campaignResourceName } }]);
    return;
  }
  const snapshot = await readGoogleAdsCampaign(config, campaignResourceName);
  if (snapshot.status === "REMOVED") throw new GoogleAdsError("Kaldırılan kampanya değiştirilemez.");
  if (status === "ENABLED") {
    if (snapshot.status !== "PAUSED") throw new GoogleAdsError("Etkinleştirme için kampanya duraklatılmış olmalı.");
    if (!snapshot.startDate || !snapshot.endDate || snapshot.accountDate > snapshot.endDate) throw new GoogleAdsError("Kampanya tarih aralığı etkinleştirmeye uygun değil.");
    const policy = await readGoogleAdsPolicy(config, campaignResourceName);
    if (!policy.canServe) throw new GoogleAdsError("Tüm reklamların Google politika incelemesi ve onayı tamamlanmalı.");
  }
  if (snapshot.status === status) return;
  await mutate(config, [{ campaignOperation: { update: { resourceName: campaignResourceName, status }, updateMask: "status" } }]);
}
