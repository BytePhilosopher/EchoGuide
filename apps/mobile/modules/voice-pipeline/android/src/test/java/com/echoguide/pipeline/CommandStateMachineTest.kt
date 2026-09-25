package com.echoguide.pipeline

import com.echoguide.network.ActionPlan
import com.echoguide.network.ActionStep
import com.echoguide.network.ActionType
import com.echoguide.network.CommandStatus
import com.echoguide.network.SpeakCode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CommandStateMachineTest {
  private val plan = ActionPlan(
    "p1", "com.app", false,
    listOf(ActionStep("s1", ActionType.TAP, "com.app:id/ok", null, false)),
  )

  @Test
  fun `every terminal state except discarded produces speech`() {
    val terminals = listOf(
      CommandStateMachine().on(CommandStateMachine.Event.NetworkFailed(SpeakCode.ERR_NETWORK)),
      CommandStateMachine().on(CommandStateMachine.Event.PlanBlockedLocally),
      CommandStateMachine().on(CommandStateMachine.Event.UserDeclined),
      CommandStateMachine().on(CommandStateMachine.Event.ExecutionFinished(true)),
      CommandStateMachine().on(CommandStateMachine.Event.ExecutionFinished(false)),
    )
    terminals.forEach { transition ->
      assertTrue(transition.isTerminal)
      assertNotNull("terminal ${transition.state} must speak", transition.speak)
    }
  }

  @Test
  fun `a discarded buffer is the one deliberate silence`() {
    val transition = CommandStateMachine().on(CommandStateMachine.Event.BufferTooShort)
    assertEquals(CommandStateMachine.State.DISCARDED, transition.state)
    assertNull(transition.speak)
    assertTrue(transition.isTerminal)
  }

  @Test
  fun `the third reprompt falls back instead of asking again`() {
    val machine = CommandStateMachine()
    val reprompt = CommandStateMachine.Event.ServerReplied(CommandStatus.REPROMPT, SpeakCode.RETRY, null)

    assertEquals(CommandStateMachine.State.REPROMPTING, machine.on(reprompt).state)
    assertEquals(CommandStateMachine.State.REPROMPTING, machine.on(reprompt).state)

    val third = machine.on(reprompt)
    assertEquals(CommandStateMachine.State.FALLBACK, third.state)
    assertNotNull(third.speak)
    assertTrue(third.isTerminal)
  }

  @Test
  fun `reset clears the reprompt count`() {
    val machine = CommandStateMachine()
    val reprompt = CommandStateMachine.Event.ServerReplied(CommandStatus.REPROMPT, SpeakCode.RETRY, null)
    machine.on(reprompt)
    machine.on(reprompt)
    machine.reset()
    assertEquals(CommandStateMachine.State.REPROMPTING, machine.on(reprompt).state)
  }

  @Test
  fun `a destructive plan goes to confirming, never straight to executing`() {
    val machine = CommandStateMachine()
    val transition = machine.on(
      CommandStateMachine.Event.ServerReplied(
        CommandStatus.CONFIRMATION_REQUIRED, SpeakCode.CONFIRM, plan,
      ),
    )
    assertEquals(CommandStateMachine.State.CONFIRMING, transition.state)
    assertEquals(SpeakCode.CONFIRM, transition.speak)
  }

  @Test
  fun `an accepted reply with no plan fails rather than executing nothing`() {
    val machine = CommandStateMachine()
    val transition = machine.on(
      CommandStateMachine.Event.ServerReplied(CommandStatus.ACCEPTED, SpeakCode.ACK, null),
    )
    assertEquals(CommandStateMachine.State.FAILED, transition.state)
    assertNotNull(transition.speak)
  }

  @Test
  fun `declining a confirmation cancels and speaks`() {
    val machine = CommandStateMachine()
    machine.on(
      CommandStateMachine.Event.ServerReplied(
        CommandStatus.CONFIRMATION_REQUIRED, SpeakCode.CONFIRM, plan,
      ),
    )
    val transition = machine.on(CommandStateMachine.Event.UserDeclined)
    assertEquals(CommandStateMachine.State.CANCELLED, transition.state)
    assertEquals("cancelled", machine.telemetryOutcome())
  }

  @Test
  fun `telemetry outcomes stay inside the server vocabulary`() {
    val allowed = setOf("done", "failed", "rejected", "blocked", "cancelled")
    CommandStateMachine.State.entries.forEach { state ->
      val machine = CommandStateMachine()

      val outcome = machine.telemetryOutcome()
      assertTrue("$state -> $outcome", outcome in allowed)
    }
  }
}
