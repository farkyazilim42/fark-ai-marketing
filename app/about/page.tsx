import type { Metadata } from "next";
import PublicInfoPage, { operatorName, supportEmail } from "@/components/public-info-page";

export const metadata: Metadata = {
  title: "Uygulama hakkında | FARK AI Marketing",
  description: "FARK AI Marketing: Google Ads kampanya planları, açık onayla yayın, bütçe izleme ve pazarlama raporları."
};

export default function AboutPage() {
  return <PublicInfoPage current="about" title="Pazarlama operasyonlarınız için tek çalışma alanı" description="FARK AI Marketing, yetkili ekiplerin kendi Google Ads hesapları için kampanya planlamasını, onay süreçlerini ve bütçe takibini yönetmesine yardımcı olur.">
    <section>
      <h2>Uygulamayı kim işletiyor?</h2>
      <p>FARK AI Marketing, <strong>{operatorName}</strong> tarafından işletilir. Ürün ve hesap desteği için <a href={`mailto:${supportEmail}`}>{supportEmail}</a> adresine ulaşabilirsiniz.</p>
      <p>Çalışma alanı, davet edilen ve yetki verilen ekip kullanıcıları içindir. Bu tanıtım sayfası ile gizlilik ve kullanım koşulları sayfalarını giriş yapmadan okuyabilirsiniz.</p>
    </section>
    <section>
      <h2>Google Ads kampanyaları nasıl yönetilir?</h2>
      <ol>
        <li><strong>Planı hazırlayın.</strong> Ürünü, açılış sayfasını, reklam metinlerini, anahtar kelimeleri, Türkiye geneli veya bölgesel hedefleri, tarihleri ve bütçe sınırlarını belirleyin.</li>
        <li><strong>Kontrol edip onaylayın.</strong> Plan, Google Ads bağlantısı üzerinden doğrulanır. İlk açık onay kampanyayı duraklatılmış olarak oluşturur; reklamların yayınlanması için ayrıca yayın onayı gerekir.</li>
        <li><strong>Onaylanan sınırlar içinde izleyin.</strong> İzleme etkin olduğunda harcama, kampanya durumu ve onaylanan ayarlar kontrol edilir. Bütçe, izin verilen aralık ve değişim sınırları içinde düzenlenebilir; güvenlik koşulları gerektiğinde kampanya duraklatılabilir.</li>
      </ol>
      <p>Onaylanan planın hedefleri veya sınırları değiştirilecekse yeni bir plan hazırlanır. Mevcut sürüm, hesap başına tek bir yönetilen kampanyayı destekler; birden fazla ürün bu kampanyadaki ayrı reklam gruplarında yer alabilir.</p>
    </section>
    <section>
      <h2>Kontrol ve görünürlük</h2>
      <p>Panelde planları, onayları ve işlem geçmişini inceleyebilir; uygulamanın yönettiği kampanyaları duraklatabilirsiniz. Acil durdurma, uygulamanın yönettiği reklamlara uygulanır. Hesapta başka araçlarla veya doğrudan Google Ads üzerinden oluşturulan kampanyalar bu bütçe korumasına dahil değildir.</p>
      <p>Bütçe kontrolleri, Google&apos;ın bildirdiği veriler ve izleme aralıklarıyla çalışır. Raporlama gecikmeleri ve Google&apos;ın günlük harcama kuralları nedeniyle kesin bir harcama tavanı veya reklam sonucu garanti edilmez.</p>
    </section>
    <section>
      <h2>İsteğe bağlı analiz ve raporlar</h2>
      <p>İlgili bağlantılar kurulduğunda Search Console arama performansı, Google Analytics oturum sayıları ve Google Ads harcamaları çalışma alanında birleştirilebilir. AI raporu özelliği etkinleştirilip kullanıldığında bu metrikler ve arama sorguları rapor üretimi için OpenAI&apos;a gönderilir. Slack paylaşımı ayrıca yapılandırılır; manuel paylaşım onayla, planlı paylaşım ise etkinleştirilen rapor otomasyonu kapsamında yapılır.</p>
      <p>Hesap bağlantıları, gerekli izinler ve otomasyon kurulumu tamamlanmadan canlı işlemler çalışmaz. Etkin özelliklerin ve eksik bağlantıların durumu çalışma alanında gösterilir.</p>
    </section>
    <section>
      <h2>Verileriniz ve kullanım koşulları</h2>
      <p>Hangi verilere erişildiği, bunların nasıl saklandığı ve silme talebinin nasıl iletileceği <a href="/privacy">Gizlilik Politikası</a> içinde açıklanır. Kampanya sorumlulukları ve bütçe sınırlarının kapsamı için <a href="/terms">Kullanım Koşulları</a> sayfasını inceleyin.</p>
    </section>
  </PublicInfoPage>;
}
