package com.fiyatgor.app.ui

import android.app.Activity
import android.text.InputType
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.Toast
import androidx.appcompat.app.AlertDialog

object PinDialog {
    fun show(activity: Activity, expected: String, onDismiss: () -> Unit, onSuccess: () -> Unit) {
        val input = EditText(activity).apply {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            hint = "PIN / Şifre"
            isSingleLine = true
        }
        val pad = (24 * activity.resources.displayMetrics.density).toInt()
        val frame = FrameLayout(activity).apply {
            setPadding(pad, pad / 2, pad, 0)
            addView(input)
        }
        val dialog = AlertDialog.Builder(activity)
            .setTitle("Ayarlar")
            .setMessage("Ayarlara girmek için PIN kodunu girin")
            .setView(frame)
            .setPositiveButton("Giriş") { _, _ ->
                if (input.text.toString() == expected) onSuccess()
                else Toast.makeText(activity, "Hatalı PIN", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("İptal", null)
            .setOnDismissListener { onDismiss() }
            .create()
        dialog.window?.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE)
        input.imeOptions = EditorInfo.IME_ACTION_DONE
        input.setOnEditorActionListener { _, _, _ ->
            dialog.getButton(AlertDialog.BUTTON_POSITIVE)?.performClick()
            true
        }
        dialog.show()
        input.requestFocus()
    }
}
