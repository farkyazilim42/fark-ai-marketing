# Fark AI Marketing

Fark Yazılım için SEO ve Google Ads çalışma alanı. Next.js 16, TypeScript, React ve Supabase ile hazırlanmıştır.

## İlk sürümde çalışan özellikler

- Türkçe, mobil uyumlu pazarlama paneli.
- Görev ekleme, düzenleme, silme, tamamlama, filtreleme ve arama.
- Gerçek Search Console sorgularından SEO fırsatları: 20+ gösterim ve 4–20 ortalama konum; tıklama oranı ve tek tuşla görev oluşturma.
- Kampanya taslaklarını Türkçe karakterleri koruyan, elektronik tablo formüllerine karşı korumalı CSV olarak indirme.
- Türkiye saatinde rapor tarihleri, zaman aşımı ve tekrar deneme ekranı. Senkronizasyon/AI raporu sırasında yapılan görev değişiklikleri korunur.
- Mikro Jump, Mikro Fly, e-Dönüşüm, ERP ve MRP için düzenlenebilir ve silinebilir kampanya taslakları.
- Taslak → İnceleme → Onaylandı akışı; onaylar **Google Ads'te yayınlama yapmaz**.
- Yerel tarayıcı kaydı, JSON yedekleme ve geri yükleme.
- Supabase ile e-posta/parola girişi ve kullanıcıya özel bulut kayıtları.
- Sunucudan Search Console sorguları, GA4 oturumları ve Google Ads harcaması okuma.
- Gerçek hesap verilerine dayalı OpenAI raporu, rapor geçmişi ve metin indirme.
- RLS ile veri izolasyonu, sunucuda e-posta izin listesi ve kullanıcı başına saatlik 5 AI rapor limiti.

Hesap bağlantıları kurulmadan görevler ve taslaklar yerel modda çalışır; performans rakamları boş görünür. Entegrasyonların gerçek hesaplarla uçtan uca testi için ilgili hesap erişimleri gerekir.

## Vercel'e ilk yayın

1. GitHub'daki `farkyazilim42/fark-ai-marketing` reposunu içe aktarın.
2. Proje adı: `fark-ai-marketing`. Üretim dalı: `main`.
3. Framework Preset: **Next.js**. Root Directory: `./`.
4. Build Command: `npm run build`. Output Directory: otomatik; değiştirmeyin.
5. Deploy. Ortam değişkenleri olmadan yerel çalışma modu açılır.
6. Gerçek bağlantıları aşağıdaki adımlarla ekleyin ve **Redeploy** yapın. `NEXT_PUBLIC_` değişkenleri derleme sırasında uygulamaya eklenir.

## Supabase: hesap ve bulut kaydı

1. Kendi Supabase projenizi oluşturun. SQL Editor'da `supabase/schema.sql` dosyasını **bir kez** çalıştırın.
2. Auth ayarlarında herkese açık kayıt olmayı kapatın. Çalışacak ekip kullanıcılarını davet edin; e-posta/parola girişini etkinleştirin.
3. Vercel'e `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_ANON_KEY` ekleyin. Anon key RLS koruması altında tarayıcıda kullanılabilir; Normal panel kullanımı service role anahtarı gerektirmez. Haftalık otomasyonun sunucu ayarları aşağıda açıklanmıştır.
4. `ADMIN_EMAILS` değerine Google ve AI kaynaklarına erişecek e-postaları virgülle ayırarak yazın.
5. Redeploy sonrası panelden giriş yapın. Her kullanıcı kendi görev/taslak/rapor alanına sahiptir; ortak ekip alanı bu sürümde yoktur.

Yerel taslaklar hesaba otomatik aktarılmaz. Aktarmak için önce JSON dışa aktarın, giriş yaptıktan sonra Bağlantılar ekranından yedeği yükleyin. Yedek yükleme mevcut çalışma alanı verilerini değiştirir.

## Google veri bağlantısı

Bu ilk sürüm, sunucuda saklanan bir Google OAuth bağlantısını izinli kullanıcılarla paylaşır. Tarayıcıda OAuth kurulum sihirbazı henüz yoktur.

