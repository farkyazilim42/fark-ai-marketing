package com.fiyatgor.app.ads

import android.view.View
import android.widget.ImageView
import android.widget.VideoView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class AdPlayer(
    private val container: View,
    private val image: ImageView,
    private val video: VideoView,
    private val scope: CoroutineScope,
) {
    private var items: List<AdItem> = emptyList()
    private var index = -1
    private var failures = 0
    private var job: Job? = null
    var imageDurationMs: Long = 8000
    var muted: Boolean = false
    var isRunning = false
        private set

    fun start(list: List<AdItem>) {
        if (list.isEmpty()) return
        stop()
        items = list
        index = -1
        failures = 0
        isRunning = true
        container.visibility = View.VISIBLE
        next()
    }

    fun stop() {
        isRunning = false
        job?.cancel()
        job = null
        runCatching { video.stopPlayback() }
        video.setOnCompletionListener(null)
        video.setOnErrorListener(null)
        video.setOnPreparedListener(null)
        video.visibility = View.GONE
        image.setImageDrawable(null)
        container.visibility = View.GONE
    }

    private fun next() {
        if (!isRunning) return
        if (failures >= items.size) {
            stop()
            return
        }
        index = (index + 1) % items.size
        val item = items[index]
        when (item.kind) {
            MediaKind.IMAGE -> showImage(item)
            MediaKind.VIDEO -> playVideo(item)
        }
    }

    private fun showImage(item: AdItem) {
        job?.cancel()
        job = scope.launch {
            val w = container.width.takeIf { it > 0 } ?: 1280
            val h = container.height.takeIf { it > 0 } ?: 800
            val bmp = withContext(Dispatchers.IO) { Bitmaps.decode(image.context, item.uri, w, h) }
            if (!isRunning) return@launch
            if (bmp == null) {
                failures++
                next()
                return@launch
            }
            failures = 0
            runCatching { video.stopPlayback() }
            video.visibility = View.GONE
            image.setImageBitmap(bmp)
            image.visibility = View.VISIBLE
            delay(imageDurationMs)
            next()
        }
    }

    private fun playVideo(item: AdItem) {
        job?.cancel()
        video.setOnPreparedListener { mp ->
            failures = 0
            if (muted) mp.setVolume(0f, 0f)
            mp.isLooping = items.size == 1
            image.visibility = View.GONE
            video.start()
        }
        video.setOnCompletionListener { next() }
        video.setOnErrorListener { _, _, _ ->
            failures++
            next()
            true
        }
        video.visibility = View.VISIBLE
        video.setVideoURI(item.uri)
    }
}
