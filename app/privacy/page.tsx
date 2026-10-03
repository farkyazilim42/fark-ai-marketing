import type { Metadata } from "next";
import PublicInfoPage, { operatorName, supportEmail } from "@/components/public-info-page";

export const metadata: Metadata = {
  title: "Gizlilik Politikası | FARK AI Marketing",
  description: "FARK AI Marketing'in Google verilerine erişimi, veri kullanımı, hizmet sağlayıcıları, saklama ve silme süreçleri."
};

export default function PrivacyPage() {
  return <PublicInfoPage current="privacy" title="Gizlilik Politikası" description="Bu metin, FARK AI Marketing çalışma alanında ve bağlantısı kurulmuş özelliklerde verilerin nasıl işlendiğini açıklar. Bir özelliğin burada açıklanması, o bağlantının hesabınızda etkin olduğu anlamına gelmez.">
    <section>
      <h2>İşletmeci ve iletişim</h2>
      <p>Uygulamanın işletmecisi <strong>{operatorName}</strong>&apos;dir. Veri kullanımı, erişim ve silme talepleriniz için <a href={`mailto:${supportEmail}`}>{supportEmail}</a> adresine yazabilirsiniz. Mesajınıza parola, OAuth erişim anahtarı veya başka gizli kimlik bilgileri eklemeyin.</p>
    </section>
    <section>
      <h2>Erişilen ve kaydedilen veriler</h2>
      <ul>
        <li><strong>Hesap ve çalışma alanı:</strong> giriş için e-posta adresi, kullanıcı kimliği ve oturum bilgileri; sizin girdiğiniz görevler, kampanya taslakları, ürün ve açılış sayfası bilgileri ile kaydedilen raporlar.</li>
        <li><strong>Google Ads:</strong> bağlı reklam hesabının kimliği, adı, para birimi ve saat dilimi; yönetilen kampanyaların, bütçelerin, reklam gruplarının ve reklamların ayarları; anahtar kelimeler, konum hedefleri, yayın ve politika inceleme durumları; harcama, maliyet ve dönüşüm ölçümleri.</li>
        <li><strong>İsteğe bağlı Google analiz bağlantıları:</strong> Search Console üzerinden arama sorguları, tıklamalar, gösterimler ve ortalama konum; Google Analytics üzerinden toplam oturum sayısı. Rapor verileri tarih aralığı ve senkronizasyon zamanı içerir.</li>
        <li><strong>İşlem kayıtları:</strong> değiştirilemez plan kopyaları, onaylanan bütçe sınırları, onay ve işlem zamanları, kampanya kaynak kimlikleri, doğrulama sonuçları, bütçe kararları, hata ve teslimat durumları.</li>
      </ul>
      <p>Google erişimi, yetki verilen hesaplar ve kurulan bağlantılarla sınırlıdır. Bu uygulamanın mevcut bağlantıları Gmail iletilerini, kişileri veya Drive dosyalarını okumaz.</p>
    </section>
    <section>
      <h2>Verileri ne için kullanıyoruz?</h2>
      <p>Veriler; hesabınıza erişimi doğrulamak, çalışma alanını kaydetmek, seçtiğiniz kampanya planlarını doğrulamak ve onayla uygulamak, bütçe ve yayın durumunu izlemek, rapor oluşturmak ve işlemlerin sonucunu takip etmek için kullanılır.</p>
      <p>Kampanya konumları, reklam metinleri ve anahtar kelimeler sizin planınızdan gelir. Uygulama Google&apos;dan alınan verilerden kişi bazlı yeniden pazarlama veya ilgi alanı profili oluşturmaz. Google verilerini satma, veri aracısına gönderme ya da genel amaçlı model eğitimi için veri kümesi oluşturma özelliği bulunmaz.</p>
      <p>Google API&apos;lerinden alınan bilgiler, başka uygulamalara aktarım dahil, Limited Use (Sınırlı Kullanım) gerekliliklerini de içeren <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noreferrer">Google API Services User Data Policy</a> politikasına uygun olarak kullanılır ve aktarılır.</p>
    </section>
    <section>
      <h2>Hizmet sağlayıcıları ve paylaşım</h2>
      <ul>
        <li><strong>Google:</strong> yetkilendirme, reklam hesabı işlemleri ve etkin analiz bağlantılarının veri kaynağıdır. Onayladığınız kampanya, hedefleme ve bütçe değişiklikleri Google Ads&apos;e gönderilir.</li>
        <li><strong>Vercel:</strong> uygulamayı ve sunucu işlemlerini barındırır; bu işlemler sırasında ilgili verileri işler.</li>
        <li><strong>Supabase:</strong> hesap doğrulamasını, çalışma alanı ve rapor kayıtlarını, Ads planlarını ve işlem geçmişini saklar. Erişim, hesap yetkileri ve kullanıcıya bağlı erişim kurallarıyla sınırlandırılır; yetkili işletmeci sunucu işlemlerini yönetir.</li>
        <li><strong>OpenAI — isteğe bağlı AI raporları:</strong> özellik yapılandırılıp rapor oluşturulduğunda pazarlama metrikleri, Google Ads hesap harcaması ve varsa Search Console sorguları OpenAI API&apos;ye gönderilir. Aynı aktarım, etkinleştirilen haftalık AI raporu otomasyonunda da gerçekleşir. AI çıktıları çalışma alanında veya rapor geçmişinde saklanabilir.</li>
        <li><strong>Slack — isteğe bağlı rapor paylaşımı:</strong> rapor metni, yapılandırılan Slack kanalına gönderilir. Manuel gönderimde kullanıcı onayı alınır; planlı gönderim ayrıca etkinleştirilmişse rapor otomatik paylaşılır. Kanal üyeleri rapordaki pazarlama verilerini görebilir.</li>
      </ul>
      <p>AI&apos;a aktarımın amacı istenen raporu üretmektir. OpenAI ve Slack tarafındaki saklama, erişim ve silme işlemleri kullanılan hizmetin koşullarına ve hesap ayarlarına da bağlıdır; uygulama bu hizmetlerde sıfır veri saklama garantisi vermez.</p>
      <p>Sayfaların yazı tipleri Google Fonts üzerinden yüklenir. Tarayıcınız bu hizmete bağlantı kurar. Barındırma, kimlik doğrulama ve yazı tipi hizmetleri istek zamanı, IP adresi ve tarayıcı bilgisi gibi teknik bağlantı verilerini kendi hizmet işlemleri kapsamında işleyebilir.</p>
    </section>
    <section>
      <h2>Saklama ve erişim güvenliği</h2>
      <p>Google OAuth istemci sırrı ve yenileme anahtarı sunucuda tutulur; çalışma alanındaki kampanya planlarına veya tarayıcıya gönderilen yapılandırmaya eklenmez. Uygulama oturumu ise Supabase tarafından yönetilir ve tarayıcıda saklanabilir.</p>
      <p>Giriş yapılmadan hazırlanan yerel görev ve taslaklar tarayıcı depolamasında kalır. Ads plan düzenleyicisindeki taslaklar, giriş yapılmışken de bu tarayıcıda saklanabilir; hesaptan çıkış bunları silmez. Giriş yapılmış çalışma alanı, kaydedilen planlar, raporlar ve işlem kayıtları sunucu tarafında saklanır. Bu kayıtlar için otomatik süre sonu silme uygulanmaz; yetkili silme işlemi yapılana kadar tutulabilirler.</p>
      <p>Erişim sınırlamaları ve işlem kayıtları güvenliği destekler. Hizmet sağlayıcıların günlükleri ve yedekleri ayrıca kendi saklama süreçlerine tabidir; tüm kopyaların anında silindiği taahhüt edilmez.</p>
    </section>
    <section>
      <h2>Google iznini kaldırma ve veri silme</h2>
      <p>Google erişimini <a href="https://myaccount.google.com/connections" rel="noreferrer">Google Hesabınızın bağlantılar bölümünden</a> kaldırabilirsiniz. İzin kaldırıldığında uygulama yeni Google verisi alamaz veya kampanyalarınızda işlem yapamaz. <strong>Bu işlem Google Ads&apos;te yayındaki kampanyaları kendiliğinden durdurmaz.</strong> Reklamları durdurmak istiyorsanız önce Google Ads veya uygulamadaki duraklatma işlemini kullanın ve sonucu kontrol edin.</p>
      <p>Uygulamada saklanan verilerin incelenmesi, düzeltilmesi veya silinmesi için <a href={`mailto:${supportEmail}`}>{supportEmail}</a> adresine, hesap e-postanızı ve talebinizin kapsamını yazarak başvurun. Talep sahibinin hesap yetkisi doğrulanır. Çalışan kampanyaların ve tamamlanmamış işlemlerin güvenli biçimde ele alınması gerekebilir.</p>
      <p>Google iznini kaldırmak, uygulamada daha önce kaydedilmiş verileri silmez. Uygulama kayıtlarının silinmesi de Google Ads&apos;teki kampanyaları, Google&apos;ın hesap geçmişini veya daha önce Slack&apos;e gönderilen rapor kopyalarını otomatik silmez. Bunlar için ilgili hizmette ayrıca işlem gerekir. Yerel taslakları kaldırmak için tarayıcınızdan bu sitenin depolanan verilerini temizleyebilirsiniz.</p>
    </section>
    <section>
      <h2>Politika değişiklikleri</h2>
      <p>Veri kullanımında değişiklik olduğunda bu sayfa güncellenir. Google verileri için yeni bir kullanım veya paylaşım amacı ortaya çıkarsa ilgili özellik kullanılmadan önce kullanıcıya açıklanır ve gerekli izin alınır. Uygulamanın kapsamı için <a href="/about">Uygulama hakkında</a>, kampanya sorumlulukları için <a href="/terms">Kullanım Koşulları</a> sayfasını inceleyebilirsiniz.</p>
    </section>
  </PublicInfoPage>;
}
