# Fiyat Gör (Android, Kotlin)

KODPOS C102A gibi Android fiyat gör cihazları için, Mikro v17 SQL Server veritabanından barkodla ürün adı ve satış fiyatı gösteren kiosk uygulaması. Bu klasör depodaki Next.js uygulamasından bağımsızdır.

## Derleme

Gereksinimler: JDK 17+, Android SDK (platform 34, build-tools 34).

```bash
cd fiyatgor-apk
echo "sdk.dir=$ANDROID_HOME" > local.properties
./gradlew testDebugUnitTest assembleDebug assembleRelease
# app/build/outputs/apk/debug/app-debug.apk
# app/build/outputs/apk/release/app-release.apk  (keystore/ altındaki TEST anahtarıyla imzalı)
```

`keystore/fiyatgor-test.jks` yalnızca test içindir. Canlı dağıtımda kendi anahtarınızı üretip `keystore/keystore.properties` dosyasını güncelleyin.

## Entegrasyon testi (gerçek SQL Server)

`tools/mikro-demo-schema.sql`, Mikro tablolarının uygulamanın okuduğu kolonlarını içeren bir demo veritabanı oluşturur.

```bash
docker run -d --name mssql -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD=FiyatGor_2026 -p 1433:1433 mcr.microsoft.com/mssql/server:2022-latest
docker cp tools/mikro-demo-schema.sql mssql:/tmp/s.sql
docker exec mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P FiyatGor_2026 -i /tmp/s.sql
FIYATGOR_IT_HOST=127.0.0.1 ./gradlew testDebugUnitTest
```

## Yapı

- `db/`: jTDS bağlantısı (`MikroRepository`), sorgular (`MikroQueries`), depo/birim fiyat seçimi (`PriceSelector`), KDV ve TL biçimlendirme (`PriceFormat`), Türkçe hata mesajları.
- `scan/`: klavye (keyboard wedge) tamponu, broadcast intent extra çözümleme, tekrar okuma filtresi.
- `ads/`: boşta reklam döngüsü (resim + video).
- `ui/`: kiosk ana ekranı, PIN korumalı ayarlar (`res/xml/preferences.xml`).

Sorgu akışı: `BARKOD_TANIMLARI.bar_kodu` → `bar_stokkodu`, bulunamazsa `STOKLAR.sto_kod`. Fiyat, seçili liste no için `STOK_SATIS_FIYAT_LISTELERI` tablosundan okunur. Depo önceliği "seçili depo → 0 → herhangi bir depo" sırasıyla, birim önceliği "barkodun birimi → 1. birim" sırasıyla uygulanır. KDV dahil bilgisi `STOK_SATIS_FIYAT_LISTE_TANIMLARI.sfl_kdvdahil` alanından gelir.
