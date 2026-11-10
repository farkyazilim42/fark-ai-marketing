package com.fiyatgor.app.db

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PriceSelectorTest {
    private fun row(price: Double, depot: Int = 0, unit: Int = 1, plan: Int = 0, cur: Int = 0) =
        PriceRow(price, depot, unit, cur, plan)

    @Test fun emptyRowsGiveNull() {
        assertNull(PriceSelector.select(emptyList(), 0, null, true))
    }

    @Test fun prefersConfiguredDepotOverAllDepots() {
        val rows = listOf(row(10.0, depot = 0), row(12.0, depot = 3))
        assertEquals(12.0, PriceSelector.select(rows, 3, null, true)!!.price, 0.0)
    }

    @Test fun fallsBackToDepotZero() {
        val rows = listOf(row(10.0, depot = 0), row(12.0, depot = 5))
        assertEquals(10.0, PriceSelector.select(rows, 3, null, true)!!.price, 0.0)
    }

    @Test fun anyDepotOnlyWhenAllowed() {
        val rows = listOf(row(12.0, depot = 5))
        assertEquals(12.0, PriceSelector.select(rows, 0, null, true)!!.price, 0.0)
        assertNull(PriceSelector.select(rows, 0, null, false))
    }

    @Test fun zeroPriceInPreferredTierFallsThroughToPositive() {
        val rows = listOf(row(0.0, depot = 3), row(9.5, depot = 0))
        assertEquals(9.5, PriceSelector.select(rows, 3, null, true)!!.price, 0.0)
    }

    @Test fun onlyZeroPricesReturnsZeroRow() {
        val rows = listOf(row(0.0, depot = 0))
        assertEquals(0.0, PriceSelector.select(rows, 0, null, true)!!.price, 0.0)
    }

    @Test fun prefersBarcodeUnitThenFirstUnit() {
        val rows = listOf(row(5.0, unit = 1), row(55.0, unit = 2), row(500.0, unit = 3))
        assertEquals(55.0, PriceSelector.select(rows, 0, 2, true)!!.price, 0.0)
        assertEquals(5.0, PriceSelector.select(rows, 0, null, true)!!.price, 0.0)
        assertEquals(5.0, PriceSelector.select(rows, 0, 4, true)!!.price, 0.0)
    }

    @Test fun prefersCashPaymentPlan() {
        val rows = listOf(row(11.0, plan = 3), row(10.0, plan = 0))
        assertEquals(10.0, PriceSelector.select(rows, 0, null, true)!!.price, 0.0)
    }

    @Test fun ignoresNaN() {
        val rows = listOf(row(Double.NaN), row(7.0, depot = 2))
        assertEquals(7.0, PriceSelector.select(rows, 0, null, true)!!.price, 0.0)
    }
}

class PriceCalcTest {
    @Test fun asIsKeepsPriceAndFlag() {
        val d = PriceCalc.compute(100.0, false, VatMode.AS_IS, 20.0)
        assertEquals(100.0, d.amount, 0.0)
        assertEquals(false, d.vatIncluded)
    }

    @Test fun includeAddsVatWhenListIsExclusive() {
        val d = PriceCalc.compute(100.0, false, VatMode.INCLUDE, 20.0)
        assertEquals(120.0, d.amount, 0.0)
        assertEquals(true, d.vatIncluded)
    }

    @Test fun includeDoesNotDoubleCountKdvDahilList() {
        val d = PriceCalc.compute(120.0, true, VatMode.INCLUDE, 20.0)
        assertEquals(120.0, d.amount, 0.0)
        assertEquals(true, d.vatIncluded)
    }

    @Test fun includeWithUnknownRateLeavesPrice() {
        val d = PriceCalc.compute(100.0, false, VatMode.INCLUDE, null)
        assertEquals(100.0, d.amount, 0.0)
        assertEquals(false, d.vatIncluded)
    }

    @Test fun roundsHalfUpToKurus() {
        assertEquals(12.35, PriceCalc.compute(10.29, false, VatMode.INCLUDE, 20.0).amount, 0.0) // 12.348
        assertEquals(1.09, PriceCalc.compute(1.0, null, VatMode.INCLUDE, 8.5).amount, 0.0) // 1.085
    }

    @Test fun vatModeParsing() {
        assertEquals(VatMode.INCLUDE, VatMode.from("include"))
        assertEquals(VatMode.AS_IS, VatMode.from("as_is"))
        assertEquals(VatMode.AS_IS, VatMode.from(null))
    }
}

class PriceFormatterTest {
    @Test fun turkishGroupingAndDecimals() {
        assertEquals("1.234,50 TL", PriceFormatter.format(1234.5))
        assertEquals("0,99 TL", PriceFormatter.format(0.99))
        assertEquals("1.000.000,00 TL", PriceFormatter.format(1_000_000.0))
    }

    @Test fun roundsHalfUp() {
        assertEquals("2,35 TL", PriceFormatter.format(2.345))
    }

    @Test fun liraSymbolPrefix() {
        assertEquals("₺12,00", PriceFormatter.format(12.0, 0, "₺"))
    }

    @Test fun foreignCurrencies() {
        assertEquals("5,00 USD", PriceFormatter.format(5.0, 1))
        assertEquals("5,00 EUR", PriceFormatter.format(5.0, 2))
        assertEquals("5,00 DVZ7", PriceFormatter.format(5.0, 7))
    }
}

