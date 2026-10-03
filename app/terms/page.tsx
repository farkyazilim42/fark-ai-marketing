import type { Metadata } from "next";
import PublicInfoPage, { operatorName, supportEmail } from "@/components/public-info-page";

export const metadata: Metadata = {
  title: "Kullanım Koşulları | FARK AI Marketing",
  description: "FARK AI Marketing hesap yetkileri, kampanya onayları, reklam politikaları ve bütçe kontrollerinin kapsamı."
};

export default function TermsPage() {
  return <PublicInfoPage current="terms" title="Kullanım Koşulları" description="Bu koşullar, FARK AI Marketing çalışma alanının kullanımını ve Google Ads işlemlerinde kullanıcı ile uygulamanın sorumluluklarını açıklar.">
    <section>
      <h2>Hizmet ve işletmeci</h2>
      <p>FARK AI Marketing, <strong>{operatorName}</strong> tarafından işletilen bir pazarlama yönetim aracıdır. Kampanya planlama, onayla Google Ads işlemleri, bütçe izleme ve isteğe bağlı analiz raporları sunar. Özellikler, gerekli bağlantıların ve yetkilerin kurulmasına bağlıdır.</p>
      <p>Destek ve kullanım sorularınızı <a href={`mailto:${supportEmail}`}>{supportEmail}</a> adresine iletebilirsiniz. Kişisel verilerin işlenmesi <a href="/privacy">Gizlilik Politikası</a> içinde açıklanır.</p>
    </section>
    <section>
      <h2>Hesap yetkisi ve doğru bilgi</h2>
      <p>Yalnızca sahibi olduğunuz veya yönetmeye yetkili bulunduğunuz hesapları bağlayın. Ekip üyelerine verdiğiniz erişimden, giriş bilgilerinizin korunmasından ve bağlı Google hesabının yetkilerinden sorumlusunuz.</p>
      <p>Ürün bilgilerini, reklam metinlerini, anahtar kelimeleri, konumları, açılış sayfalarını, dönüşüm ölçümünü ve bütçeleri yayın öncesinde kontrol edin. Kullanılan metin ve görseller için gerekli haklara, sunduğunuz ürün veya hizmet için gerekli izinlere sahip olmalısınız.</p>
    </section>
    <section>
      <h2>Plan ve yayın onayları</h2>
      <p>Plan kaydetmek reklam yayını başlatmaz. Google doğrulaması teknik bir kontroldür. İlk açık onay, planı Google Ads&apos;te duraklatılmış kampanya olarak oluşturur. Yayın ve buna bağlı harcama için ayrıca yayın onayı gerekir.</p>
      <p>Yayın onayı; planın hedefleri, tarihleri ve belirtilen bütçe sınırları içinde çalışmasına izin verir. Etkinleştirilen bütçe yönetimi bu sınırlar içinde değişiklik yapabilir. Planın içeriği veya sınırları değişecekse yeni plan ve ilgili onaylar gerekir. Kayıtlı onay, Google&apos;ın reklamı onaylayacağını veya belirli bir tarihte göstereceğini garanti etmez.</p>
    </section>
    <section>
      <h2>Google kuralları ve reklam incelemesi</h2>
      <p>Reklamlarınızın, hedeflenen ülkedeki uygulanabilir kurallara ve <a href="https://support.google.com/adspolicy/answer/6008942" rel="noreferrer">Google Ads politikalarına</a> uygunluğunu sağlamalısınız. Uygulamanın kontrolleri kapsamlı bir hukuki uygunluk incelemesi değildir; bölge seçimi tek başına o bölgedeki tüm reklam kurallarının karşılandığı anlamına gelmez.</p>
      <p>Google reklamları inceleyebilir, kısıtlayabilir veya reddedebilir; hesabın durumu ve Google&apos;ın servis koşulları yayın imkânını etkiler. Google tarafından talep edilen düzeltmelerin ve hesap işlemlerinin tamamlanması kullanıcıya aittir.</p>
    </section>
    <section>
      <h2>Bütçe kontrollerinin kapsamı</h2>
      <p>Google Ads günlük bütçesi ortalama günlük bütçedir. Google&apos;ın kurallarına göre bazı günlerin harcaması belirlenen ortalama günlük bütçeyi aşabilir. Bütçe değişiklikleri faturalandırma sınırlarını etkileyebilir; ayrıntılar için <a href="https://support.google.com/google-ads/answer/1704443" rel="noreferrer">Google&apos;ın günlük bütçe ve fazla yayın açıklamasını</a> inceleyin.</p>
      <p>Uygulama, onaylanan günlük aralık ve aylık hedef doğrultusunda bildirilen harcamayı izler; gerektiğinde bütçeyi azaltmayı veya kampanyayı duraklatmayı dener. Google raporlaması gecikebilir; zamanlayıcı, ağ veya API kesintileri kontrolün ve durdurmanın gecikmesine yol açabilir. <strong>Uygulamadaki aylık sınır, Google&apos;ın faturalandırmasına uygulanan kesin bir harcama tavanı değildir.</strong></p>
      <p>Mevcut sürümün koruması hesap başına tek yönetilen kampanyayı kapsar. Hesaptaki diğer kampanyaların harcamaları bu sınırın dışındadır. Google Ads üzerinden yapılan manuel değişiklikler ve başka araçların işlemleri izleme sonuçlarını etkileyebilir. Toplam hesap harcamasını ve Google faturanızı ayrıca kontrol edin.</p>
    </section>
    <section>
      <h2>Duraklatma ve bağlantıyı kesme</h2>
      <p>Panelden uygulamanın yönettiği kampanyaları duraklatabilirsiniz. Acil durdurma, hesapta bulunan tüm kampanyaları kapsamaz. İşlemin sonucunu panelde ve gerekirse Google Ads&apos;te doğrulayın; bağlantı sorunu olduğunda doğrudan Google Ads üzerinden işlem yapın.</p>
      <p>Google erişim iznini iptal etmek uygulamanın sonraki işlemlerini engeller, fakat Google Ads&apos;te zaten etkin olan kampanyaları durdurmaz. Reklamları sonlandırmak istiyorsanız önce kampanyaları duraklatın. Oluşmuş reklam maliyetleri Google hesabınızda geçerli olmaya devam eder.</p>
    </section>
    <section>
      <h2>Raporlar ve sonuç beklentisi</h2>
      <p>AI raporları yorum ve öneri üretir; hatalı veya eksik olabilir. İş kararlarını vermeden önce kaynak verileri ve önerileri inceleyin. Slack paylaşımını etkinleştirirken raporu görecek kanal üyelerini kontrol edin.</p>
      <p>Uygulama; gösterim, satış, dönüşüm, arama sıralaması, yatırım getirisi veya belirli bir maliyet sonucu vaat etmez. Google, OpenAI ve diğer bağlı hizmetlerin kullanılabilirliği ile kullanım koşulları ilgili özellikleri etkiler.</p>
    </section>
  </PublicInfoPage>;
}
