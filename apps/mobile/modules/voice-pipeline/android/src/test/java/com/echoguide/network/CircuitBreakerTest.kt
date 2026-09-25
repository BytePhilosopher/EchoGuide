package com.echoguide.network

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CircuitBreakerTest {
  private var now = 0L
  private fun breaker() = CircuitBreaker(clock = { now })

  @Test
  fun `four failures keep the circuit closed`() {
    val breaker = breaker()
    repeat(4) { breaker.recordFailure() }
    assertEquals(CircuitBreaker.State.CLOSED, breaker.state())
    assertTrue(breaker.allowsRequest())
  }

  @Test
  fun `the fifth failure opens it and requests are refused without a call`() {
    val breaker = breaker()
    repeat(5) { breaker.recordFailure() }
    assertEquals(CircuitBreaker.State.OPEN, breaker.state())
    assertFalse(breaker.allowsRequest())
  }

  @Test
  fun `it half-opens after thirty seconds`() {
    val breaker = breaker()
    repeat(5) { breaker.recordFailure() }
    now += 30_000
    assertEquals(CircuitBreaker.State.HALF_OPEN, breaker.state())
    assertTrue(breaker.allowsRequest())
  }

  @Test
  fun `a failure while half-open starts a fresh open window`() {
    val breaker = breaker()
    repeat(5) { breaker.recordFailure() }
    now += 30_000
    breaker.recordFailure()
    assertEquals(CircuitBreaker.State.OPEN, breaker.state())
    now += 29_000
    assertEquals(CircuitBreaker.State.OPEN, breaker.state())
  }

  @Test
  fun `success while half-open closes it and clears the count`() {
    val breaker = breaker()
    repeat(5) { breaker.recordFailure() }
    now += 30_000
    breaker.recordSuccess()
    assertEquals(CircuitBreaker.State.CLOSED, breaker.state())
    repeat(4) { breaker.recordFailure() }
    assertEquals(CircuitBreaker.State.CLOSED, breaker.state())
  }
}
