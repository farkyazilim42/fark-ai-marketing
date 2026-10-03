/* Run against a local dev/production server; no Google Ads writes or account credentials. */
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

(async () => {
  const executablePath = process.env.ADS_CHROMIUM_EXECUTABLE || process.env.CHROMIUM_EXECUTABLE_PATH;
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", ...(process.env.ADS_CHROMIUM_ARGS ? JSON.parse(process.env.ADS_CHROMIUM_ARGS) : [])],
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1040 }, locale: "tr-TR" });
    const page = await context.newPage();
    const errors = [];
    const writes = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => { if (request.url().includes("/api/ads") && request.method() === "POST") writes.push(request.url()); });
    await page.goto(process.env.TEST_BASE_URL || "http://localhost:3000", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Google Ads otomasyonu", exact: true }).click();
    await page.getByRole("heading", { name: "Kampanya planlayıcı", exact: true }).waitFor();
    const root = page.locator(".ads-automation");
    const readDraft = () => page.evaluate(() => JSON.parse(localStorage.getItem("fark-ads-draft-v1:local")));
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("fark-ads-draft-v1:local") || "null")?.plan?.adGroups?.length === 4);
    const initial = await readDraft();
    assert.deepEqual(initial.plan.adGroups.map(group => group.product), ["Mikro Jump", "Mikro Fly", "Zeus WMS", "Eryaz B4B"]);
    assert.equal(initial.plan.dailyBudgetMinor, 50_000);
    assert.equal(initial.plan.monthlyLimitMinor, 2_000_000);
    assert.equal(initial.plan.optimizeEnabled, false);
    assert.equal(initial.scope, "regional");
    assert.equal(initial.plan.locations.length, 0, "Konya must be verified through Google, never a guessed ID");
    assert.equal(await root.getByRole("button", { name: "Planı incelemeye kaydet", exact: true }).isDisabled(), true);
    assert.equal(await root.locator(".ads-setup").getAttribute("open"), null);
    await root.getByRole("button", { name: "Taslağı kontrol et", exact: true }).click();
    await root.locator(".ads-validation").getByText(/Hedef bölge/).first().waitFor();

    await root.getByRole("radio", { name: /Türkiye geneli/ }).check();
    await root.getByRole("tab", { name: /Reklam içeriği/ }).click();
    const groupSelect = root.getByRole("combobox", { name: /^Düzenlenen reklam grubu/ });
    await groupSelect.selectOption("1");
    assert.equal(await root.getByRole("textbox", { name: /^Grubun açılış sayfası/ }).inputValue(), "https://www.farkyazilim.com/urunlerimiz/mikro-fly");
    await root.getByRole("textbox", { name: /^Başlık 1 / }).fill("Konya ERP ve Üretim");
    await groupSelect.selectOption("2");
    assert.notEqual(await root.getByRole("textbox", { name: /^Başlık 1 / }).inputValue(), "Konya ERP ve Üretim", "Per-product edits must not leak to other groups");
    await groupSelect.selectOption("1");
    assert.equal(await root.getByRole("textbox", { name: /^Başlık 1 / }).inputValue(), "Konya ERP ve Üretim");
    await root.getByLabel("Yeni anahtar kelimeler", { exact: true }).fill("konya üretim erp\nkonya maliyet yazılımı");
    await root.getByLabel("Yeni anahtar kelime eşleme", { exact: true }).selectOption("EXACT");
    await root.getByRole("button", { name: "Kelimeleri ekle", exact: true }).click();
    assert.ok((await readDraft()).plan.adGroups[1].keywords.some(keyword => keyword.text === "konya üretim erp" && keyword.matchType === "EXACT"));

    await root.getByRole("tab", { name: /Bütçe ve kurallar/ }).click();
    await root.getByLabel("Başlangıç günlük ortalama bütçe", { exact: false }).fill("512.35");
    assert.equal((await readDraft()).plan.dailyBudgetMinor, 51235, "TRY decimals must become integer kuruş");
    await root.getByLabel("Aylık harcama hedefi", { exact: false }).fill("100");
    await root.getByRole("button", { name: "Taslağı kontrol et", exact: true }).click();
    await root.locator(".ads-validation").getByText(/Aylık hedef/).first().waitFor();
    await root.getByLabel("Aylık harcama hedefi", { exact: false }).fill("25000");
    await root.getByRole("checkbox", { name: /Yayın sonrası bütçeyi otomatik yönet/ }).check();
    await root.getByRole("button", { name: "Taslağı kontrol et", exact: true }).click();
    await root.getByRole("status").filter({ hasText: "biçim ve bütçe kontrolleri tamamlandı" }).waitFor();
    const downloading = page.waitForEvent("download");
    await root.getByRole("button", { name: "JSON indir", exact: true }).click();
    const downloaded = await downloading;
    assert.equal(downloaded.suggestedFilename(), "fark-google-ads-plan.json");
    const backup = JSON.parse(await fs.readFile(await downloaded.path(), "utf8"));
    assert.equal(backup.plan.dailyBudgetMinor, 51235);
    assert.equal(backup.plan.currency, "TRY");
    assert.equal(backup.plan.adGroups.length, 4);
    assert.equal(backup.plan.adGroups[1].headlines[0], "Konya ERP ve Üretim");
    assert.equal(backup.plan.optimizeEnabled, true);
    assert.equal("approved_at" in backup.plan, false);

    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Google Ads otomasyonu", exact: true }).click();
    await root.getByRole("tab", { name: /Reklam içeriği/ }).click();
    await root.getByRole("combobox", { name: /^Düzenlenen reklam grubu/ }).selectOption("1");
    assert.equal(await root.getByRole("textbox", { name: /^Başlık 1 / }).inputValue(), "Konya ERP ve Üretim");
    assert.equal((await readDraft()).plan.dailyBudgetMinor, 51235);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const name of [/Hedefleme/, /Reklam içeriği/, /Bütçe ve kurallar/]) {
      await root.getByRole("tab", { name }).click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Mobile overflow in ${name}`);
    }
    if (process.env.TEST_SCREENSHOT_DIR) {
      await fs.mkdir(process.env.TEST_SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({ path: path.join(process.env.TEST_SCREENSHOT_DIR, "ads-mobile-budget.png"), fullPage: true });
      await page.setViewportSize({ width: 1440, height: 1040 });
      await root.getByRole("tab", { name: /Hedefleme/ }).click();
      await page.screenshot({ path: path.join(process.env.TEST_SCREENSHOT_DIR, "ads-desktop-plan.png"), fullPage: true });
    }
    assert.deepEqual(writes, [], "Local drafting never sends a Google Ads write request");
    assert.deepEqual(errors, [], "No browser runtime errors");
    console.log("PASS: 4 product groups, independent edits, verified-region gate, integer money, budget validation, local persistence, JSON export, no live writes, 390px layout.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
