package com.fiyatgor.app.db

import java.math.BigDecimal
import java.math.RoundingMode
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale

enum class VatMode { AS_IS, INCLUDE;
    companion object {
        fun from(value: String?): VatMode = if (value == "include") INCLUDE else AS_IS
    }
}

/** [vatIncluded] null ise fiyatın KDV durumu bilinmiyor demektir. */
data class DisplayPrice(val amount: Double, val vatIncluded: Boolean?, val vatRate: Double? = null)

object PriceCalc {
    fun compute(base: Double, listKdvDahil: Boolean?, mode: VatMode, vatRatePercent: Double?): DisplayPrice {
        if (mode == VatMode.AS_IS || listKdvDahil == true) return DisplayPrice(base, listKdvDahil, vatRatePercent)
        if (vatRatePercent == null || vatRatePercent < 0) return DisplayPrice(base, listKdvDahil)
        val gross = BigDecimal.valueOf(base)
            .multiply(BigDecimal.ONE + BigDecimal.valueOf(vatRatePercent).divide(BigDecimal(100)))
            .setScale(2, RoundingMode.HALF_UP)
            .toDouble()
        return DisplayPrice(gross, true, vatRatePercent)
    }
}

object PriceFormatter {
    private val symbols = DecimalFormatSymbols(Locale("tr", "TR")).apply {
        groupingSeparator = '.'
        decimalSeparator = ','
    }

    /** Mikro'da döviz sıra no 0 = TL (ana döviz); 1 ve 2 standart kurulumda USD ve EUR'dur. */
    fun currencyLabel(currency: Int, tlSymbol: String): String = when (currency) {
        0 -> tlSymbol
        1 -> "USD"
        2 -> "EUR"
        else -> "DVZ$currency"
    }

    fun format(amount: Double, currency: Int = 0, tlSymbol: String = "TL"): String {
        val df = DecimalFormat("#,##0.00", symbols)
        df.roundingMode = RoundingMode.HALF_UP
        val label = currencyLabel(currency, tlSymbol)
        // BigDecimal.valueOf uses the shortest decimal form, so 2.345 rounds to 2,35 not 2,34.
        val text = df.format(BigDecimal.valueOf(amount))
        return if (label == "₺") "$label$text" else "$text $label"
    }
}
