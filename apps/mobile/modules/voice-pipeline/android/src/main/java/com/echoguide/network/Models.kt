package com.echoguide.network

import org.json.JSONObject

enum class ActionType { TAP, SCROLL, TEXT_INPUT, BACK, HOME }

data class ActionStep(
  val stepId: String,
  val actionType: ActionType,
  val targetNodeId: String?,
  val payload: String?,
  val isDestructive: Boolean,
)

data class ActionPlan(
  val planId: String,
  val packageName: String,
  val requiresUserConfirmation: Boolean,
  val steps: List<ActionStep>,
)

enum class CommandStatus { ACCEPTED, CONFIRMATION_REQUIRED, REPROMPT, REJECTED }

enum class SpeakCode {
  ACK, STILL_WORKING, RETRY, CONFIRM,
  ERR_NETWORK, ERR_TOO_SLOW, ERR_REJECTED, ERR_BILLING;

  companion object {
    fun from(raw: String?): SpeakCode = entries.firstOrNull { it.name == raw } ?: ERR_REJECTED
  }
}

data class CommandResponse(
  val commandId: String,
  val status: CommandStatus,
  val speakCode: SpeakCode,
  val repromptReason: String?,
  val speechResponseText: String?,
  val actionPlan: ActionPlan?,
)

data class ScreenContext(
  val currentPackage: String,
  val viewTreeSummary: String,
)

object CommandResponseParser {
  fun parse(body: String): CommandResponse {
    val root = JSONObject(body)
    val status = runCatching { CommandStatus.valueOf(root.getString("status")) }
      .getOrElse { CommandStatus.REJECTED }
    return CommandResponse(
      commandId = root.string("command_id").orEmpty(),
      status = status,
      speakCode = SpeakCode.from(root.string("speak_code")),
      repromptReason = root.string("reprompt_reason"),
      speechResponseText = root.string("speech_response_text"),
      actionPlan = root.optJSONObject("action_plan")?.let(::parsePlan),
    )
  }

  private fun parsePlan(plan: JSONObject): ActionPlan? {
    val steps = plan.optJSONArray("steps") ?: return null
    val parsed = ArrayList<ActionStep>(steps.length())
    for (i in 0 until steps.length()) {
      val step = steps.optJSONObject(i) ?: continue

      val type = runCatching { ActionType.valueOf(step.getString("action_type")) }.getOrNull()
        ?: return null
      parsed += ActionStep(
        stepId = step.string("step_id").orEmpty(),
        actionType = type,
        targetNodeId = step.string("target_node_id"),
        payload = step.string("payload"),
        isDestructive = step.optBoolean("is_destructive", false),
      )
    }
    return ActionPlan(
      planId = plan.string("plan_id").orEmpty(),
      packageName = plan.string("package_name").orEmpty(),
      requiresUserConfirmation = plan.optBoolean("requires_user_confirmation", false),
      steps = parsed,
    )
  }
}

private fun JSONObject.string(key: String): String? =
  if (has(key) && !isNull(key)) getString(key).ifEmpty { null } else null
