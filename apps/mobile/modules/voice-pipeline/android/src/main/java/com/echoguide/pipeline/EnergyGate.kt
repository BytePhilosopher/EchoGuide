package com.echoguide.pipeline

import kotlin.math.sqrt

class EnergyGate(
  private val sampleRate: Int = 16_000,
  private val hangoverMs: Int = 500,
  private val openMultiplier: Double = 2.0,
  private val floorAdaptRate: Double = 0.02,
) {
  private var noiseFloor = INITIAL_FLOOR
  private var hangoverRemainingMs = 0

  val isOpen: Boolean
    get() = hangoverRemainingMs > 0

  fun reset() {
    noiseFloor = INITIAL_FLOOR
    hangoverRemainingMs = 0
  }

  fun accept(frame: ShortArray, length: Int): Boolean {
    if (length <= 0) return isOpen
    val frameMs = length * 1000 / sampleRate
    val level = rms(frame, length)

    if (level > noiseFloor * openMultiplier) {
      hangoverRemainingMs = hangoverMs
    } else {
      noiseFloor = noiseFloor * (1 - floorAdaptRate) + level * floorAdaptRate
      hangoverRemainingMs = (hangoverRemainingMs - frameMs).coerceAtLeast(0)
    }
    return isOpen
  }

  private fun rms(frame: ShortArray, length: Int): Double {
    var sum = 0.0
    for (i in 0 until length) {
      val sample = frame[i].toDouble()
      sum += sample * sample
    }
    return sqrt(sum / length)
  }

  private companion object {
    const val INITIAL_FLOOR = 400.0
  }
}
