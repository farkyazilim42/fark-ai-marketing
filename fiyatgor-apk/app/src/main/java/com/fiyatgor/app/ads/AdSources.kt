package com.fiyatgor.app.ads

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.documentfile.provider.DocumentFile
import com.fiyatgor.app.settings.AppSettings
import java.io.File

data class AdItem(val uri: Uri, val kind: MediaKind)

object AdSources {
    /** Order: individually picked files, then the picked folder, then the manual folder path. */
    fun load(context: Context, settings: AppSettings): List<AdItem> {
        val items = mutableListOf<AdItem>()
        val resolver = context.contentResolver

        for (s in settings.adUris) {
            val uri = Uri.parse(s)
            val name = uri.lastPathSegment
            val mime = runCatching { resolver.getType(uri) }.getOrNull()
            MediaTypes.classify(name, mime)?.let { items += AdItem(uri, it) }
        }

        settings.adFolderTree.takeIf { it.isNotBlank() }?.let { tree ->
            runCatching {
                DocumentFile.fromTreeUri(context, Uri.parse(tree))?.listFiles()
                    ?.filter { it.isFile }
                    ?.sortedBy { it.name?.lowercase() }
                    ?.forEach { f -> MediaTypes.classify(f.name, f.type)?.let { items += AdItem(f.uri, it) } }
            }
        }

        settings.adFolderPath.takeIf { it.isNotBlank() }?.let { path ->
            runCatching {
                File(path).listFiles()
                    ?.filter { it.isFile }
                    ?.sortedBy { it.name.lowercase() }
                    ?.forEach { f -> MediaTypes.classify(f.name, null)?.let { items += AdItem(Uri.fromFile(f), it) } }
            }
        }
        return items
    }
}

object Bitmaps {
    /** Decodes with power-of-two subsampling so large ad images do not exhaust a 2 GB device. */
    fun decode(context: Context, uri: Uri, maxW: Int, maxH: Int): Bitmap? = runCatching {
        val resolver = context.contentResolver
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        var sample = 1
        while (bounds.outWidth / (sample * 2) >= maxW && bounds.outHeight / (sample * 2) >= maxH) sample *= 2
        val opts = BitmapFactory.Options().apply { inSampleSize = sample }
        resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, opts) }
    }.getOrNull()
}
