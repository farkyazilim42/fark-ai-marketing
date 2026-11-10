package com.fiyatgor.app.db

data class DbConfig(
    val host: String,
    val port: Int?,
    val instance: String,
    val user: String,
    val password: String,
    val database: String,
    val loginTimeoutSec: Int = 5,
    val queryTimeoutSec: Int = 5,
) {
    val isComplete: Boolean
        get() = host.isNotBlank() && user.isNotBlank() && database.isNotBlank()

    /** Identifies the physical connection; any change forces a reconnect. */
    fun connectionKey(databaseOverride: String? = null): String =
        listOf(host, port, instance, user, password, databaseOverride ?: database, loginTimeoutSec, queryTimeoutSec)
            .joinToString("|")
}

object JtdsUrl {
    const val DEFAULT_PORT = 1433

    /**
     * jTDS resolves a named instance through the SQL Browser service (UDP 1434). When a port is
     * given explicitly it is used directly and the instance name is not sent, which is what works
     * for named instances pinned to a static port.
     */
    fun build(cfg: DbConfig, databaseOverride: String? = null): String {
        val db = (databaseOverride ?: cfg.database).trim()
        val sb = StringBuilder("jdbc:jtds:sqlserver://").append(cfg.host.trim())
        val instance = cfg.instance.trim()
        when {
            cfg.port != null -> sb.append(':').append(cfg.port)
            instance.isEmpty() -> sb.append(':').append(DEFAULT_PORT)
        }
        if (db.isNotEmpty()) sb.append('/').append(db)
        if (cfg.port == null && instance.isNotEmpty()) sb.append(";instance=").append(instance)
        val login = cfg.loginTimeoutSec.coerceIn(1, 120)
        val socket = (cfg.queryTimeoutSec.coerceIn(1, 120) + 5)
        sb.append(";loginTimeout=").append(login)
        sb.append(";socketTimeout=").append(socket)
        sb.append(";socketKeepAlive=true")
        sb.append(";appName=FiyatGor")
        return sb.toString()
    }

    fun parsePort(text: String?): Int? {
        val t = text?.trim().orEmpty()
        if (t.isEmpty()) return null
        val p = t.toIntOrNull() ?: return null
        return if (p in 1..65535) p else null
    }
}
