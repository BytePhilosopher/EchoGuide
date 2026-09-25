package com.echoguide.network

import java.util.Base64 as JavaBase64
import kotlin.random.Random
import org.junit.Assert.assertEquals
import org.junit.Test

class Base64EncoderTest {
  @Test
  fun `it matches the reference encoder across every padding case`() {
    val reference = JavaBase64.getEncoder()
    for (size in 0..64) {
      val bytes = Random(size).nextBytes(size)
      assertEquals(
        "length $size",
        reference.encodeToString(bytes),
        Base64Encoder.encode(bytes),
      )
    }
  }

  @Test
  fun `it encodes high bytes without sign extension`() {
    val bytes = byteArrayOf(-1, -128, 127, 0)
    assertEquals(JavaBase64.getEncoder().encodeToString(bytes), Base64Encoder.encode(bytes))
  }
}
