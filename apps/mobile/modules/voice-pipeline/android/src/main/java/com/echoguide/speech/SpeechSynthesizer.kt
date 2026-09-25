package com.echoguide.speech

import android.content.Context
import android.media.MediaPlayer
import android.speech.tts.TextToSpeech
import java.util.Locale

class SpeechSynthesizer(private val context: Context) : TextToSpeech.OnInitListener {
    private var tts: TextToSpeech = TextToSpeech(context, this)
    private var player: MediaPlayer? = null
    private var language: String = PhraseCatalog.language

    init {
        PhraseCatalog.refresh(context, language)
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            tts.language = PhraseCatalog.locale()
        }
    }

    fun setLanguage(languageCode: String) {
        PhraseCatalog.refresh(context, languageCode)
        language = PhraseCatalog.language
        tts.language = PhraseCatalog.locale()
    }

    fun playPhrase(key: String) {
        val path = PhraseCatalog.assetPath(key)
        try {
            context.assets.openFd(path).use { fd ->
                player?.release()
                player = MediaPlayer().apply {
                    setDataSource(fd.fileDescriptor, fd.startOffset, fd.length)
                    prepare()
                    start()
                }
            }
        } catch (_: Exception) {
            speak(PhraseCatalog.text(key), language)
        }
    }

    fun speak(text: String, languageCode: String) {
        val locale = if (languageCode == "en-US") Locale.US else Locale.forLanguageTag("am-ET")
        tts.language = locale
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "UTTERANCE_ID")
    }
}
