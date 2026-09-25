package com.echoguide.network

class CircuitBreaker(
  private val failureThreshold: Int = 5,
  private val openDurationMs: Long = 30_000,
  private val clock: () -> Long = System::currentTimeMillis,
) {
  enum class State { CLOSED, OPEN, HALF_OPEN }

  private var consecutiveFailures = 0
  private var openedAt = 0L

  @Synchronized
  fun state(): State = when {
    consecutiveFailures < failureThreshold -> State.CLOSED
    clock() - openedAt >= openDurationMs -> State.HALF_OPEN
    else -> State.OPEN
  }

  fun allowsRequest(): Boolean = state() != State.OPEN

  @Synchronized
  fun recordSuccess() {
    consecutiveFailures = 0
    openedAt = 0L
  }

  @Synchronized
  fun recordFailure() {
    consecutiveFailures += 1

    if (consecutiveFailures >= failureThreshold) openedAt = clock()
  }
}
