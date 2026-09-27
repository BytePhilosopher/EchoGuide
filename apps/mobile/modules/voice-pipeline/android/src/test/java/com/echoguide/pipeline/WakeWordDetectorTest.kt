package com.echoguide.pipeline

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WakeWordDetectorTest {
  @Test
  fun `a two word wake word matches when both words are heard in order`() {
    assertTrue(WakeWordDetector.containsPhrase("hey echo", "hey echo"))
    assertTrue(WakeWordDetector.containsPhrase("um hey  echo open", "hey echo"))
    assertFalse(WakeWordDetector.containsPhrase("echo hey", "hey echo"))
    assertFalse(WakeWordDetector.containsPhrase("hey", "hey echo"))
  }

  @Test
  fun `a one word wake word matches whole words only`() {
    assertTrue(WakeWordDetector.containsPhrase("Echo", "echo"))
    assertFalse(WakeWordDetector.containsPhrase("echoes", "echo"))
  }
}
