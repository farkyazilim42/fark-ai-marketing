package com.fiyatgor.app.ui

import com.fiyatgor.app.db.PriceFormatter
import java.math.BigDecimal
import java.math.RoundingMode
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

object DisplayTexts {
    val TURKISH: Locale = Locale("tr", "TR")
    private val ISTANBUL: TimeZone = TimeZone.getTimeZone("Europe/Istanbul")

    fun time(date: Date): String = SimpleDateFormat("HH:mm:ss", TURKISH).apply { timeZone = ISTANBUL }.format(date)

    /** e.g. "10 Kasım 2026 Salı" */
    fun date(date: Date): String = SimpleDateFormat("d MMMM yyyy EEEE", TURKISH).apply { timeZone = ISTANBUL }.format(date)

    data class PriceParts(val number: String, val label: String, val labelFirst: Boolean)

    fun priceParts(amount: Double, currency: Int, tlSymbol: String): PriceParts {
        val label = PriceFormatter.currencyLabel(currency, tlSymbol)
        val number = PriceFormatter.format(amount, currency, tlSymbol).replace(label, "").trim()
        return PriceParts(number, label, label == "₺")
    }

    /** Sentence for TextToSpeech, e.g. "Sütaş Süt. Fiyatı 42 lira 50 kuruş." */
    fun spoken(name: String, amount: Double?, currency: Int): String {
        if (amount == null) return "$name. Fiyat tanımlı değil."
        val rounded = BigDecimal.valueOf(amount).setScale(2, RoundingMode.HALF_UP)
        val whole = rounded.toBigInteger()
        val cents = rounded.subtract(BigDecimal(whole)).movePointRight(2).toInt()
        val unit = when (currency) {
            0 -> "lira" to "kuruş"
            1 -> "dolar" to "sent"
            2 -> "avro" to "sent"
            else -> "" to ""
        }
        val price = buildString {
            append(whole)
            if (unit.first.isNotEmpty()) append(' ').append(unit.first)
            if (cents > 0) {
                append(' ').append(cents)
                if (unit.second.isNotEmpty()) append(' ').append(unit.second)
            }
        }
        return "$name. Fiyatı $price."
    }
}

object Ean13 {
    private val L = arrayOf("0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011")
    private val G = arrayOf("0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111")
    private val R = arrayOf("1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100")
    private val PARITY = arrayOf("LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL")

    fun isValid(code: String): Boolean {
        if (code.length != 13 || !code.all { it.isDigit() }) return false
        val sum = code.take(12).mapIndexed { i, c -> (c - '0') * if (i % 2 == 0) 1 else 3 }.sum()
        return (10 - sum % 10) % 10 == code[12] - '0'
    }

    /** 95-module EAN-13 bar pattern ('1' = bar), or null when [code] is not a valid EAN-13. */
    fun modules(code: String): String? {
        if (!isValid(code)) return null
        val first = code[0] - '0'
        val sb = StringBuilder("101")
        for (i in 1..6) {
            val d = code[i] - '0'
            sb.append(if (PARITY[first][i - 1] == 'L') L[d] else G[d])
        }
        sb.append("01010")
        for (i in 7..12) sb.append(R[code[i] - '0'])
        sb.append("101")
        return sb.toString()
    }

    /** Decorative stand-in for non-EAN codes so the tile still shows a barcode graphic. */
    fun pseudoModules(code: String): String = buildString {
        append("101")
        for (c in code) append(R[(c.code) % 10])
        append("101")
    }
}
