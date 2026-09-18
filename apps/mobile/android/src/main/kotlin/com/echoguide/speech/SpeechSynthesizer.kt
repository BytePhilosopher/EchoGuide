package com.echoguide.speech

import android.content.Context
import android.speech.tts.TextToSpeech
import java.util.Locale

/**
 * Section 6.3 Speech Output Management
 * English -> On-Device Android TTS (Near-zero latency)
 * Amharic -> Addis AI Cloud TTS Queue
 */
class SpeechSynthesizer(context: Context) : TextToSpeech.OnInitListener {
    private var tts: TextToSpeech = TextToSpeech(context, this)

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            tts.language = Locale.US
        }
    }

    fun speak(text: String, language: String) {
        if (language == "en-US") {
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "UTTERANCE_ID")
        } else {
            // Stream or play pre-synthesised Amharic audio buffer
        }
    }
}
