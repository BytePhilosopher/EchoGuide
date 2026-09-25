package com.echoguide.pipeline

import org.junit.Assert.assertEquals
import org.junit.Test

class FramePrerollTest {
  @Test
  fun `it keeps only the most recent frames`() {
    val preroll = FramePreroll(3)
    repeat(5) { index -> preroll.push(ShortArray(2) { index.toShort() }, 2) }
    val drained = preroll.drain()
    assertEquals(3, drained.size)
    assertEquals(2.toShort(), drained.first()[0])
    assertEquals(4.toShort(), drained.last()[0])
  }

  @Test
  fun `draining empties it so audio is never replayed twice`() {
    val preroll = FramePreroll(3)
    preroll.push(ShortArray(2), 2)
    preroll.drain()
    assertEquals(0, preroll.drain().size)
  }

  @Test
  fun `it copies the frame rather than holding the caller's reusable buffer`() {
    val preroll = FramePreroll(2)
    val shared = ShortArray(2) { 7 }
    preroll.push(shared, 2)
    shared[0] = 99
    assertEquals(7.toShort(), preroll.drain().first()[0])
  }
}
