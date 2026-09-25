package com.echoguide.pipeline

import kotlin.math.sqrt

class VoiceActivityDetector(
  private val sampleRate: Int = 16_000,
  private val silenceTimeoutMs: Int = 700,
  private val minUtteranceMs: Int = 400,
  private val maxUtteranceMs: Int = 15_000,
) {
  enum class Decision { WAITING, SPEAKING, CLOSED_BY_SILENCE, CLOSED_BY_LIMIT, DISCARDED_TOO_SHORT }

  private var noiseFloor = INITIAL_NOISE_FLOOR
  private var speechMs = 0
  private var trailingSilenceMs = 0
  private var hasSpeechStarted = false

  var lastDecision: Decision = Decision.WAITING
    private set

  fun reset() {
    noiseFloor = INITIAL_NOISE_FLOOR
    speechMs = 0
    trailingSilenceMs = 0
    hasSpeechStarted = false
    lastDecision = Decision.WAITING
  }

  fun accept(frame: ShortArray, frameLength: Int): Decision {
    if (frameLength <= 0) return current()
    return decide(frame, frameLength).also { lastDecision = it }
  }

  private fun decide(frame: ShortArray, frameLength: Int): Decision {
    val frameMs = frameLength * 1000 / sampleRate
    val isSpeech = rms(frame, frameLength) > noiseFloor * SPEECH_MULTIPLIER

    if (isSpeech) {
      hasSpeechStarted = true
      trailingSilenceMs = 0
    } else {
      noiseFloor = noiseFloor * (1 - FLOOR_ADAPT_RATE) + rms(frame, frameLength) * FLOOR_ADAPT_RATE
      if (hasSpeechStarted) trailingSilenceMs += frameMs
    }
    if (hasSpeechStarted) speechMs += frameMs

    return when {
      speechMs >= maxUtteranceMs -> Decision.CLOSED_BY_LIMIT
      hasSpeechStarted && trailingSilenceMs >= silenceTimeoutMs ->
        if (speechMs - trailingSilenceMs >= minUtteranceMs) Decision.CLOSED_BY_SILENCE
        else Decision.DISCARDED_TOO_SHORT
      else -> current()
    }
  }

  private fun current(): Decision = if (hasSpeechStarted) Decision.SPEAKING else Decision.WAITING

  private fun rms(frame: ShortArray, length: Int): Double {
    var sum = 0.0
    for (i in 0 until length) {
      val sample = frame[i].toDouble()
      sum += sample * sample
    }
    return sqrt(sum / length)
  }

  private companion object {
    const val INITIAL_NOISE_FLOOR = 500.0
    const val SPEECH_MULTIPLIER = 2.5
    const val FLOOR_ADAPT_RATE = 0.05
  }
}
