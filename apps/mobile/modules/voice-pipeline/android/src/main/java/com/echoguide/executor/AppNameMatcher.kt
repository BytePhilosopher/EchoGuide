package com.echoguide.executor

object AppNameMatcher {
  /**
   * Index of the launcher label that best matches the spoken app name: an exact match first,
   * then a label that starts with it, then one that contains it. Null when nothing matches.
   */
  fun bestMatch(spoken: String, labels: List<String>): Int? {
    val wanted = normalize(spoken)
    if (wanted.isEmpty()) return null
    val names = labels.map(::normalize)
    return names.indexOfFirst { it == wanted }.takeIf { it >= 0 }
      ?: names.indexOfFirst { it.startsWith(wanted) }.takeIf { it >= 0 }
      ?: names.indexOfFirst { it.contains(wanted) }.takeIf { it >= 0 }
  }

  private fun normalize(name: String): String = name.trim().lowercase().replace(Regex("\\s+"), " ")
}
