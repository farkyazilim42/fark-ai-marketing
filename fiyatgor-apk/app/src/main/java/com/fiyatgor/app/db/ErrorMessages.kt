package com.fiyatgor.app.db

import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.sql.SQLException
import java.sql.SQLTimeoutException

object ErrorMessages {
    const val NOT_CONFIGURED = "Veritabanı ayarları eksik. Ayarlardan sunucu, kullanıcı ve veritabanını girin."

    fun describe(t: Throwable): String {
        val chain = generateSequence(t) { it.cause }.take(6).toList()
        val msg = chain.joinToString(" | ") { it.message.orEmpty() }
        val lower = msg.lowercase()
        val sql = chain.filterIsInstance<SQLException>().firstOrNull()

        return when {
            sql?.errorCode == 18456 || "login failed" in lower ->
                "SQL kullanıcı adı veya şifre hatalı."
            sql?.errorCode == 4060 || "cannot open database" in lower ->
                "Veritabanı açılamadı. Veritabanı adını ve kullanıcının yetkisini kontrol edin."
            sql?.errorCode == 208 || "invalid object name" in lower ->
                "Mikro tabloları bulunamadı. Doğru firma veritabanı (MikroDB_V17_...) seçili mi?"
            sql?.errorCode == 207 || "invalid column name" in lower ->
                "Beklenen kolon bulunamadı: ${sql?.message ?: msg}"
            "unable to get information from sql server" in lower || "instance" in lower && "not" in lower ->
                "SQL Server örneğine ulaşılamadı. Instance adını, SQL Browser servisini (UDP 1434) veya portu kontrol edin."
            chain.any { it is UnknownHostException } || "unknown server host" in lower ->
                "Sunucu adresi çözümlenemedi. IP adresini kontrol edin."
            t is SQLTimeoutException || chain.any { it is SocketTimeoutException } || "timed out" in lower || "timeout" in lower ->
                "Sunucu zamanında yanıt vermedi (zaman aşımı). Ağ bağlantısını ve sunucuyu kontrol edin."
            "connection refused" in lower || "network error" in lower || "i/o error" in lower || sql?.sqlState == "08S01" ->
                "Sunucuya bağlanılamadı. IP, port (1433), TCP/IP ayarı ve güvenlik duvarını kontrol edin."
            "ssl" in lower || "encrypt" in lower ->
                "Sunucu şifreli bağlantı (Force Encryption) istiyor; jTDS bunu desteklemeyebilir. SQL Server'da Force Encryption'ı kapatın."
            else -> "Veritabanı hatası: ${t.message ?: t.javaClass.simpleName}"
        }
    }
}
