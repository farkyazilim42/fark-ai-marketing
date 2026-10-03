# Fark AI Marketing — Ads otomasyonu kurulumu ve devreye alma

Bu sürüm Google Arama Ağı kampanyası, ürüne özel reklam grupları, duyarlı arama reklamları, tam/sıralı anahtar kelimeler, negatif kelimeler ve Türkiye/il hedeflemelerini Google Ads API üzerinden oluşturur. Kampanya önce **duraklatılmış** oluşturulur. Gösterim/harcama için panelde ikinci açık onay gerekir.

## Hesap bağlantıları

1. Supabase projesi: mevcut `fark-ai-marketing` projesini kullanın. Temel `schema.sql`, raporlar için `automation.sql`, Ads için `ads-automation.sql` kurulmalıdır. Kullanıcıları davet ederek oluşturun; herkese açık kaydı kapatın. Bu kullanıcı uygulamaya e-posta/parola ile giriş yapar.
2. Vercel Production ortamına `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (modern publishable key de bu değişkene verilebilir), `SUPABASE_SERVICE_ROLE_KEY` ekleyin. Service role yalnızca sunucuda kullanılır. Hesap sahibinin e-postasını `ADMIN_EMAILS`, Supabase UUID'sini `ADS_AUTOMATION_USER_ID` olarak girin.
3. Google Cloud Console'da Google Ads API'yi etkinleştirin ve gerçek hesaba erişecek proje için üretim erişimini tamamlayın. Google'ın 9 Eylül 2026 değişikliği sonrası erişim seviyesi Cloud projesine bağlıdır; eski developer token isteğe bağlıdır.
4. Aynı Cloud projesinde OAuth istemcisi oluşturun. Reklam hesabına yetkili Google kullanıcısıyla `https://www.googleapis.com/auth/adwords` kapsamını offline yetkilendirin. `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` değerlerini Vercel sunucu ortamında saklayın. OAuth uygulaması test modunda bırakılırsa token ömrü kısıtlanabilir; izin ekranını üretime uygun yapılandırın.
5. `GOOGLE_ADS_CUSTOMER_ID` gerçek reklam hesabının 10 haneli kimliğidir; yönetici hesap kimliği değildir. Yönetici hesabı üzerinden erişiliyorsa `GOOGLE_ADS_LOGIN_CUSTOMER_ID` eklenir. `GOOGLE_ADS_API_VERSION=v25` kullanın veya desteklenen sürümü resmi sunset tablosundan kontrol edin. Uygulama TRY para birimini destekler.
6. Teklif/dönüşüm değerlendirmesi için Google Ads hesabındaki gerçek telefon/form dönüşümlerini yapılandırın. Sistem yeterli dönüşüm gözlenmeden performans nedeniyle bütçe artırmaz. Dönüşüm etiketi bu pazarlama paneline değil, reklamın yönlendirdiği web sitesine kurulmalıdır.

**Anahtarları GitHub'a, onay mesajına veya reklam formuna yazmayın.** `.env.local` gitignore kapsamındadır; gerçek sırlar Vercel'in ortam değişkenlerinde saklanır. OpenAI anahtarı rapor analizi içindir; Ads kampanyası oluşturmak için gerekli değildir.

## Zamanlayıcı

Canlı reklamlar 1–15 dakika aralıkla denetlenmelidir. Bütçe performans ayarı hesap saat diliminde günde en çok bir kez yapılır; koruyucu durdurma kontrolleri her çağrıda çalışır.

- **Vercel Pro/uygun plan:** `deployment/vercel-pro.json` içeriğini `vercel.json` olarak kullanın. Ads cron ifadesi `*/15 * * * *` olur. `ADS_MONITOR_INTERVAL_MINUTES=15` ayarlayın.
- **Harici zamanlayıcı:** 15 dakikada bir üretim `/api/cron/ads-optimize` adresine GET gönderin. Sunucudaki en az 32 karakterlik rastgele `CRON_SECRET` değerini zamanlayıcının sır alanına koyun; `Authorization: Bearer <CRON_SECRET>` başlığı kullanın. Sırrı URL'ye koymayın.
- **Varsayılan Hobby yapılandırması:** Depodaki `vercel.json` günlük çağrı yapar; tek başına canlı reklam otomasyonunu açmaya yeterli değildir. Hobby'de 15 dakikalık cron ifadesi kullanmak deploy'u başarısız yapar. Günlük cron, harici zamanlayıcı seçildiğinde silinebilir.

