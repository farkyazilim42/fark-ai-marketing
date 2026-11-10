package com.fiyatgor.app.ui

import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ActivityInfo
import android.graphics.BitmapFactory
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.text.Editable
import android.text.TextWatcher
import android.util.TypedValue
import android.view.Gravity
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.widget.TextViewCompat
import androidx.lifecycle.lifecycleScope
import com.fiyatgor.app.FiyatGorApp
import com.fiyatgor.app.LastScanInfo
import com.fiyatgor.app.R
import com.fiyatgor.app.ads.AdItem
import com.fiyatgor.app.ads.AdPlayer
import com.fiyatgor.app.ads.AdSources
import com.fiyatgor.app.databinding.ActivityMainBinding
import com.fiyatgor.app.db.ErrorMessages
import com.fiyatgor.app.db.LookupResult
import com.fiyatgor.app.db.PriceFormatter
import com.fiyatgor.app.scan.BarcodeSanitizer
import com.fiyatgor.app.scan.DuplicateFilter
import com.fiyatgor.app.scan.ScanBuffer
import com.fiyatgor.app.scan.ScanExtras
import com.fiyatgor.app.settings.AppSettings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.concurrent.atomic.AtomicLong

class MainActivity : AppCompatActivity() {
    private lateinit var b: ActivityMainBinding
    private lateinit var settings: AppSettings
    private lateinit var adPlayer: AdPlayer
    private val app get() = application as FiyatGorApp

    private val handler = Handler(Looper.getMainLooper())
    private val scanSeq = AtomicLong(0)
    private val keyBuffer = ScanBuffer()
    private val duplicates = DuplicateFilter()
    private var receiver: BroadcastReceiver? = null
    private var adItems: List<AdItem> = emptyList()
    private var cornerTaps = 0
    private var lastCornerTap = 0L
    private var pinDialogOpen = false

