package com.fiyatgor.app.scan

enum class EndMode {
    AUTO, ENTER, TAB, TIMEOUT;

    fun terminatesOnEnter() = this == AUTO || this == ENTER || this == TAB
    fun terminatesOnTab() = this == AUTO || this == TAB
    fun usesTimeout() = this == AUTO || this == TIMEOUT

    companion object {
        fun from(value: String?): EndMode = when (value) {
            "enter" -> ENTER
            "tab" -> TAB
            "timeout" -> TIMEOUT
            else -> AUTO
        }
    }
}

/** Collects keyboard-wedge characters; stale partial input (stray key presses) is discarded. */
class ScanBuffer(private val staleAfterMs: Long = 2000) {
    private val sb = StringBuilder()
    private var lastAt = 0L

    fun append(c: Char, now: Long) {
        if (sb.isNotEmpty() && now - lastAt > staleAfterMs) sb.setLength(0)
        sb.append(c)
        lastAt = now
    }

    fun append(text: String, now: Long) = text.forEach { append(it, now) }

    fun isEmpty() = sb.isEmpty()

    fun flush(): String? {
        val s = sb.toString()
        sb.setLength(0)
        return s.ifEmpty { null }
    }
}

object BarcodeSanitizer {
    /** Removes control characters, AIM/GS1 group separators and surrounding whitespace. */
    fun clean(raw: String): String =
        raw.filter { it >= ' ' && it != '\u007f' }.trim()
}

/** Some scanners emit both a broadcast and keystrokes for one read; drop the echo. */
class DuplicateFilter(private val windowMs: Long = 400) {
    private var lastCode: String? = null
    private var lastAt = 0L

    fun accept(code: String, now: Long): Boolean {
        val dup = code == lastCode && now - lastAt < windowMs
        lastCode = code
        lastAt = now
        return !dup
    }
}

object ScanExtras {
    /** Common extra keys used by Android scanner services (Urovo, Newland, iData, Honeywell, generic RK). */
    val COMMON_KEYS = listOf(
        "barcode_string", "scannerdata", "barcode", "data", "SCAN_BARCODE1", "barcodeData",
        "decode_data", "barocode", "BARCODE", "scannerdatact", "EXTRA_SCAN_DATA",
        "android.intent.extra.SCAN_BROADCAST_DATA", "scan_data", "code", "value",
    )

    val DEFAULT_ACTIONS = listOf(
        "android.intent.ACTION_DECODE_DATA",
        "com.android.server.scannerservice.broadcast",
        "scan.rcv.message",
        "nlscan.action.SCANNER_RESULT",
        "com.barcode.sendBroadcast",
        "android.intent.action.SCANRESULT",
        "com.scanner.broadcast",
    )

    fun parseActions(text: String?): List<String> =
        text.orEmpty().split(',', ';', '\n').map { it.trim() }.filter { it.isNotEmpty() }.distinct()

    fun extract(extras: Map<String, Any?>, preferredKey: String?): String? {
        val keys = listOfNotNull(preferredKey?.trim()?.takeIf { it.isNotEmpty() }) + COMMON_KEYS
        for (key in keys) {
            val value = valueAsString(extras[key], extras["length"] as? Int)
            if (!value.isNullOrBlank()) return value
        }
        val strings = extras.values.mapNotNull { valueAsString(it, null) }.filter { it.isNotBlank() }
        return strings.singleOrNull()
    }

    private fun valueAsString(value: Any?, length: Int?): String? = when (value) {
        is String -> value
        is CharSequence -> value.toString()
        is ByteArray -> {
            val n = if (length != null && length in 1..value.size) length else value.size
            String(value, 0, n, Charsets.UTF_8).trimEnd('\u0000')
        }
        else -> null
    }
}
