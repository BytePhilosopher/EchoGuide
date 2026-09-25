package com.echoguide.executor

import com.echoguide.network.ActionPlan
import com.echoguide.network.ActionType

object PlanValidator {
  sealed interface Verdict {
    data object Valid : Verdict
    data class NeedsConfirmation(val destructiveSteps: Int) : Verdict
    data class Blocked(val reason: Reason) : Verdict
  }

  enum class Reason {
    EMPTY_PLAN,
    FOREGROUND_PACKAGE_MISMATCH,
    UNKNOWN_TARGET_NODE,
    MISSING_TARGET_NODE,
    MISSING_TEXT_PAYLOAD,
  }

  private val NODE_ADDRESSED = setOf(ActionType.TAP, ActionType.SCROLL, ActionType.TEXT_INPUT)

  fun validate(
    plan: ActionPlan,
    foregroundPackage: String,
    visibleNodeIds: Set<String>,
  ): Verdict {
    if (plan.steps.isEmpty()) return Verdict.Blocked(Reason.EMPTY_PLAN)

    if (plan.packageName != foregroundPackage) {
      return Verdict.Blocked(Reason.FOREGROUND_PACKAGE_MISMATCH)
    }

    plan.steps.forEach { step ->
      if (step.actionType in NODE_ADDRESSED) {
        val nodeId = step.targetNodeId
          ?: return Verdict.Blocked(Reason.MISSING_TARGET_NODE)
        if (nodeId !in visibleNodeIds) return Verdict.Blocked(Reason.UNKNOWN_TARGET_NODE)
      }
      if (step.actionType == ActionType.TEXT_INPUT && step.payload.isNullOrEmpty()) {
        return Verdict.Blocked(Reason.MISSING_TEXT_PAYLOAD)
      }
    }

    val destructive = plan.steps.count { it.isDestructive }
    return if (destructive > 0 || plan.requiresUserConfirmation) {
      Verdict.NeedsConfirmation(destructive)
    } else {
      Verdict.Valid
    }
  }
}
