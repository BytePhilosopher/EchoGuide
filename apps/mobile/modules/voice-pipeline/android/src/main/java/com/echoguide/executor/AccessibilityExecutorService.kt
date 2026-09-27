package com.echoguide.executor

import android.accessibilityservice.AccessibilityButtonController
import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.Intent
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

  @Volatile
  private var currentPackage: String = ""

  @Volatile
  private var settleLatch: CountDownLatch? = null

  private val shortcutCallback = object : AccessibilityButtonController.AccessibilityButtonCallback() {
    override fun onClicked(controller: AccessibilityButtonController) {
      onShortcut?.invoke()
    }
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    instance = this
    runCatching {
      accessibilityButtonController.registerAccessibilityButtonCallback(shortcutCallback)
    }
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    event?.packageName?.let { currentPackage = it.toString() }
    if (event?.eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED ||
      event?.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
    ) {
      settleLatch?.countDown()
    }
  }

  override fun onInterrupt() = Unit

  override fun onDestroy() {
    runCatching {
      accessibilityButtonController.unregisterAccessibilityButtonCallback(shortcutCallback)
    }
    if (instance === this) instance = null
    super.onDestroy()
  }

  fun captureScreen(): ViewTreeReducer.Reduction = reducer.reduce(rootInActiveWindow)

  fun foregroundPackage(): String =
    currentPackage.ifEmpty { rootInActiveWindow?.packageName?.toString().orEmpty() }

  fun execute(plan: ActionPlan): Boolean {
    plan.steps.forEachIndexed { index, step ->
      if (!perform(step)) return false
      if (index < plan.steps.lastIndex) awaitSettle()
    }
    return true
  }

  private fun awaitSettle() {
    val latch = CountDownLatch(1)
    settleLatch = latch
    latch.await(SETTLE_TIMEOUT_MS, TimeUnit.MILLISECONDS)
    settleLatch = null
  }

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
    ActionType.OPEN_APP -> openApp(step.payload.orEmpty())
  }

  private fun openApp(name: String): Boolean {
    val launchers = packageManager.queryIntentActivities(
      Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER),
      0,
    )
    val labels = launchers.map { it.loadLabel(packageManager).toString() }
    val activity = AppNameMatcher.bestMatch(name, labels)?.let { launchers[it].activityInfo }
      ?: return false
    val intent = Intent(Intent.ACTION_MAIN)
      .addCategory(Intent.CATEGORY_LAUNCHER)
      .setClassName(activity.packageName, activity.name)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
    return runCatching { startActivity(intent) }.isSuccess
  }

  // Ids are the reducer's, not Android view ids: most nodes have no view id, and view ids repeat.
  private inline fun withNode(nodeId: String?, action: (AccessibilityNodeInfo) -> Boolean): Boolean {
    if (nodeId.isNullOrEmpty()) return false
    val node = captureScreen().nodes[nodeId] ?: return false
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

    @Volatile
    var onShortcut: (() -> Unit)? = null

    const val SETTLE_TIMEOUT_MS = 400L
    const val TAP_DURATION_MS = 60L
    const val GESTURE_TIMEOUT_MS = 2_000L
  }
}
