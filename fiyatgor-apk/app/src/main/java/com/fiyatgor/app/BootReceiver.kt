package com.fiyatgor.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.fiyatgor.app.settings.AppSettings
import com.fiyatgor.app.ui.MainActivity

/**
 * Android 10+ blocks activity starts from the background unless the app holds the
 * "display over other apps" permission (requested from settings) or is the HOME app.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action !in BOOT_ACTIONS) return
        if (!AppSettings(context).launchOnBoot) return
        context.startActivity(
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
    }

    companion object {
        private val BOOT_ACTIONS = setOf(
            Intent.ACTION_BOOT_COMPLETED,
            "android.intent.action.QUICKBOOT_POWERON",
        )
    }
}
