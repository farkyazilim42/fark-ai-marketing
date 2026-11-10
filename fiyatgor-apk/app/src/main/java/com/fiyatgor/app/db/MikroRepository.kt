package com.fiyatgor.app.db

import java.sql.Connection
import java.sql.DriverManager
import java.sql.PreparedStatement
import java.sql.ResultSet
import java.sql.SQLException
import java.util.Properties

data class LookupOptions(
    val priceList: Int = 1,
    val depot: Int = 0,
    val allowAnyDepot: Boolean = true,
    val vatMode: VatMode = VatMode.AS_IS,
    val fallbackToStockCode: Boolean = true,
    /** STOKLAR column shown under the name (e.g. sto_kisa_ismi); read only if present in the row. */
    val subtitleColumn: String? = null,
)

data class Product(
    val barcode: String,
    val stockCode: String,
    val name: String,
    val subtitle: String?,
    val unitName: String?,
    val price: DisplayPrice?,
    val currency: Int,
    val priceDepot: Int?,
)

sealed class LookupResult {
    data class Found(val product: Product) : LookupResult()
    data class NotFound(val barcode: String) : LookupResult()
    data class Error(val message: String) : LookupResult()
}

data class PriceListInfo(val number: Int, val description: String, val kdvDahil: Boolean)

/**
 * Not thread-safe by design: all calls must run on one dedicated thread so the single cached
 * connection and its prepared statements are reused across rapid scans.
 */
class MikroRepository {
    private var connection: Connection? = null
    private var connectionKey: String? = null
    private val statements = HashMap<String, PreparedStatement>()
    private val kdvDahilCache = HashMap<Int, Boolean?>()
    private val vatCache = HashMap<Int, Double?>()
    private var vatFunctionAvailable = true

    init {
        Class.forName("net.sourceforge.jtds.jdbc.Driver")
    }

    fun lookup(barcode: String, cfg: DbConfig, opts: LookupOptions): LookupResult {
        if (!cfg.isComplete) return LookupResult.Error(ErrorMessages.NOT_CONFIGURED)
        return withRetry(cfg) { c -> doLookup(c, barcode, cfg, opts) }
    }

    /** Opens (or validates) the connection ahead of the first scan. */
    fun ping(cfg: DbConfig): String? {
        if (!cfg.isComplete) return ErrorMessages.NOT_CONFIGURED
        return when (val r = withRetry(cfg) { c ->
            prepare(c, MikroQueries.PING, cfg).executeQuery().use { it.next() }
            LookupResult.NotFound("")
        }) {
            is LookupResult.Error -> r.message
            else -> null
        }
    }

    fun close() {
        statements.values.forEach { runCatching { it.close() } }
        statements.clear()
        runCatching { connection?.close() }
        connection = null
        connectionKey = null
        kdvDahilCache.clear()
        vatCache.clear()
        vatFunctionAvailable = true
    }

    private inline fun withRetry(cfg: DbConfig, block: (Connection) -> LookupResult): LookupResult {
        var reused = false
        return try {
            reused = connection != null && connectionKey == cfg.connectionKey()
            block(connection(cfg))
        } catch (e: Exception) {
            close()
            if (!reused || e !is SQLException) return LookupResult.Error(ErrorMessages.describe(e))
            try {
                block(connection(cfg))
            } catch (e2: Exception) {
                close()
                LookupResult.Error(ErrorMessages.describe(e2))
            }
        }
    }

    private fun connection(cfg: DbConfig): Connection {
        val key = cfg.connectionKey()
        val existing = connection
        if (existing != null && connectionKey == key && !existing.isClosed) return existing
        close()
        val c = open(cfg, null)
        connection = c
        connectionKey = key
        return c
    }

    private fun prepare(c: Connection, sql: String, cfg: DbConfig): PreparedStatement =
        statements.getOrPut(sql) {
            c.prepareStatement(sql).apply { queryTimeout = cfg.queryTimeoutSec.coerceIn(1, 120) }
        }