1. Google Cloud projesinde Search Console API, Analytics Data API ve Google Ads API'yi etkinleştirin.
2. OAuth istemcisi ve izin ekranını yapılandırın. İzinler: `https://www.googleapis.com/auth/webmasters.readonly`, `https://www.googleapis.com/auth/analytics.readonly`; Ads kullanılacaksa `https://www.googleapis.com/auth/adwords`.
3. Kendi Google hesabınızla OAuth offline erişimini yetkilendirin ve refresh tokenı alın. Google'ın OAuth Playground aracı kullanılacaksa kendi OAuth istemci bilgilerinizi kullanın. Tokenı veya istemci sırrını sohbette, GitHub'da veya tarayıcıdaki panelde paylaşmayın.
4. Vercel ortam değişkenlerine `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` ekleyin.
5. Search Console'daki mülkün tam adresini `GSC_SITE_URL` olarak girin. URL-prefix için örnek: `https://www.farkyazilim.com/`; domain property kullanılıyorsa `sc-domain:farkyazilim.com`.
6. GA4 sayısal mülk ID'sini `GA4_PROPERTY_ID` olarak girin. Ölçüm ID'si (`G-...`) kullanılmaz.
7. Ads için `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_DEVELOPER_TOKEN`, güncel desteklenen `GOOGLE_ADS_API_VERSION` ve gerekiyorsa `GOOGLE_ADS_LOGIN_CUSTOMER_ID` ekleyin.
8. Redeploy yapıp izinli kullanıcıyla giriş yapın; **SEO analizi → Verileri senkronize et**. Her servisin hata durumu ayrı gösterilir.

`adwords` kapsamı Google tarafından okuma/yazma olarak verilir; bu uygulamada yalnızca rapor okuyan SearchStream isteği vardır. Reklam/bütçe değiştiren endpoint bulunmaz.

## OpenAI raporları

1. `OPENAI_API_KEY` sunucu ortam değişkenini ekleyin. İsterseniz `OPENAI_MODEL` değişkenini ayarlayın; varsayılan `gpt-4.1-mini`.
2. Supabase şeması ve `ADMIN_EMAILS` hazır olmalı. Saatlik 5 rapor sınırı veritabanında uygulanır; başarısız AI denemeleri de bu kotayı tüketir.
3. Gerçek hesap verilerini senkronize edin. **AI raporları → AI raporu oluştur**.
4. İşlem, senkronize pazarlama metriklerini ve arama sorgularını OpenAI'a gönderir. ChatGPT aboneliği API kullanımını karşılamaz.

## Haftalık rapor ve Slack

Kodda haftalık zamanlayıcı, iş geçmişi ve onaylı manuel Slack gönderimi hazırdır; `.env.example` varsayılanında otomasyon ve planlı gönderim kapalıdır. Bağlantılar paneli eksik ayarları ve çalışma geçmişini gösterir.

1. Temel şemadan sonra `supabase/automation.sql` dosyasını SQL Editor'da çalıştırın. Bu ek migration tekrar çalıştırılabilir.
2. Sunucuda `AUTOMATION_USER_ID` değerini raporların sahibi olan Supabase kullanıcısının UUID'si yapın. Kullanıcının e-postası `ADMIN_EMAILS` listesinde bulunmalı.
3. `SUPABASE_SERVICE_ROLE_KEY` yalnızca Vercel sunucu ortamına eklenir. Asla `NEXT_PUBLIC_` önekiyle, tarayıcıya veya GitHub'a koymayın. Otomasyon kullanıcı doğrulaması ve kayıt için bu anahtarı kullanır.
4. `CRON_SECRET` en az 32 karakterlik rastgele bir sır olmalı. Google ve OpenAI ayarlarını tamamlayın. `AUTOMATION_ENABLED=true` ile etkinleştirin.
5. Slack uygulamanızın **Incoming Webhook** bağlantısını `#ai-reports` kanalına bağlayın ve `SLACK_REPORT_WEBHOOK_URL` sunucu değişkenine koyun. Webhook, kendi bağlı kanalına gönderir; `SLACK_REPORT_CHANNEL_NAME` yalnızca paneldeki kanal etiketidir. Bağlı kanalla eşleşmeli.
6. Önce panelde onay vererek haftayı çalıştırın ve gerçek veri raporunu kontrol edin. AI raporları ekranında kaydedilmiş bir rapor **Slack’e gönder** ile ayrıca onaylanabilir. Bildirim endpoint'i yalnızca kullanıcının kayıtlı raporunu kabul eder ve saatlik 10 deneme sınırı uygular.
7. Planlı Slack gönderimi için `AUTOMATION_SLACK_ENABLED=true` ekleyin ve yeniden yayınlayın. `vercel.json` cron'u üretimde pazartesi 06:00 UTC / 09:00 Türkiye saati için ayarlıdır; Hobby planda o saat içinde çalışabilir.

