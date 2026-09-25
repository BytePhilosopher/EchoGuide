package com.echoguide.speech

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.speech.tts.TextToSpeech
import java.util.Locale
import java.util.concurrent.atomic.AtomicLong

class SpeechSynthesizer(private val context: Context) : TextToSpeech.OnInitListener {
  enum class VoiceStatus { READY, MISSING_VOICE, UNAVAILABLE }

  private val tts = TextToSpeech(context, this)
  private val utteranceCounter = AtomicLong(0)
  private val pending = ArrayDeque<Pair<String, String>>()
  private val earcons = Earcons()

  private var player: MediaPlayer? = null
  private var isReady = false
  private var language: String = PhraseCatalog.language

  @Volatile
  var amharicStatus: VoiceStatus = VoiceStatus.UNAVAILABLE
    private set

  @Volatile
  var englishStatus: VoiceStatus = VoiceStatus.UNAVAILABLE
    private set

  init {
    PhraseCatalog.refresh(context, language)
  }

  override fun onInit(status: Int) {
    if (status != TextToSpeech.SUCCESS) return
    isReady = true
    amharicStatus = statusFor(AMHARIC)
    englishStatus = statusFor(Locale.US)
    applyLanguage(language)

    while (pending.isNotEmpty()) {
      val (text, code) = pending.removeFirst()
      speak(text, code)
    }
  }

  fun setLanguage(languageCode: String) {
    PhraseCatalog.refresh(context, languageCode)
    language = PhraseCatalog.language
    applyLanguage(language)
  }

  fun hasVoiceFor(languageCode: String): Boolean =
    if (languageCode == EN_US) englishStatus == VoiceStatus.READY
    else amharicStatus == VoiceStatus.READY

  fun playPhrase(key: String) {
    if (playAsset(PhraseCatalog.assetPath(key))) return
    if (isReady && trySpeak(PhraseCatalog.text(key), language)) return
    earcons.play(key)
  }

  fun speak(text: String, languageCode: String) {
    if (text.isEmpty()) return
    if (!isReady) {
      pending.addLast(text to languageCode)
      return
    }

    trySpeak(text, languageCode)
  }

  fun stop() {
    tts.stop()
    releasePlayer()
  }

  fun shutdown() {
    stop()
    earcons.release()
    tts.shutdown()
  }

  private fun trySpeak(text: String, languageCode: String): Boolean {
    val locale = if (languageCode == EN_US) Locale.US else AMHARIC
    if (statusFor(locale) != VoiceStatus.READY) return false
    tts.language = locale
    val id = "echoguide-${utteranceCounter.incrementAndGet()}"
    return tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, id) == TextToSpeech.SUCCESS
  }

  private fun playAsset(path: String): Boolean = try {
    context.assets.openFd(path).use { descriptor ->
      releasePlayer()
      player = MediaPlayer().apply {
        setAudioAttributes(ACCESSIBILITY_AUDIO)
        setDataSource(descriptor.fileDescriptor, descriptor.startOffset, descriptor.length)
        setOnCompletionListener { it.release(); if (player === it) player = null }
        prepare()
        start()
      }
      true
    }
  } catch (_: Exception) {
    false
  }

  private fun applyLanguage(languageCode: String) {
    if (!isReady) return
    val locale = if (languageCode == EN_US) Locale.US else AMHARIC
    if (statusFor(locale) == VoiceStatus.READY) tts.language = locale
  }

  private fun statusFor(locale: Locale): VoiceStatus = when (tts.isLanguageAvailable(locale)) {
    TextToSpeech.LANG_AVAILABLE,
    TextToSpeech.LANG_COUNTRY_AVAILABLE,
    TextToSpeech.LANG_COUNTRY_VAR_AVAILABLE,
    -> VoiceStatus.READY
    TextToSpeech.LANG_MISSING_DATA -> VoiceStatus.MISSING_VOICE
    else -> VoiceStatus.UNAVAILABLE
  }

  private fun releasePlayer() {
    player?.let { runCatching { it.release() } }
    player = null
  }

  private companion object {
    const val EN_US = "en-US"
    val AMHARIC: Locale = Locale.forLanguageTag("am-ET")
    val ACCESSIBILITY_AUDIO: AudioAttributes = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
      .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
      .build()
  }
}
