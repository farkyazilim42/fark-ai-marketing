# Google OAuth Branding — kullanıcı onayı bekleyen önizleme

Bu dosya ve yeni public sayfalar 3 Ekim 2026 tarihinde inceleme için hazırlanmıştır. İçerik henüz kullanıcı tarafından onaylanmış veya bu çalışma kapsamında yayımlanmış değildir. Google Cloud ayarlarında değişiklik yapılmamıştır. Google onayı, hukuki uygunluk sertifikası veya doğrulanmış alan adı iddiası değildir.

## İncelenecek sayfalar

| Alan | Hazırlanan yol | İçerik |
| --- | --- | --- |
| Application home page | `/about` | Ürün kapsamı, işletmeci, destek, onay ve bütçe sınırları, politika bağlantıları |
| Application privacy policy | `/privacy` | Google ve hesap verileri, sağlayıcılar, AI/Slack paylaşımı, saklama, erişim iptali ve silme talebi |
| Application terms of service | `/terms` | Hesap yetkileri, plan/yayın onayları, Google politikaları ve maliyet kontrolünün sınırları |

Üç sayfa giriş gerektirmeyen Server Component olarak hazırlanmıştır. Ortak gezinme ve metadata vardır. `/` çalışma alanıdır; OAuth ana sayfası olarak uygulamayı açıklayan `/about` önerilir. Ürün adı **FARK AI Marketing**, kullanıcı bağlamında doğrulanmış işletmeci unvanı **FARK DONANIM VE YAZILIM TEKNOLOJİLERİ SAN. TİC. LTD. ŞTİ.**, destek adresi **kaplans08@gmail.com** olarak kullanılmıştır. Adres, vergi numarası veya abonelik bilgisi eklenmemiştir.

## Onay ve yayın sırası

1. Kullanıcı tanıtım, gizlilik ve kullanım koşulları metinlerini; işletmeci unvanı, destek adresi, mevcut saklama/silme süreci ve isteğe bağlı veri paylaşımlarıyla birlikte inceler ve onaylar.
2. Onaylı değişiklikler kullanıcının ayrıca yetkilendirdiği yayın süreciyle yayımlanır. Bu dosyanın hazırlanması main'e birleştirme veya üretim yayını yetkisi sayılmaz.
3. Kalıcı, işletmeci tarafından kontrol edilen HTTPS alan adı belirlenir. Nihai alan adı ve DNS sahiplik doğrulaması henüz kararlaştırılmış/doğrulanmış değildir. Mevcut hedef `https://fark-ai-marketing.vercel.app` olsa da bu adresin yeni sayfaları yayımladığı veya Google için alan adı sahipliğinin doğrulandığı varsayılmamalıdır. Geçici dağıtım URL'si nihai Branding adresi olarak kullanılmamalıdır.
4. Yayımlanan `/about`, `/privacy`, `/terms` adresleri oturumsuz açılarak doğrulanır. Metinler uygulamadaki erişim ve paylaşım bildirimleriyle tutarlı olmalıdır.
5. Google'ın güncel Branding ve alan adı doğrulama gereklilikleri karşılandıktan sonra **tam yayımlanmış URL'ler** ilgili alanlara girilir. Search Console doğrulaması, Cloud projesinde Owner olan Google hesabıyla **Domain Property / DNS düzeyinde** yapılmalıdır; yalnız URL-prefix doğrulaması yeterli sayılmaz. Mevcut Vercel alt alanının DNS sahipliği bu biçimde doğrulanamıyorsa, işletmecinin DNS kontrolüne sahip olduğu özel alan adı gerekir. Tamamlanmış bir doğrulama varmış gibi bildirilmez.
6. Google yetkilendirmesi, OpenAI/Slack bağlantıları ve reklam otomasyonu bu sayfalar yayımlandı diye açılmaz. Her biri kendi kurulum ve açık işlem onaylarıyla yönetilir.

## Teknik doğruluk notları

