package com.echoguide.accessibility

import android.text.InputType
import android.view.accessibility.AccessibilityNodeInfo

class ViewTreeReducer(
  private val maxNodes: Int = 200,
  private val maxDepth: Int = 40,
) {
  data class Reduction(
    val summary: String,
    val nodeIds: Set<String>,
    val hasSensitiveField: Boolean,
    /** The live node behind each id in [summary], so a plan's ids resolve to what the planner saw. */
    val nodes: Map<String, AccessibilityNodeInfo> = emptyMap(),
  )

  fun reduce(rootNode: AccessibilityNodeInfo?): Reduction {
    if (rootNode == null) return Reduction("", emptySet(), false)
    val builder = StringBuilder()
    val nodes = LinkedHashMap<String, AccessibilityNodeInfo>()
    val sensitive = booleanArrayOf(false)
    traverse(rootNode, builder, nodes, sensitive, depth = 0)
    return Reduction(builder.toString().trimEnd(), nodes.keys, sensitive[0], nodes)
  }

  private fun traverse(
    node: AccessibilityNodeInfo,
    builder: StringBuilder,
    nodes: MutableMap<String, AccessibilityNodeInfo>,
    sensitive: BooleanArray,
    depth: Int,
  ) {
    if (depth > maxDepth || nodes.size >= maxNodes) return

    if (isSensitive(node)) sensitive[0] = true

    if (node.isClickable || node.isCheckable || node.isEditable || node.isScrollable) {
      // Resource ids repeat in lists, so a repeat gets a positional id to stay unique.
      val id = node.viewIdResourceName?.takeIf { it.isNotEmpty() && it !in nodes } ?: "n${nodes.size}"
      nodes[id] = node
      builder.append("[id: ").append(id)
      node.text?.takeIf { it.isNotBlank() }
        ?.let { builder.append(" text: '").append(it).append('\'') }
      node.contentDescription?.takeIf { it.isNotBlank() }
        ?.let { builder.append(" desc: '").append(it).append('\'') }
      if (node.isEditable) builder.append(" editable")
      if (node.isScrollable) builder.append(" scrollable")
      builder.append("]\n")
    }

    for (i in 0 until node.childCount) {
      node.getChild(i)?.let { traverse(it, builder, nodes, sensitive, depth + 1) }
    }
  }

  private fun isSensitive(node: AccessibilityNodeInfo): Boolean {
    if (node.isPassword) return true
    val variation = node.inputType and InputType.TYPE_MASK_VARIATION
    return variation == InputType.TYPE_TEXT_VARIATION_PASSWORD ||
      variation == InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD ||
      variation == InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD ||
      variation == InputType.TYPE_NUMBER_VARIATION_PASSWORD
  }
}
