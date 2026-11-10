package com.fiyatgor.app.ui

import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ActivityInfo
import android.content.res.ColorStateList
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.speech.tts.TextToSpeech
import android.text.Editable
import android.text.SpannableString
import android.text.Spanned
import android.text.TextWatcher
import android.text.style.RelativeSizeSpan
import android.util.TypedValue
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.graphics.ColorUtils
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
import com.fiyatgor.app.db.Product
import com.fiyatgor.app.scan.BarcodeSanitizer
import com.fiyatgor.app.scan.DuplicateFilter
import com.fiyatgor.app.scan.ScanBuffer
import com.fiyatgor.app.scan.ScanExtras
import com.fiyatgor.app.settings.AppSettings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.Date
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

    private enum class Status { CONNECTING, READY, ERROR, NOT_CONFIGURED }
    private var status = Status.CONNECTING

    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var currentProduct: Product? = null

    /** uptimeMillis deadlines driving the footer countdown; 0 = not scheduled. */
    private var resetDeadline = 0L
    private var idleDeadline = 0L
    private var idleScreen = true

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
    private val clockRunnable = object : Runnable {
        override fun run() {
            updateClock()
            handler.postDelayed(this, 1000L - System.currentTimeMillis() % 1000L + 5)
        }
    }
    private val countdownRunnable = object : Runnable {
        override fun run() {
            updateCountdown()
            handler.postDelayed(this, 250L)
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
        b.clockBox.setOnClickListener { onClockTap() }
        b.speakButton.setOnClickListener { speakCurrent(userInitiated = true) }
        b.overlays.adOverlay.setOnClickListener { stopAds(); resetIdle() }
        setupHiddenInput()
        setStatus(Status.CONNECTING)
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
        handler.post(clockRunnable)
        handler.post(countdownRunnable)
        if (settings.ttsEnabled || settings.ttsAuto) ensureTts()
        lifecycleScope.launch {
            adItems = withContext(Dispatchers.IO) { AdSources.load(this@MainActivity, settings) }
        }
    }

    override fun onPause() {
        super.onPause()
        unregisterScanReceiver()
        handler.removeCallbacksAndMessages(null)
        resetDeadline = 0L
        stopAds()
        tts?.stop()
    }

    override fun onDestroy() {
        tts?.shutdown()
        tts = null
        super.onDestroy()
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
        hideIme()
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

    /** Some keyboards (e.g. Gboard with "show with hardware keyboard") pop up on scanner key input. */
    private fun hideIme() {
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        imm.hideSoftInputFromWindow(b.overlays.hiddenInput.windowToken, 0)
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
        hideIme()

        stopAds()
        resetIdle()
        handler.removeCallbacks(resetRunnable)
        resetDeadline = 0L
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
            setStatus(
                when (error) {
                    null -> Status.READY
                    ErrorMessages.NOT_CONFIGURED -> Status.NOT_CONFIGURED
                    else -> Status.ERROR
                }
            )
        }
    }

    // --- Header ---------------------------------------------------------------------------

    private fun setStatus(s: Status) {
        status = s
        val (text, fg, bg) = when (s) {
            Status.READY -> Triple("BARKOD OKUYUCU HAZIR", "#15803D", "#E8F8EE")
            Status.ERROR -> Triple("BAĞLANTI HATASI", "#B91C1C", "#FDECEC")
            Status.NOT_CONFIGURED -> Triple("AYARLAR EKSİK", "#B45309", "#FEF4E2")
            Status.CONNECTING -> Triple("BAĞLANILIYOR…", "#B45309", "#FEF4E2")
        }
        val fgColor = Color.parseColor(fg)
        b.statusText.text = text
        b.statusText.setTextColor(fgColor)
        b.statusPill.background = GradientDrawable().apply {
            cornerRadius = dp(20f)
            setColor(Color.parseColor(bg))
            setStroke(dp(1f).toInt(), ColorUtils.setAlphaComponent(fgColor, 0x40))
        }
        b.statusDot.background = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(fgColor)
        }
    }

    private fun updateClock() {
        val now = Date()
        b.clockTime.text = DisplayTexts.time(now)
        b.clockDate.text = DisplayTexts.date(now)
    }

    // --- Card states ------------------------------------------------------------------------

    private fun showWelcome() {
        idleScreen = true
        currentProduct = null
        resetDeadline = 0L
        setVisible(b.productGroup, false)
        setVisible(b.idleGroup, true)
        b.idleTitle.text = settings.welcomeText
        updateSpeakButton()
    }

    private fun showProductLayout(withDetails: Boolean) {
        idleScreen = false
        setVisible(b.idleGroup, false)
        setVisible(b.productGroup, true)
        setVisible(b.priceRow, withDetails)
        setVisible(b.divider, withDetails)
        setVisible(b.tiles, withDetails)
        if (!withDetails) setVisible(b.vatNote, false)
    }

    private fun showLoading(code: String) {
        currentProduct = null
        showProductLayout(withDetails = false)
        b.productName.setTextColor(settings.textColor)
        b.productName.text = "Sorgulanıyor…"
        b.subtitle.text = code
        setVisible(b.subtitle, true)
        updateSpeakButton()
    }

    private fun render(result: LookupResult) {
        when (result) {
            is LookupResult.Found -> {
                setStatus(Status.READY)
                showProduct(result.product)
            }
            is LookupResult.NotFound -> {
                setStatus(Status.READY)
                showMessage("Ürün bulunamadı", "Barkod: ${result.barcode}")
            }
            is LookupResult.Error -> {
                val notConfigured = result.message == ErrorMessages.NOT_CONFIGURED
                setStatus(if (notConfigured) Status.NOT_CONFIGURED else Status.ERROR)
                showMessage(if (notConfigured) "Ayarlar eksik" else "Bağlantı hatası", result.message)
            }
        }
        scheduleReset()
    }

    private fun showProduct(p: Product) {
        currentProduct = p
        showProductLayout(withDetails = true)
        b.productName.setTextColor(settings.textColor)
        b.productName.text = p.name.ifBlank { p.stockCode }
        b.subtitle.text = p.subtitle.orEmpty()
        setVisible(b.subtitle, !p.subtitle.isNullOrBlank())

        val price = p.price
        b.price.text = if (price != null) {
            val parts = DisplayTexts.priceParts(price.amount, p.currency, settings.currencySymbol)
            priceSpan(parts)
        } else {
            "Fiyat tanımlı değil"
        }
        val vat = when (price?.vatIncluded) {
            true -> "KDV Dahil"
            false -> "KDV Hariç"
            null -> ""
        }
        b.vatNote.text = vat
        setVisible(b.vatNote, settings.showVatNote && vat.isNotEmpty())

        b.stockCodeValue.text = p.stockCode
        b.barcodeValue.text = p.barcode
        b.barcodeGraphic.setCode(p.barcode)
        b.unitValue.text = p.unitName?.takeIf { it.isNotBlank() }
            ?.let { "1 ${it.trim().uppercase(DisplayTexts.TURKISH)}" } ?: "—"
        setVisible(b.tileStock, settings.showStockCode)
        setVisible(b.tileBarcode, settings.showBarcode)
        setVisible(b.tileUnit, settings.showUnit)
        val anyTile = settings.showStockCode || settings.showBarcode || settings.showUnit
        setVisible(b.tiles, anyTile)
        setVisible(b.divider, anyTile)

        updateSpeakButton()
        if (settings.ttsAuto) speakCurrent(userInitiated = false)
    }

    /** Big number with a smaller currency label, e.g. "42,50 TL" or "₺42,50". */
    private fun priceSpan(parts: DisplayTexts.PriceParts): CharSequence {
        val text = if (parts.labelFirst) "${parts.label}${parts.number}" else "${parts.number} ${parts.label}"
        val span = SpannableString(text)
        val labelStart = if (parts.labelFirst) 0 else parts.number.length
        val labelEnd = if (parts.labelFirst) parts.label.length else text.length
        span.setSpan(RelativeSizeSpan(0.42f), labelStart, labelEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        return span
    }

    private fun showMessage(title: String, detail: String) {
        currentProduct = null
        showProductLayout(withDetails = false)
        b.productName.text = title
        b.productName.setTextColor(settings.priceColor)
        b.subtitle.text = detail
        setVisible(b.subtitle, true)
        updateSpeakButton()
    }

    private fun scheduleReset() {
        handler.removeCallbacks(resetRunnable)
        resetDeadline = 0L
        val s = settings.resultDisplaySec
        if (s > 0) {
            resetDeadline = SystemClock.uptimeMillis() + s * 1000L
            handler.postDelayed(resetRunnable, s * 1000L)
        }
    }

    // --- Footer ---------------------------------------------------------------------------

    private fun updateCountdown() {
        val now = SystemClock.uptimeMillis()
        val (deadline, totalMs) = when {
            !idleScreen && resetDeadline > 0 -> resetDeadline to settings.resultDisplaySec * 1000L
            idleScreen && idleDeadline > 0 && adItems.isNotEmpty() && !adPlayer.isRunning ->
                idleDeadline to settings.idleTimeoutSec * 1000L
            else -> 0L to 0L
        }
        val show = settings.showCountdown && deadline > 0 && totalMs > 0
        setVisible(b.countdownBox, show)
        if (!show) return
        val left = (deadline - now).coerceAtLeast(0)
        b.countdownBar.progress = (left * b.countdownBar.max / totalMs).toInt()
        b.countdownText.text = "${(left + 999) / 1000} sn"
    }

    private fun ensureTts() {
        if (tts != null) return
        tts = TextToSpeech(applicationContext) { code ->
            val engine = tts ?: return@TextToSpeech
            ttsReady = code == TextToSpeech.SUCCESS &&
                engine.setLanguage(DisplayTexts.TURKISH) >= TextToSpeech.LANG_AVAILABLE
        }
    }

    private fun speakCurrent(userInitiated: Boolean) {
        val p = currentProduct ?: return
        ensureTts()
        val engine = tts
        if (engine == null || !ttsReady) {
            if (userInitiated) {
                Toast.makeText(this, "Türkçe sesli okuma kullanılamıyor. Cihazda Türkçe ses paketi kurulu olmalı.", Toast.LENGTH_LONG).show()
            }
            return
        }
        val text = DisplayTexts.spoken(p.name.ifBlank { p.stockCode }, p.price?.amount, p.currency)
        engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "fiyat")
        if (userInitiated) resetIdle()
    }

    private fun updateSpeakButton() {
        val enabled = currentProduct != null
        b.speakButton.isEnabled = enabled
        b.speakButton.alpha = if (enabled) 1f else 0.45f
    }

    private fun setVisible(v: View, visible: Boolean) {
        v.visibility = if (visible) View.VISIBLE else View.GONE
    }

    // --- Ads / idle -----------------------------------------------------------------------

    private fun resetIdle() {
        handler.removeCallbacks(idleRunnable)
        idleDeadline = 0L
        if (settings.adsEnabled) {
            val ms = settings.idleTimeoutSec * 1000L
            idleDeadline = SystemClock.uptimeMillis() + ms
            handler.postDelayed(idleRunnable, ms)
        }
    }

    private fun startAds() {
        if (!settings.adsEnabled || adItems.isEmpty() || pinDialogOpen) return
        adPlayer.imageDurationMs = settings.adImageSec * 1000L
        adPlayer.muted = settings.adMuted
        showWelcome()
        tts?.stop()
        adPlayer.start(adItems)
    }

    private fun stopAds() {
        if (adPlayer.isRunning) adPlayer.stop()
        b.overlays.hiddenInput.requestFocus()
    }

    // --- Settings access ------------------------------------------------------------------

    private fun onClockTap() {
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
        val accent = settings.accentColor
        b.root.setBackgroundColor(settings.backgroundColor)
        b.frame.background = GradientDrawable().apply {
            setColor(settings.backgroundColor)
            setStroke(dp(3f).toInt(), accent)
            cornerRadius = dp(14f)
        }
        b.frame.clipToOutline = true

        b.companyTagline.setTextColor(accent)
        b.countdownBar.progressTintList = ColorStateList.valueOf(accent)
        b.speakIcon.imageTintList = ColorStateList.valueOf(accent)
        b.idleBarcode.barColor = ColorUtils.setAlphaComponent(settings.textColor, 0x55)
        b.barcodeGraphic.barColor = settings.textColor
        b.idleBarcode.setCode("8690002000027")

        b.productName.setTextColor(settings.textColor)
        b.idleTitle.setTextColor(settings.textColor)
        b.price.setTextColor(settings.priceColor)
        autoSize(b.productName, settings.nameFontSp)
        autoSize(b.price, settings.priceFontSp)
        b.idleTitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, settings.statusFontSp.toFloat())

        setText(b.companyName, settings.companyName)
        setText(b.companyTagline, settings.companyTagline)
        setText(b.hintText, settings.hintText)
        setVisible(b.hintPill, settings.hintText.isNotEmpty())
        val id = settings.deviceId
        setText(b.deviceId, if (id.isEmpty()) "" else "ID: $id")
        setVisible(b.clockTime, settings.clockVisible)
        setVisible(b.clockDate, settings.clockVisible)
        setVisible(b.idDivider, settings.clockVisible && id.isNotEmpty())
        b.clockTime.setTextSize(TypedValue.COMPLEX_UNIT_SP, settings.clockFontSp.toFloat())
        b.clockDate.setTextSize(TypedValue.COMPLEX_UNIT_SP, (settings.clockFontSp * 0.5f).coerceAtLeast(10f))
        setVisible(b.speakButton, settings.ttsEnabled)

        b.logo.layoutParams = b.logo.layoutParams.apply { height = dp(settings.logoHeightDp.toFloat()).toInt() }
        b.logo.maxWidth = (resources.displayMetrics.widthPixels * 0.25f).toInt()
        b.logo.scaleType = ImageView.ScaleType.FIT_CENTER
        val logoFile = settings.logoPath.takeIf { it.isNotBlank() }?.let { File(it) }
        val bmp = logoFile?.takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.absolutePath) }
        if (bmp != null) b.logo.setImageBitmap(bmp) else b.logo.setImageResource(R.drawable.default_logo)

        if (idleScreen) b.idleTitle.text = settings.welcomeText
        updateClock()
    }

    private fun setText(tv: TextView, text: String) {
        tv.text = text
        setVisible(tv, text.isNotEmpty())
    }

    private fun dp(v: Float) = v * resources.displayMetrics.density

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
