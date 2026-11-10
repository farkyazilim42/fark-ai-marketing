package com.fiyatgor.app.ui

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.preference.EditTextPreference
import androidx.preference.Preference
import androidx.preference.PreferenceFragmentCompat
import androidx.preference.SwitchPreferenceCompat
import com.fiyatgor.app.BuildConfig
import com.fiyatgor.app.FiyatGorApp
import com.fiyatgor.app.LastScanInfo
import com.fiyatgor.app.R
import com.fiyatgor.app.ads.AdSources
import com.fiyatgor.app.ads.Bitmaps
import com.fiyatgor.app.db.MikroRepository
import com.fiyatgor.app.settings.AppSettings
import com.fiyatgor.app.settings.AppSettings.K
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.text.DateFormat
import java.util.Date

class SettingsActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)
        supportActionBar?.title = "Fiyat Gör Ayarları"
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        if (savedInstanceState == null) {
            supportFragmentManager.beginTransaction().replace(R.id.settings_container, SettingsFragment()).commit()
        }
    }

    override fun onSupportNavigateUp(): Boolean {
        finish()
        return true
    }
}

class SettingsFragment : PreferenceFragmentCompat() {
    private lateinit var settings: AppSettings

    private val pickLogo = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri?.let { saveLogo(it) }
    }
    private val pickAdFiles = registerForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
        if (uris.isNullOrEmpty()) return@registerForActivityResult
        uris.forEach { persist(it) }
        settings.adUris = settings.adUris + uris.map { it.toString() }
        refreshAdSummary()
    }
    private val pickAdFolder = registerForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
        uri ?: return@registerForActivityResult
        persist(uri)
        settings.setString(K.AD_FOLDER_TREE, uri.toString())
        refreshAdSummary()
    }
    private val requestStorage = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        refreshAdSummary()
    }

    override fun onCreatePreferences(savedInstanceState: Bundle?, rootKey: String?) {
        setPreferencesFromResource(R.xml.preferences, rootKey)
        settings = AppSettings(requireContext())

        numeric(K.DB_PORT, K.DB_LOGIN_TIMEOUT, K.DB_QUERY_TIMEOUT, K.PRICE_LIST, K.DEPOT, K.FONT_NAME, K.FONT_PRICE, K.FONT_STATUS, K.FONT_CLOCK, K.LOGO_HEIGHT,
            K.RESULT_SECONDS, K.IDLE_TIMEOUT, K.AD_IMAGE_SECONDS, K.SCAN_CHAR_TIMEOUT, K.SCAN_MIN_LEN)
        password(K.DB_PASSWORD)
        password(K.PIN)
        findPreference<EditTextPreference>(K.DB_PORT)?.summaryProvider = Preference.SummaryProvider<EditTextPreference> {
            it.text?.takeIf { t -> t.isNotBlank() } ?: "Boş: instance varsa SQL Browser, yoksa 1433"
        }

        click("db_test") { testConnection() }
        click("db_pick") { pickDatabase() }
        click("price_list_pick") { pickPriceList() }
        click("logo_pick") { launchPicker { pickLogo.launch(arrayOf("image/*")) } }
        click("logo_clear") {
            settings.setString(K.LOGO_PATH, "")
            toast("Varsayılan logo kullanılacak")
        }
        click("ad_pick_files") { launchPicker { pickAdFiles.launch(arrayOf("image/*", "video/*")) } }
        click("ad_pick_folder") { launchPicker { pickAdFolder.launch(null) } }
        click("ad_clear") {
            settings.adUris = emptyList()
            settings.setString(K.AD_FOLDER_TREE, "")
            settings.setString(K.AD_FOLDER_PATH, "")
            findPreference<EditTextPreference>(K.AD_FOLDER_PATH)?.text = ""
            refreshAdSummary()
        }
        findPreference<EditTextPreference>(K.AD_FOLDER_PATH)?.setOnPreferenceChangeListener { _, _ ->
            requestStoragePermission()
            view?.post { refreshAdSummary() }
            true
        }
        click("overlay_permission") { openOverlayPermission() }
        click("home_settings") { openHomeSettings() }
        findPreference<SwitchPreferenceCompat>(K.HOME_APP)?.setOnPreferenceChangeListener { _, value ->
            setHomeAlias(value as Boolean)
            true
        }
        click("exit_app") { requireActivity().finishAffinity() }
        findPreference<Preference>("about")?.summary =
            "Sürüm ${BuildConfig.VERSION_NAME} • Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT}) • ${Build.MANUFACTURER} ${Build.MODEL}"
    }

    override fun onResume() {
        super.onResume()
        refreshAdSummary()
        findPreference<Preference>("last_scan")?.summary = if (LastScanInfo.at == 0L) {
            "Henüz okuma yok. Ana ekranda bir barkod okutup buraya dönün."
        } else {
            "${LastScanInfo.code}\nKaynak: ${LastScanInfo.source}\n${DateFormat.getTimeInstance().format(Date(LastScanInfo.at))}"
        }
    }

    // --- Helpers ---------------------------------------------------------------------------

    private fun click(key: String, action: () -> Unit) {
        findPreference<Preference>(key)?.setOnPreferenceClickListener { action(); true }
    }

    private fun numeric(vararg keys: String) = keys.forEach { key ->
        findPreference<EditTextPreference>(key)?.setOnBindEditTextListener {
            it.inputType = InputType.TYPE_CLASS_NUMBER
            it.setSelection(it.text.length)
        }
    }

    private fun password(key: String) {
        findPreference<EditTextPreference>(key)?.apply {
            setOnBindEditTextListener { it.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD }
            summaryProvider = Preference.SummaryProvider<EditTextPreference> { p ->
                if (p.text.isNullOrEmpty()) "Ayarlanmadı" else "•".repeat(p.text!!.length.coerceAtMost(8))
            }
        }
    }

    private fun toast(msg: String) = Toast.makeText(requireContext(), msg, Toast.LENGTH_LONG).show()

    private fun info(title: String, msg: String) {
        AlertDialog.Builder(requireContext()).setTitle(title).setMessage(msg).setPositiveButton("Tamam", null).show()
    }

    private fun progress(msg: String): AlertDialog =
        AlertDialog.Builder(requireContext()).setMessage(msg).setCancelable(false).show()

    private fun launchPicker(launch: () -> Unit) {
        try {
            launch()
        } catch (e: ActivityNotFoundException) {
            info("Dosya seçici yok", "Bu cihazda sistem dosya seçicisi bulunamadı. Reklamlar için \"Reklam klasörü yolu\" alanına klasör yolunu elle yazın (örn. /sdcard/Reklam).")
        }
    }

    private fun persist(uri: Uri) {
        runCatching {
            requireContext().contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    }

    // --- Database -------------------------------------------------------------------------

    private fun testConnection() {
        val cfg = settings.dbConfig()
        if (cfg.host.isBlank() || cfg.user.isBlank()) return info("Eksik bilgi", "Sunucu IP ve kullanıcı adını girin.")
        val dlg = progress("Bağlanılıyor…")
        viewLifecycleOwner.lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) { MikroRepository.testConnection(cfg) }
            dlg.dismiss()
            result.fold(
                onSuccess = { info("Bağlantı testi", it) },
                onFailure = { info("Bağlantı başarısız", it.message ?: it.toString()) },
            )
        }
    }

    private fun pickDatabase() {
        val cfg = settings.dbConfig()
        if (cfg.host.isBlank() || cfg.user.isBlank()) return info("Eksik bilgi", "Önce sunucu IP, kullanıcı adı ve şifreyi girin.")
        val dlg = progress("Veritabanları listeleniyor…")
        viewLifecycleOwner.lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) { MikroRepository.listDatabases(cfg) }
            dlg.dismiss()
            result.fold(
                onSuccess = { names ->
                    if (names.isEmpty()) return@fold info("Veritabanı yok", "Sunucuda erişilebilir veritabanı bulunamadı.")
                    AlertDialog.Builder(requireContext())
                        .setTitle("Veritabanı seçin")
                        .setItems(names.toTypedArray()) { _, i ->
                            findPreference<EditTextPreference>(K.DB_NAME)?.text = names[i]
                        }
                        .setNegativeButton("İptal", null)
                        .show()
                },
                onFailure = { info("Listelenemedi", it.message ?: it.toString()) },
            )
        }
    }

    private fun pickPriceList() {
        val cfg = settings.dbConfig()
        if (!cfg.isComplete) return info("Eksik bilgi", "Önce bağlantı bilgilerini ve veritabanını girin.")
        val dlg = progress("Fiyat listeleri alınıyor…")
        viewLifecycleOwner.lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) { MikroRepository.listPriceLists(cfg) }
            dlg.dismiss()
            result.fold(
                onSuccess = { lists ->
                    if (lists.isEmpty()) return@fold info("Liste yok", "Fiyat listesi tanımı bulunamadı. Liste numarasını elle girin.")
                    val labels = lists.map { "${it.number} - ${it.description.ifBlank { "(açıklama yok)" }}${if (it.kdvDahil) "  [KDV dahil]" else ""}" }
                    AlertDialog.Builder(requireContext())
                        .setTitle("Fiyat listesi seçin")
                        .setItems(labels.toTypedArray()) { _, i ->
                            findPreference<EditTextPreference>(K.PRICE_LIST)?.text = lists[i].number.toString()
                        }
                        .setNegativeButton("İptal", null)
                        .show()
                },
                onFailure = { info("Listelenemedi", it.message ?: it.toString()) },
            )
        }
    }

    // --- Media ----------------------------------------------------------------------------

    private fun saveLogo(uri: Uri) {
        val ctx = requireContext().applicationContext
        viewLifecycleOwner.lifecycleScope.launch {
            val path = withContext(Dispatchers.IO) {
                val bmp = Bitmaps.decode(ctx, uri, 1024, 1024) ?: return@withContext null
                val file = File(ctx.filesDir, "logo.png")
                file.outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
                file.absolutePath
            }
            if (path == null) {
                toast("Logo okunamadı")
            } else {
                settings.setString(K.LOGO_PATH, path)
                toast("Logo kaydedildi")
            }
        }
    }

    private fun refreshAdSummary() {
        val ctx = context ?: return
        viewLifecycleOwner.lifecycleScope.launch {
            val items = withContext(Dispatchers.IO) { AdSources.load(ctx, settings) }
            val images = items.count { it.kind == com.fiyatgor.app.ads.MediaKind.IMAGE }
            val videos = items.size - images
            findPreference<Preference>("ad_summary")?.summary =
                if (items.isEmpty()) "Reklam medyası seçilmedi" else "$images resim, $videos video"
        }
    }

    private fun requestStoragePermission() {
        val perms = if (Build.VERSION.SDK_INT >= 33) {
            arrayOf(Manifest.permission.READ_MEDIA_IMAGES, Manifest.permission.READ_MEDIA_VIDEO)
        } else {
            arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)
        }
        val missing = perms.filter { ContextCompat.checkSelfPermission(requireContext(), it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isNotEmpty()) requestStorage.launch(missing.toTypedArray())
    }

    // --- Kiosk ----------------------------------------------------------------------------

    private fun openOverlayPermission() {
        if (Build.VERSION.SDK_INT < 23) return toast("Bu Android sürümünde gerekmez")
        try {
            startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${requireContext().packageName}")))
        } catch (e: ActivityNotFoundException) {
            toast("Bu cihazda izin ekranı bulunamadı")
        }
    }

    private fun openHomeSettings() {
        try {
            startActivity(Intent(Settings.ACTION_HOME_SETTINGS))
        } catch (e: ActivityNotFoundException) {
            toast("Ana ekran ayarı bulunamadı; Ana Sayfa tuşuna basıp Fiyat Gör'ü \"Her zaman\" seçin")
        }
    }

    private fun setHomeAlias(enabled: Boolean) {
        val ctx = requireContext()
        ctx.packageManager.setComponentEnabledSetting(
            ComponentName(ctx, "com.fiyatgor.app.HomeAlias"),
            if (enabled) PackageManager.COMPONENT_ENABLED_STATE_ENABLED else PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
            PackageManager.DONT_KILL_APP,
        )
        if (enabled) toast("Ana Sayfa tuşuna basıp Fiyat Gör'ü \"Her zaman\" olarak seçin")
    }
}
