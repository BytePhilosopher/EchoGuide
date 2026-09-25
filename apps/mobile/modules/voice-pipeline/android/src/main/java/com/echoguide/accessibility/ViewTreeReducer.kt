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
  )

  fun reduce(rootNode: AccessibilityNodeInfo?): Reduction {
    if (rootNode == null) return Reduction("", emptySet(), false)
    val builder = StringBuilder()
    val ids = LinkedHashSet<String>()
    val sensitive = booleanArrayOf(false)
    traverse(rootNode, builder, ids, sensitive, depth = 0)
    return Reduction(builder.toString().trimEnd(), ids, sensitive[0])
  }

  private fun traverse(
    node: AccessibilityNodeInfo,
    builder: StringBuilder,
    ids: MutableSet<String>,
    sensitive: BooleanArray,
    depth: Int,
  ) {
    if (depth > maxDepth || ids.size >= maxNodes) return

    if (isSensitive(node)) sensitive[0] = true

    if (node.isClickable || node.isCheckable || node.isEditable || node.isScrollable) {
      val id = node.viewIdResourceName?.takeIf { it.isNotEmpty() } ?: "n${ids.size}"
      ids += id
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
      node.getChild(i)?.let { traverse(it, builder, ids, sensitive, depth + 1) }
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
