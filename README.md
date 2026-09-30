# Fark AI Marketing

Fark Yazılım için SEO ve Google Ads çalışma alanı. Next.js 16, TypeScript, React ve Supabase ile hazırlanmıştır.

## İlk sürümde çalışan özellikler

- Türkçe, mobil uyumlu pazarlama paneli.
- Görev ekleme, tamamlama, filtreleme ve arama.
- Mikro Jump, Mikro Fly, e-Dönüşüm, ERP ve MRP için düzenlenebilir kampanya taslakları.
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
3. Vercel'e `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_ANON_KEY` ekleyin. Anon key RLS koruması altında tarayıcıda kullanılabilir; **service role anahtarı eklemeyin**.
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

## Henüz etkin olmayanlar

- Zamanlanmış haftalık raporlar ve cron.
- Slack'te otomatik rapor/uyarı gönderme ve GitHub/Vercel deploy bildirimleri.
- Google Ads'e kampanya yayınlama veya bütçe değişikliği.
- Web sitesine içerik yayınlama ve çok müşterili SaaS.

Önce Supabase ve Google hesapları doğrulanmalı; ardından zamanlayıcı, bildirim ve canlı değişiklikler için ayrıca uçtan uca kurulum yapılmalı. Bunlar panelde etkinmiş gibi gösterilmez.

## Yerel geliştirme ve doğrulama

Node.js 22 veya 24 önerilir.

```bash
npm ci
npm run test
npm run typecheck
npm run build
npm start
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
