# Panel girişi ve parola yenileme

Bu uygulamadaki hesap, Supabase yönetim paneline girişte kullanılan hesaptan ayrıdır. Aynı e-posta kullanılsa da parolalar bağımsızdır. Uygulama hesabı Supabase projesinin Authentication → Users bölümünde bulunur.

## Sürümü hazırlama

1. Bu değişikliği içeren sürümü mevcut Vercel projesinde derleyin. Tarayıcı kodu için `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_ANON_KEY` derleme sırasında tanımlı olmalıdır. Publishable key bu ikinci değişkende kullanılabilir; service-role/secret key asla kullanılamaz.
2. Bu projenin mevcut bağlantı değişkenleri yalnızca Production ortamında bulunuyor. Git dalının otomatik Preview derlemesi tek başına bağlı panel değildir. Ana alan adına yayın onayı verilmeden inceleme yapılacaksa Production ortamında **staged** deployment oluşturun; otomatik alan adı atamasını kapalı tutun. Reklam ve otomasyon bayrakları kapalı kalmalıdır.
3. Yeni deployment'ın `/auth/recover` sayfasının açıldığını ve Supabase bağlantısının tanımlı olduğunu doğrulayın. Eski deployment URL'si yeni kodu kendiliğinden almaz.

## Supabase yönlendirme ayarı

Authentication → URL Configuration → Redirect URLs listesine, yeni deployment'ın gerçek adresini kullanarak tam `https://<deployment-host>/auth/recover` adresini ekleyin. Genel `*.vercel.app` izni vermeyin. Üretim alan adı bu sürüme geçirildiğinde ayrıca `https://fark-ai-marketing.vercel.app/auth/recover` adresini ekleyin.

Site URL, yönlendirme izin listesine uymayan isteklerde varsayılan hedeftir; yeni ekranın yerine eski panel veya localhost'a yönlenmemelidir. Recovery e-posta şablonu varsayılan `{{ .ConfirmationURL }}` bağlantısını korumalıdır. Özelleştirilmiş bir şablonda yalnızca Site URL'ye giden bir bağlantı yenileme işlemini tamamlamaz.

Korunan Vercel inceleme sürümlerinde kullanıcı, e-postadaki bağlantıyı açacağı aynı tarayıcıda önce sürüme erişim sağlamalıdır. Geçici paylaşım adresini e-posta yönlendirme listesine koymayın; dağıtımın tam `/auth/recover` adresini kullanın. Kullanıcıların farklı cihazlarda sorunsuz kurtarma yapabilmesi için son kabul testi kararlı üretim adresinde yapılmalıdır.

## Kullanıcının tamamlayacağı işlem

1. Giriş ekranında **Parolamı unuttum** bağlantısını açın ve uygulama hesabının e-postasını girin.
2. **Kurtarma bağlantısı gönder** düğmesini kullanıcı tıklasın. Hesap varlığını açıklamayan bir yanıt gösterilir. E-posta teslimi Supabase'in e-posta sağlayıcısına ve hız limitlerine bağlıdır.
3. Gelen en son e-postadaki bağlantıyı açın. Geçersiz veya süresi dolmuş bağlantıda yeniden bağlantı isteyin.
4. Ekrandaki hesap e-postasını kontrol edin, yeni parolayı ve tekrarını kendiniz girin. Parola veya yenileme bağlantısını sohbete, GitHub'a ya da destek kaydına kopyalamayın.
5. Başarılı güncellemeden sonra panelde yeni parolayla giriş yapın. Yenileme akışı reklam başlatmaz veya bütçe değiştirmez.

Supabase Studio'daki **Send password recovery** yalnızca e-posta gönderir; uygulamada yeni parola ekranının ve doğru yönlendirme ayarının bulunması yine gerekir. Studio'nun kendi parola değiştirme ekranı uygulama kullanıcısının parolasını değiştirmez.

## Kabul kontrolü

- Geçerli yenileme bağlantısında doğru uygulama hesabı gösteriliyor.
- Eksik, bozuk ve süresi geçmiş bağlantılar parola değiştirme yetkisi vermiyor.
- Başka bir hesabın tarayıcıda açık olması o hesabın parolasını değiştirmiyor.
- Başarılı yenilemenin ardından kullanıcı yeni parolayla giriş yapabiliyor.
- Gerçek e-posta gönderimi ve parola değişimi kullanıcı tarafından tamamlanmadan bu akış canlı ortamda doğrulanmış sayılmamalıdır.

Kaynaklar:
- https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/reference/javascript/auth-updateuser
