package com.echoguide.executor

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.graphics.Rect
import android.os.Bundle
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.echoguide.accessibility.ViewTreeReducer
import com.echoguide.network.ActionPlan
import com.echoguide.network.ActionStep
import com.echoguide.network.ActionType
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class AccessibilityExecutorService : AccessibilityService() {
  private val reducer = ViewTreeReducer()

  override fun onServiceConnected() {
    super.onServiceConnected()
    instance = this
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit

  override fun onInterrupt() = Unit

  override fun onDestroy() {
    if (instance === this) instance = null
    super.onDestroy()
  }

  fun captureScreen(): ViewTreeReducer.Reduction = reducer.reduce(rootInActiveWindow)

  fun foregroundPackage(): String = rootInActiveWindow?.packageName?.toString().orEmpty()

  fun execute(plan: ActionPlan): Boolean =
    plan.steps.all { step -> perform(step) }

  private fun perform(step: ActionStep): Boolean = when (step.actionType) {
    ActionType.BACK -> performGlobalAction(GLOBAL_ACTION_BACK)
    ActionType.HOME -> performGlobalAction(GLOBAL_ACTION_HOME)
    ActionType.TAP -> withNode(step.targetNodeId) { tap(it) }
    ActionType.SCROLL -> withNode(step.targetNodeId) {
      it.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
    }
    ActionType.TEXT_INPUT -> withNode(step.targetNodeId) { node ->
      val args = Bundle().apply {
        putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, step.payload)
      }
      node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
    }
  }

  private inline fun withNode(nodeId: String?, action: (AccessibilityNodeInfo) -> Boolean): Boolean {
    if (nodeId.isNullOrEmpty()) return false
    val root = rootInActiveWindow ?: return false
    val node = root.findAccessibilityNodeInfosByViewId(nodeId)?.firstOrNull() ?: return false
    return action(node)
  }

  private fun tap(node: AccessibilityNodeInfo): Boolean {
    val bounds = Rect().also { node.getBoundsInScreen(it) }
    if (bounds.isEmpty) return node.performAction(AccessibilityNodeInfo.ACTION_CLICK)

    val path = Path().apply { moveTo(bounds.exactCenterX(), bounds.exactCenterY()) }
    val gesture = GestureDescription.Builder()
      .addStroke(GestureDescription.StrokeDescription(path, 0, TAP_DURATION_MS))
      .build()

    val latch = CountDownLatch(1)
    var completed = false
    val dispatched = dispatchGesture(
      gesture,
      object : GestureResultCallback() {
        override fun onCompleted(description: GestureDescription?) {
          completed = true
          latch.countDown()
        }

        override fun onCancelled(description: GestureDescription?) {
          latch.countDown()
        }
      },
      null,
    )
    if (!dispatched) return false
    latch.await(GESTURE_TIMEOUT_MS, TimeUnit.MILLISECONDS)
    return completed
  }

  companion object {
    @Volatile
    var instance: AccessibilityExecutorService? = null
      private set

    const val TAP_DURATION_MS = 60L
    const val GESTURE_TIMEOUT_MS = 2_000L
  }
}
