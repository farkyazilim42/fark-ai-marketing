package com.fiyatgor.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Calendar
import java.util.Date
import java.util.TimeZone

class DisplayTextsTest {
    private fun istanbul(y: Int, m: Int, d: Int, h: Int, min: Int, s: Int): Date =
        Calendar.getInstance(TimeZone.getTimeZone("Europe/Istanbul")).apply {
            clear()
            set(y, m - 1, d, h, min, s)
        }.time

    @Test fun clockAndTurkishDate() {
        val t = istanbul(2026, 11, 10, 11, 2, 10)
        assertEquals("11:02:10", DisplayTexts.time(t))
        assertEquals("10 Kasım 2026 Salı", DisplayTexts.date(t))
        assertEquals("1 Şubat 2027 Pazartesi", DisplayTexts.date(istanbul(2027, 2, 1, 0, 0, 0)))
    }

    @Test fun priceParts() {
        assertEquals(DisplayTexts.PriceParts("42,50", "TL", false), DisplayTexts.priceParts(42.5, 0, "TL"))
        assertEquals(DisplayTexts.PriceParts("1.249,95", "TL", false), DisplayTexts.priceParts(1249.95, 0, "TL"))
        assertEquals(DisplayTexts.PriceParts("42,50", "₺", true), DisplayTexts.priceParts(42.5, 0, "₺"))
        assertEquals(DisplayTexts.PriceParts("9,99", "USD", false), DisplayTexts.priceParts(9.99, 1, "TL"))
    }

    @Test fun spokenText() {
        assertEquals("Sütaş Süt. Fiyatı 42 lira 50 kuruş.", DisplayTexts.spoken("Sütaş Süt", 42.5, 0))
        assertEquals("Çay. Fiyatı 245 lira.", DisplayTexts.spoken("Çay", 245.0, 0))
        assertEquals("X. Fiyatı 3 avro 5 sent.", DisplayTexts.spoken("X", 3.05, 2))
        assertEquals("X. Fiyat tanımlı değil.", DisplayTexts.spoken("X", null, 0))
    }

    @Test fun ean13() {
        assertTrue(Ean13.isValid("8690002000027"))
        assertTrue(Ean13.isValid("8690001000011"))
        assertFalse(Ean13.isValid("8690002000028"))
        assertFalse(Ean13.isValid("ST002"))
        val m = Ean13.modules("8690002000027")!!
        assertEquals(95, m.length)
        assertTrue(m.startsWith("101") && m.endsWith("101") && m.substring(45, 50) == "01010")
        assertNull(Ean13.modules("123"))
        assertTrue(Ean13.pseudoModules("ST002").all { it == '0' || it == '1' })
    }
}