class JtdsUrlTest {
    private val base = DbConfig("192.168.1.10", null, "", "fiyatgor", "x;y", "MikroDB_V17_FIRMA", 5, 5)

    @Test fun defaultPortWhenNoInstance() {
        val url = JtdsUrl.build(base)
        assertTrue(url, url.startsWith("jdbc:jtds:sqlserver://192.168.1.10:1433/MikroDB_V17_FIRMA;"))
        assertTrue(url.contains(";loginTimeout=5;"))
        assertTrue(url.contains(";socketTimeout=10;"))
    }

    @Test fun namedInstanceUsesBrowserWithoutPort() {
        val url = JtdsUrl.build(base.copy(instance = "MIKRO"))
        assertTrue(url, url.startsWith("jdbc:jtds:sqlserver://192.168.1.10/MikroDB_V17_FIRMA;instance=MIKRO;"))
    }

    @Test fun explicitPortWinsOverInstance() {
        val url = JtdsUrl.build(base.copy(instance = "MIKRO", port = 1500))
        assertTrue(url, url.startsWith("jdbc:jtds:sqlserver://192.168.1.10:1500/MikroDB_V17_FIRMA;"))
        assertTrue(!url.contains("instance="))
    }

    @Test fun passwordNeverInUrl() {
        assertTrue(!JtdsUrl.build(base).contains("x;y"))
    }

    @Test fun databaseOverride() {
        assertTrue(JtdsUrl.build(base, "master").contains(":1433/master;"))
    }

    @Test fun portParsing() {
        assertEquals(1433, JtdsUrl.parsePort(" 1433 "))
        assertNull(JtdsUrl.parsePort(""))
        assertNull(JtdsUrl.parsePort("abc"))
        assertNull(JtdsUrl.parsePort("70000"))
    }

    @Test fun completeness() {
        assertTrue(base.isComplete)
        assertTrue(!base.copy(database = " ").isComplete)
    }
}

class MikroQueriesTest {
    @Test fun barcodeQueryUsesMikroColumns() {
        val q = MikroQueries.PRODUCT_BY_BARCODE
        assertTrue(q.contains("BARKOD_TANIMLARI"))
        assertTrue(q.contains("b.bar_kodu = ?"))
        assertTrue(q.contains("s.sto_kod = b.bar_stokkodu"))
        assertTrue(q.contains("bar_iptal"))
        assertEquals(1, q.count { it == '?' })
    }

    @Test fun stockCodeFallback() {
        val q = MikroQueries.PRODUCT_BY_STOCK_CODE
        assertTrue(q.contains("s.sto_kod = ?"))
        assertTrue(q.contains(MikroQueries.BARCODE_UNIT_ALIAS))
        assertEquals(1, q.count { it == '?' })
    }

    @Test fun priceQueryFiltersStockAndList() {
        val q = MikroQueries.PRICES_FOR_STOCK
        listOf("STOK_SATIS_FIYAT_LISTELERI", "sfiyat_fiyati", "sfiyat_deposirano", "sfiyat_birim_pntr",
            "sfiyat_stokkod = ?", "sfiyat_listesirano = ?", "sfiyat_iptal").forEach {
            assertTrue(it, q.contains(it))
        }
        assertEquals(2, q.count { it == '?' })
    }

    @Test fun allQueriesUseNoLockOnMikroTables() {
        listOf(MikroQueries.PRODUCT_BY_BARCODE, MikroQueries.PRODUCT_BY_STOCK_CODE, MikroQueries.PRICES_FOR_STOCK,
            MikroQueries.PRICE_LIST_KDV_DAHIL, MikroQueries.PRICE_LISTS).forEach {
            assertTrue(it, it.contains("WITH (NOLOCK)"))
        }
    }

    @Test fun unitColumns() {
        assertEquals("sto_birim2_ad", MikroQueries.unitNameColumn(2))
    }
}

class ErrorMessagesTest {
    @Test fun loginFailed() {
        val e = java.sql.SQLException("Login failed for user 'x'.", "28000", 18456)
        assertEquals("SQL kullanıcı adı veya şifre hatalı.", ErrorMessages.describe(e))
    }

    @Test fun networkError() {
        val e = java.sql.SQLException("Network error IOException: Connection refused", "08S01")
        assertTrue(ErrorMessages.describe(e).startsWith("Sunucuya bağlanılamadı"))
    }

    @Test fun timeout() {
        val e = java.sql.SQLException("Network error IOException: connect timed out", "08S01")
        assertTrue(ErrorMessages.describe(e).contains("zaman aşımı"))
    }

    @Test fun missingTable() {
        val e = java.sql.SQLException("Invalid object name 'dbo.STOKLAR'.", "S0002", 208)
        assertTrue(ErrorMessages.describe(e).contains("Mikro tabloları bulunamadı"))
    }

    @Test fun instanceNotFound() {
        val e = java.sql.SQLException("Unable to get information from SQL Server: 10.0.0.1.", "08S01")
        assertTrue(ErrorMessages.describe(e).contains("SQL Server örneğine ulaşılamadı"))
    }

    @Test fun unknownHost() {
        val e = java.sql.SQLException("Unknown server host name 'abc'.", "08S01", 0, java.net.UnknownHostException("abc"))
        assertTrue(ErrorMessages.describe(e).contains("IP adresini"))
    }
}
