package com.fiyatgor.app.db

data class PriceRow(
    val price: Double,
    val depot: Int,
    val unitPointer: Int,
    val currency: Int,
    val paymentPlan: Int,
)

object PriceSelector {
    /**
     * Depo önceliği: ayarlanan depo -> 0 (tüm depolar) -> (izin varsa) herhangi bir depo.
     * Her seviyede fiyatı > 0 olan satır aranır; hiçbir seviyede yoksa ilk bulunan 0 fiyat döner.
     * Seviye içinde: barkodun birimi, sonra 1. birim; peşin (ödeme planı 0) tercih edilir.
     */
    fun select(
        rows: List<PriceRow>,
        depot: Int,
        barcodeUnit: Int?,
        allowAnyDepot: Boolean,
    ): PriceRow? {
        val valid = rows.filter { !it.price.isNaN() && !it.price.isInfinite() }
        if (valid.isEmpty()) return null

        val tiers = mutableListOf<(PriceRow) -> Boolean>()
        if (depot != 0) tiers += { it.depot == depot }
        tiers += { it.depot == 0 }
        if (allowAnyDepot) tiers += { true }

        var zeroFallback: PriceRow? = null
        for (tier in tiers) {
            val candidates = valid.filter(tier).sortedWith(
                compareBy<PriceRow>({ unitRank(it.unitPointer, barcodeUnit) }, { if (it.paymentPlan == 0) 0 else 1 }, { it.depot })
            )
            candidates.firstOrNull { it.price > 0.0 }?.let { return it }
            if (zeroFallback == null) zeroFallback = candidates.firstOrNull()
        }
        return zeroFallback
    }

    private fun unitRank(unit: Int, barcodeUnit: Int?): Int = when {
        barcodeUnit != null && barcodeUnit > 0 && unit == barcodeUnit -> 0
        unit == 1 || unit == 0 -> 1
        else -> 2
    }
}
