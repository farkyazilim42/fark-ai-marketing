# NimetBars – Doğal Taş Ürün Vitrini

Fiyatsız, tanıtım amaçlı ürün katalog sitesi (Türkçe). Sepet/ödeme yoktur; tüm talepler WhatsApp üzerinden "Bilgi Al" akışıyla iletilir.

Bağımlılık veya build adımı yoktur: saf HTML, CSS ve JavaScript.

## Yerelde çalıştırma

```bash
cd nimetbars-site
python3 -m http.server 8080
# http://localhost:8080
```

## Yayınlama

Klasörün tamamını herhangi bir statik barındırmaya yükleyin (Netlify, Vercel, GitHub Pages, Cloudflare Pages, klasik hosting). Vercel/Netlify'da "root directory" olarak `nimetbars-site` seçmeniz yeterlidir.

## Yapı

| Dosya | İçerik |
| --- | --- |
| `index.html` | Sayfa iskeleti: hero, kategoriler, koleksiyon, süreç, hakkımızda, SSS, iletişim |
| `js/data.js` | Marka/iletişim ayarları, kategoriler ve ürün verisi |
| `js/app.js` | Filtre, arama, ürün detay penceresi, talep listesi, iletişim formu |
| `css/styles.css` | Tüm stiller |
| `assets/products/` | Ürün görselleri (`<ürün kodu>-<sıra>.jpg`, en uzun kenar 1000 px) |

## Düzenleme

- **İletişim bilgileri:** `js/data.js` içindeki `SITE` nesnesi (`whatsapp`, `phoneDisplay`, `email`, `city`). WhatsApp numarası şu an yer tutucudur.
- **Ürün ekleme:** `PRODUCTS` dizisine yeni bir kayıt ekleyin ve görselleri `assets/products/` altına `pXX-1.jpg` biçiminde koyun.
- **Görsel oranı:** Kart görselleri sabit 4:5 çerçevede `object-fit: cover` ile gösterilir (`--card-ratio` değişkeni). Detay penceresinde görselin tamamı nötr zemin üzerinde `contain` ile gösterilir.

## Görsel kaynakları

Ürün görselleri referans mağazadan (belleviestore.shop) alınmıştır. Yayına almadan önce görsellerin kullanım hakkının bulunduğundan emin olun ya da kendi çekimlerinizle değiştirin. Ürün adları ve tüm metinler bu site için özgün olarak yazılmıştır.
