package com.fiyatgor.app.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.util.AttributeSet
import android.view.View

class BarcodeView @JvmOverloads constructor(context: Context, attrs: AttributeSet? = null) : View(context, attrs) {
    private val paint = Paint().apply { color = Color.parseColor("#1F2937"); isAntiAlias = false }
    private var pattern: String = Ean13.pseudoModules("0000000000000")

    var barColor: Int
        get() = paint.color
        set(value) {
            paint.color = value
            invalidate()
        }

    fun setCode(code: String) {
        pattern = Ean13.modules(code) ?: Ean13.pseudoModules(code.ifEmpty { "0" })
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        if (pattern.isEmpty() || width == 0) return
        val moduleWidth = width.toFloat() / pattern.length
        var i = 0
        while (i < pattern.length) {
            if (pattern[i] == '1') {
                var j = i
                while (j < pattern.length && pattern[j] == '1') j++
                canvas.drawRect(i * moduleWidth, 0f, j * moduleWidth, height.toFloat(), paint)
                i = j
            } else {
                i++
            }
        }
    }
}
