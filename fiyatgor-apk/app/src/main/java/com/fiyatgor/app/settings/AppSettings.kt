package com.fiyatgor.app.settings

import android.content.Context
import android.content.SharedPreferences
import android.graphics.Color
import androidx.preference.PreferenceManager
import com.fiyatgor.app.db.DbConfig
import com.fiyatgor.app.db.JtdsUrl
import com.fiyatgor.app.db.LookupOptions
import com.fiyatgor.app.db.VatMode
import com.fiyatgor.app.scan.EndMode
import com.fiyatgor.app.scan.ScanExtras

/** Typed view over the preference keys declared in res/xml/preferences.xml. */
class AppSettings(context: Context) {
    val prefs: SharedPreferences = PreferenceManager.getDefaultSharedPreferences(context.applicationContext)

    private fun str(key: String, def: String = "") = prefs.getString(key, def) ?: def
    private fun int(key: String, def: Int, min: Int = Int.MIN_VALUE, max: Int = Int.MAX_VALUE) =
        (str(key).trim().toIntOrNull() ?: def).coerceIn(min, max)
    private fun bool(key: String, def: Boolean) = prefs.getBoolean(key, def)
    private fun color(key: String, def: String): Int =
        runCatching { Color.parseColor(str(key, def).trim()) }.getOrDefault(Color.parseColor(def))

    fun dbConfig() = DbConfig(
        host = str(K.DB_HOST).trim(),
        port = JtdsUrl.parsePort(str(K.DB_PORT)),
        instance = str(K.DB_INSTANCE).trim(),
        user = str(K.DB_USER).trim(),
        password = str(K.DB_PASSWORD),
        database = str(K.DB_NAME).trim(),
        loginTimeoutSec = int(K.DB_LOGIN_TIMEOUT, 5, 1, 120),
        queryTimeoutSec = int(K.DB_QUERY_TIMEOUT, 5, 1, 120),
    )

    fun lookupOptions() = LookupOptions(
        priceList = int(K.PRICE_LIST, 1, 1, 100000),
        depot = int(K.DEPOT, 0, 0, 100000),
        allowAnyDepot = bool(K.DEPOT_FALLBACK, true),
        vatMode = VatMode.from(str(K.VAT_MODE, "as_is")),
        fallbackToStockCode = bool(K.STOCK_CODE_FALLBACK, true),
        subtitleColumn = str(K.SUBTITLE_FIELD, "sto_kisa_ismi").trim().takeIf { it.isNotEmpty() && it != "none" },
    )

    val currencySymbol get() = str(K.CURRENCY_SYMBOL, "TL")
    val showStockCode get() = bool(K.SHOW_STOCK_CODE, true)
    val showBarcode get() = bool(K.SHOW_BARCODE, true)
    val showUnit get() = bool(K.SHOW_UNIT, true)
    val showVatNote get() = bool(K.SHOW_VAT_NOTE, true)

    val welcomeText get() = str(K.WELCOME_TEXT, DEFAULT_WELCOME).ifBlank { DEFAULT_WELCOME }
    val logoPath get() = str(K.LOGO_PATH)
    val backgroundColor get() = color(K.COLOR_BG, "#F4F6FB")
    val accentColor get() = color(K.COLOR_ACCENT, "#6366F1")
    val textColor get() = color(K.COLOR_TEXT, "#111827")
    val priceColor get() = color(K.COLOR_PRICE, "#C8352E")
    val nameFontSp get() = int(K.FONT_NAME, 64, 12, 300)
    val priceFontSp get() = int(K.FONT_PRICE, 150, 20, 500)
    val statusFontSp get() = int(K.FONT_STATUS, 44, 12, 200)
    val clockFontSp get() = int(K.FONT_CLOCK, 26, 12, 200)
    val clockVisible get() = bool(K.CLOCK_VISIBLE, true)
    val logoHeightDp get() = int(K.LOGO_HEIGHT, 48, 24, 200)
    val companyName get() = str(K.COMPANY_NAME, "FİYAT GÖR").trim()
    val companyTagline get() = str(K.COMPANY_TAGLINE).trim()
    val deviceId get() = str(K.DEVICE_ID).trim()
    val hintText get() = str(K.HINT_TEXT, DEFAULT_HINT).trim()
    val showCountdown get() = bool(K.SHOW_COUNTDOWN, true)
    val ttsEnabled get() = bool(K.TTS_ENABLED, true)
    val ttsAuto get() = bool(K.TTS_AUTO, false)
    val orientation get() = str(K.ORIENTATION, "auto")

