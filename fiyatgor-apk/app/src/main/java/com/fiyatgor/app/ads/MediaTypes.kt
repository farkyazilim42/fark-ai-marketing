package com.fiyatgor.app.ads

enum class MediaKind { IMAGE, VIDEO }

object MediaTypes {
    private val imageExt = setOf("jpg", "jpeg", "png", "webp", "bmp", "gif")
    private val videoExt = setOf("mp4", "m4v", "3gp", "webm", "mkv", "ts", "mov")

    fun classify(name: String?, mime: String?): MediaKind? {
        val m = mime?.lowercase().orEmpty()
        if (m.startsWith("image/")) return MediaKind.IMAGE
        if (m.startsWith("video/")) return MediaKind.VIDEO
        val ext = name.orEmpty().substringAfterLast('.', "").lowercase()
        return when (ext) {
            in imageExt -> MediaKind.IMAGE
            in videoExt -> MediaKind.VIDEO
            else -> null
        }
    }
}
