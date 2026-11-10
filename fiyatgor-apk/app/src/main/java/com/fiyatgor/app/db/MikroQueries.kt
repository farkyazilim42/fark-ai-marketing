package com.fiyatgor.app.db

/**
 * Mikro v17 tablo/kolon adları apidocs.mikro.com.tr "Tablo Alan Adları" dokümanından:
 * BARKOD_TANIMLARI (15), STOKLAR, STOK_SATIS_FIYAT_LISTE_TANIMLARI (227),
 * STOK_SATIS_FIYAT_LISTELERI (228).
 */
object MikroQueries {
    const val BARCODE_UNIT_ALIAS = "fg_bar_birimpntr"

    /** Barkoddan stok kartı. STOKLAR'dan `*` alınır, böylece sürüme göre değişen kolonlar opsiyonel okunur. */
    val PRODUCT_BY_BARCODE = """
        SELECT TOP 1 s.*, b.bar_birimpntr AS $BARCODE_UNIT_ALIAS
        FROM dbo.BARKOD_TANIMLARI b WITH (NOLOCK)
        INNER JOIN dbo.STOKLAR s WITH (NOLOCK) ON s.sto_kod = b.bar_stokkodu
        WHERE b.bar_kodu = ? AND ISNULL(b.bar_iptal, 0) = 0
        ORDER BY ISNULL(b.bar_birimpntr, 1)
    """.trimIndent()

    /** Barkod tanımı yoksa okunan değer doğrudan stok kodu olarak denenir. */
    val PRODUCT_BY_STOCK_CODE = """
        SELECT TOP 1 s.*, CAST(NULL AS tinyint) AS $BARCODE_UNIT_ALIAS
        FROM dbo.STOKLAR s WITH (NOLOCK)
        WHERE s.sto_kod = ?
    """.trimIndent()

    /** Tüm depo/birim/ödeme planı satırları alınır; uygun satırı [PriceSelector] seçer. */
    val PRICES_FOR_STOCK = """
        SELECT f.sfiyat_fiyati, f.sfiyat_deposirano, f.sfiyat_birim_pntr, f.sfiyat_doviz, f.sfiyat_odemeplan
        FROM dbo.STOK_SATIS_FIYAT_LISTELERI f WITH (NOLOCK)
        WHERE f.sfiyat_stokkod = ? AND f.sfiyat_listesirano = ? AND ISNULL(f.sfiyat_iptal, 0) = 0
    """.trimIndent()

    val PRICE_LIST_KDV_DAHIL = """
        SELECT TOP 1 CAST(ISNULL(sfl_kdvdahil, 0) AS int)
        FROM dbo.STOK_SATIS_FIYAT_LISTE_TANIMLARI WITH (NOLOCK)
        WHERE sfl_sirano = ?
    """.trimIndent()

    val PRICE_LISTS = """
        SELECT sfl_sirano, sfl_aciklama, CAST(ISNULL(sfl_kdvdahil, 0) AS int) AS kdvdahil
        FROM dbo.STOK_SATIS_FIYAT_LISTE_TANIMLARI WITH (NOLOCK)
        WHERE ISNULL(sfl_iptal, 0) = 0
        ORDER BY sfl_sirano
    """.trimIndent()

    /** Mikro'nun vergi sıra no -> yüzde fonksiyonu (v17'de tek parametreli). */
    const val VAT_PERCENT = "SELECT dbo.fn_VergiYuzde(?)"

    val DATABASES = """
        SELECT name FROM sys.databases
        WHERE database_id > 4 AND state = 0
        ORDER BY CASE WHEN name LIKE 'MikroDB%' THEN 0 ELSE 1 END, name
    """.trimIndent()

    val SERVER_INFO = "SELECT CAST(SERVERPROPERTY('ProductVersion') AS nvarchar(64)), DB_NAME()"

    val MIKRO_TABLE_CHECK = """
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME IN ('STOKLAR', 'BARKOD_TANIMLARI', 'STOK_SATIS_FIYAT_LISTELERI')
    """.trimIndent()

    const val PING = "SELECT 1"

    // Optional STOKLAR columns, read only if present in the result set.
    const val COL_CODE = "sto_kod"
    const val COL_NAME = "sto_isim"
    const val COL_VAT_POINTER = "sto_perakende_vergi"
    fun unitNameColumn(pointer: Int) = "sto_birim${pointer}_ad"
}