    val resultDisplaySec get() = int(K.RESULT_SECONDS, 15, 0, 3600)
    val adsEnabled get() = bool(K.ADS_ENABLED, true)
    val idleTimeoutSec get() = int(K.IDLE_TIMEOUT, 60, 5, 86400)
    val adImageSec get() = int(K.AD_IMAGE_SECONDS, 8, 1, 3600)
    val adMuted get() = bool(K.AD_MUTE, false)
    val adFolderTree get() = str(K.AD_FOLDER_TREE)
    val adFolderPath get() = str(K.AD_FOLDER_PATH).trim()
    var adUris: List<String>
        get() = str(K.AD_URIS).lines().map { it.trim() }.filter { it.isNotEmpty() }
        set(v) = prefs.edit().putString(K.AD_URIS, v.distinct().joinToString("\n")).apply()

    val keyboardScanEnabled get() = bool(K.SCAN_KEYBOARD, true)
    val endMode get() = EndMode.from(str(K.SCAN_END, "auto"))
    val charTimeoutMs get() = int(K.SCAN_CHAR_TIMEOUT, 120, 20, 5000).toLong()
    val minBarcodeLength get() = int(K.SCAN_MIN_LEN, 3, 1, 100)
    val broadcastEnabled get() = bool(K.SCAN_BROADCAST, true)
    val broadcastActions get() = ScanExtras.parseActions(str(K.SCAN_ACTIONS, DEFAULT_ACTIONS))
    val broadcastExtraKey get() = str(K.SCAN_EXTRA, "barcode_string").trim()

    val launchOnBoot get() = bool(K.LAUNCH_ON_BOOT, true)
    val pin get() = str(K.PIN, "1234")

    fun setString(key: String, value: String) = prefs.edit().putString(key, value).apply()

    companion object {
        const val DEFAULT_WELCOME = "Fiyat öğrenmek için ürün barkodunu okutunuz"
        const val DEFAULT_HINT = "Barkodunuzu cihazın altındaki okuyucuya yaklaştırınız"
        val DEFAULT_ACTIONS = ScanExtras.DEFAULT_ACTIONS.joinToString(", ")
    }

    object K {
        const val DB_HOST = "db_host"
        const val DB_PORT = "db_port"
        const val DB_INSTANCE = "db_instance"
        const val DB_USER = "db_user"
        const val DB_PASSWORD = "db_password"
        const val DB_NAME = "db_name"
        const val DB_LOGIN_TIMEOUT = "db_login_timeout"
        const val DB_QUERY_TIMEOUT = "db_query_timeout"
        const val PRICE_LIST = "price_list_no"
        const val DEPOT = "depot_no"
        const val DEPOT_FALLBACK = "depot_fallback"
        const val VAT_MODE = "vat_mode"
        const val STOCK_CODE_FALLBACK = "stock_code_fallback"
        const val CURRENCY_SYMBOL = "currency_symbol"
        const val SHOW_STOCK_CODE = "show_stock_code"
        const val SHOW_BARCODE = "show_barcode"
        const val SHOW_UNIT = "show_unit"
        const val SHOW_VAT_NOTE = "show_vat_note"
        const val WELCOME_TEXT = "welcome_text"
        const val LOGO_PATH = "logo_path"
        const val COLOR_BG = "color_bg"
        const val COLOR_TEXT = "color_text"
        const val COLOR_PRICE = "color_price"
        const val FONT_NAME = "font_name_sp"
        const val FONT_PRICE = "font_price_sp"
        const val FONT_STATUS = "font_status_sp"
        const val FONT_CLOCK = "font_clock_sp"
        const val CLOCK_VISIBLE = "clock_visible"
        const val LOGO_HEIGHT = "logo_height_dp"
        const val COLOR_ACCENT = "color_accent"
        const val COMPANY_NAME = "company_name"
        const val COMPANY_TAGLINE = "company_tagline"
        const val DEVICE_ID = "device_id"
        const val HINT_TEXT = "hint_text"
        const val SHOW_COUNTDOWN = "show_countdown"
        const val TTS_ENABLED = "tts_enabled"
        const val TTS_AUTO = "tts_auto"
        const val SUBTITLE_FIELD = "subtitle_field"
        const val ORIENTATION = "orientation"
        const val RESULT_SECONDS = "result_display_s"
        const val ADS_ENABLED = "ads_enabled"
        const val IDLE_TIMEOUT = "idle_timeout_s"
        const val AD_IMAGE_SECONDS = "ad_image_s"
        const val AD_MUTE = "ad_mute"
        const val AD_URIS = "ad_uris"
        const val AD_FOLDER_TREE = "ad_folder_tree"
        const val AD_FOLDER_PATH = "ad_folder_path"
        const val SCAN_KEYBOARD = "scan_keyboard"
        const val SCAN_END = "scan_end"
        const val SCAN_CHAR_TIMEOUT = "scan_char_timeout_ms"
        const val SCAN_MIN_LEN = "scan_min_len"
        const val SCAN_BROADCAST = "scan_broadcast"
        const val SCAN_ACTIONS = "scan_actions"
        const val SCAN_EXTRA = "scan_extra_key"
        const val LAUNCH_ON_BOOT = "launch_on_boot"
        const val HOME_APP = "home_app"
        const val PIN = "pin"
    }
}