    private fun doLookup(c: Connection, barcode: String, cfg: DbConfig, opts: LookupOptions): LookupResult {
        var row = queryProduct(prepare(c, MikroQueries.PRODUCT_BY_BARCODE, cfg), barcode, opts.subtitleColumn)
        if (row == null && opts.fallbackToStockCode) {
            row = queryProduct(prepare(c, MikroQueries.PRODUCT_BY_STOCK_CODE, cfg), barcode, opts.subtitleColumn)
        }
        if (row == null) return LookupResult.NotFound(barcode)

        val prices = prepare(c, MikroQueries.PRICES_FOR_STOCK, cfg).run {
            setString(1, row.stockCode)
            setInt(2, opts.priceList)
            executeQuery().use { rs ->
                buildList {
                    while (rs.next()) {
                        add(
                            PriceRow(
                                price = rs.getDouble(1),
                                depot = rs.getInt(2),
                                unitPointer = rs.getInt(3),
                                currency = rs.getInt(4),
                                paymentPlan = rs.getInt(5),
                            )
                        )
                    }
                }
            }
        }
        val chosen = PriceSelector.select(prices, opts.depot, row.barcodeUnit, opts.allowAnyDepot)

        val display = chosen?.let {
            val kdvDahil = listKdvDahil(c, cfg, opts.priceList)
            val rate = if (opts.vatMode == VatMode.INCLUDE && kdvDahil != true) vatRate(c, cfg, row.vatPointer) else null
            PriceCalc.compute(it.price, kdvDahil, opts.vatMode, rate)
        }
        val unitPointer = row.barcodeUnit?.takeIf { it > 0 } ?: chosen?.unitPointer?.takeIf { it > 0 } ?: 1
        return LookupResult.Found(
            Product(
                barcode = barcode,
                stockCode = row.stockCode,
                name = row.name,
                subtitle = row.subtitle?.takeIf { !it.equals(row.name, ignoreCase = true) },
                unitName = row.unitNames[unitPointer] ?: row.unitNames[1],
                price = display,
                currency = chosen?.currency ?: 0,
                priceDepot = chosen?.depot,
            )
        )
    }

    private class ProductRow(
        val stockCode: String,
        val name: String,
        val subtitle: String?,
        val barcodeUnit: Int?,
        val vatPointer: Int?,
        val unitNames: Map<Int, String>,
    )

    private fun queryProduct(ps: PreparedStatement, code: String, subtitleColumn: String?): ProductRow? {
        ps.setString(1, code)
        return ps.executeQuery().use { rs ->
            if (!rs.next()) return null
            val cols = columnNames(rs)
            ProductRow(
                stockCode = rs.getString(MikroQueries.COL_CODE).orEmpty().trim(),
                name = rs.getString(MikroQueries.COL_NAME).orEmpty().trim(),
                subtitle = subtitleColumn?.lowercase()?.takeIf { it.isNotBlank() && it in cols }
                    ?.let { rs.getString(it)?.trim()?.takeIf { v -> v.isNotEmpty() } },
                barcodeUnit = optInt(rs, cols, MikroQueries.BARCODE_UNIT_ALIAS),
                vatPointer = optInt(rs, cols, MikroQueries.COL_VAT_POINTER),
                unitNames = (1..4).mapNotNull { p ->
                    val col = MikroQueries.unitNameColumn(p)
                    if (col in cols) rs.getString(col)?.trim()?.takeIf { it.isNotEmpty() }?.let { p to it } else null
                }.toMap(),
            )
        }
    }

    private fun <K, V> HashMap<K, V?>.cached(key: K, compute: () -> V?): V? {
        if (containsKey(key)) return get(key)
        return compute().also { put(key, it) }
    }

