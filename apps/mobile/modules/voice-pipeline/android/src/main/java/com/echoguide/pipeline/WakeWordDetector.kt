package com.echoguide.pipeline

import java.io.File
import org.json.JSONObject
import org.vosk.Model
import org.vosk.Recognizer

class WakeWordDetector(
  private val modelDirectory: File,
  keyword: String = DEFAULT_KEYWORD,
) {
  private val keyword = keyword.trim().lowercase()
  private var model: Model? = null
  private var recognizer: Recognizer? = null

  val isAvailable: Boolean get() = modelDirectory.isDirectory

  fun prepare(): Boolean {
    if (recognizer != null) return true
    if (!isAvailable) return false
    return try {
      val loaded = Model(modelDirectory.absolutePath)

      val grammar = "[\"$keyword\", \"[unk]\"]"
      recognizer = Recognizer(loaded, SAMPLE_RATE, grammar)
      model = loaded
      true
    } catch (_: Exception) {
      close()
      false
    }
  }

  fun accept(frame: ShortArray, length: Int): Boolean {
    val active = recognizer ?: return false
    return try {
      val settled = active.acceptWaveForm(frame, length)
      val payload = if (settled) active.result else active.partialResult
      matches(payload)
    } catch (_: Exception) {
      false
    }
  }

  fun reset() {
    runCatching { recognizer?.reset() }
  }

  fun close() {
    runCatching { recognizer?.close() }
    recognizer = null
    runCatching { model?.close() }
    model = null
  }

  private fun matches(payload: String?): Boolean {
    payload ?: return false
    val json = runCatching { JSONObject(payload) }.getOrNull() ?: return false
    val heard = json.optString("text").ifEmpty { json.optString("partial") }
    if (heard.isEmpty()) return false
    return heard.lowercase().split(' ', '\n', '\t').any { it.trim() == keyword }
  }

  private companion object {
    const val SAMPLE_RATE = 16_000f

    const val DEFAULT_KEYWORD = "echo"
  }
}
