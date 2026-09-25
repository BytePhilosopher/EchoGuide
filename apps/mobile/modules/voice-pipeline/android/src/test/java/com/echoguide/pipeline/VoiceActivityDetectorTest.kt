package com.echoguide.pipeline

import kotlin.math.sin
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class VoiceActivityDetectorTest {
  private val frameSamples = 320

  private fun silence() = ShortArray(frameSamples)

  private fun tone(amplitude: Short = 8000): ShortArray =
    ShortArray(frameSamples) { (amplitude * sin(it * 0.3)).toInt().toShort() }

  private fun feed(vad: VoiceActivityDetector, frame: ShortArray, frames: Int):
    VoiceActivityDetector.Decision {
    var last = VoiceActivityDetector.Decision.WAITING
    repeat(frames) {
      last = vad.accept(frame, frameSamples)
      if (last == VoiceActivityDetector.Decision.CLOSED_BY_SILENCE ||
        last == VoiceActivityDetector.Decision.CLOSED_BY_LIMIT ||
        last == VoiceActivityDetector.Decision.DISCARDED_TOO_SHORT
      ) return last
    }
    return last
  }

  @Test
  fun `silence never opens a buffer`() {
    val vad = VoiceActivityDetector()
    val decision = feed(vad, silence(), frames = 250)
    assertEquals(VoiceActivityDetector.Decision.WAITING, decision)
  }

  @Test
  fun `speech shorter than the floor is discarded, not uploaded`() {
    val vad = VoiceActivityDetector()

    feed(vad, tone(), frames = 10)
    val decision = feed(vad, silence(), frames = 60)
    assertEquals(VoiceActivityDetector.Decision.DISCARDED_TOO_SHORT, decision)
  }

  @Test
  fun `a full utterance closes on trailing silence`() {
    val vad = VoiceActivityDetector()
    feed(vad, tone(), frames = 50)
    val decision = feed(vad, silence(), frames = 60)
    assertEquals(VoiceActivityDetector.Decision.CLOSED_BY_SILENCE, decision)
  }

  @Test
  fun `a mid-sentence pause does not close the buffer`() {
    val vad = VoiceActivityDetector()
    feed(vad, tone(), frames = 50)

    val decision = feed(vad, silence(), frames = 15)
    assertNotEquals(VoiceActivityDetector.Decision.CLOSED_BY_SILENCE, decision)
  }

  @Test
  fun `a runaway utterance stops at the hard limit`() {
    val vad = VoiceActivityDetector()

    val decision = feed(vad, tone(), frames = 800)
    assertEquals(VoiceActivityDetector.Decision.CLOSED_BY_LIMIT, decision)
  }
}
