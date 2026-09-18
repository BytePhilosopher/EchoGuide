package com.echoguide.accessibility

import android.view.accessibility.AccessibilityNodeInfo

/**
 * Section 5.3 & 13.2 View-Tree Reduction & Node Matching
 * Converts dense Android UI tree into compact tokenized context for planner LLM.
 */
class ViewTreeReducer {
    fun reduceTree(rootNode: AccessibilityNodeInfo?): String {
        if (rootNode == null) return ""
        val builder = StringBuilder()
        traverseAndTokenize(rootNode, builder)
        return builder.toString()
    }

    private fun traverseAndTokenize(node: AccessibilityNodeInfo, builder: StringBuilder) {
        if (node.isClickable || node.isCheckable) {
            builder.append("[id: ${node.viewIdResourceName} text: '${node.text}']\n")
        }
        for (i in 0 until node.childCount) {
            node.getChild(i)?.let { traverseAndTokenize(it, builder) }
        }
    }
}
