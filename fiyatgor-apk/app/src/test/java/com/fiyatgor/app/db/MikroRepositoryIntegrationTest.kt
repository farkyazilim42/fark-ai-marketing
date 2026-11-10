package com.fiyatgor.app.db

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test

/**
 * Runs against a SQL Server seeded with tools/mikro-demo-schema.sql. Skipped unless
 * FIYATGOR_IT_HOST is set, e.g.: FIYATGOR_IT_HOST=127.0.0.1 ./gradlew testDebugUnitTest
 */
class MikroRepositoryIntegrationTest {
    private lateinit var cfg: DbConfig

    @Before fun setUp() {
        val host = System.getenv("FIYATGOR_IT_HOST")
        assumeTrue("FIYATGOR_IT_HOST not set", !host.isNullOrBlank())
        cfg = DbConfig(
            host = host!!,
            port = System.getenv("FIYATGOR_IT_PORT")?.toIntOrNull() ?: 1433,
            instance = "",
            user = System.getenv("FIYATGOR_IT_USER") ?: "fiyatgor",
            password = System.getenv("FIYATGOR_IT_PASSWORD") ?: "Fiyat_Okur_2026",
            database = "MikroDB_V17_DEMO",
        )
    }

    private fun found(r: LookupResult): Product {
        assertTrue(r.toString(), r is LookupResult.Found)
        return (r as LookupResult.Found).product
    }

    @Test fun barcodeLookupWithReusedConnection() {
        val repo = MikroRepository()
        val p = found(repo.lookup("8690001000011", cfg, LookupOptions()))
        assertEquals("ST001", p.stockCode)
        assertEquals("Çaykur Rize Turist Çayı 1000 g", p.name)
        assertEquals(289.90, p.price!!.amount, 0.001)
        assertEquals(true, p.price!!.vatIncluded)
        assertEquals("ADET", p.unitName)

        val start = System.nanoTime()
        repeat(20) { found(repo.lookup("8690003000035", cfg, LookupOptions())) }
        val avgMs = (System.nanoTime() - start) / 20 / 1_000_000.0
        println("avg lookup on reused connection: $avgMs ms")
        repo.close()
    }

    @Test fun secondUnitBarcodeUsesItsUnitPrice() {
        val p = found(MikroRepository().lookup("18690002000025", cfg, LookupOptions()))
        assertEquals(480.0, p.price!!.amount, 0.001)
        assertEquals("KOLI", p.unitName)
    }

    @Test fun depotSpecificPrice() {
        val p = found(MikroRepository().lookup("8690002000028", cfg, LookupOptions(depot = 2)))
        assertEquals(39.90, p.price!!.amount, 0.001)
    }

    @Test fun stockCodeFallbackAndVatInclusion() {
        val p = found(MikroRepository().lookup("ST001", cfg, LookupOptions(priceList = 2, vatMode = VatMode.INCLUDE)))
        assertEquals(269.5, p.price!!.amount, 0.001) // 245 + %10
        assertEquals(true, p.price!!.vatIncluded)
    }

    @Test fun subtitleFromOptionalColumn() {
        val repo = MikroRepository()
        val p = found(repo.lookup("8690002000028", cfg, LookupOptions(subtitleColumn = "sto_kisa_ismi")))
        assertEquals("Homojenize • %3.5 Yağ • Tetrapak Ambalaj", p.subtitle)
        assertEquals(null, found(repo.lookup("8690003000035", cfg, LookupOptions(subtitleColumn = "sto_kisa_ismi"))).subtitle)
        assertEquals(null, found(repo.lookup("8690002000028", cfg, LookupOptions(subtitleColumn = "sto_yok_kolon"))).subtitle)
        assertEquals(null, found(repo.lookup("8690002000028", cfg, LookupOptions())).subtitle)
    }

    @Test fun notFound() {
        assertTrue(MikroRepository().lookup("0000000000000", cfg, LookupOptions()) is LookupResult.NotFound)
    }

    @Test fun wrongPassword() {
        val r = MikroRepository().lookup("8690001000011", cfg.copy(password = "bad"), LookupOptions())
        assertEquals(LookupResult.Error("SQL kullanıcı adı veya şifre hatalı."), r)
    }

    @Test fun adminCalls() {
        val sa = cfg.copy(user = "sa", password = System.getenv("FIYATGOR_IT_SA_PASSWORD") ?: "FiyatGor_2026")
        assertTrue(MikroRepository.listDatabases(sa).getOrThrow().contains("MikroDB_V17_DEMO"))
        assertTrue(MikroRepository.testConnection(cfg).getOrThrow().contains("3/3"))
        assertEquals(listOf(1, 2), MikroRepository.listPriceLists(cfg).getOrThrow().map { it.number })
    }
}