    private val idleRunnable = Runnable { startAds() }
    private val resetRunnable = Runnable { showWelcome() }
    private val keyFlushRunnable = Runnable { keyBuffer.flush()?.let { onScan(it, "Klavye") } }
    private val inputFlushRunnable = Runnable { flushHiddenInput(force = true) }
    private val pingRunnable = object : Runnable {
        override fun run() {
            ping()
            handler.postDelayed(this, PING_INTERVAL_MS)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityMainBinding.inflate(layoutInflater)
        setContentView(b.root)
        settings = AppSettings(this)
        adPlayer = AdPlayer(b.overlays.adOverlay, b.overlays.adImage, b.overlays.adVideo, lifecycleScope)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (adPlayer.isRunning) stopAds()
            }
        })

        b.logo.setOnLongClickListener { askPinAndOpenSettings(); true }
        b.overlays.settingsCorner.setOnClickListener { onCornerTap() }
        b.overlays.adOverlay.setOnClickListener { stopAds(); resetIdle() }
        setupHiddenInput()
        showWelcome()
    }

    override fun onResume() {
        super.onResume()
        applySettings()
        registerScanReceiver()
        enterFullscreen()
        b.overlays.hiddenInput.requestFocus()
        resetIdle()
        handler.post(pingRunnable)
        lifecycleScope.launch {
            adItems = withContext(Dispatchers.IO) { AdSources.load(this@MainActivity, settings) }
        }
    }

    override fun onPause() {
        super.onPause()
        unregisterScanReceiver()
        handler.removeCallbacksAndMessages(null)
        stopAds()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            enterFullscreen()
            b.overlays.hiddenInput.requestFocus()
        }
    }

    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        if (ev.actionMasked == MotionEvent.ACTION_DOWN) resetIdle()
        return super.dispatchTouchEvent(ev)
    }

    // --- Scanner input ---------------------------------------------------------------------

    /** Keyboard-wedge scanners (USB HID / virtual keyboard) arrive here regardless of focus. */
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (!settings.keyboardScanEnabled || pinDialogOpen) return super.dispatchKeyEvent(event)
        val code = event.keyCode
        if (code == KeyEvent.KEYCODE_BACK || code == KeyEvent.KEYCODE_VOLUME_UP ||
            code == KeyEvent.KEYCODE_VOLUME_DOWN || code == KeyEvent.KEYCODE_VOLUME_MUTE
        ) return super.dispatchKeyEvent(event)

        val mode = settings.endMode
        val isEnter = code == KeyEvent.KEYCODE_ENTER || code == KeyEvent.KEYCODE_NUMPAD_ENTER
        val isTab = code == KeyEvent.KEYCODE_TAB

        if (event.action == KeyEvent.ACTION_MULTIPLE && code == KeyEvent.KEYCODE_UNKNOWN) {
            event.characters?.let { appendKeyText(it) }
            return true
        }
        if (event.action != KeyEvent.ACTION_DOWN) {
            return isEnter || isTab || event.unicodeChar != 0 || super.dispatchKeyEvent(event)
        }
        if ((isEnter && mode.terminatesOnEnter()) || (isTab && mode.terminatesOnTab())) {
            handler.removeCallbacks(keyFlushRunnable)
            keyBuffer.flush()?.let { onScan(it, "Klavye") }
            return true
        }
        if (isEnter || isTab) return true
        val ch = event.unicodeChar
        if (ch != 0 && (ch and KeyCharacterMapCombining) == 0) {
            appendKeyText(ch.toChar().toString())
            return true
        }
        return super.dispatchKeyEvent(event)
    }

    private fun appendKeyText(text: String) {
        keyBuffer.append(text, SystemClock.uptimeMillis())
        handler.removeCallbacks(keyFlushRunnable)
        if (settings.endMode.usesTimeout()) handler.postDelayed(keyFlushRunnable, settings.charTimeoutMs)
    }

    /** Some built-in scanner services type into the focused editor via the IME instead of key events. */
    @SuppressLint("ClickableViewAccessibility")
    private fun setupHiddenInput() {
        val input = b.overlays.hiddenInput
        input.showSoftInputOnFocus = false
        input.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                if (s.isNullOrEmpty()) return
                flushHiddenInput(force = false)
            }
        })
        input.setOnEditorActionListener { _, _, _ -> flushHiddenInput(force = true); true }
    }

    private fun flushHiddenInput(force: Boolean) {
        val input = b.overlays.hiddenInput
        val text = input.text?.toString().orEmpty()
        if (text.isEmpty()) return
        val terminator = text.indexOfFirst { it == '\n' || it == '\r' || it == '\t' }
        handler.removeCallbacks(inputFlushRunnable)
        when {
            terminator >= 0 -> {
                input.setText("")
                onScan(text.substring(0, terminator), "Klavye (IME)")
            }
            force -> {
                input.setText("")
                onScan(text, "Klavye (IME)")
            }
            else -> handler.postDelayed(inputFlushRunnable, settings.charTimeoutMs.coerceAtLeast(150))
        }
    }

    private fun registerScanReceiver() {
        unregisterScanReceiver()
        if (!settings.broadcastEnabled) return
        val actions = settings.broadcastActions
        if (actions.isEmpty()) return
        val extraKey = settings.broadcastExtraKey
        val r = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val bundle = intent.extras ?: return
                @Suppress("DEPRECATION")
                val map = bundle.keySet().associateWith { bundle.get(it) }
                ScanExtras.extract(map, extraKey)?.let { onScan(it, "Yayın: ${intent.action}") }
            }
        }
        val filter = IntentFilter().apply { actions.forEach { addAction(it) } }
        ContextCompat.registerReceiver(this, r, filter, ContextCompat.RECEIVER_EXPORTED)
        receiver = r
    }

    private fun unregisterScanReceiver() {
        receiver?.let { runCatching { unregisterReceiver(it) } }
        receiver = null
    }

    // --- Lookup ---------------------------------------------------------------------------

    private fun onScan(raw: String, source: String) {
        val code = BarcodeSanitizer.clean(raw)
        if (code.length < settings.minBarcodeLength) return
        if (!duplicates.accept(code, SystemClock.uptimeMillis())) return
        LastScanInfo.record(code, source)

        stopAds()
        resetIdle()
        handler.removeCallbacks(resetRunnable)
        val seq = scanSeq.incrementAndGet()
        showLoading(code)

        val cfg = settings.dbConfig()
        val opts = settings.lookupOptions()
        lifecycleScope.launch {
            // Latest scan wins: queued lookups that were superseded are skipped before hitting the DB.
            val result = withContext(app.dbDispatcher) {
                if (seq != scanSeq.get()) null else app.repository.lookup(code, cfg, opts)
            }
            if (result == null || seq != scanSeq.get()) return@launch
            render(result)
        }
    }

    private fun ping() {
        val cfg = settings.dbConfig()
        lifecycleScope.launch {
            val error = withContext(app.dbDispatcher) { app.repository.ping(cfg) }
            setConnectionState(error == null)
        }
    }

    private fun setConnectionState(ok: Boolean) {
        b.overlays.connectionDot.setBackgroundResource(if (ok) R.drawable.dot_green else R.drawable.dot_red)
    }

    private fun showWelcome() {
        b.info.productName.text = ""
        b.info.price.text = ""
        b.info.vatNote.text = ""
        b.info.details.text = ""
        b.info.status.text = settings.welcomeText
        b.info.status.setTextColor(settings.textColor)
        setVisible(b.info.status, true)
        setVisible(b.info.productName, false)
        setVisible(b.info.price, false)
        setVisible(b.info.vatNote, false)
        setVisible(b.info.details, false)
    }

    private fun showLoading(code: String) {
        b.info.productName.text = ""
        b.info.price.text = ""
        b.info.vatNote.text = ""
        b.info.details.text = if (settings.showBarcode) "Barkod: $code" else ""
        b.info.status.text = "Sorgulanıyor…"
        b.info.status.setTextColor(settings.textColor)
        setVisible(b.info.productName, false)
        setVisible(b.info.price, false)
        setVisible(b.info.vatNote, false)
        setVisible(b.info.details, settings.showBarcode)
        setVisible(b.info.status, true)
    }

    private fun render(result: LookupResult) {
        when (result) {
            is LookupResult.Found -> {
                setConnectionState(true)
                val p = result.product
                b.info.productName.setTextColor(settings.textColor)
                b.info.productName.gravity = Gravity.CENTER_HORIZONTAL or Gravity.BOTTOM
                b.info.productName.text = p.name.ifBlank { p.stockCode }
                val price = p.price
                b.info.price.text = if (price != null) {
                    PriceFormatter.format(price.amount, p.currency, settings.currencySymbol)
                } else {
                    "Fiyat tanımlı değil"
                }
                b.info.vatNote.text = when (price?.vatIncluded) {
                    true -> "KDV Dahil"
                    false -> "KDV Hariç"
                    null -> ""
                }
                b.info.details.text = buildList {
                    if (settings.showStockCode) add("Stok Kodu: ${p.stockCode}")
                    if (settings.showBarcode) add("Barkod: ${p.barcode}")
                    if (settings.showUnit && !p.unitName.isNullOrBlank()) add("Birim: ${p.unitName}")
                }.joinToString("   •   ")
                setVisible(b.info.productName, true)
                setVisible(b.info.price, true)
                setVisible(b.info.vatNote, settings.showVatNote && b.info.vatNote.text.isNotEmpty())
                setVisible(b.info.details, b.info.details.text.isNotEmpty())
                setVisible(b.info.status, false)
            }
            is LookupResult.NotFound -> {
                setConnectionState(true)
                showMessage("Ürün bulunamadı", "Barkod: ${result.barcode}")
            }
            is LookupResult.Error -> {
                setConnectionState(false)
                val title = if (result.message == ErrorMessages.NOT_CONFIGURED) "Ayarlar eksik" else "Bağlantı hatası"
                showMessage(title, result.message)
            }
        }
        scheduleReset()
    }

    private fun showMessage(title: String, detail: String) {
        b.info.productName.text = title
        b.info.productName.setTextColor(settings.priceColor)
        b.info.productName.gravity = Gravity.CENTER
        b.info.details.text = detail
        b.info.price.text = ""
        b.info.vatNote.text = ""
        setVisible(b.info.productName, true)
        setVisible(b.info.details, true)
        setVisible(b.info.price, false)
        setVisible(b.info.vatNote, false)
        setVisible(b.info.status, false)
    }

    private fun scheduleReset() {
        handler.removeCallbacks(resetRunnable)
        val s = settings.resultDisplaySec
        if (s > 0) handler.postDelayed(resetRunnable, s * 1000L)
    }

    private fun setVisible(v: View, visible: Boolean) {
        v.visibility = if (visible) View.VISIBLE else View.GONE
    }

    // --- Ads / idle -----------------------------------------------------------------------

    private fun resetIdle() {
        handler.removeCallbacks(idleRunnable)
        if (settings.adsEnabled) handler.postDelayed(idleRunnable, settings.idleTimeoutSec * 1000L)
    }

    private fun startAds() {
        if (!settings.adsEnabled || adItems.isEmpty() || pinDialogOpen) return
        adPlayer.imageDurationMs = settings.adImageSec * 1000L
        adPlayer.muted = settings.adMuted
        showWelcome()
        adPlayer.start(adItems)
    }

    private fun stopAds() {
        if (adPlayer.isRunning) adPlayer.stop()
        b.overlays.hiddenInput.requestFocus()
    }

    // --- Settings access ------------------------------------------------------------------

    private fun onCornerTap() {
        val now = SystemClock.uptimeMillis()
        cornerTaps = if (now - lastCornerTap < 1500) cornerTaps + 1 else 1
        lastCornerTap = now
        if (cornerTaps >= 5) {
            cornerTaps = 0
            askPinAndOpenSettings()
        }
    }

    private fun askPinAndOpenSettings() {
        if (pinDialogOpen) return
        val pin = settings.pin
        if (pin.isEmpty()) {
            startActivity(Intent(this, SettingsActivity::class.java))
            return
        }
        pinDialogOpen = true
        handler.removeCallbacks(idleRunnable)
        PinDialog.show(this, pin, onDismiss = {
            pinDialogOpen = false
            resetIdle()
            b.overlays.hiddenInput.requestFocus()
        }) {
            startActivity(Intent(this, SettingsActivity::class.java))
        }
    }

    // --- Appearance / kiosk ---------------------------------------------------------------

    private fun applySettings() {
        requestedOrientation = when (settings.orientation) {
            "landscape" -> ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
            "portrait" -> ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT
            "landscape_fixed" -> ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
            "portrait_fixed" -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            else -> ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        }
        b.root.setBackgroundColor(settings.backgroundColor)
        b.info.productName.setTextColor(settings.textColor)
        b.info.details.setTextColor(settings.textColor)
        b.info.vatNote.setTextColor(settings.textColor)
        b.info.price.setTextColor(settings.priceColor)
        autoSize(b.info.productName, settings.nameFontSp)
        autoSize(b.info.price, settings.priceFontSp)

        val logoFile = settings.logoPath.takeIf { it.isNotBlank() }?.let { File(it) }
        val bmp = logoFile?.takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.absolutePath) }
        if (bmp != null) b.logo.setImageBitmap(bmp) else b.logo.setImageResource(R.drawable.default_logo)
        if (b.info.status.visibility == View.VISIBLE && b.info.productName.visibility != View.VISIBLE) {
            b.info.status.text = settings.welcomeText
        }
    }

    private fun autoSize(tv: TextView, maxSp: Int) {
        TextViewCompat.setAutoSizeTextTypeUniformWithConfiguration(
            tv, (maxSp / 4).coerceAtLeast(12), maxSp, 2, TypedValue.COMPLEX_UNIT_SP
        )
    }

    private fun enterFullscreen() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    companion object {
        private const val PING_INTERVAL_MS = 60_000L
        private const val KeyCharacterMapCombining = android.view.KeyCharacterMap.COMBINING_ACCENT
    }
}
