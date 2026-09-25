package com.echoguide.executor

import com.echoguide.network.ActionPlan
import com.echoguide.network.ActionStep
import com.echoguide.network.ActionType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PlanValidatorTest {
  private val bank = "com.bank.app"
  private val live = setOf("com.bank.app:id/send", "com.bank.app:id/amount")

  private fun plan(
    pkg: String = bank,
    steps: List<ActionStep>,
    confirm: Boolean = false,
  ) = ActionPlan("plan-1", pkg, confirm, steps)

  private fun tap(node: String?, destructive: Boolean = false) =
    ActionStep("s1", ActionType.TAP, node, null, destructive)

  @Test
  fun `an empty plan is blocked`() {
    val verdict = PlanValidator.validate(plan(steps = emptyList()), bank, live)
    assertEquals(
      PlanValidator.Verdict.Blocked(PlanValidator.Reason.EMPTY_PLAN),
      verdict,
    )
  }

  @Test
  fun `a plan for another app is blocked`() {
    val verdict = PlanValidator.validate(
      plan(pkg = "com.other.app", steps = listOf(tap("com.bank.app:id/send"))),
      bank,
      live,
    )
    assertEquals(
      PlanValidator.Verdict.Blocked(PlanValidator.Reason.FOREGROUND_PACKAGE_MISMATCH),
      verdict,
    )
  }

  @Test
  fun `a lookalike package is blocked, not prefix-matched`() {
    val verdict = PlanValidator.validate(
      plan(pkg = "com.bank.app.evil", steps = listOf(tap("com.bank.app:id/send"))),
      bank,
      live,
    )
    assertEquals(
      PlanValidator.Verdict.Blocked(PlanValidator.Reason.FOREGROUND_PACKAGE_MISMATCH),
      verdict,
    )
  }

  @Test
  fun `a node that is not on screen is blocked`() {
    val verdict = PlanValidator.validate(
      plan(steps = listOf(tap("com.bank.app:id/confirm_transfer"))),
      bank,
      live,
    )
    assertEquals(
      PlanValidator.Verdict.Blocked(PlanValidator.Reason.UNKNOWN_TARGET_NODE),
      verdict,
    )
  }

  @Test
  fun `a node id that is only a substring of a live id is blocked`() {
    val verdict = PlanValidator.validate(
      plan(steps = listOf(tap("com.bank.app:id/sen"))),
      bank,
      live,
    )
    assertEquals(
      PlanValidator.Verdict.Blocked(PlanValidator.Reason.UNKNOWN_TARGET_NODE),
      verdict,
    )
  }

  @Test
  fun `a tap with no target is blocked`() {
    val verdict = PlanValidator.validate(plan(steps = listOf(tap(null))), bank, live)
    assertEquals(
      PlanValidator.Verdict.Blocked(PlanValidator.Reason.MISSING_TARGET_NODE),
      verdict,
    )
  }

  @Test
  fun `text input with no payload is blocked`() {
    val step = ActionStep("s1", ActionType.TEXT_INPUT, "com.bank.app:id/amount", null, false)
    val verdict = PlanValidator.validate(plan(steps = listOf(step)), bank, live)
    assertEquals(
      PlanValidator.Verdict.Blocked(PlanValidator.Reason.MISSING_TEXT_PAYLOAD),
      verdict,
    )
  }

  @Test
  fun `a destructive step never returns Valid`() {
    val verdict = PlanValidator.validate(
      plan(steps = listOf(tap("com.bank.app:id/send", destructive = true))),
      bank,
      live,
    )
    assertTrue(verdict is PlanValidator.Verdict.NeedsConfirmation)
  }

  @Test
  fun `plan-level confirmation is honoured even when every step is benign`() {
    val verdict = PlanValidator.validate(
      plan(steps = listOf(tap("com.bank.app:id/send")), confirm = true),
      bank,
      live,
    )
    assertTrue(verdict is PlanValidator.Verdict.NeedsConfirmation)
  }

  @Test
  fun `a benign plan on the right screen is valid`() {
    val verdict = PlanValidator.validate(
      plan(steps = listOf(tap("com.bank.app:id/send"))),
      bank,
      live,
    )
    assertEquals(PlanValidator.Verdict.Valid, verdict)
  }

  @Test
  fun `back and home need no target`() {
    val steps = listOf(
      ActionStep("s1", ActionType.BACK, null, null, false),
      ActionStep("s2", ActionType.HOME, null, null, false),
    )
    assertEquals(PlanValidator.Verdict.Valid, PlanValidator.validate(plan(steps = steps), bank, live))
  }
}