- `lib/google.ts`, Ads hesap harcaması ve para birimini; varsa Search Console sorguları/tıklama/gösterim/konum ile GA4 oturum sayısını ortak metrik nesnesine alır. GSC sorguları rapor için kişisel olmayan veri olarak garanti edilemez.
- `lib/report.ts`, bu metrik nesnesinin tamamını OpenAI Responses API'ye rapor üretimi için gönderir. `store:false` veya sıfır saklama düzenlemesi kodda yoktur. Sağlayıcı hesabının saklama/eğitim ayarları depodan doğrulanamaz. Bu nedenle “Google verisi OpenAI'a gitmez”, “tamamı anonimdir”, “OpenAI veriyi hiç saklamaz/eğitimde kullanmaz” garantileri verilmemiştir. Uygulamanın kendisinde model eğitimi, veri satışı, veri aracısı aktarımı veya kişi bazlı yeniden pazarlama profili üretimi kodu yoktur.
- AI raporlarının Ads ayrıntılı plan kopyalarını doğrudan alan bir akışı yoktur; Ads hesap harcaması rapora girer. Haftalık otomasyon aynı analiz akışını kullanır; `scheduled_reports` tablosuna rapor metni ve metrikler kaydedilir.
- Manuel Slack gönderimi kayıtlı rapor metnini kullanıcı onayıyla yollar. Planlı Slack gönderimi ayrıca etkinleştirilirse rapor otomatik aktarılır. Geçmiş gönderiler, uygulama kaydı silindiğinde Slack'ten kaldırılmaz.
- `workspaces`, `report_usage`, `automation_runs`, `scheduled_reports`, `notification_deliveries`, `notification_usage` tablolarında kullanıcıya bağlı cascade silme ilişkileri vardır; kullanıcı arayüzünde tam hesap/veri silme akışı yoktur. Ads planları, işlem günlükleri, kilitler ve izleme sağlığı tabloları için kullanıcı silme cascade'i yoktur. Bağlı Ads kayıtları temizlenmeden kullanıcı silme engellenebilir; operasyon sırası yönetici tarafından ele alınmalıdır.
- Uygulamada plan/rapor/audit verisi için TTL veya otomatik süre sonu silme işi bulunmaz. OAuth iznini kaldırmak ya da uygulamadan çıkış yapmak sunucu kayıtlarını silmez. Yerel taslaklar tarayıcıda kalır. Talep üzerine silme için operasyonel süreç ve uygulanacak saklama süreleri işletmeci tarafından ayrıca kararlaştırılmalıdır; bu metin sabit bir silme süresi uydurmaz.
- Google OAuth yenileme anahtarı ve istemci sırrı sunucu yapılandırmasında kullanılır; Ads plan tablolarına kaydedilmez. Silme talebinde aktif kampanyalar, otomasyon görevleri ve sunucuda tutulan Google yetkisinin de kapsamı belirlenmelidir. Reklamı durdurmadan Google yetkisini kaldırmak çalışan kampanyayı durdurmaz.
- `app/globals.css` Google Fonts kaynağına istek oluşturur. Supabase oturumu ve yerel çalışma alanı tarayıcı depolamasını kullanır. Üçüncü taraf servis günlüğü/yedek saklama ayarları depodan doğrulanamaz.

## Resmi başvurular

- [Google OAuth Branding yapılandırması](https://support.google.com/cloud/answer/15549049?hl=en&ref_topic=15540269)
- [Google alan adı doğrulama gereklilikleri](https://support.google.com/cloud/answer/13804266?hl=en)
- [Google API Services User Data Policy ve Limited Use](https://developers.google.com/terms/api-services-user-data-policy)
- [Google Ads günlük bütçe ve fazla yayın](https://support.google.com/google-ads/answer/1704443)
- [Google Ads politikaları](https://support.google.com/adspolicy/answer/6008942)
- [Google Hesabı bağlantı yönetimi](https://myaccount.google.com/connections)

Limited Use beyanı, işletmecinin onayına sunulan veri kullanımı ve aktarım taahhüdüdür; Google'ın uygulamayı doğruladığı iddiası değildir. Veri erişiminde yeni amaç veya paylaşım eklenmeden önce politika ve ilgili kullanıcı bilgilendirmesi/onayı güncellenmelidir.