`ADS_MUTATIONS_ENABLED=true` ve `ADS_AUTOMATION_ENABLED=true` değerleri yalnızca hesap, kullanıcı ve scheduler kurulumundan sonra açılır. Bu bayraklar tek başına kampanya oluşturmaz veya harcama başlatmaz. Panelde plan onayı ve yayın onayı ayrıca gerekir. Canlı aktivasyon için sistemin iki gerçek zamanlayıcı çağrısını uygun aralıkta kaydetmiş olması gerekir.

## Onay akışı

1. Ürün reklam grupları, gerçek açılış sayfaları, hedef iller/Türkiye, kelimeler ve bütçe aralığını düzenleyin.
2. Planı kaydedin. Kayıt kimliği ve SHA-256 özetiyle değiştirilemez bir onay kopyası oluşur. Parametre değişikliği yeni plan gerektirir.
3. **Google'da doğrula:** Google `validateOnly` ile kaynak, bölge, hesap, metin ve API doğrulaması yapar; reklam oluşturmaz. Bu kontrol nihai reklam politikası onayı değildir.
4. **Onayla ve duraklatılmış oluştur:** Onay verilen kopyadan tek atomik Google mutate isteğiyle kampanya/bütçe/gruplar/reklamlar/kelimeler oluşturulur.
5. Panelde tam bütçe ve hedefleme özetini inceleyin; **REKLAMLARI YAYINA AL** onayıyla kampanyayı etkinleştirin. Google'ın reklam incelemesi gösterimin başlayıp başlamayacağını ayrıca belirler.
6. İşlem geçmişi, izleyici durumu ve Google politika sonuçlarını kontrol edin. Acil durdurma yönetilen kampanyayı duraklatır. Google panelinde manuel duraklatılmış kampanya otomatik açılmaz.
7. Parametreleri değiştirmek için önce kampanyayı duraklatın; **KAMPANYAYI KALDIR** onayıyla mevcut kampanyayı Google'da kaldırın. Yeni parametrelerle yeni plan kaydedin. Bu kalıcı işlem ayrı onay ister; geçmiş kayıtlar korunur. Süresi geçmiş onaylar, aynı kampanyayı tekrar oluşturmadan yeniden doğrulanıp yenilenebilir.

Gelecek başlangıç tarihi Google tarafında uygulanır. Başlangıç öncesinde performans nedeniyle bütçe artırılmaz; beklenmeyen harcama koruyucu durdurma nedenidir. Bitiş tarihinden sonra kampanya duraklatılır.

Bu kurulum bir Ads hesabında tek yönetilen kampanya ve bu kampanya altında birden fazla ürün reklam grubu kullanır; günlük/aylık örnek tutarlar grupların **toplamı** içindir. Mevcut dış kampanyaların harcamaları bu limite dahil değildir. Uygulama dışı reklamları otomatik değiştirmez.

## Örnek Konya planı — kullanıcı onayı bekliyor

| Parametre | Örnek değer |
|---|---|
| Hedefleme | Konya; Google bölge aramasından doğrulanmış seçim |
| Reklam grupları | Mikro Jump, Mikro Fly, Zeus WMS, Eryaz B2B/B4B |
| İlk ortalama günlük bütçe | Toplam 500 TL |
| Otomatik bütçe aralığı | Toplam 200–600 TL/gün |
| Aylık izleme eşiği | 20.000 TL |
| Maksimum tıklama teklifi | 30 TL |
| Performans değerlendirme hedefi | 300 TL/dönüşüm (garanti değil) |
| Günlük performans değişim sınırı | %10 |
| Artış için asgari 7 günlük dönüşüm | 5 |

