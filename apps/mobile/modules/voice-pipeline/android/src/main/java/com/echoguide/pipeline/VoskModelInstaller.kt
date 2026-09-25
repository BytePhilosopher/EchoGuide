package com.echoguide.pipeline

import com.echoguide.voice.BuildConfig
import java.io.File
import java.io.IOException
import java.net.URL
import java.util.zip.ZipInputStream

class VoskModelInstaller(
  private val modelRoot: File,
  private val modelUrl: String = BuildConfig.VOSK_MODEL_URL,
  private val openStream: (String) -> java.io.InputStream = { URL(it).openStream() },
) {
  val modelDirectory: File get() = File(modelRoot, MODEL_DIR)

  fun isInstalled(): Boolean = File(modelDirectory, "am").isDirectory ||
    File(modelDirectory, "conf").isDirectory

  fun install(): Boolean {
    if (isInstalled()) return true
    val staging = File(modelRoot, "$MODEL_DIR.partial")
    staging.deleteRecursively()
    return try {
      openStream(modelUrl).use { input ->
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
    } catch (_: SecurityException) {
      staging.deleteRecursively()
      false
    }
  }

  private companion object {
    const val MODEL_DIR = "vosk-model"
  }
}
