package com.echoguide.pipeline

import com.echoguide.network.ActionPlan
import com.echoguide.network.CommandStatus
import com.echoguide.network.SpeakCode

class CommandStateMachine(private val maxReprompts: Int = 2) {
  enum class State {
    IDLE, CAPTURING, TRANSCRIBING, PLANNING, CONFIRMING, EXECUTING,
    DISCARDED, REPROMPTING, FALLBACK, BLOCKED, CANCELLED, DONE, FAILED,
  }

  sealed interface Event {
    data object WakeWord : Event
    data object BufferTooShort : Event
    data class BufferClosed(val durationMs: Int) : Event
    data class ServerReplied(val status: CommandStatus, val speakCode: SpeakCode, val plan: ActionPlan?) : Event
    data class NetworkFailed(val speakCode: SpeakCode) : Event
    data object PlanBlockedLocally : Event
    data object UserConfirmed : Event
    data object UserDeclined : Event
    data class ExecutionFinished(val success: Boolean) : Event
  }

  data class Transition(
    val state: State,
    val speak: SpeakCode?,
    val plan: ActionPlan? = null,
    val isTerminal: Boolean = false,
  )

  var state: State = State.IDLE
    private set

  private var repromptCount = 0

  fun reset() {
    state = State.IDLE
    repromptCount = 0
  }

  fun on(event: Event): Transition = when (event) {
    is Event.WakeWord -> move(State.CAPTURING, speak = null)

    is Event.BufferTooShort -> terminal(State.DISCARDED, speak = null)

    is Event.BufferClosed -> move(State.TRANSCRIBING, speak = null)

    is Event.NetworkFailed -> terminal(State.FAILED, event.speakCode)

    is Event.PlanBlockedLocally -> terminal(State.BLOCKED, SpeakCode.ERR_REJECTED)

    is Event.ServerReplied -> onServerReply(event)

    is Event.UserConfirmed -> move(State.EXECUTING, speak = null)

    is Event.UserDeclined -> terminal(State.CANCELLED, SpeakCode.ERR_REJECTED)

    is Event.ExecutionFinished ->
      if (event.success) terminal(State.DONE, SpeakCode.ACK)
      else terminal(State.FAILED, SpeakCode.ERR_REJECTED)
  }

  private fun onServerReply(event: Event.ServerReplied): Transition = when (event.status) {
    CommandStatus.REPROMPT -> {
      repromptCount += 1

      if (repromptCount > maxReprompts) terminal(State.FALLBACK, SpeakCode.ERR_TOO_SLOW)
      else move(State.REPROMPTING, SpeakCode.RETRY)
    }
    CommandStatus.REJECTED -> terminal(State.BLOCKED, event.speakCode)
    CommandStatus.CONFIRMATION_REQUIRED ->
      Transition(State.CONFIRMING, SpeakCode.CONFIRM, event.plan).also { state = State.CONFIRMING }
    CommandStatus.ACCEPTED ->
      if (event.plan == null) terminal(State.FAILED, SpeakCode.ERR_REJECTED)
      else Transition(State.EXECUTING, SpeakCode.ACK, event.plan).also { state = State.EXECUTING }
  }

  private fun move(next: State, speak: SpeakCode?): Transition {
    state = next
    return Transition(next, speak)
  }

  private fun terminal(next: State, speak: SpeakCode?): Transition {
    state = next
    return Transition(next, speak, isTerminal = true)
  }

  fun telemetryOutcome(): String = when (state) {
    State.DONE -> "done"
    State.BLOCKED -> "blocked"
    State.CANCELLED -> "cancelled"
    State.FALLBACK, State.REPROMPTING -> "rejected"
    else -> "failed"
  }
}