Google günlük ortalama bütçeyi bazı günlerde iki katına kadar harcayabilir; 600 TL üst ortalamada 1.200 TL'ye kadar günlük harcama oluşabilir. Bütçe değişiklikleri harcama limitini etkiler; düşürmek aynı günün önceki yüksek bütçesini geri almaz. Google'ın sabit bütçeler için kullandığı 30,4 aylık katsayısı ve uygulamanın kalan bütçe kontrolleri birlikte dikkate alınır. **Raporlama gecikmesi, cron/API kesintisi ve Google faturalama kuralları nedeniyle 20.000 TL eşiği kesin fatura tavanı değildir.** Kesin finansal limit gerekiyorsa hesabın uygun faturalama/hesap bütçesi özelliği Google tarafında ayrıca değerlendirilmelidir.

## Belirsiz sonuç ve müdahale

İşlem niyeti ve hesap kilidi Google isteğinden önce veritabanına kaydedilir. Zaman aşımı veya sonuç kaydı hatasında istek otomatik tekrarlanmaz; hesap kilitli kalır. **Uzlaştır** Google'dan salt okunur sorgu yapar. Sonuç kesinleşmeden ikinci kampanya oluşturulmaz. Devam eden işlemi kesmemek için 10 dakika bekleme uygulanır. Kampanyanın oluşmadığı kesinleştirilemiyorsa kilit elle silinmez. Acil durumda Ads hesabından kampanyayı doğrudan duraklatın; ardından sonucu uzlaştırın.

## Kabul kontrolü

- Birim testleri, API yetki testleri ve üretim derlemesi başarılı olmalı.
- Supabase ads tablolarında RLS açık; authenticated sadece kendi kayıtlarını okuyabilir. Yazma ve RPC çağrıları yalnızca service_role tarafından yapılır.
- Gerçek Google hesabında validateOnly başarılı olmalı; TRY para birimi, müşteri kimliği, saat dilimi ve bölge kimlikleri doğrulanmalı.
- Google test hesabında kampanya PAUSED oluşumu ve tekrar isteğin kopya üretmemesi doğrulanmalı.
- Üretimde canlı yayın yalnızca seçilen tutar ve hedeflerin açık onayından sonra yapılmalı.

### 3 Ekim 2026 teslim doğrulaması

- 60 birim/API testi, TypeScript kontrolü ve üretim derlemesi başarılı.
- Gerçek Chromium ile dört reklam grubunda bağımsız düzenleme, bölge doğrulama kapısı, kuruş hassasiyeti, bütçe hataları, taslak kalıcılığı, JSON dışa aktarımı ve 390 px mobil yerleşim doğrulandı. Testler Ads yazma isteği göndermedi.
- Mevcut Supabase projesine Ads migration uygulandı. Gerçek veritabanında sahipler arası okuma izolasyonu, yetkisiz yazma/RPC engeli, değişmez plan ve eşzamanlı hesap kilidi test edildi; test verileri geri alındı.
- Gerçek Google hesabında doğrulama, duraklatılmış kampanya oluşturma ve harcama testi **henüz yapılmadı**. OAuth/Ads erişimi, yönetici kullanıcı, Vercel ortam değişkenleri ve çalışan sık zamanlayıcı bağlantısı gerekiyor.

## Resmi kaynaklar

- https://developers.google.com/google-ads/api/docs/api-policy/developer-token
- https://developers.google.com/google-ads/api/docs/oauth/overview
- https://developers.google.com/google-ads/api/docs/sunset-dates
- https://developers.google.com/google-ads/api/docs/deprecations
- https://developers.google.com/google-ads/api/docs/mutating/overview
- https://developers.google.com/google-ads/api/samples/validate-ad
- https://support.google.com/google-ads/answer/6385083
- https://support.google.com/google-ads/answer/10487143
- https://vercel.com/docs/cron-jobs/usage-and-pricing