Haftalık kilit kullanıcı/hafta başına bir çalışma kabul eder; eşzamanlı veya tekrarlı çağrılar yeni AI raporu üretmez. Başarısız iş de kilidi korur. Slack teslimat kaydı manuel ve planlı gönderimde ortaktır; aynı raporun ikinci gönderimi engellenir. Zaman aşımı, teslimatın belirsiz olduğu anlamına gelir ve otomatik tekrar gönderilmez. Yeniden denemeden önce iş geçmişini ve Slack kanalını inceleyin; yanlışlıkla yinelenen mesaj oluşturmamak için kayıtları körlemesine silmeyin.

Otomasyon raporları ayrı `scheduled_reports` tablosunda tutulur ve panelde gösterilir. Mevcut görev ve kampanya taslaklarını otomasyon değiştirmez. Veritabanına kaydedilen raporlar JSON dışa aktarmaya dahil edilir.

## Kapsam dışında kalan işlemler

- GitHub/Vercel deploy bildirimleri ve diğer Slack kanallarına otomatik uyarılar.
- Google Ads'e kampanya yayınlama veya bütçe değişikliği.
- Web sitesine içerik yayınlama ve çok müşterili SaaS.

## Yerel geliştirme ve doğrulama

Node.js 22 veya 24 önerilir.

```bash
npm ci
npm run test
npm run typecheck
npm run build
npm start
# Ayrı terminalde, çalışan sunucuya karşı API kontrolleri:
TEST_BASE_URL=http://localhost:3000 node tests/api.test.mjs
```

Gerçek entegrasyonlarla geliştirmek için `.env.example` dosyasını `.env.local` olarak kopyalayın, değerleri güvenli biçimde doldurun. `.env.local` Git'e eklenmez.

## Teknik kaynaklar

- https://nextjs.org/docs/app
- https://supabase.com/docs/guides/auth
- https://developers.google.com/webmaster-tools/v1/searchanalytics/query
- https://developers.google.com/analytics/devguides/reporting/data/v1/basics
- https://developers.google.com/google-ads/api/rest/common/search
- https://developers.google.com/google-ads/api/docs/sunset-dates
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://platform.openai.com/docs/api-reference/responses

## Veri ve güvenlik

API anahtarları yalnızca sunucu ortam değişkenlerinde bulunur. Google/AI API'leri geçerli Supabase oturumu ve `ADMIN_EMAILS` izin listesi olmadan çalışmaz. Kullanıcı verileri RLS ile ayrılır. Yerel mod yalnızca o tarayıcı profiline aittir; paylaşılan bilgisayarlarda hesabınıza giriş yapıp çıkış yapın. JSON yedekleri raporlarınızı ve çalışma alanınızı içerir; güvenli saklayın.

## 3 Ekim 2026 canlı kurulum kontrolü

Üretim durum endpoint’leri kontrol edildi: Supabase, Search Console, GA4, Google Ads ve OpenAI yapılandırması yok; otomasyon ve Slack kapalı. Bu nedenle hesap girişi, gerçek metrikler, AI raporları ve zamanlanmış rapor teslimatı henüz gerçek hesaplarla doğrulanamaz. Üstteki kurulum adımları tamamlanıp yeni yayın yapıldıktan sonra izinli kullanıcıyla giriş, senkronizasyon, AI raporu ve manuel haftalık çalışma sırasıyla doğrulanmalıdır. Anahtarlar ve OAuth tokenları sohbet veya GitHub üzerinden paylaşılmamalıdır.