    private fun listKdvDahil(c: Connection, cfg: DbConfig, list: Int): Boolean? =
        kdvDahilCache.cached(list) {
            try {
                prepare(c, MikroQueries.PRICE_LIST_KDV_DAHIL, cfg).run {
                    setInt(1, list)
                    executeQuery().use { rs -> if (rs.next()) rs.getInt(1) == 1 else null }
                }
            } catch (e: SQLException) {
                if (isSchemaError(e)) null else throw e
            }
        }

    private fun vatRate(c: Connection, cfg: DbConfig, pointer: Int?): Double? {
        if (pointer == null || !vatFunctionAvailable) return null
        return vatCache.cached(pointer) {
            try {
                prepare(c, MikroQueries.VAT_PERCENT, cfg).run {
                    setInt(1, pointer)
                    executeQuery().use { rs -> if (rs.next()) rs.getDouble(1).takeIf { !rs.wasNull() } else null }
                }
            } catch (e: SQLException) {
                if (!isSchemaError(e)) throw e
                vatFunctionAvailable = false
                null
            }
        }
    }

    companion object {
        fun open(cfg: DbConfig, databaseOverride: String?): Connection {
            val props = Properties().apply {
                setProperty("user", cfg.user)
                setProperty("password", cfg.password)
            }
            DriverManager.setLoginTimeout(cfg.loginTimeoutSec.coerceIn(1, 120))
            return DriverManager.getConnection(JtdsUrl.build(cfg, databaseOverride), props)
        }

        /** Missing table/column/function: the feature is skipped instead of failing the scan. */
        fun isSchemaError(e: SQLException) = e.errorCode in setOf(207, 208, 4121, 195, 2812)

        private fun columnNames(rs: ResultSet): Set<String> {
            val md = rs.metaData
            return (1..md.columnCount).map { md.getColumnLabel(it).lowercase() }.toSet()
        }

        private fun optInt(rs: ResultSet, cols: Set<String>, name: String): Int? {
            if (name.lowercase() !in cols) return null
            val v = rs.getInt(name)
            return if (rs.wasNull()) null else v
        }

        // --- One-off admin calls used by the settings screen -------------------------------

        fun testConnection(cfg: DbConfig): Result<String> = runCatching {
            open(cfg, cfg.database.ifBlank { "master" }).use { c ->
                val (version, db) = c.createStatement().use { st ->
                    st.executeQuery(MikroQueries.SERVER_INFO).use { rs -> rs.next(); rs.getString(1) to rs.getString(2) }
                }
                val tables = c.createStatement().use { st ->
                    st.executeQuery(MikroQueries.MIKRO_TABLE_CHECK).use { rs -> rs.next(); rs.getInt(1) }
                }
                buildString {
                    append("Bağlantı başarılı.\nSQL Server sürümü: ").append(version)
                    append("\nVeritabanı: ").append(db)
                    append("\nMikro tabloları: ").append(tables).append("/3 bulundu")
                    if (tables < 3) append("\nUyarı: Bu veritabanı bir Mikro firma veritabanı gibi görünmüyor.")
                }
            }
        }.recoverCatching { throw IllegalStateException(ErrorMessages.describe(it)) }

        fun listDatabases(cfg: DbConfig): Result<List<String>> = runCatching {
            open(cfg, "master").use { c ->
                c.createStatement().use { st ->
                    st.executeQuery(MikroQueries.DATABASES).use { rs ->
                        buildList { while (rs.next()) add(rs.getString(1)) }
                    }
                }
            }
        }.recoverCatching { throw IllegalStateException(ErrorMessages.describe(it)) }

        fun listPriceLists(cfg: DbConfig): Result<List<PriceListInfo>> = runCatching {
            open(cfg, null).use { c ->
                c.createStatement().use { st ->
                    st.executeQuery(MikroQueries.PRICE_LISTS).use { rs ->
                        buildList {
                            while (rs.next()) add(PriceListInfo(rs.getInt(1), rs.getString(2).orEmpty(), rs.getInt(3) == 1))
                        }
                    }
                }
            }
        }.recoverCatching { throw IllegalStateException(ErrorMessages.describe(it)) }
    }
}
