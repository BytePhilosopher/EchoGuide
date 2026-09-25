package com.echoguide.speech

import android.media.AudioManager
import android.media.ToneGenerator

class Earcons {
  private var generator: ToneGenerator? = null

  fun play(key: String) {
    val tone = TONES[key] ?: ToneGenerator.TONE_PROP_BEEP
    val durationMs = DURATIONS[key] ?: 150
    try {
      val active = generator ?: ToneGenerator(
        AudioManager.STREAM_ACCESSIBILITY,
        VOLUME,
      ).also { generator = it }
      active.startTone(tone, durationMs)
    } catch (_: RuntimeException) {
      generator = null
    }
  }

  fun release() {
    runCatching { generator?.release() }
    generator = null
  }

  private companion object {
    const val VOLUME = 80

    val TONES = mapOf(
      "ACK" to ToneGenerator.TONE_PROP_BEEP,
      "STILL_WORKING" to ToneGenerator.TONE_PROP_PROMPT,
      "RETRY" to ToneGenerator.TONE_PROP_BEEP2,
      "CONFIRM" to ToneGenerator.TONE_PROP_ACK,
      "ERR_NETWORK" to ToneGenerator.TONE_SUP_ERROR,
      "ERR_TOO_SLOW" to ToneGenerator.TONE_SUP_ERROR,
      "ERR_REJECTED" to ToneGenerator.TONE_PROP_NACK,
      "ERR_BILLING" to ToneGenerator.TONE_PROP_NACK,
    )

    val DURATIONS = mapOf(
      "ACK" to 120,
      "STILL_WORKING" to 200,
      "RETRY" to 250,
      "CONFIRM" to 300,
      "ERR_NETWORK" to 400,
      "ERR_TOO_SLOW" to 400,
      "ERR_REJECTED" to 300,
      "ERR_BILLING" to 300,
    )
  }
}
