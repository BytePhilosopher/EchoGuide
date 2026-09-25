package com.echoguide.pipeline

import kotlin.math.sin
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class EnergyGateTest {
  private val frameSamples = 320

  private fun silence() = ShortArray(frameSamples)

  private fun speech(amplitude: Short = 8000): ShortArray =
    ShortArray(frameSamples) { (amplitude * sin(it * 0.3)).toInt().toShort() }

  private fun feed(gate: EnergyGate, frame: ShortArray, frames: Int): Boolean {
    var open = false
    repeat(frames) { open = gate.accept(frame, frameSamples) }
    return open
  }

  @Test
  fun `a quiet room keeps the recogniser off`() {
    val gate = EnergyGate()
    assertFalse(feed(gate, silence(), frames = 500))
  }

  @Test
  fun `speech opens the gate`() {
    val gate = EnergyGate()
    assertTrue(feed(gate, speech(), frames = 3))
  }

  @Test
  fun `the gate holds briefly after speech so a word is not cut in half`() {
    val gate = EnergyGate()
    feed(gate, speech(), frames = 5)
    assertTrue(feed(gate, silence(), frames = 10))
  }

  @Test
  fun `the gate closes once the hangover expires`() {
    val gate = EnergyGate()
    feed(gate, speech(), frames = 5)
    assertFalse(feed(gate, silence(), frames = 40))
  }

  @Test
  fun `a rising noise floor does not latch the gate open`() {
    val gate = EnergyGate()
    assertFalse(feed(gate, ShortArray(frameSamples) { 300 }, frames = 400))
  }
}
