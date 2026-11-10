package com.fiyatgor.app

import android.app.Application
import androidx.preference.PreferenceManager
import com.fiyatgor.app.db.MikroRepository
import kotlinx.coroutines.ExecutorCoroutineDispatcher
import kotlinx.coroutines.asCoroutineDispatcher
import java.util.concurrent.Executors

class FiyatGorApp : Application() {
    /** Every [repository] call must run on this single thread. */
    val dbDispatcher: ExecutorCoroutineDispatcher by lazy {
        Executors.newSingleThreadExecutor { r -> Thread(r, "fiyatgor-db").apply { isDaemon = true } }
            .asCoroutineDispatcher()
    }

    val repository: MikroRepository by lazy { MikroRepository() }

    override fun onCreate() {
        super.onCreate()
        PreferenceManager.setDefaultValues(this, R.xml.preferences, false)
    }
}

object LastScanInfo {
    @Volatile var code: String = ""
    @Volatile var source: String = ""
    @Volatile var at: Long = 0L

    fun record(code: String, source: String) {
        this.code = code
        this.source = source
        this.at = System.currentTimeMillis()
    }
}
