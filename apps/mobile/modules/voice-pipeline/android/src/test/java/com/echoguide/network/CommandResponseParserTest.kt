package com.echoguide.network

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CommandResponseParserTest {
  @Test
  fun `an accepted reply yields a plan`() {
    val parsed = CommandResponseParser.parse(
      """
      {"command_id":"c1","status":"ACCEPTED","speak_code":"ACK",
       "action_plan":{"plan_id":"p1","package_name":"com.app","requires_user_confirmation":false,
        "steps":[{"step_id":"s1","action_type":"TAP","target_node_id":"com.app:id/ok",
                  "is_destructive":false}]}}
      """.trimIndent(),
    )
    assertEquals(CommandStatus.ACCEPTED, parsed.status)
    assertEquals(SpeakCode.ACK, parsed.speakCode)
    assertEquals(1, parsed.actionPlan?.steps?.size)
    assertEquals(ActionType.TAP, parsed.actionPlan?.steps?.first()?.actionType)
  }

  @Test
  fun `a reprompt carries the retry code and no plan`() {
    val parsed = CommandResponseParser.parse(
      """{"command_id":"c1","status":"REPROMPT","speak_code":"RETRY","reprompt_reason":"Low confidence"}""",
    )
    assertEquals(CommandStatus.REPROMPT, parsed.status)
    assertEquals(SpeakCode.RETRY, parsed.speakCode)
    assertNull(parsed.actionPlan)
  }

  @Test
  fun `a billing rejection is understood`() {
    val parsed = CommandResponseParser.parse(
      """{"command_id":"c1","status":"REJECTED","speak_code":"ERR_BILLING","reprompt_reason":"quota"}""",
    )
    assertEquals(CommandStatus.REJECTED, parsed.status)
    assertEquals(SpeakCode.ERR_BILLING, parsed.speakCode)
  }

  @Test
  fun `an unknown action type drops the whole plan rather than half of it`() {
    val parsed = CommandResponseParser.parse(
      """
      {"command_id":"c1","status":"ACCEPTED","speak_code":"ACK",
       "action_plan":{"plan_id":"p1","package_name":"com.app","requires_user_confirmation":false,
        "steps":[{"step_id":"s1","action_type":"TAP","target_node_id":"a","is_destructive":false},
                 {"step_id":"s2","action_type":"WIPE_DEVICE","is_destructive":true}]}}
      """.trimIndent(),
    )
    assertNull(parsed.actionPlan)
  }

  @Test
  fun `an unknown status degrades to rejected rather than throwing`() {
    val parsed = CommandResponseParser.parse("""{"command_id":"c1","status":"TELEPORT"}""")
    assertEquals(CommandStatus.REJECTED, parsed.status)
  }

  @Test
  fun `a json null optional reads as null, not the string null`() {
    val parsed = CommandResponseParser.parse(
      """{"command_id":"c1","status":"REJECTED","speak_code":"ERR_REJECTED","reprompt_reason":null}""",
    )
    assertNull(parsed.repromptReason)
  }

  @Test
  fun `unknown keys are ignored so contract drift is not a crash`() {
    val parsed = CommandResponseParser.parse(
      """{"command_id":"c1","status":"ACCEPTED","speak_code":"ACK","future_field":{"a":1}}""",
    )
    assertEquals(CommandStatus.ACCEPTED, parsed.status)
  }
}
