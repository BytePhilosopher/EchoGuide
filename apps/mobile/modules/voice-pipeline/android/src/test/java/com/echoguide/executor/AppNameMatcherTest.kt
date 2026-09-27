package com.echoguide.executor

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AppNameMatcherTest {
  private val labels = listOf("Samsung Notes", "Settings", "Telegram", "Settings Suggestions")

  @Test
  fun `an exact name wins over a longer label that starts with it`() {
    assertEquals(1, AppNameMatcher.bestMatch(" settings ", labels))
  }

  @Test
  fun `a partial name finds the app`() {
    assertEquals(0, AppNameMatcher.bestMatch("notes", labels))
    assertEquals(2, AppNameMatcher.bestMatch("tele", labels))
  }

  @Test
  fun `nothing matches an unknown or blank name`() {
    assertNull(AppNameMatcher.bestMatch("whatsapp", labels))
    assertNull(AppNameMatcher.bestMatch("  ", labels))
  }
}
