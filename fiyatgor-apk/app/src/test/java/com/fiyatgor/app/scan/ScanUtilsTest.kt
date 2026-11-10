package com.fiyatgor.app.scan

import com.fiyatgor.app.ads.MediaKind
import com.fiyatgor.app.ads.MediaTypes
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ScanUtilsTest {
    @Test fun bufferCollectsAndFlushes() {
        val b = ScanBuffer()
        b.append("8690", 0)
        b.append("123", 10)
        assertEquals("8690123", b.flush())
        assertNull(b.flush())
    }

    @Test fun bufferDropsStalePartialInput() {
        val b = ScanBuffer(staleAfterMs = 500)
        b.append('x', 0)
        b.append("8690526", 2000)
        assertEquals("8690526", b.flush())
    }

    @Test fun sanitizerStripsControlChars() {
        assertEquals("8690000000012", BarcodeSanitizer.clean("\u001d 8690000000012\r\n"))
        assertEquals("ABC-1", BarcodeSanitizer.clean("ABC-1\u0000"))
    }

    @Test fun duplicateFilterDropsEchoButAllowsRescan() {
        val f = DuplicateFilter(400)
        assertTrue(f.accept("1", 0))
        assertFalse(f.accept("1", 100))
        assertTrue(f.accept("2", 150))
        assertTrue(f.accept("2", 1000))
    }

    @Test fun endModes() {
        assertEquals(EndMode.AUTO, EndMode.from(null))
        assertTrue(EndMode.AUTO.usesTimeout() && EndMode.AUTO.terminatesOnEnter() && EndMode.AUTO.terminatesOnTab())
        assertFalse(EndMode.ENTER.usesTimeout())
        assertFalse(EndMode.ENTER.terminatesOnTab())
        assertFalse(EndMode.TIMEOUT.terminatesOnEnter())
    }

    @Test fun extractPreferredKeyFirst() {
        val extras = mapOf("data" to "111", "my_key" to "222")
        assertEquals("222", ScanExtras.extract(extras, "my_key"))
        assertEquals("111", ScanExtras.extract(extras, ""))
    }

    @Test fun extractUrovoByteArrayWithLength() {
        val bytes = "8690123456789".toByteArray() + ByteArray(4)
        val extras = mapOf<String, Any?>("barocode" to bytes, "length" to 13, "barcodeType" to 0.toByte())
        assertEquals("8690123456789", ScanExtras.extract(extras, null))
    }

    @Test fun extractSingleUnknownStringExtra() {
        assertEquals("42", ScanExtras.extract(mapOf("weird_key" to "42"), null))
        assertNull(ScanExtras.extract(mapOf("a" to "1", "b" to "2"), null))
    }

    @Test fun parseActions() {
        assertEquals(listOf("a.b", "c.d"), ScanExtras.parseActions(" a.b, c.d;\n a.b "))
        assertTrue(ScanExtras.parseActions("").isEmpty())
    }

    @Test fun mediaClassification() {
        assertEquals(MediaKind.IMAGE, MediaTypes.classify("x.JPG", null))
        assertEquals(MediaKind.VIDEO, MediaTypes.classify("kampanya.mp4", null))
        assertEquals(MediaKind.VIDEO, MediaTypes.classify("123", "video/mp4"))
        assertNull(MediaTypes.classify("notes.txt", "text/plain"))
    }
}
