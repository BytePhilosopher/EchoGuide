package com.echoguide.pipeline

import java.io.File
import java.io.FilterInputStream
import java.io.IOException
import java.io.InputStream
import java.util.zip.ZipInputStream

/**
 * Unpacks the wake word model that ships inside the app into app storage, once.
 * [openModel] opens the zip; [modelBytes] is its size, or -1 when unknown (no progress then).
 */
class VoskModelInstaller(
  private val modelRoot: File,
  private val openModel: () -> InputStream,
  private val modelBytes: Long,
) {
  val modelDirectory: File get() = File(modelRoot, MODEL_DIR)

  fun isInstalled(): Boolean = File(modelDirectory, "am").isDirectory ||
    File(modelDirectory, "conf").isDirectory

  fun install(onProgress: (Float) -> Unit = {}): Boolean {
    if (isInstalled()) return true
    val staging = File(modelRoot, "$MODEL_DIR.partial")
    staging.deleteRecursively()
    return try {
      CountingStream(openModel(), modelBytes, onProgress).use { input ->
        ZipInputStream(input.buffered()).use { zip ->
          generateSequence { zip.nextEntry }.forEach { entry ->
            val target = File(staging, entry.name).canonicalFile

            if (!target.path.startsWith(staging.canonicalFile.path)) return@forEach
            if (entry.isDirectory) {
              target.mkdirs()
            } else {
              target.parentFile?.mkdirs()
              target.outputStream().use { zip.copyTo(it) }
            }
          }
        }
      }

      val extracted = staging.listFiles()?.singleOrNull { it.isDirectory } ?: staging
      modelDirectory.deleteRecursively()
      extracted.renameTo(modelDirectory).also { staging.deleteRecursively() }
    } catch (_: IOException) {
      staging.deleteRecursively()
      false
    }
  }

  private class CountingStream(
    input: InputStream,
    private val total: Long,
    private val onProgress: (Float) -> Unit,
  ) : FilterInputStream(input) {
    private var read = 0L

    override fun read(): Int = super.read().also { if (it >= 0) advance(1) }

    override fun read(b: ByteArray, off: Int, len: Int): Int =
      super.read(b, off, len).also { if (it > 0) advance(it.toLong()) }

    private fun advance(count: Long) {
      read += count
      if (total > 0) onProgress((read.toFloat() / total).coerceAtMost(1f))
    }
  }

  private companion object {
    const val MODEL_DIR = "vosk-model"
  }
}
